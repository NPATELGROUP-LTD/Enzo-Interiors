import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { tap } from 'rxjs';

import type { AuthPrincipal } from '../common/types/principal';
import { DatabaseService } from '../data/database.service';
import { maskEmail } from '../modules/auth/auth.service';
import { AlertService } from './alert.service';
import { clientCountry, clientIp } from './client-ip';

/** Routes that return a session because someone just signed in (not a refresh, not a password change). */
const SIGN_IN = /^\/auth\/(portal\/login|admin\/(login|verify-code|enrol\/(email|totp)\/confirm)|google\/exchange)$/;
const LOGIN = /^\/auth\/(portal|admin)\/(login|verify-code)$/;
/** Heartbeats and public error reports: they would bury everything else. */
const QUIET = /^\/(health|alerts\/(browser|web)|auth\/refresh|notifications|push)/;
/** Reads worth remembering: files leaving, exports, and these logs being looked at. */
const READS = /(\/download|\/export)$|^\/(activity-logs|access-log)/;
const HOUR_MS = 60 * 60_000;

type Noted = Request & { principal?: AuthPrincipal; signedIn?: AuthPrincipal };

/** "Chrome · Windows": enough to tell one machine from another, nothing that identifies a person. The raw user agent is not kept. */
export function deviceOf(ua: string | undefined): string | null {
  if (!ua) return null;
  const browser = /Edg(?:e|A|iOS)?\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Firefox\/|FxiOS/.test(ua)
        ? 'Firefox'
        : /Chrome\/|CriOS/.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Other';
  // Android UAs say Linux and iPhone ones say Mac OS X, so those go first.
  const os = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad/.test(ua)
      ? 'iOS'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Macintosh|Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'Other';
  return `${browser} · ${os}`;
}

/**
 * The access log: who signed in, and what changed or was refused, from where.
 *
 * Written when a response finishes (a middleware, so a refusal by a guard or
 * the rate limiter is seen too). Logged: sign-ins, every change (anything but
 * a GET), every 4xx and 5xx, and a few reads (see READS). Not logged: a plain
 * successful GET, unmatched paths, and the heartbeat routes in QUIET.
 * ponytail: add a route to READS to log its reads; a request counter belongs
 * in the Infra stats, not here.
 *
 * Never throws and never waits for the request. Rows go after 90 days.
 */
@Injectable()
export class AccessLogService {
  private readonly logger = new Logger(AccessLogService.name);
  private pruned = 0;
  /** actor + log -> when it was last noted, so paging through a log is one entry, not twenty. */
  private readonly looked = new Map<string, number>();

  constructor(
    private readonly db: DatabaseService,
    private readonly alerts: AlertService,
  ) {}

  middleware = (req: Request, res: Response, next: NextFunction): void => {
    res.on('finish', () => {
      void this.note(req as Noted, res.statusCode).catch((error: unknown) =>
        this.logger.error(`Could not write the access log: ${error instanceof Error ? error.message : String(error)}`),
      );
    });
    next();
  };

  private async note(req: Noted, status: number): Promise<void> {
    const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : null;
    if (!route || req.method === 'OPTIONS' || req.method === 'HEAD' || QUIET.test(route)) return;

    const signedIn = status < 300 && SIGN_IN.test(route) ? req.signedIn : undefined;
    if (!signedIn && req.method === 'GET' && status < 400 && !READS.test(route)) return;

    const who = signedIn ?? req.principal;
    if (req.method === 'GET' && status < 400 && /^\/(activity-logs|access-log)/.test(route)) {
      const key = `${who?.id}|${route}`;
      if (Date.now() - (this.looked.get(key) ?? 0) < 60_000) return;
      if (this.looked.size > 500) this.looked.clear();
      this.looked.set(key, Date.now());
    }
    const typed = typeof req.body?.email === 'string' ? maskEmail(req.body.email.trim().toLowerCase()).slice(0, 80) : null;
    const caller = {
      ip: clientIp(req as never) || null,
      country: clientCountry(req),
      device: deviceOf(req.headers['user-agent']),
    };
    if (signedIn) await this.checkNewSignIn(signedIn, caller);

    await this.db.accessStore.add({
      kind: signedIn ? 'signin' : 'request',
      actor_id: who?.id ?? null,
      actor_kind: who?.kind ?? null,
      // A failed sign-in has no account: keep the address that was typed, masked.
      actor_name: who?.name ?? (LOGIN.test(route) ? typed : null),
      actor_role: who?.role ?? null,
      method: req.method,
      route,
      target_id: typeof req.params?.id === 'string' ? req.params.id.slice(0, 64) : null,
      status,
      ...caller,
    });

    // 429 on a sign-in route: the lockout or the rate limit has just stopped someone.
    if (status === 429 && LOGIN.test(route)) {
      const account = who?.name ?? typed;
      this.alerts.report({
        kind: 'security',
        source: 'api',
        title: `Too many sign-in attempts${account ? ` for ${account}` : ''}. See Settings › Security.`,
        route,
        status,
      });
    }

    if (Date.now() - this.pruned > HOUR_MS) {
      this.pruned = Date.now();
      await this.db.accessStore.prune();
    }
  }

  /** A staff sign-in from a country or device this person has not used in the last 90 days. Their first one has nothing to compare with. */
  private async checkNewSignIn(who: AuthPrincipal, caller: { country: string | null; device: string | null }): Promise<void> {
    if (who.kind !== 'Staff') return;
    const seen = await this.db.accessStore.seen(who.id, caller.country, caller.device);
    if (!seen.total) return;
    const what = [
      caller.country && !seen.country ? `a new country (${caller.country})` : '',
      caller.device && !seen.device ? 'a new device' : '',
    ].filter(Boolean);
    if (what.length) {
      this.alerts.report({
        kind: 'security',
        source: 'api',
        title: `${who.name} signed in from ${what.join(' and ')}. See Settings › Security.`,
        route: '/sign-in',
      });
    }
  }
}

/** Notes who signed in on the request, so the access log (which sees only the response) can say who it was. */
@Injectable()
export class SignInNote implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<Noted>();
    return next.handle().pipe(
      tap((result: { access_token?: string; user?: AuthPrincipal } | undefined) => {
        if (result?.access_token && result.user) req.signedIn = result.user;
      }),
    );
  }
}
