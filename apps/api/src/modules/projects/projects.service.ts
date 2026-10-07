import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { AccessService } from '../../common/access/access.service';
import { PROJECT_STAGES, Project, ProjectStage } from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { ActivityLogService } from '../../core/activity-log.service';
import { DatabaseService } from '../../data/database.service';
import { NotificationsService } from '../notifications/notifications.module';
import {
  CreateProjectDto,
  ProjectDecisionDto,
  UpdateProjectDto,
  UpdateProjectStageDto,
} from './dto';

export interface ProjectView extends Project {
  client_name: string;
  assigned_designer_name: string | null;
  assigned_installer_name: string | null;
}

/**
 * Default progress for each stage, used when a stage moves and the caller does
 * not supply an explicit percentage. Keeps the client-facing progress bar
 * honest without the admin having to maintain two fields by hand.
 */
const STAGE_PROGRESS: Record<ProjectStage, number> = {
  Consultation: 10,
  Design: 35,
  Approval: 60,
  Installation: 80,
  Completed: 100,
};

/** What a Designer may change on a project assigned to them. The rest is the Admin's. */
const DESIGNER_FIELDS = new Set(['progress_pct', 'current_stage']);

/**
 * The CRM's projects. Which rows anyone reaches is AccessService's call
 * (Admin all; Designers their assigned ones; clients their own shared ones);
 * which routes they may call is the controller's @Roles; which fields a
 * Designer may write is DESIGNER_FIELDS.
 */
