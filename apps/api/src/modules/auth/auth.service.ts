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

import { StaffUser } from '../../common/types/domain';
import { AuthPrincipal, JwtPayload } from '../../common/types/principal';
import { MailService, templates } from '../../core/mail.service';
import { DatabaseService } from '../../data/database.service';

export interface LoginResult {
  access_token: string;
  user: AuthPrincipal;
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

/** The reset token is emailed; only this digest of it is stored. */
export function digest(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Failed sign-ins allowed per address+IP before that pair is locked for LOCK_MS. */
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;
const RESET_TTL_MS = 30 * 60 * 1000;

/**
 * Staff authentication: sign-in, password change, and reset by email.
 *
 * Every token carries the account's `token_version`, and JwtAuthGuard refuses
 * one that no longer matches. Changing or resetting a password bumps it, which
 * is what signs out every other session.
 */
@Injectable()
export class AuthService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AuthService.name);
  // ponytail: in-memory and per-process, so it resets on restart and is not
  // shared between replicas. v1 runs one API container; move this to the
  // database or Redis if that changes. The throttler caps attempts per IP on
  // top of this.
  private readonly failures = new Map<string, { count: number; since: number; lockedUntil: number }>();
  private readonly adminUrl = (process.env.ADMIN_URL ?? 'http://localhost:5174').replace(/\/+$/, '');

  constructor(
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
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

  /**
   * Keyed on IP + address, not address alone: keyed on the address, anyone
   * could lock the owner out of their own admin by typing their email wrong
   * five times from anywhere.
   */
  private lockKey(email: string, ip: string): string {
    return `${ip}|${email}`;
  }

  private assertNotLocked(key: string): void {
    const entry = this.failures.get(key);
    if (!entry?.lockedUntil) return;
    if (entry.lockedUntil > Date.now()) {
      const minutes = Math.ceil((entry.lockedUntil - Date.now()) / 60_000);
      throw new HttpException(
        `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.failures.delete(key);
  }

  private recordFailure(key: string): void {
    const now = Date.now();
    if (this.failures.size > 1000) {
      for (const [k, e] of this.failures) {
        if ((e.lockedUntil || e.since + LOCK_MS) < now) this.failures.delete(k);
      }
    }
    const previous = this.failures.get(key);
    const count = (previous?.count ?? 0) + 1;
    this.failures.set(key, {
      count,
      since: previous?.since ?? now,
      lockedUntil: count >= MAX_FAILURES ? now + LOCK_MS : 0,
    });
  }

  /** A reset proves ownership of the address, so it clears its locks everywhere. */
  private clearLocks(email: string): void {
    for (const key of this.failures.keys()) {
      if (key.endsWith(`|${email}`)) this.failures.delete(key);
    }
  }

  private findByEmail(email: string): Promise<StaffUser | null> {
    const key = email.trim().toLowerCase();
    return this.db.staffUsers.findOne((row) => row.email.toLowerCase() === key);
  }

  /* ---- Endpoints ---- */

  /** POST /auth/admin/login */
  async loginStaff(email: string, password: string, ip: string): Promise<LoginResult> {
    const address = email.trim().toLowerCase();
    const key = this.lockKey(address, ip);
    this.assertNotLocked(key);

    const staff = await this.findByEmail(address);
    if (!staff || !(await verify(password, staff.password_hash))) {
      this.recordFailure(key);
      // One message for "no such account" and "wrong password" alike, so this
      // endpoint cannot be used to find out which addresses are registered.
      throw new UnauthorizedException('Incorrect email or password');
    }
    this.failures.delete(key);
    return this.issue(staff);
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
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const hash = digest(token);
    const staff = await this.db.staffUsers.findOne((row) => row.reset_token_hash === hash);
    if (!staff || !staff.reset_expires_at || Date.parse(staff.reset_expires_at) < Date.now()) {
      throw new BadRequestException('This reset link has expired or was already used. Ask for a new one.');
    }
    await this.setPassword(staff, newPassword);
    this.clearLocks(staff.email.toLowerCase());
  }

  /** Stores the new hash, burns any reset token, and signs every session out. */
  private async setPassword(staff: StaffUser, newPassword: string): Promise<StaffUser> {
    const updated = await this.db.staffUsers.update(staff.id, {
      password_hash: await hashPassword(newPassword),
      token_version: staff.token_version + 1,
      reset_token_hash: null,
      reset_expires_at: null,
      updated_at: new Date().toISOString(),
    });
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
