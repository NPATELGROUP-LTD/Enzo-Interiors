import { StaffRole } from './domain';

/**
 * The authenticated caller, decoded from the bearer token by JwtAuthGuard and
 * attached to the request.
 *
 * Two login flows issue these — /auth/admin/login and /auth/portal/login — and
 * a token from one is not interchangeable with the other. `kind` is what the
 * guards branch on, and it comes from the signed token, never from a header or
 * body field the frontend controls.
 */
export type PrincipalKind = 'Staff' | 'Client';

export interface AuthPrincipal {
  /** staff_users.id or clients.id, per `kind`. */
  id: string;
  kind: PrincipalKind;
  /**
   * Staff role. Clients carry the literal 'Client' so a single `@Roles(...)`
   * check can express every rule in the RBAC table without a second decorator.
   */
  role: StaffRole | 'Client';
  name: string;
  email: string;
}

/** What we actually sign. Kept small — a token is not a cache. */
export interface JwtPayload {
  sub: string;
  kind: PrincipalKind;
  role: StaffRole | 'Client';
  name: string;
  email: string;
  /** staff_users.token_version at signing. A mismatch means signed out. */
  tv?: number;
}

/** Every role value that can appear on a principal. */
export type AnyRole = StaffRole | 'Client';

/** Express Request with the principal the guard attached. */
export interface AuthenticatedRequest {
  principal?: AuthPrincipal;
  headers: Record<string, string | string[] | undefined>;
}
