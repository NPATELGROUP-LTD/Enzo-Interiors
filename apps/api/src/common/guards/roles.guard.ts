import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY, ROLES_KEY } from '../decorators';
import { AnyRole, AuthenticatedRequest } from '../types/principal';

/**
 * Enforces @Roles(...) on a route.
 *
 * This is the coarse half of RBAC — "may this KIND of user call this endpoint
 * at all". The fine half, "may this particular user touch this particular
 * record", is row-level scoping and lives in AccessService, because it needs
 * to read the data. Both halves are required; neither is sufficient alone.
 *
 * A route with no @Roles is open to any authenticated STAFF principal. Clients
 * are default-deny: they pass only routes whose @Roles names 'Client', so a new
 * staff route can never leak to the portal by forgetting a decorator. Staff
 * never pass a Client-only route ('Client' is not a staff role).
 *
 * HTTP only: a socket gateway authenticates and scopes its own events.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<AnyRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const principal = request.principal;
    if (!principal) {
      throw new ForbiddenException('No authenticated principal');
    }

    const allowed =
      principal.kind === 'Client'
        ? Boolean(required?.includes('Client'))
        : !required?.length || required.includes(principal.role);
    if (!allowed) {
      throw new ForbiddenException('Your account does not have access to this.');
    }
    return true;
  }
}
