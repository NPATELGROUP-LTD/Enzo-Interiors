import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { isIP } from 'node:net';

/**
 * The visitor's IP, for everything that keys on it (the throttler, sign-in
 * lockouts).
 *
 * Behind Cloudflare Tunnel, X-Forwarded-For carries whatever the tunnel and
 * Traefik make of it; Cloudflare's own CF-Connecting-IP is the visitor. It is
 * only believed with TRUST_CLOUDFLARE=true, since anyone reaching the API
 * some other way could send the header. Otherwise req.ip, which honours
 * TRUST_PROXY (main.ts).
 *
 * TRUST_CLOUDFLARE=true is only safe when nothing reaches the API except
 * through Cloudflare: no Coolify sslip.io URL and no direct Traefik domain
 * for the API. Any such route lets a caller pick their own IP, and with it
 * dodge every per-IP limit and sign-in lockout.
 */
export function clientIp(req: { ip?: string; headers: Record<string, string | string[] | undefined> }): string {
  if (process.env.TRUST_CLOUDFLARE === 'true') {
    const cf = req.headers['cf-connecting-ip'];
    if (typeof cf === 'string' && isIP(cf.trim())) return cf.trim();
  }
  return req.ip ?? '';
}

/** clientIp(request) as a handler parameter, in place of Nest's @Ip(). */
export const ClientIp = createParamDecorator((_data: unknown, context: ExecutionContext): string =>
  clientIp(context.switchToHttp().getRequest()),
);
