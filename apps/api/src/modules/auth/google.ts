import { randomBytes } from 'node:crypto';

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Logger,
  NotFoundException,
  Post,
  Query,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';

import { CurrentUser, Public } from '../../common/decorators';
import { StaffUser } from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { CacheService } from '../../core/cache';
import { ClientIp } from '../../core/client-ip';
import { RateLimitStore } from '../../core/rate-limit';
import { DatabaseService } from '../../data/database.service';
import { AuthService, LoginResult, digest } from './auth.service';
import { GoogleExchangeDto, GoogleLinkDto } from './dto';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
const TEN_MINUTES = 10 * 60_000;
const FIFTEEN_MINUTES = 15 * 60_000;

/** Null unless all three are set; then the button is hidden and these routes 404. */
function config(): { id: string; secret: string; redirect: string } | null {
  const id = process.env.GOOGLE_CLIENT_ID?.trim();
  const secret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirect = process.env.GOOGLE_AUTH_REDIRECT_URI?.trim();
  return id && secret && redirect ? { id, secret, redirect } : null;
}

function requireConfig(): { id: string; secret: string; redirect: string } {
  const google = config();
  if (!google) throw new NotFoundException('Sign in with Google is not set up.');
  return google;
}

/** Google's `state`, signed by us: which flow, for whom, and a nonce that is spent on return. */
interface State {
  purpose?: string;
  mode?: 'login' | 'link';
  nonce?: string;
  sub?: string;
  tv?: number;
}

/**
 * "Sign in with Google", for accounts that linked a Google account from
 * their Account page first. Sign-in looks people up by Google's stable id
 * (`sub`) only, never by email, and never creates anyone. It skips the
 * two-step code: Google's own sign-in is the second factor.
 *
 * The admin is a SPA on Bearer tokens, so the callback cannot hand it a
 * session directly, and a JWT in a URL ends up in history and logs. It
 * redirects with a one-time code instead (60 seconds, single use), which the
 * login page swaps for a session at POST /auth/google/exchange.
 *
 * ponytail: `state` is signed and single-use but not tied to the browser
 * (no cookie; the SPA and API are different origins). Someone could hand a
 * colleague a link that signs them in as the sender's own linked account;
 * add a cookie-bound state if that ever matters.
 */
