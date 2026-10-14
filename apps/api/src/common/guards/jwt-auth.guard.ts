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
 * authenticated by default and has to opt out deliberately. HTTP only: a
 * socket gateway authenticates its own connections with authenticate().
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly db: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
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
    request.principal = await authenticate(this.jwt, this.db, token);
    return true;
  }
}

/**
 * A session token -> the principal it belongs to, or 401.
 *
 * The principal is built from the database row the verified token names, never
 * from its claims, which is what stops a frontend claiming a role it does not
 * hold. The row is re-read every time so a token dies with its account: a
 * deleted user, a changed role, a deactivated client or a bumped token_version
 * (password change/reset, role change) take effect immediately instead of when
 * the JWT expires. One primary-key lookup per call is cheap at this scale.
 *
 * Shared by JwtAuthGuard and any socket gateway, so both apply the same rules.
 */
export async function authenticate(jwt: JwtService, db: DatabaseService, token: string): Promise<AuthPrincipal> {
  // Deliberately one opaque message: distinguishing "expired" from "bad
  // signature" or "signed out" tells an attacker what to keep working on.
  const refuse = () => new UnauthorizedException('Invalid or expired session token');

  let payload: JwtPayload;
  try {
    payload = await jwt.verifyAsync<JwtPayload>(token);
  } catch {
    throw refuse();
  }

  // Same key signs the 2FA challenge and Google's state. Neither is a session.
  if (payload.purpose !== undefined || !payload.sub) throw refuse();

  if (payload.kind === 'Staff') {
    const staff = await db.staffUsers.findById(payload.sub);
    if (!staff || (payload.tv ?? 0) !== staff.token_version) throw refuse();
    return { id: staff.id, kind: 'Staff', role: staff.role, name: staff.name, email: staff.email };
  }

  if (payload.kind === 'Client') {
    const client = await db.clients.findById(payload.sub);
    if (!client || client.status !== 'Active' || (payload.tv ?? 0) !== (client.token_version ?? 0)) throw refuse();
    return { id: client.id, kind: 'Client', role: 'Client', name: client.name, email: client.email };
  }

  throw refuse();
}

/** Pull the raw token out of an `Authorization: Bearer <token>` header. */
export function extractBearerToken(request: AuthenticatedRequest): string | null {
  const header = request.headers?.authorization;
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) return null;
  const [scheme, token] = value.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}
