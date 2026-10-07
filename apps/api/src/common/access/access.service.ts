import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { DatabaseService } from '../../data/database.service';
import { Project } from '../types/domain';
import { AuthPrincipal } from '../types/principal';

/**
 * Row-level access scoping — the half of RBAC the guards cannot do.
 *
 * RolesGuard answers "may an Admin call this endpoint". This answers "may THIS
 * staff member read THIS client", which needs the data itself:
 *
 *   Client              own client_id only.
 *   Designer/Installer  the clients of projects they are the assigned designer
 *                       on (projects.assigned_designer_id), and those projects.
 *   Admin               everything.
 *   Anyone else         nothing (an Editor never reaches the CRM; this is the
 *                       floor if a route forgets its @Roles).
 *
 * Work assignment is the only edge. clients.assigned_staff_id is who looks
 * after the account, an Admin's note; it grants nobody access.
 *
 * Every service that returns client-scoped rows funnels through
 * `visibleClientIds` so the scoping cannot be forgotten in one endpoint and
 * present in another.
 */
@Injectable()
export class AccessService {
  constructor(private readonly db: DatabaseService) {}

  isAdmin(principal: AuthPrincipal): boolean {
    return principal.kind === 'Staff' && principal.role === 'Admin';
  }

  isClient(principal: AuthPrincipal): boolean {
    return principal.kind === 'Client';
  }

  /** Designer or Installer: sees assigned work only. */
  private isAssignable(principal: AuthPrincipal): boolean {
    return principal.kind === 'Staff' && (principal.role === 'Designer' || principal.role === 'Installer');
  }

  /**
   * The set of client ids this principal may see, or 'all' for Admin.
   *
   * Returning the sentinel rather than materialising every id keeps the Admin
   * path from doing pointless work, and makes the two cases impossible to
   * confuse at the call site.
   */
  async visibleClientIds(principal: AuthPrincipal): Promise<Set<string> | 'all'> {
    if (this.isAdmin(principal)) return 'all';
    if (this.isClient(principal)) return new Set([principal.id]);
    if (!this.isAssignable(principal)) return new Set();

    const projects = await this.db.projects.findWhere({ assigned_designer_id: principal.id });
    return new Set(projects.map((project) => project.client_id));
  }

  /** True when the principal may read/write records belonging to `clientId`. */
  async canAccessClient(principal: AuthPrincipal, clientId: string): Promise<boolean> {
    if (this.isAdmin(principal)) return true;
    if (this.isClient(principal)) return principal.id === clientId;
    if (!this.isAssignable(principal)) return false;
    return (await this.db.projects.countWhere({ client_id: clientId, assigned_designer_id: principal.id })) > 0;
  }

  /**
   * Throw unless the principal may touch this client's records.
   *
   * Raises 404 rather than 403 for a client principal reaching outside their
   * own account: telling them "that record exists but is not yours" leaks the
   * existence of other clients' data. Staff get a 403, because for them the
   * record's existence is not the secret — their scope is.
   */
  async assertClientAccess(principal: AuthPrincipal, clientId: string): Promise<void> {
    if (await this.canAccessClient(principal, clientId)) return;
    if (this.isClient(principal)) {
      throw new NotFoundException('Record not found');
    }
    throw new ForbiddenException('This record is outside your assigned clients');
  }

  /**
   * Whether a project is visible to the principal.
   *
   * A client additionally cannot see a project with `client_visible` false —
   * that is the admin's "send to client" toggle, and it hides work in progress
   * from the portal.
   */
  canAccessProject(principal: AuthPrincipal, project: Project): boolean {
    if (this.isAdmin(principal)) return true;
    if (this.isClient(principal)) {
      return project.client_id === principal.id && project.client_visible;
    }
    return this.isAssignable(principal) && project.assigned_designer_id === principal.id;
  }

  /** Load a project by id, enforcing visibility. Throws 404 when out of scope. */
  async requireProject(principal: AuthPrincipal, projectId: string): Promise<Project> {
    const project = await this.db.projects.findById(projectId);
    if (!project) throw new NotFoundException('Project not found');
    if (!this.canAccessProject(principal, project)) {
      if (this.isClient(principal)) throw new NotFoundException('Project not found');
      throw new ForbiddenException('This project is outside your assigned work');
    }
    return project;
  }

  /**
   * Filter any client-scoped collection down to what the principal may see.
   * The single chokepoint every list endpoint uses.
   */
  async scopeToVisibleClients<T>(
    principal: AuthPrincipal,
    rows: T[],
    clientIdOf: (row: T) => string,
  ): Promise<T[]> {
    const visible = await this.visibleClientIds(principal);
    if (visible === 'all') return rows;
    return rows.filter((row) => visible.has(clientIdOf(row)));
  }
}