@Injectable()
export class ProjectsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly access: AccessService,
    private readonly activity: ActivityLogService,
    private readonly notifications: NotificationsService,
  ) {}

  /* ------------------------------------------------------------------ */
  /* Reads                                                               */
  /* ------------------------------------------------------------------ */

  async list(principal: AuthPrincipal): Promise<ProjectView[]> {
    const rows = await this.db.projects.findWhere(this.access.projectScope(principal), {
      orderBy: { updated_at: 'desc' },
    });
    return this.decorate(rows);
  }

  async findOne(principal: AuthPrincipal, id: string): Promise<ProjectView> {
    const [view] = await this.decorate([await this.access.requireProject(principal, id)]);
    return view!;
  }

  /**
   * Everything the Project Detail screen needs, in one round trip.
   *
   * Documents and invoices must belong to this project AND this project's
   * client: a row whose project_id points here but whose client_id is someone
   * else's is never shown. A client also never sees Draft invoices, internal
   * documents or the activity log. Where a file is stored is never sent.
   */
  async detail(principal: AuthPrincipal, id: string) {
    const project = await this.access.requireProject(principal, id);
    const isClient = this.access.isClient(principal);
    const own = { project_id: id, client_id: project.client_id };

    const [documents, invoices, activity, client, [view]] = await Promise.all([
      this.db.documents.findWhere(
        { ...own, ...(isClient && { client_visible: true }) },
        { orderBy: { upload_date: 'desc' } },
      ),
      this.db.invoices.findWhere(
        { ...own, ...(isClient && { status: { not: 'Draft' } }) },
        { orderBy: { created_at: 'desc' } },
      ),
      isClient ? Promise.resolve([]) : this.activity.listForTarget('projects', id),
      this.db.clients.findById(project.client_id),
      this.decorate([project]),
    ]);

    return {
      project: view!,
      client: client ? { id: client.id, name: client.name, email: client.email } : null,
      documents: documents.map(({ storage_url: _storage, ...document }) => document),
      invoices,
      activity,
      /** The 5-stage timeline, with the current position marked. */
      timeline: PROJECT_STAGES.map((stage, index) => ({
        stage,
        position: index,
        reached: index <= PROJECT_STAGES.indexOf(project.status),
        current: stage === project.status,
      })),
      /** True when this project is sitting on the client's desk for a decision. */
      awaiting_client_decision: project.status === 'Approval',
    };
  }

  /* ------------------------------------------------------------------ */
  /* Writes                                                              */
  /* ------------------------------------------------------------------ */

  /** Admin only (controller). */
  async create(principal: AuthPrincipal, dto: CreateProjectDto): Promise<ProjectView> {
    const client = await this.db.clients.findById(dto.client_id);
    if (!client) throw new BadRequestException('Client does not exist');
    await this.assertAssignable(dto.assigned_designer_id);
    await this.assertAssignable(dto.assigned_installer_id);

    const status = dto.status ?? 'Consultation';
    const now = new Date().toISOString();

    const created = await this.db.projects.create({
      client_id: dto.client_id,
      name: dto.name.trim(),
      type: dto.type,
      status,
      progress_pct: dto.progress_pct ?? STAGE_PROGRESS[status],
      current_stage: dto.current_stage ?? null,
      assigned_designer_id: dto.assigned_designer_id ?? null,
      assigned_installer_id: dto.assigned_installer_id ?? null,
      // Closed by default: the Admin sends a project to the portal on purpose.
      client_visible: dto.client_visible ?? false,
      created_at: now,
      updated_at: now,
    });

    await this.activity.record({
      principal,
      action: 'project_create',
      targetTable: 'projects',
      targetId: created.id,
      details: { name: created.name, type: created.type, client: client.name },
    });
    await this.notifyNewAssignees(principal, created);
    return this.findOne(principal, created.id);
  }

  async update(principal: AuthPrincipal, id: string, dto: UpdateProjectDto): Promise<ProjectView> {
    const project = await this.access.requireProject(principal, id);
    const fields = Object.keys(dto).filter((key) => dto[key as keyof UpdateProjectDto] !== undefined);
    if (!this.access.isAdmin(principal)) {
      const adminOnly = fields.filter((key) => !DESIGNER_FIELDS.has(key));
      if (adminOnly.length > 0) {
        throw new ForbiddenException(`Only an Admin can change ${adminOnly.join(', ')}.`);
      }
    }
    await this.assertAssignable(dto.assigned_designer_id);
    await this.assertAssignable(dto.assigned_installer_id);

    const patch: Partial<Project> = { updated_at: new Date().toISOString() };
    if (dto.name !== undefined) patch.name = dto.name.trim();
    if (dto.type !== undefined) patch.type = dto.type;
    if (dto.current_stage !== undefined) patch.current_stage = dto.current_stage;
    if (dto.assigned_designer_id !== undefined) patch.assigned_designer_id = dto.assigned_designer_id;
    if (dto.assigned_installer_id !== undefined) patch.assigned_installer_id = dto.assigned_installer_id;
    if (dto.client_visible !== undefined) patch.client_visible = dto.client_visible;
    if (dto.progress_pct !== undefined) patch.progress_pct = dto.progress_pct;

    const updated = await this.db.projects.update(id, patch);
    if (!updated) throw new NotFoundException('Project not found');

    // Assignment and visibility get their own entries: both are operationally
    // meaningful and have their own controls.
    const ownEntries = {
      assigned_designer_id: 'project_assign_designer',
      assigned_installer_id: 'project_assign_installer',
      client_visible: 'project_visibility_change',
    } as const;
    for (const [key, action] of Object.entries(ownEntries) as Array<[keyof typeof ownEntries, string]>) {
      if (dto[key] !== undefined && dto[key] !== project[key]) {
        await this.activity.record({
          principal,
          action,
          targetTable: 'projects',
          targetId: id,
          details: { from: project[key], to: dto[key] },
        });
      }
    }
    await this.activity.record({
      principal,
      action: 'project_update',
      targetTable: 'projects',
      targetId: id,
      details: { fields },
    });
    await this.notifyNewAssignees(principal, updated, project);

    return this.findOne(principal, id);
  }

  /**
   * PATCH /projects/:id/stage — the Kanban drag-and-drop and the "Move to…"
   * menu both land here. Direct: there is no approval step for staff.
   *
   * Any stage may move to any other stage, forwards or backwards: a real
   * installation slips back to Design when something is wrong, and forcing a
   * strict forward-only pipeline would make the board lie about reality. The
   * transition is audited with both ends so the history stays readable.
   */
  async changeStage(
    principal: AuthPrincipal,
    id: string,
    dto: UpdateProjectStageDto,
  ): Promise<ProjectView> {
    const project = await this.access.requireProject(principal, id);
    if (project.status === dto.status) {
      // Not an error — a drag that lands back where it started is a no-op.
      return this.findOne(principal, id);
    }

    await this.db.projects.update(id, {
      status: dto.status,
      progress_pct: dto.progress_pct ?? STAGE_PROGRESS[dto.status],
      current_stage: dto.current_stage ?? project.current_stage,
      updated_at: new Date().toISOString(),
    });

    await this.activity.record({
      principal,
      action: 'project_stage_change',
      targetTable: 'projects',
      targetId: id,
      details: { from: project.status, to: dto.status, name: project.name },
    });
    return this.findOne(principal, id);
  }

  /**
   * Client approves the design (portal Project Detail). Client only
   * (controller); requireProject limits it to their own shared projects.
   *
   * Advances Approval -> Installation. This is the forward half of the
   * design-approval loop the App Flow doc calls the critical path.
   */
  async approve(principal: AuthPrincipal, id: string, dto: ProjectDecisionDto): Promise<ProjectView> {
    const project = await this.access.requireProject(principal, id);
    if (project.status !== 'Approval') {
      throw new BadRequestException(
        `There is nothing to approve on this project right now — it is at the ${project.status} stage.`,
      );
    }

    await this.db.projects.update(id, {
      status: 'Installation',
      progress_pct: STAGE_PROGRESS.Installation,
      current_stage: 'Design approved by client — scheduling installation',
      updated_at: new Date().toISOString(),
    });

    await this.activity.record({
      principal,
      action: 'project_design_approved',
      targetTable: 'projects',
      targetId: id,
      details: { from: 'Approval', to: 'Installation', note: dto.note ?? null },
    });
    return this.findOne(principal, id);
  }

  /**
   * Client requests changes (portal Project Detail).
   *
   * Sends the project BACK to Design, which is what "Request Changes restarts
   * the project stage" means in the App Flow doc. The admin's Kanban and the
   * activity log both reflect this on their next read, with the client's note
   * attached so the designer knows what to change.
   */
  async requestChanges(
    principal: AuthPrincipal,
    id: string,
    dto: ProjectDecisionDto,
  ): Promise<ProjectView> {
    const project = await this.access.requireProject(principal, id);
    if (project.status !== 'Approval') {
      throw new BadRequestException(
        `Changes can only be requested while a design is awaiting your approval. This project is at the ${project.status} stage.`,
      );
    }
    if (!dto.note || dto.note.trim().length === 0) {
      throw new BadRequestException('Please tell us what you would like changed.');
    }

    await this.db.projects.update(id, {
      status: 'Design',
      progress_pct: STAGE_PROGRESS.Design,
      current_stage: 'Client requested changes — design being revised',
      updated_at: new Date().toISOString(),
    });

    await this.activity.record({
      principal,
      action: 'project_changes_requested',
      targetTable: 'projects',
      targetId: id,
      details: { from: 'Approval', to: 'Design', note: dto.note.trim() },
    });
    return this.findOne(principal, id);
  }

  /** Admin only (controller). */
  async remove(principal: AuthPrincipal, id: string): Promise<{ id: string; deleted: true }> {
    const project = await this.db.projects.findById(id);
    if (!project) throw new NotFoundException('Project not found');

    const invoiceCount = await this.db.invoices.countWhere({ project_id: id });
    if (invoiceCount > 0) {
      throw new BadRequestException(
        `Cannot delete "${project.name}" while ${invoiceCount} invoice${invoiceCount === 1 ? '' : 's'} reference it. ` +
          'Detach or delete those invoices first.',
      );
    }

    // Documents belong to the client; detach rather than delete so the file
    // stays on the client's record instead of silently disappearing.
    const detached = await this.db.documents.updateWhere({ project_id: id }, { project_id: null });
    await this.db.projects.delete(id);

    await this.activity.record({
      principal,
      action: 'project_delete',
      targetTable: 'projects',
      targetId: id,
      details: { name: project.name, detached_documents: detached },
    });
    return { id, deleted: true };
  }

  /* ------------------------------------------------------------------ */

  private async decorate(projects: Project[]): Promise<ProjectView[]> {
    const clientIds = [...new Set(projects.map((project) => project.client_id))];
    const staffIds = [
      ...new Set(
        projects
          .flatMap((project) => [project.assigned_designer_id, project.assigned_installer_id])
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const [clients, staff] = await Promise.all([
      this.db.clients.findWhere({ id: { in: clientIds } }),
      this.db.staffUsers.findWhere({ id: { in: staffIds } }),
    ]);
    const clientName = new Map(clients.map((c) => [c.id, c.name]));
    const staffName = new Map(staff.map((s) => [s.id, s.name]));
    const nameOf = (id: string | null | undefined) => (id ? (staffName.get(id) ?? null) : null);

    return projects.map((project) => ({
      ...project,
      client_name: clientName.get(project.client_id) ?? 'Unknown client',
      assigned_designer_name: nameOf(project.assigned_designer_id),
      assigned_installer_name: nameOf(project.assigned_installer_id),
    }));
  }

  /** Only a Designer (or a legacy Installer) is assigned to a project. */
  private async assertAssignable(staffId: string | null | undefined): Promise<void> {
    if (!staffId) return;
    const staff = await this.db.staffUsers.findById(staffId);
    if (!staff || (staff.role !== 'Designer' && staff.role !== 'Installer')) {
      throw new BadRequestException('Assign someone with the Designer role.');
    }
  }

  /** The bell, for whoever was just put on the project (not whoever did it). */
  private async notifyNewAssignees(principal: AuthPrincipal, project: Project, before?: Project): Promise<void> {
    const had = new Set([before?.assigned_designer_id, before?.assigned_installer_id]);
    const fresh = new Set(
      [project.assigned_designer_id, project.assigned_installer_id].filter(
        (id): id is string => Boolean(id) && id !== principal.id && !had.has(id),
      ),
    );
    for (const id of fresh) {
      await this.notifications.notify(id, {
        kind: 'project',
        title: `You're on ${project.name}`,
        body: `${principal.name} assigned you to this project.`,
        link: `/projects/${project.id}`,
      });
    }
  }
}
