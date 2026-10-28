import { createHash, randomBytes, randomInt } from 'node:crypto';

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

import { Client, StaffUser, TwoFactorMethod } from '../../common/types/domain';
import { AuthPrincipal, JwtPayload } from '../../common/types/principal';
import { waitFor } from '../../common/guards/throttle.guard';
import { MailService, templates } from '../../core/mail.service';
import { RateLimitStore } from '../../core/rate-limit';
import { DatabaseService } from '../../data/database.service';

export interface LoginResult {
  access_token: string;
  /** A client also learns whether they are still on the emailed password (the portal then offers to change it). */
  user: AuthPrincipal & { passwordIsDefault?: boolean };
  /** Set when "remember this device" was ticked: send it back as deviceToken on the next sign-in. */
  deviceToken?: string;
  /** Set once, when an authenticator app is enrolled. */
  recoveryCodes?: string[];
}

export interface Me extends AuthPrincipal {
  /** Clients only. */
  passwordIsDefault?: boolean;
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

/** Letters and digits without look-alikes (no 0/O, 1/l/I), so it can be read from an email and typed. */
const PASSWORD_SETS = ['abcdefghjkmnpqrstuvwxyz', 'ABCDEFGHJKLMNPQRSTUVWXYZ', '23456789'];

/**
 * A random password for a portal invitation: `length` characters from crypto, at least one of
 * each set, shuffled. 14 characters of 57 is about 80 bits. Never logged; only emailed.
 */
export function generatePassword(length = 14): string {
  const all = PASSWORD_SETS.join('');
  const chars = [
    ...PASSWORD_SETS.map((set) => set[randomInt(set.length)]!),
    ...Array.from({ length: length - PASSWORD_SETS.length }, () => all[randomInt(all.length)]!),
  ];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join('');
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
/** Longest a session can be kept alive by refreshing: what one token used to last. */
const SESSION_MAX_SECONDS = 12 * 60 * 60;

/**
 * The purpose of a portal set-password link. The link is a JWT naming the
 * client and their token_version; setting the password bumps token_version, so
 * a link works once, dies with any later reset, and signs out every portal
 * session. JwtAuthGuard refuses any token with a purpose, so it is never a
 * session. No reset columns on clients: the signature is the record.
 */
const PORTAL_PASSWORD = 'portal-password';

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
  private readonly portalUrl = (process.env.PORTAL_URL ?? 'http://localhost:5175').replace(/\/+$/, '');

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
      this.logger.warn(`Sign-in for ${maskEmail(email)} locked for 15 minutes after repeated failures from several addresses.`);
    }
  }

  // A password reset deliberately does NOT lift a lockout: it would be a way
  // round the rate limit. Locks only expire with time.

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
   * POST /auth/portal/login. Same lockout and same single message as staff
   * sign-in, keyed apart (`client:` prefix) so a client's mistyped password
   * never locks a staff account with the same address, or the reverse. An
   * inactive client gets the same answer as a wrong password. No second step
   * for clients yet.
   */
  async portalLogin(email: string, password: string, ip: string): Promise<LoginResult> {
    const address = email.trim().toLowerCase();
    const key = `client:${address}`;
    await this.assertNotLocked(key, ip);

    const client = await this.db.clients.findFirstWhere({ email: { equals: address, mode: 'insensitive' } });
    // verify() runs bcrypt even with no row, so a missing account is not faster.
    const ok = await verify(password, client?.password_hash);
    if (!client || !ok || client.status !== 'Active') {
      await this.recordFailure(key, ip);
      throw new UnauthorizedException('Incorrect email or password');
    }
    await this.limits.clear(`login:fail:${ip}|${key}`);
    return this.issueClient(client);
  }

  /** A portal session for this client at their current token_version. */
  private async issueClient(client: Client): Promise<LoginResult> {
    const user = {
      id: client.id,
      kind: 'Client' as const,
      role: 'Client' as const,
      name: client.name,
      email: client.email,
      passwordIsDefault: Boolean(client.password_is_default),
    };
    const payload: JwtPayload = {
      sub: client.id,
      kind: 'Client',
      role: 'Client',
      name: client.name,
      email: client.email,
      tv: client.token_version ?? 0,
    };
    return { access_token: await this.jwt.signAsync(payload), user };
  }

  /**
   * PUT /account/password for a signed-in client. A wrong current password
   * counts toward the same lockout as a wrong sign-in (a stolen token must not
   * be a free password oracle). Bumps token_version in one conditional UPDATE,
   * so every other portal session, and the token used to ask, stop working;
   * the answer is a fresh session.
   */
  async changeClientPassword(principal: AuthPrincipal, currentPassword: string, newPassword: string, ip: string): Promise<LoginResult> {
    const client = await this.db.clients.findById(principal.id);
    if (!client) throw new UnauthorizedException('Invalid or expired session token');
    const key = `client:${client.email.toLowerCase()}`;
    await this.assertNotLocked(key, ip);
    if (!(await verify(currentPassword, client.password_hash))) {
      await this.recordFailure(key, ip);
      throw new BadRequestException('Your current password is not correct.');
    }
    const version = client.token_version ?? 0;
    const changed = await this.db.clients.updateWhere(
      { id: client.id, token_version: version },
      {
        password_hash: await hashPassword(newPassword),
        password_is_default: false,
        token_version: version + 1,
        updated_at: new Date().toISOString(),
      },
    );
    if (changed !== 1) throw new BadRequestException('Your password was just changed elsewhere. Please sign in again.');
    await this.mail.send({ to: client.email, ...templates.passwordChanged(client.name, `${this.portalUrl}/forgot-password`) });
    return this.issueClient({ ...client, password_is_default: false, token_version: version + 1 });
  }

  /** POST /account/password/keep: the client chose to keep the emailed password, so stop asking. */
  async keepClientPassword(principal: AuthPrincipal): Promise<void> {
    await this.db.clients.updateWhere({ id: principal.id, password_is_default: true }, { password_is_default: false });
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
    if (principal.kind === 'Client') {
      const client = await this.db.clients.findById(principal.id);
      return { ...principal, passwordIsDefault: Boolean(client?.password_is_default), twoFactorMethod: null, googleLinked: false, googleEmail: null };
    }
    const staff = await this.db.staffUsers.findById(principal.id);
    return {
      ...principal,
      twoFactorMethod: staff?.two_factor_method ?? null,
      googleLinked: Boolean(staff?.google_sub),
      googleEmail: staff?.google_email ?? null,
    };
  }

  /**
   * PUT /auth/password — signs out every other session and returns a fresh token for this one.
   * A wrong current password counts toward the lockout like a wrong sign-in:
   * a stolen session must not be a free oracle for the password.
   */
  async changePassword(
    principal: AuthPrincipal,
    currentPassword: string,
    newPassword: string,
    ip: string,
  ): Promise<LoginResult> {
    const email = principal.email.toLowerCase();
    await this.assertNotLocked(email, ip);
    const staff = await this.db.staffUsers.findById(principal.id);
    if (!staff || !(await verify(currentPassword, staff.password_hash))) {
      await this.recordFailure(email, ip);
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
    const address = email.trim().toLowerCase();
    // Three reset emails an hour per address, from anywhere: the form cannot
    // be used to flood someone's inbox. Counted before the lookup, so the
    // answer and its timing are the same for every address.
    if ((await this.limits.hit(`forgot:${address}`, 60 * 60_000)) > 3) return;
    const staff = await this.findByEmail(address);
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
    if (!sent) this.logger.warn(`Password reset requested for ${maskEmail(staff.email)} but no email could be sent.`);
  }

  /** The staff row this live reset/invite token belongs to, or null (unknown, expired or already used). */
  private async staffForToken(token: string): Promise<StaffUser | null> {
    const hash = digest(token);
    const staff = await this.db.staffUsers.findOne((row) => row.reset_token_hash === hash);
    return staff?.reset_expires_at && Date.parse(staff.reset_expires_at) >= Date.now() ? staff : null;
  }

  /** POST /auth/admin/reset-password/check: is this link still good? Lets the page say so before a password is typed. */
  async resetLinkValid(token: string): Promise<boolean> {
    return (await this.staffForToken(token)) !== null;
  }

  /** POST /auth/admin/reset-password */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const expired = () => new BadRequestException('This link has expired or was already used. Ask for a new one.');
    const staff = await this.staffForToken(token);
    if (!staff) throw expired();
    // Claim the token in one conditional UPDATE: two requests racing with the
    // same link cannot both win.
    const claimed = await this.db.staffUsers.updateWhere(
      { id: staff.id, reset_token_hash: digest(token) },
      { reset_token_hash: null, reset_expires_at: null },
    );
    if (claimed !== 1) throw expired();
    await this.setPassword(staff, newPassword);
  }

  /* ---- Portal passwords: invite, forgot, reset ---- */

  /** The client's one-time set-password link. In the fragment, like the staff one. */
  private async portalLink(client: Client, expiresIn: '30m' | '7d', invite: boolean): Promise<string> {
    const token = await this.jwt.signAsync(
      { sub: client.id, tv: client.token_version ?? 0, purpose: PORTAL_PASSWORD },
      { expiresIn },
    );
    return `${this.portalUrl}/reset-password#token=${token}${invite ? '&invite=1' : ''}`;
  }

  /**
   * POST /clients/:id/invite: gives the client a generated password and emails it with the sign-in
   * address. Resending replaces it. The hash is stored in one conditional UPDATE that also bumps
   * token_version, so two invites racing cannot both win and any older link or session dies.
   * The caller decides who may be invited. The password is never logged.
   */
  async sendPortalInvite(client: Client, inviter: string): Promise<boolean> {
    if ((await this.limits.hit(`invite:client:${client.id}`, 60 * 60_000)) > 5) {
      throw new HttpException('This client was invited several times in the last hour. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const password = generatePassword();
    const version = client.token_version ?? 0;
    const stored = await this.db.clients.updateWhere(
      { id: client.id, token_version: version },
      {
        password_hash: await hashPassword(password),
        password_is_default: true,
        token_version: version + 1,
        updated_at: new Date().toISOString(),
      },
    );
    if (stored !== 1) throw new BadRequestException('This client was just changed elsewhere. Please try again.');
    const sent = await this.mail.send({ to: client.email, ...templates.portalInvite(client.name, inviter, `${this.portalUrl}/login`, password) });
    if (!sent) this.logger.warn(`Portal invitation for ${maskEmail(client.email)} could not be emailed.`);
    return sent;
  }

  /**
   * POST /auth/portal/forgot. Silent unless the address is an active client
   * who already has a portal password: forgetting one is not a way to get one
   * (that is the Admin's invitation). Same answer either way.
   */
  async forgotPortalPassword(email: string): Promise<void> {
    const address = email.trim().toLowerCase();
    // Counted before the lookup: same answer and timing for every address.
    if ((await this.limits.hit(`forgot:client:${address}`, 60 * 60_000)) > 3) return;
    const client = await this.db.clients.findFirstWhere({ email: { equals: address, mode: 'insensitive' } });
    if (!client || client.status !== 'Active' || !looksHashed(client.password_hash)) return;

    const link = await this.portalLink(client, '30m', false);
    const sent = await this.mail.send({ to: client.email, ...templates.passwordReset(client.name, link) });
    if (!sent) this.logger.warn(`Portal reset requested for ${maskEmail(client.email)} but no email could be sent.`);
  }

  /** The client a live portal link belongs to, or null: bad signature, expired, wrong purpose, or already used (token_version moved on). */
  private async portalLinkOwner(token: string): Promise<{ client: Client; tv: number } | null> {
    let claims: { sub?: string; tv?: number; purpose?: string };
    try {
      claims = await this.jwt.verifyAsync(token);
    } catch {
      return null;
    }
    if (claims.purpose !== PORTAL_PASSWORD || !claims.sub || typeof claims.tv !== 'number') return null;
    const client = await this.db.clients.findById(claims.sub);
    if (!client || client.status !== 'Active' || (client.token_version ?? 0) !== claims.tv) return null;
    return { client, tv: claims.tv };
  }

  /** POST /auth/portal/reset/check: is this link still good? No side effects. */
  async portalLinkValid(token: string): Promise<boolean> {
    return (await this.portalLinkOwner(token)) !== null;
  }

  /** POST /auth/portal/reset: the invitation and the forgotten password both land here. */
  async resetPortalPassword(token: string, newPassword: string): Promise<void> {
    const expired = () => new BadRequestException('This link has expired or was already used. Ask for a new one.');
    const owner = await this.portalLinkOwner(token);
    if (!owner) throw expired();
    const { client, tv } = owner;

    // Conditional on the version the link was signed with, in one UPDATE, so
    // two requests racing with the same link cannot both win.
    const changed = await this.db.clients.updateWhere(
      { id: client.id, token_version: tv },
      { password_hash: await hashPassword(newPassword), password_is_default: false, token_version: tv + 1, updated_at: new Date().toISOString() },
    );
    if (changed !== 1) throw expired();
    // Accepting an invitation sets the first password; nothing was "changed".
    if (looksHashed(client.password_hash)) {
      await this.mail.send({
        to: client.email,
        ...templates.passwordChanged(client.name, `${this.portalUrl}/forgot-password`),
      });
    }
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

  /**
   * A fresh short-lived token for a still-valid one, so the SPAs can keep a
   * session alive without a long-lived token sitting in localStorage. The
   * sign-in time (`at`) is carried through, and a session older than
   * SESSION_MAX_SECONDS is refused: a stolen token cannot be renewed forever.
   * `principal` is already re-read from the database by the guard, and `tv`
   * was checked against it there, so a revoked session never gets here.
   */
  async refresh(principal: AuthPrincipal, token: string): Promise<LoginResult> {
    let old: JwtPayload;
    try {
      old = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired session token');
    }
    const at = old.at ?? old.iat ?? 0;
    if (Date.now() / 1000 - at > SESSION_MAX_SECONDS) {
      throw new UnauthorizedException('Your session has expired. Please sign in again.');
    }
    const { id, kind, role, name, email } = principal;
    const payload: JwtPayload = { sub: id, kind, role, name, email, tv: old.tv, at };
    return { access_token: await this.jwt.signAsync(payload), user: principal };
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
