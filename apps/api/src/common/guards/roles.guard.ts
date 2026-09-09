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
 * A route with no @Roles is open to any authenticated principal, which is
 * correct for endpoints such as "list my own invoices" where the role is
 * irrelevant and the row scoping does all the work.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<AnyRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const principal = request.principal;
    if (!principal) {
      throw new ForbiddenException('No authenticated principal');
    }

    if (!required.includes(principal.role)) {
      throw new ForbiddenException(
        `This action requires one of: ${required.join(', ')}. Your role is ${principal.role}.`,
      );
    }
    return true;
  }
}
