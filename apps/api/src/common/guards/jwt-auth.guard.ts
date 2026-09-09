import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

import { IS_PUBLIC_KEY } from '../decorators';
import { AuthPrincipal, AuthenticatedRequest, JwtPayload } from '../types/principal';

/**
 * Authenticates every request from the bearer token, unless the route is
 * marked @Public().
 *
 * Registered globally in AppModule (APP_GUARD), so a new controller is
 * authenticated by default and has to opt out deliberately. The principal is
 * built ONLY from the verified token signature — no role, client id or staff
 * id is ever read from a request header or body, which is what stops a
 * frontend claiming a role it does not hold.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      // Deliberately opaque: distinguishing "expired" from "bad signature"
      // tells an attacker which half of the token to keep working on.
      throw new UnauthorizedException('Invalid or expired session token');
    }

    const principal: AuthPrincipal = {
      id: payload.sub,
      kind: payload.kind,
      role: payload.role,
      name: payload.name,
      email: payload.email,
    };
    request.principal = principal;
    return true;
  }
}

/** Pull the raw token out of an `Authorization: Bearer <token>` header. */
export function extractBearerToken(request: AuthenticatedRequest): string | null {
  const header = request.headers?.authorization;
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) return null;
  const [scheme, token] = value.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}