@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);
  private readonly adminUrl = (process.env.ADMIN_URL ?? 'http://localhost:5174').replace(/\/+$/, '');

  constructor(
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
    private readonly cache: CacheService,
    private readonly limits: RateLimitStore,
    private readonly auth: AuthService,
  ) {}

  /** Google's sign-in page. For `link`, `staff` is who is linking (password already re-checked). */
  async start(mode: 'login' | 'link', staff?: StaffUser): Promise<{ url: string }> {
    const google = requireConfig();
    const nonce = randomBytes(16).toString('base64url');
    const state = await this.jwt.signAsync(
      { purpose: 'google', mode, nonce, ...(staff ? { sub: staff.id, tv: staff.token_version } : {}) },
      { expiresIn: '10m' },
    );
    const query = new URLSearchParams({
      client_id: google.id,
      redirect_uri: google.redirect,
      response_type: 'code',
      scope: 'openid email',
      prompt: 'select_account',
      state,
      nonce,
    });
    return { url: `${AUTH_URL}?${query}` };
  }

  /** Where Google sends the browser back. Returns the admin page to land on, never a token. */
  async callback(code: unknown, state: unknown): Promise<string> {
    requireConfig();
    let claims: State = {};
    try {
      if (typeof state === 'string') claims = await this.jwt.verifyAsync<State>(state);
    } catch {
      // Expired or forged: claims stay empty.
    }
    const page = claims.mode === 'link' ? '/account' : '/login';
    const fail = (reason: string) => `${this.adminUrl}${page}?google=error&reason=${reason}`;
    if (claims.purpose !== 'google' || !claims.nonce) return fail('expired');
    // Google's error=access_denied (they pressed Cancel) comes back without a code.
    if (typeof code !== 'string' || !code) return fail('cancelled');
    if ((await this.limits.hit(`google:state:${claims.nonce}`, TEN_MINUTES)) !== 1) return fail('expired');

    let identity: { sub: string; email: string };
    try {
      identity = await this.identify(code, claims.nonce);
    } catch (error) {
      this.logger.warn(`Google sign-in failed: ${error instanceof Error ? error.message : String(error)}`);
      return fail('failed');
    }

    const owner = await this.db.staffUsers.findFirstWhere({ google_sub: identity.sub });
    if (claims.mode === 'link') {
      const staff = claims.sub ? await this.db.staffUsers.findById(claims.sub) : null;
      if (!staff || claims.tv !== staff.token_version) return fail('expired');
      if (owner && owner.id !== staff.id) return fail('taken');
      const linked = await this.db.staffUsers
        .update(staff.id, { google_sub: identity.sub, google_email: identity.email, updated_at: new Date().toISOString() })
        .catch(() => null); // the unique index, if someone else linked it a moment ago
      if (!linked) return fail('taken');
      await this.auth.notify(
        staff,
        'Google sign-in added to your Enzo account',
        `Google account ${identity.email} can now sign in to your Enzo Interiors account.`,
      );
      return `${this.adminUrl}/account?google=linked`;
    }

    if (!owner) return `${this.adminUrl}/login?google=not_linked`;
    const handoff = randomBytes(32).toString('base64url');
    await this.cache.set(`google-login:${digest(handoff)}`, { id: owner.id, sub: identity.sub }, 60_000);
    return `${this.adminUrl}/login?google_code=${handoff}`;
  }

  /** POST /auth/google/exchange: the one-time code from the redirect, for a session. */
  async exchange(code: string, ip: string): Promise<LoginResult> {
    const expired = new UnauthorizedException('That Google sign-in has expired. Try again.');
    const key = `google-login:${digest(code)}`;
    const entry = await this.cache.get<{ id: string; sub: string }>(key);
    // hit() is atomic in Redis: of two requests racing with one code, only one sees 1.
    if (!entry || (await this.limits.hit(key, 60_000)) !== 1) throw expired;
    await this.cache.del(key);
    const staff = await this.db.staffUsers.findById(entry.id);
    // Unlinked in the meantime: no.
    if (!staff || staff.google_sub !== entry.sub) throw expired;
    return this.auth.complete(staff, ip);
  }

  /** Allowed with Google switched off, so nobody is stuck with a link they cannot remove. */
  async unlink(principal: AuthPrincipal): Promise<void> {
    await this.db.staffUsers.update(principal.id, { google_sub: null, google_email: null, updated_at: new Date().toISOString() });
  }

  /**
   * Swaps Google's code for the account it signed in. The ID token comes
   * straight from Google's token endpoint over TLS, so its signature need not
   * be checked (OpenID Connect Core 3.1.3.7); its claims still are.
   */
  private async identify(code: string, nonce: string): Promise<{ sub: string; email: string }> {
    const google = requireConfig();
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      body: new URLSearchParams({
        code,
        client_id: google.id,
        client_secret: google.secret,
        redirect_uri: google.redirect,
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => ({}))) as { id_token?: string };
    if (!res.ok || !body.id_token) throw new Error(`Google refused the code (${res.status})`);

    const claims = JSON.parse(Buffer.from(body.id_token.split('.')[1] ?? '', 'base64url').toString('utf8')) as {
      iss?: string;
      aud?: string;
      exp?: number;
      sub?: string;
      email?: string;
      email_verified?: boolean;
      nonce?: string;
    };
    if (
      claims.aud !== google.id ||
      !ISSUERS.includes(claims.iss ?? '') ||
      !((claims.exp ?? 0) * 1000 > Date.now()) ||
      claims.email_verified !== true ||
      claims.nonce !== nonce ||
      !claims.sub ||
      !claims.email
    ) {
      throw new Error('the ID token is not for us, has expired, or its email is unverified');
    }
    return { sub: claims.sub, email: claims.email };
  }
}

@Controller('auth/google')
export class GoogleAuthController {
  constructor(
    private readonly google: GoogleAuthService,
    private readonly auth: AuthService,
  ) {}

  /** So the login page knows whether to show the button. */
  @Public()
  @Get('enabled')
  enabled(): { enabled: boolean } {
    return { enabled: config() !== null };
  }

  /** Sign in: `{ url }` to send the browser to. */
  @Public()
  @Throttle({ default: { limit: 20, ttl: FIFTEEN_MINUTES } })
  @Get('start')
  start() {
    return this.google.start('login');
  }

  /**
   * Link the signed-in account: `{ url }`, as for sign-in. Needs the password
   * again, so a session left open on someone's desk cannot add a way in.
   */
  @Throttle({ default: { limit: 10, ttl: FIFTEEN_MINUTES } })
  @Post('link')
  @HttpCode(200)
  async link(@CurrentUser() principal: AuthPrincipal, @Body() dto: GoogleLinkDto, @ClientIp() ip: string) {
    requireConfig();
    return this.google.start('link', await this.auth.confirmPassword(principal, dto.password, ip));
  }

  /** The registered redirect URI (GOOGLE_AUTH_REDIRECT_URI). Always a redirect to the admin. */
  @Public()
  @Throttle({ default: { limit: 20, ttl: FIFTEEN_MINUTES } })
  @Get('callback')
  async callback(@Query('code') code: unknown, @Query('state') state: unknown, @Res() res: Response): Promise<void> {
    res.redirect(302, await this.google.callback(code, state));
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: FIFTEEN_MINUTES } })
  @Post('exchange')
  @HttpCode(200)
  exchange(@Body() dto: GoogleExchangeDto, @ClientIp() ip: string): Promise<LoginResult> {
    requireConfig();
    return this.google.exchange(dto.code, ip);
  }

  @Throttle({ default: { limit: 10, ttl: FIFTEEN_MINUTES } })
  @Delete()
  @HttpCode(204)
  async unlink(@CurrentUser() principal: AuthPrincipal): Promise<void> {
    await this.google.unlink(principal);
  }
}
