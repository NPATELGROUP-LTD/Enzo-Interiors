import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

import { DatabaseService } from '../../data/database.service';
import { IS_PUBLIC_KEY } from '../decorators';
import { AuthPrincipal, AuthenticatedRequest, JwtPayload } from '../types/principal';

/**
 * Authenticates every request from the bearer token, unless the route is
 * marked @Public().
 *
 * Registered globally in AppModule (APP_GUARD), so a new controller is
 * authenticated by default and has to opt out deliberately. The principal is
 * built from the database row the verified token names, never from a request
 * header or body, which is what stops a frontend claiming a role it does not
 * hold.
 *
 * The row is re-read on every request so a token dies with its account: a
 * deleted user, a changed role or a password change (which bumps
 * token_version) all take effect immediately instead of when the JWT expires.
 * One primary-key lookup per request is cheap at staff scale.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly db: DatabaseService,
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

    // Same key signs the 2FA challenge and Google's state. Neither is a session.
    if (payload.purpose !== undefined) {
      throw new UnauthorizedException('Invalid or expired session token');
    }

    // Staff only: v1 has no client portal. When it returns, look up
    // db.clients here the same way (and give clients a token_version).
    const staff =
      payload.kind === 'Staff' && payload.sub ? await this.db.staffUsers.findById(payload.sub) : null;
    if (!staff || (payload.tv ?? 0) !== staff.token_version) {
      throw new UnauthorizedException('Invalid or expired session token');
    }

    const principal: AuthPrincipal = {
      id: staff.id,
      kind: 'Staff',
      role: staff.role,
      name: staff.name,
      email: staff.email,
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
