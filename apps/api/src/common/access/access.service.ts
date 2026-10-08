import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { DatabaseService } from '../../data/database.service';
import { Where } from '../../data/prisma-repository';
import { DocumentRecord, Project } from '../types/domain';
import { AuthPrincipal } from '../types/principal';

/**
 * Row-level access scoping — the half of RBAC the guards cannot do.
 *
 * RolesGuard answers "may an Admin call this endpoint". This answers "may THIS
 * staff member read THIS client", which needs the data itself:
 *
 *   Client              own client_id only, and only projects shared with them.
 *   Designer/Installer  projects they are assigned to, as designer
 *                       (assigned_designer_id) or installer
 *                       (assigned_installer_id), and those projects' clients.
 *   Admin               everything.
 *   Anyone else         nothing (an Editor never reaches the CRM; this is the
 *                       floor if a route forgets its @Roles).
 *
 * Work assignment is the only edge. clients.assigned_staff_id is who looks
 * after the account, an Admin's note; it grants nobody access.
 *
 * Every service that returns client-scoped rows funnels through
 * `visibleClientIds`, and every project read through `projectScope` /
 * `requireProject`, so the scoping cannot be forgotten in one endpoint and
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
   * The projects this principal may see, as a WHERE clause, so PostgreSQL
   * filters (both assignment columns are indexed). Closed by default: anyone
   * not named here matches no row.
   */
  projectScope(principal: AuthPrincipal): Where<Project> {
    if (this.isAdmin(principal)) return {};
    if (this.isClient(principal)) return { client_id: principal.id, client_visible: true };
    if (this.isAssignable(principal)) {
      return { OR: [{ assigned_designer_id: principal.id }, { assigned_installer_id: principal.id }] };
    }
    return { id: { in: [] } };
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

    const projects = await this.db.projects.findWhere(this.projectScope(principal));
    return new Set(projects.map((project) => project.client_id));
  }

  /** True when the principal may read/write records belonging to `clientId`. */
  async canAccessClient(principal: AuthPrincipal, clientId: string): Promise<boolean> {
    if (this.isAdmin(principal)) return true;
    if (this.isClient(principal)) return principal.id === clientId;
    if (!this.isAssignable(principal)) return false;
    return (await this.db.projects.countWhere({ client_id: clientId, ...this.projectScope(principal) })) > 0;
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
   * Whether a project is visible to the principal: the in-memory twin of
   * `projectScope`. A client additionally cannot see a project with
   * `client_visible` false — the admin's "send to client" toggle.
   */
  canAccessProject(principal: AuthPrincipal, project: Project): boolean {
    if (this.isAdmin(principal)) return true;
    if (this.isClient(principal)) {
      return project.client_id === principal.id && project.client_visible;
    }
    return (
      this.isAssignable(principal) &&
      (project.assigned_designer_id === principal.id || project.assigned_installer_id === principal.id)
    );
  }

  /**
   * The documents this principal may see, as a WHERE clause. A client: their
   * own, once shared AND on a project that is itself shared (hiding a project
   * hides its files; a file with no project is never shown). A Designer:
   * through their projects only (never through the client), and only a row
   * that belongs to that project's client.
   */
  async documentScope(principal: AuthPrincipal): Promise<Where<DocumentRecord>> {
    if (this.isAdmin(principal)) return {};
    if (this.isClient(principal)) {
      const shared = await this.db.projects.findWhere({ client_id: principal.id, client_visible: true });
      return { client_id: principal.id, client_visible: true, project_id: { in: shared.map((project) => project.id) } };
    }
    const projects = this.isAssignable(principal)
      ? await this.db.projects.findWhere(this.projectScope(principal))
      : [];
    if (projects.length === 0) return { id: { in: [] } };
    return { OR: projects.map((project) => ({ project_id: project.id, client_id: project.client_id })) };
  }

  /**
   * Load a project by id, enforcing visibility. 404 when out of scope, for
   * staff too: a project id outside your work is not yours to confirm.
   */
  async requireProject(principal: AuthPrincipal, projectId: string): Promise<Project> {
    const project = await this.db.projects.findById(projectId);
    if (!project || !this.canAccessProject(principal, project)) {
      throw new NotFoundException('Project not found');
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
