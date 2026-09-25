import { ExecutionContext, SetMetadata, createParamDecorator } from '@nestjs/common';

import { AnyRole, AuthPrincipal, AuthenticatedRequest } from '../types/principal';

export const IS_PUBLIC_KEY = 'enzo:isPublic';
export const ROLES_KEY = 'enzo:roles';

/**
 * Opt a route out of authentication.
 *
 * JwtAuthGuard is registered globally, so authentication is the default and
 * exposing a route is an explicit, greppable act. Only the two login endpoints
 * and the public content/estimate routes consumed by apps/web carry this.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Restrict a route to the listed roles.
 *
 * Enforced centrally by RolesGuard. Per the architecture doc and CLAUDE.md,
 * role checks belong here and in the guards, never hand-rolled inside a
 * handler body.
 */
export const Roles = (...roles: AnyRole[]) => SetMetadata(ROLES_KEY, roles);

/** Inject the authenticated principal into a handler parameter. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthPrincipal => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.principal) {
      // Unreachable through the global guard; a loud failure beats silently
      // handing a service `undefined` and scoping a query to nobody.
      throw new Error('CurrentUser used on a route with no authenticated principal');
    }
    return request.principal;
  },
);
