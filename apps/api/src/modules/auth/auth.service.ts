import { createHash, randomBytes } from 'node:crypto';

import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

import { StaffUser, TwoFactorMethod } from '../../common/types/domain';
import { AuthPrincipal, JwtPayload } from '../../common/types/principal';
import { waitFor } from '../../common/guards/throttle.guard';
import { MailService, templates } from '../../core/mail.service';
import { RateLimitStore } from '../../core/rate-limit';
import { DatabaseService } from '../../data/database.service';

export interface LoginResult {
  access_token: string;
  user: AuthPrincipal;
  /** Set when "remember this device" was ticked: send it back as deviceToken on the next sign-in. */
  deviceToken?: string;
  /** Set once, when an authenticator app is enrolled. */
  recoveryCodes?: string[];
}

export interface Me extends AuthPrincipal {
  twoFactorMethod: TwoFactorMethod | null;
  googleLinked: boolean;
  googleEmail: string | null;
}

/** Work factor for new hashes. 12 is ~250ms on commodity hardware in 2026. */
export const BCRYPT_ROUNDS = 12;

/** Hash a new password. The only place a password becomes a stored value. */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/**
 * A bcrypt hash, as opposed to the plaintext the prototype used to store.
 *
 * Kept so that a database seeded before the migration fails closed rather than
 * silently comparing a password against a plaintext column.
 */
export function looksHashed(value: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(value);
}

/**
 * Constant-time password check.
 *
 * A stored value that is not a bcrypt hash is treated as a failure, never as
 * something to compare directly. bcrypt.compare is still run against a dummy
 * hash in that case so a legacy row does not answer faster than a real one and
 * leak which accounts have been migrated. Same for an unknown email.
 */
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.6jcJmTR9Qh5tVlM8Hq2FQvVQZQjvOxq';

export async function verify(plain: string, stored: string | undefined): Promise<boolean> {
  if (!stored || !looksHashed(stored)) {
    await bcrypt.compare(plain, DUMMY_HASH);
    return false;
  }
  return bcrypt.compare(plain, stored);
}

/** n***@outlook.com: enough to recognise your own inbox, not enough to learn someone's. Also for logs. */
export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  return `${local.slice(0, 1)}***@${domain}`;
}

