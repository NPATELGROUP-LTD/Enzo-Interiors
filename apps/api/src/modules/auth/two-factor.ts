import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { waitFor } from '../../common/guards/throttle.guard';
import { StaffUser } from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { open, seal } from '../../core/crypto';
import { MailService, templates } from '../../core/mail.service';
import { RateLimitStore } from '../../core/rate-limit';
import { DatabaseService } from '../../data/database.service';
import { AuthService, LoginResult, digest, maskEmail } from './auth.service';
import { base32Decode, base32Encode, totp, totpStep } from './totp';

const CODE_TTL_MS = 10 * 60_000;
const CODE_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60_000;
const SENDS_PER_WINDOW = 3;
const SEND_WINDOW_MS = 15 * 60_000;
const DEVICE_TTL_MS = 30 * 24 * 60 * 60_000;
const RECOVERY_CODES = 10;
const FAIL_CEILING = 20;
const FAIL_WINDOW_MS = 24 * 60 * 60_000;

/** What the password step answers when a code is still needed. */
export type TwoFactorStep =
  | { twoFactor: 'enrol' | 'totp'; challenge: string }
  | { twoFactor: 'email'; challenge: string; emailHint: string };

/** One remembered browser, as the account page lists it. */
export interface DeviceView {
  id: string;
  label: string | null;
  created_at: string;
  last_used_at: string;
  expires_at: string;
}

/**
 * Every two-step field back to "not chosen yet", and the Google link gone: an
 * Admin's reset and the CLI's are for a lost or taken-over account.
 */
export const NO_TWO_FACTOR = {
  two_factor_method: null,
  totp_secret_enc: null,
  totp_confirmed_at: null,
  totp_last_step: null,
  // [] not null: Prisma wants Prisma.DbNull for a JSON null, which services never import.
  recovery_hashes: [],
  login_code_hash: null,
  login_code_expires_at: null,
  login_code_attempts: 0,
  google_sub: null,
  google_email: null,
} satisfies Partial<StaffUser>;

/** "Chrome on Windows", or the user agent itself (cut short) when it is something else. */
export function deviceLabel(userAgent = ''): string | null {
  // Order matters: Edge says Chrome, Chrome says Safari, iPhones say Mac OS, Android says Linux.
  const browser = [['Edg/', 'Edge'], ['Firefox/', 'Firefox'], ['Chrome/', 'Chrome'], ['Safari/', 'Safari']].find(([k]) => userAgent.includes(k!))?.[1];
  const os = [['iPhone', 'iPhone'], ['iPad', 'iPad'], ['Android', 'Android'], ['Windows', 'Windows'], ['Mac OS', 'macOS'], ['Linux', 'Linux']].find(([k]) => userAgent.includes(k!))?.[1];
  if (browser && os) return `${browser} on ${os}`;
  return userAgent.slice(0, 120) || null;
}

/** As people type them: any case, with or without the dash. */
export const normaliseRecovery = (code: string) => code.toLowerCase().replace(/[^a-z0-9]/g, '');