/** The reset token is emailed; only this digest of it is stored. */
export function digest(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Sign-in lockout. Per address+IP it is progressive: every 5 failures within
 * the hour lock that pair for longer (1 minute, 15 minutes, then an hour).
 * Per address alone there is a ceiling, for guessing spread across many IPs:
 * 50 failures within the hour lock the account for 15 minutes from anywhere.
 * A password reset (which proves the mailbox) lifts it.
 */
const FAILURES_PER_STEP = 5;
const LOCK_STEPS = [60_000, 15 * 60_000, 60 * 60_000];
const FAILURE_WINDOW = 60 * 60_000;
const ACCOUNT_FAILURES = 50;
const ACCOUNT_LOCK = 15 * 60_000;
const RESET_TTL_MS = 30 * 60 * 1000;

/**
 * Staff authentication: sign-in, password change, and reset by email. The
 * second step of sign-in is two-factor.ts; Google is google.ts.
 *
 * Every token carries the account's `token_version`, and JwtAuthGuard refuses
 * one that no longer matches. Changing or resetting a password bumps it, which
 * is what signs out every other session.
 */
@Injectable()
export class AuthService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AuthService.name);
  private readonly adminUrl = (process.env.ADMIN_URL ?? 'http://localhost:5174').replace(/\/+$/, '');

  constructor(
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
    private readonly limits: RateLimitStore,
  ) {}

  /**
   * Creates the first administrator on a fresh database.
   *
   * Only when there are no staff rows at all, and only from ADMIN_EMAIL /
   * ADMIN_PASSWORD. It never touches an existing account, so leaving the
   * variables set after the first boot is harmless.
   */
  async onApplicationBootstrap(): Promise<void> {
    if ((await this.db.staffUsers.count()) > 0) return;

    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD ?? '';
    if (!email || password.length < 12) {
      this.logger.warn(
        'No staff accounts exist, so nobody can sign in to the admin. Set ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters, then restart the API.',
      );
      return;
    }

    const now = new Date().toISOString();
    await this.db.staffUsers.create({
      name: process.env.ADMIN_NAME?.trim() || 'Administrator',
      email,
      password_hash: await hashPassword(password),
      role: 'Admin',
      token_version: 0,
      reset_token_hash: null,
      reset_expires_at: null,
      created_at: now,
      updated_at: now,
    });
    this.logger.log(`Created the first administrator, ${email}. Change the password after signing in.`);
  }

  /* ---- Lockout ---- */

  // Keyed on IP + address as well as address alone: keyed only on the
  // address, anyone could lock the owner out by typing their email wrong five
  // times from anywhere. The address-wide ceiling is ten times higher.

  /** Also before a two-step code: guessing those locks the account the same way. */
  async assertNotLocked(email: string, ip: string): Promise<void> {
    const wait = Math.max(
      await this.limits.remaining(`login:lock:${ip}|${email}`),
      await this.limits.remaining(`login:lock:${email}`),
    );
    if (wait > 0) {
      throw new HttpException(`Too many attempts. Try again in ${waitFor(wait)}.`, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  async recordFailure(email: string, ip: string): Promise<void> {
    const pair = await this.limits.hit(`login:fail:${ip}|${email}`, FAILURE_WINDOW);
    if (pair % FAILURES_PER_STEP === 0) {
      const step = Math.min(pair / FAILURES_PER_STEP, LOCK_STEPS.length) - 1;
      await this.limits.set(`login:lock:${ip}|${email}`, LOCK_STEPS[step]!);
    }
    if ((await this.limits.hit(`login:fail:${email}`, FAILURE_WINDOW)) >= ACCOUNT_FAILURES) {
      await this.limits.set(`login:lock:${email}`, ACCOUNT_LOCK);
      this.logger.warn(`Sign-in for ${email} locked for 15 minutes after repeated failures from several addresses.`);
    }
  }

  /** A reset proves ownership of the address: lifts its lock, and the resetting IP's. */
  private clearLocks(email: string, ip: string): Promise<void> {
    return this.limits.clear(
      `login:lock:${email}`,
      `login:fail:${email}`,
      `login:lock:${ip}|${email}`,
      `login:fail:${ip}|${email}`,
    );
  }

  private findByEmail(email: string): Promise<StaffUser | null> {
    const key = email.trim().toLowerCase();
    return this.db.staffUsers.findOne((row) => row.email.toLowerCase() === key);
  }

  /* ---- Endpoints ---- */

  /**
   * POST /auth/admin/login, the password half. The pair's failure count is
   * only cleared once the second step passes too (complete()), so a known
   * password cannot be used to reset the count between code guesses.
   */
  async checkPassword(email: string, password: string, ip: string): Promise<StaffUser> {
    const address = email.trim().toLowerCase();
    // So ops can check, behind Cloudflare, that lockouts key on the visitor.
    this.logger.debug(`Sign-in attempt for ${maskEmail(address)} from ${ip}`);
    await this.assertNotLocked(address, ip);

    const staff = await this.findByEmail(address);
    if (!staff || !(await verify(password, staff.password_hash))) {
      await this.recordFailure(address, ip);
      // One message for "no such account" and "wrong password" alike, so this
      // endpoint cannot be used to find out which addresses are registered.
      throw new UnauthorizedException('Incorrect email or password');
    }
    return staff;
  }

  /**
   * Re-entering your password while signed in (linking Google). A wrong one
   * counts toward the lockout like a wrong sign-in. 400, not 401: a 401 would
   * end the session the admin is using.
   */
  async confirmPassword(principal: AuthPrincipal, password: string, ip: string): Promise<StaffUser> {
    const email = principal.email.toLowerCase();
    await this.assertNotLocked(email, ip);
    const staff = await this.db.staffUsers.findById(principal.id);
    if (!staff || !(await verify(password, staff.password_hash))) {
      await this.recordFailure(email, ip);
      throw new BadRequestException('Your password is not correct.');
    }
    return staff;
  }

  /** Signed in, by whichever route: password (+ code), a remembered device, or Google. */
  async complete(staff: StaffUser, ip: string): Promise<LoginResult> {
    await this.limits.clear(`login:fail:${ip}|${staff.email.toLowerCase()}`);
    return this.issue(staff);
  }

  /** Tells the account's owner that how it signs in changed, with the way back if it wasn't them. */
  async notify(staff: StaffUser, subject: string, message: string): Promise<void> {
    const sent = await this.mail.send({
      to: staff.email,
      ...templates.securityNotice(staff.name, subject, message, `${this.adminUrl}/forgot-password`),
    });
    if (!sent) this.logger.warn(`Could not send "${subject}" to ${maskEmail(staff.email)}.`);
  }

  /** GET /auth/me: who I am, and how I sign in. Never a secret or a hash. */
  async me(principal: AuthPrincipal): Promise<Me> {
    const staff = await this.db.staffUsers.findById(principal.id);
    return {
      ...principal,
      twoFactorMethod: staff?.two_factor_method ?? null,
      googleLinked: Boolean(staff?.google_sub),
      googleEmail: staff?.google_email ?? null,
    };
  }

  /** PUT /auth/password — signs out every other session and returns a fresh token for this one. */
  async changePassword(
    principal: AuthPrincipal,
    currentPassword: string,
    newPassword: string,
  ): Promise<LoginResult> {
    const staff = await this.db.staffUsers.findById(principal.id);
    if (!staff || !(await verify(currentPassword, staff.password_hash))) {
      throw new BadRequestException('Your current password is not correct.');
    }
    const updated = await this.setPassword(staff, newPassword);
    return this.issue(updated);
  }

  /**
   * POST /auth/admin/forgot-password.
   *
   * Always answers the same way, whether or not the address has an account,
   * so it cannot be used to discover which addresses do.
   */
  async forgotPassword(email: string): Promise<void> {
    const staff = await this.findByEmail(email);
    if (!staff) return;
    // Three reset emails an hour per address, from anywhere: the form cannot
    // be used to flood someone's inbox. Answered the same way either way.
    if ((await this.limits.hit(`forgot:${staff.email.toLowerCase()}`, 60 * 60_000)) > 3) return;

    const token = randomBytes(32).toString('base64url');
    await this.db.staffUsers.update(staff.id, {
      reset_token_hash: digest(token),
      reset_expires_at: new Date(Date.now() + RESET_TTL_MS).toISOString(),
    });
    // In the fragment, not the query: a fragment is never sent to a server,
    // so the token stays out of access logs and Referer headers.
    const link = `${this.adminUrl}/reset-password#token=${token}`;
    const sent = await this.mail.send({ to: staff.email, ...templates.passwordReset(staff.name, link) });
    if (!sent) this.logger.warn(`Password reset requested for ${staff.email} but no email could be sent.`);
  }

  /** POST /auth/admin/reset-password */
  async resetPassword(token: string, newPassword: string, ip: string): Promise<void> {
    const hash = digest(token);
    const staff = await this.db.staffUsers.findOne((row) => row.reset_token_hash === hash);
    if (!staff || !staff.reset_expires_at || Date.parse(staff.reset_expires_at) < Date.now()) {
      throw new BadRequestException('This reset link has expired or was already used. Ask for a new one.');
    }
    await this.setPassword(staff, newPassword);
    await this.clearLocks(staff.email.toLowerCase(), ip);
  }

  /** Stores the new hash, burns any reset token, and signs every session out. */
  private async setPassword(staff: StaffUser, newPassword: string): Promise<StaffUser> {
    const updated = await this.db.staffUsers.update(staff.id, {
      password_hash: await hashPassword(newPassword),
      token_version: staff.token_version + 1,
      reset_token_hash: null,
      reset_expires_at: null,
      // A reset is how someone recovers a taken-over account: whatever the
      // intruder linked goes with the old password.
      google_sub: null,
      google_email: null,
      updated_at: new Date().toISOString(),
    });
    // Remembered devices go with the old password: they skip two-step sign-in.
    await this.db.trustedDevices.deleteMany((row) => row.staff_user_id === staff.id);
    // Accepting an invitation sets the first password; nothing was "changed".
    if (looksHashed(staff.password_hash)) {
      await this.mail.send({
        to: staff.email,
        ...templates.passwordChanged(staff.name, `${this.adminUrl}/forgot-password`),
      });
    }
    return updated ?? staff;
  }

  /** PUT /auth/profile — your own name. The email is the sign-in, so an admin changes that. */
  async updateProfile(principal: AuthPrincipal, name: string): Promise<AuthPrincipal> {
    const updated = await this.db.staffUsers.update(principal.id, {
      name: name.trim(),
      updated_at: new Date().toISOString(),
    });
    if (!updated) throw new UnauthorizedException('Your account no longer exists.');
    return { ...principal, name: updated.name };
  }

  private async issue(staff: StaffUser): Promise<LoginResult> {
    const user: AuthPrincipal = {
      id: staff.id,
      kind: 'Staff',
      role: staff.role,
      name: staff.name,
      email: staff.email,
    };
    const payload: JwtPayload = {
      sub: staff.id,
      kind: 'Staff',
      role: staff.role,
      name: staff.name,
      email: staff.email,
      tv: staff.token_version,
    };
    return { access_token: await this.jwt.signAsync(payload), user };
  }
}