/** "abcd-efgh": 40 random bits each, which the sign-in lockout makes plenty. */
function recoveryCode(): string {
  const raw = base32Encode(randomBytes(5)).toLowerCase();
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

/** The per-account wrong-code counter (attempt()); an Admin's reset clears it. */
export const codeFailuresKey = (staffId: string) => `2fa:fail:${staffId}`;

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * The second step of signing in: a code from email or an authenticator app,
 * chosen once at the first sign-in and fixed after (an Admin can reset it).
 *
 * Between the two steps the browser holds a `challenge`: a 10-minute JWT with
 * purpose "2fa" that names the account and its token_version. JwtAuthGuard
 * refuses anything with a purpose, so it is never a session. A wrong code
 * counts toward the same lockout as a wrong password (AuthService), so the
 * code cannot be guessed faster than the password could.
 *
 * "Remember this device" stores sha256 of a random token for 30 days; the
 * browser sends the token back with its next password. Changing or resetting
 * the password, or an Admin resetting two-step sign-in, forgets them all.
 */
@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
    private readonly limits: RateLimitStore,
    private readonly auth: AuthService,
  ) {
    if (process.env.DISABLE_2FA === 'true') {
      this.logger.warn('DISABLE_2FA=true: staff sign in with a password alone. Never leave this on in production.');
    } else if (!this.mail.enabled) {
      this.logger.warn('SMTP_HOST is unset: two-step sign-in codes will only appear in this log until SMTP_HOST is set.');
    }
  }

  /** After a correct password: a session (2FA off, or a remembered browser), or the next step. */
  async begin(staff: StaffUser, ip: string, deviceToken?: string): Promise<LoginResult | TwoFactorStep> {
    if (process.env.DISABLE_2FA === 'true') return this.auth.complete(staff, ip);
    if (deviceToken && (await this.useDevice(staff, deviceToken))) return this.auth.complete(staff, ip);

    const challenge = await this.jwt.signAsync(
      { sub: staff.id, tv: staff.token_version, purpose: '2fa' },
      { expiresIn: '10m' },
    );
    if (staff.two_factor_method === 'totp') return { twoFactor: 'totp', challenge };
    if (staff.two_factor_method === 'email') {
      await this.sendCode(staff, true);
      return { twoFactor: 'email', challenge, emailHint: maskEmail(staff.email) };
    }
    return { twoFactor: 'enrol', challenge };
  }

  /** POST /auth/admin/verify-code */
  async verify(challenge: string, code: string, ip: string, remember?: boolean, userAgent?: string): Promise<LoginResult> {
    const staff = await this.fromChallenge(challenge);
    if (!staff.two_factor_method) throw new BadRequestException('Choose how to get your codes first.');
    await this.attempt(staff, ip, () =>
      staff.two_factor_method === 'email' ? this.checkEmailCode(staff, code, ip) : this.checkApp(staff, code),
    );
    return this.finish(staff, ip, remember, userAgent);
  }

  /** POST /auth/admin/resend-code: email codes only, and after enrolling by email has started. */
  async resend(challenge: string): Promise<{ emailHint: string }> {
    const staff = await this.fromChallenge(challenge);
    if (staff.two_factor_method === 'totp') throw new BadRequestException('Your codes come from your authenticator app.');
    await this.sendCode(staff);
    return { emailHint: maskEmail(staff.email) };
  }

  /* ---- Enrolment: at the first sign-in, with the challenge, never a session ---- */

  async enrolEmailStart(challenge: string): Promise<{ emailHint: string }> {
    const staff = await this.notEnrolled(challenge);
    await this.sendCode(staff);
    return { emailHint: maskEmail(staff.email) };
  }

  async enrolEmailConfirm(challenge: string, code: string, ip: string, remember?: boolean, userAgent?: string): Promise<LoginResult> {
    const staff = await this.notEnrolled(challenge);
    await this.attempt(staff, ip, () => this.checkEmailCode(staff, code, ip));
    await this.choose(staff, { two_factor_method: 'email' });
    return this.finish(staff, ip, remember, userAgent);
  }

  /**
   * An app is only added after the mailbox is proven: start emails a code,
   * secret checks it and only then makes the secret. totp_secret_enc is
   * written nowhere else, so confirm (which needs a stored secret) cannot be
   * reached with the password alone.
   */
  async enrolAppStart(challenge: string): Promise<{ emailHint: string }> {
    this.assertCanSeal();
    return this.enrolEmailStart(challenge);
  }

  async enrolAppSecret(challenge: string, code: string, ip: string): Promise<{ secret: string; otpauthUrl: string }> {
    // Before the code is spent, so a missing key does not cost the person their code.
    this.assertCanSeal();
    const staff = await this.notEnrolled(challenge);
    await this.attempt(staff, ip, () => this.checkEmailCode(staff, code, ip));
    const secret = base32Encode(randomBytes(20));
    const sealed = seal(secret);
    // Starting again replaces an unconfirmed secret: only the latest QR code works.
    await this.db.staffUsers.update(staff.id, { totp_secret_enc: sealed, totp_confirmed_at: null, totp_last_step: null });
    const label = `Enzo%20Interiors:${encodeURIComponent(staff.email)}`;
    return {
      secret,
      otpauthUrl: `otpauth://totp/${label}?secret=${secret}&issuer=Enzo%20Interiors&period=30&digits=6&algorithm=SHA1`,
    };
  }

  async enrolAppConfirm(challenge: string, code: string, ip: string, remember?: boolean, userAgent?: string): Promise<LoginResult> {
    const staff = await this.notEnrolled(challenge);
    if (!staff.totp_secret_enc) throw new BadRequestException('Confirm the emailed code first, then scan the QR code.');
    await this.attempt(staff, ip, () => this.checkApp(staff, code));
    const codes = Array.from({ length: RECOVERY_CODES }, recoveryCode);
    await this.choose(staff, {
      two_factor_method: 'totp',
      totp_confirmed_at: new Date().toISOString(),
      recovery_hashes: codes.map((c) => digest(normaliseRecovery(c))),
    });
    await this.auth.notify(
      staff,
      'Authenticator app added to your Enzo account',
      'An authenticator app was just set up for signing in to your Enzo Interiors account.',
    );
    return { ...(await this.finish(staff, ip, remember, userAgent)), recoveryCodes: codes };
  }

  /* ---- Remembered devices ---- */

  async devices(principal: AuthPrincipal): Promise<DeviceView[]> {
    const rows = await this.db.trustedDevices.findWhere(
      { staff_user_id: principal.id, expires_at: { gt: new Date().toISOString() } },
      { orderBy: { last_used_at: 'desc' } },
    );
    return rows.map(({ id, label, created_at, last_used_at, expires_at }) => ({ id, label, created_at, last_used_at, expires_at }));
  }

  /** Your own only: someone else's id is "not found", same as a made-up one. */
  async forgetDevice(principal: AuthPrincipal, id: string): Promise<void> {
    const removed = await this.db.trustedDevices.deleteMany((row) => row.id === id && row.staff_user_id === principal.id);
    if (!removed) throw new NotFoundException('That device is not remembered.');
  }

  /* ---- Helpers ---- */

  /** App secrets are sealed with APP_ENCRYPTION_KEY; without it, say so before anything is emailed or spent. */
  private assertCanSeal(): void {
    try {
      seal('');
    } catch (error) {
      this.logger.error(`Cannot enrol an authenticator app: ${error instanceof Error ? error.message : String(error)}`);
      throw new ServiceUnavailableException('Authenticator apps are not set up on this server yet. Use email instead.');
    }
  }

  private async fromChallenge(challenge: string): Promise<StaffUser> {
    const expired = new UnauthorizedException('This sign-in has expired. Sign in again.');
    let claims: { sub?: string; tv?: number; purpose?: string };
    try {
      claims = await this.jwt.verifyAsync(challenge);
    } catch {
      throw expired;
    }
    const staff = claims.purpose === '2fa' && claims.sub ? await this.db.staffUsers.findById(claims.sub) : null;
    // A password change since (token_version) voids the half-finished sign-in too.
    if (!staff || claims.tv !== staff.token_version) throw expired;
    return staff;
  }

  /** Fixed once chosen: switching method is an Admin's reset, not something a challenge can do. */
  private async notEnrolled(challenge: string): Promise<StaffUser> {
    const staff = await this.fromChallenge(challenge);
    if (staff.two_factor_method) throw new BadRequestException('Two-step sign-in is already set up. Sign in again.');
    return staff;
  }

  /** Conditional on still having no method, so two enrolments racing cannot both win. */
  private async choose(staff: StaffUser, patch: Partial<StaffUser>): Promise<void> {
    const changed = await this.db.staffUsers.updateWhere(
      { id: staff.id, two_factor_method: null },
      { ...patch, updated_at: new Date().toISOString() },
    );
    if (changed !== 1) throw new BadRequestException('Two-step sign-in is already set up. Sign in again.');
  }

  /**
   * One guess. Refused while the account is locked, and a miss counts toward
   * the same lock as a wrong password. On top, a ceiling per account: 20
   * wrong codes in 24 hours, from any number of addresses, stop code checks
   * for the rest of the window and email the owner once.
   *
   * The ceiling's counter goes up BEFORE the comparison (an atomic hit), so
   * guesses sent all at once cannot slip in between check and count; a right
   * code clears it. That hands someone with the password a fresh 20 each time
   * the owner signs in: about 1 in 16,000 per 20 app-code guesses, accepted.
   * A password reset does not clear it; an Admin's 2FA reset does.
   */
  private async attempt(staff: StaffUser, ip: string, check: () => Promise<boolean>): Promise<void> {
    const email = staff.email.toLowerCase();
    await this.auth.assertNotLocked(email, ip);
    const key = codeFailuresKey(staff.id);
    const tries = await this.limits.hit(key, FAIL_WINDOW_MS);
    if (tries > FAIL_CEILING) {
      if (tries === FAIL_CEILING + 1) {
        this.logger.warn(`Sign-in codes paused for ${maskEmail(email)} after ${FAIL_CEILING} wrong codes.`);
        await this.auth.notify(
          staff,
          'Wrong sign-in codes on your Enzo account',
          'Several wrong sign-in codes were entered for your Enzo Interiors account, each after the right password, so codes are paused for it for a day. An Admin can reset two-step sign-in sooner.',
        );
      }
      throw new HttpException('Too many wrong codes. Try again later or ask an admin.', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (await check()) {
      await this.limits.clear(key);
      return;
    }
    await this.auth.recordFailure(email, ip);
    throw new BadRequestException('That code is not right. Check it and try again.');
  }

  /**
   * Emails a fresh code, which also resets its attempts. At most 3 per 15
   * minutes per account, so neither the sign-in form nor "resend" can flood
   * an inbox. Past that, resend and enrolment answer 429; the sign-in form
   * still moves on to the code step without sending, and the last code
   * stands if it is still good (else verify says it has expired).
   */
  private async sendCode(staff: StaffUser, fromLogin = false): Promise<void> {
    const key = staff.email.toLowerCase();
    if (!fromLogin) {
      const wait = await this.limits.remaining(`2fa:cooldown:${key}`);
      if (wait > 0) {
        throw new HttpException(`Wait ${waitFor(wait)} before asking for another code.`, HttpStatus.TOO_MANY_REQUESTS);
      }
    }
    if ((await this.limits.hit(`2fa:sent:${key}`, SEND_WINDOW_MS)) > SENDS_PER_WINDOW) {
      if (fromLogin) return;
      throw new HttpException('Too many codes sent. Try again in 15 minutes.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.db.staffUsers.update(staff.id, {
      login_code_hash: digest(code),
      login_code_expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
      login_code_attempts: 0,
    });
    if (!this.mail.enabled) {
      // As for every other email: unset SMTP_HOST = logged, not sent (dev, or a first boot).
      this.logger.warn(`SMTP_HOST is unset, so the sign-in code for ${maskEmail(staff.email)} was not emailed: ${code}`);
    } else if (!(await this.mail.send({ to: staff.email, ...templates.loginCode(staff.name, code) }))) {
      throw new ServiceUnavailableException('We could not email your code. Try again in a minute.');
    }
    await this.limits.set(`2fa:cooldown:${key}`, RESEND_COOLDOWN_MS);
  }

  private async checkEmailCode(staff: StaffUser, code: string, ip: string): Promise<boolean> {
    const used = staff.login_code_attempts ?? 0;
    if (used >= CODE_ATTEMPTS) throw new UnauthorizedException('Too many wrong codes. Sign in again.');
    if (!staff.login_code_hash || !staff.login_code_expires_at || Date.parse(staff.login_code_expires_at) < Date.now()) {
      throw new BadRequestException('That code has expired. Send a new one.');
    }
    // Spend the attempt before comparing, conditionally on the count as read
    // (compare-and-set): of guesses racing on one read, one is compared and
    // the rest are misses. So no code is ever compared more than five times.
    const spent = await this.db.staffUsers.updateWhere(
      { id: staff.id, login_code_hash: staff.login_code_hash, login_code_attempts: used },
      { login_code_attempts: used + 1 },
    );
    if (spent !== 1) return false;
    if (same(digest(code.replace(/\s/g, '')), staff.login_code_hash)) {
      // Conditional on the hash, so the same code sent twice at once works once.
      const burned = await this.db.staffUsers.updateWhere(
        { id: staff.id, login_code_hash: staff.login_code_hash },
        { login_code_hash: null, login_code_expires_at: null, login_code_attempts: 0 },
      );
      return burned === 1;
    }
    if (used + 1 < CODE_ATTEMPTS) return false;
    // The fifth miss burns the code: a new one (sign in again, or resend) is needed.
    await this.db.staffUsers.updateWhere(
      { id: staff.id, login_code_hash: staff.login_code_hash },
      { login_code_hash: null, login_code_expires_at: null },
    );
    await this.auth.recordFailure(staff.email.toLowerCase(), ip);
    throw new UnauthorizedException('Too many wrong codes. Sign in again.');
  }

  /** Six digits from the app (one step either side for clock drift), or a recovery code. */
  private async checkApp(staff: StaffUser, code: string): Promise<boolean> {
    const typed = code.replace(/\s/g, '');
    if (!/^\d{6}$/.test(typed)) return this.useRecoveryCode(staff, typed);
    if (!staff.totp_secret_enc) return false;
    const secret = base32Decode(open(staff.totp_secret_enc));
    const now = totpStep();
    for (const step of [now - 1, now, now + 1]) {
      // A step at or before the last one accepted is a replay, even if the code matches.
      if (step <= (staff.totp_last_step ?? -1) || !same(totp(secret, step), typed)) continue;
      const accepted = await this.db.staffUsers.updateWhere(
        { id: staff.id, OR: [{ totp_last_step: null }, { totp_last_step: { lt: step } }] },
        { totp_last_step: step },
      );
      return accepted === 1;
    }
    return false;
  }

  private async useRecoveryCode(staff: StaffUser, typed: string): Promise<boolean> {
    const hashes = staff.recovery_hashes ?? [];
    const hash = digest(normaliseRecovery(typed));
    if (!hashes.some((stored) => same(stored, hash))) return false;
    // Conditional on the list being as read, so one code cannot be spent twice at once.
    const spent = await this.db.staffUsers.updateWhere(
      { id: staff.id, recovery_hashes: { equals: hashes } },
      { recovery_hashes: hashes.filter((stored) => stored !== hash) },
    );
    if (spent === 1) this.logger.log(`${staff.email} signed in with a recovery code (${hashes.length - 1} left).`);
    return spent === 1;
  }

  private async useDevice(staff: StaffUser, token: string): Promise<boolean> {
    const now = new Date().toISOString();
    const device = await this.db.trustedDevices.findFirstWhere({
      token_hash: digest(token),
      staff_user_id: staff.id,
      expires_at: { gt: now },
    });
    if (!device) return false;
    await this.db.trustedDevices.update(device.id, { last_used_at: now });
    return true;
  }

  private async finish(staff: StaffUser, ip: string, remember?: boolean, userAgent?: string): Promise<LoginResult> {
    const session = await this.auth.complete(staff, ip);
    if (!remember) return session;
    const token = randomBytes(32).toString('base64url');
    const now = Date.now();
    await this.db.trustedDevices.deleteMany((row) => row.staff_user_id === staff.id && Date.parse(row.expires_at) < now);
    await this.db.trustedDevices.create({
      staff_user_id: staff.id,
      token_hash: digest(token),
      label: deviceLabel(userAgent),
      created_at: new Date(now).toISOString(),
      last_used_at: new Date(now).toISOString(),
      expires_at: new Date(now + DEVICE_TTL_MS).toISOString(),
    });
    return { ...session, deviceToken: token };
  }
}
