import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { AccessService } from '../../common/access/access.service';
import { Project, ProjectStageConfig } from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { ActivityLogService } from '../../core/activity-log.service';
import { previewOf } from '../../core/storage';
import { DatabaseService } from '../../data/database.service';
import { confirmPassword } from '../auth/reauth';
import { NotificationsService } from '../notifications/notifications.module';
import {
  CreateProjectDto,
  ProjectDecisionDto,
  UpdateProjectDto,
  UpdateProjectStageDto,
} from './dto';
import { categoryOf } from '../documents/categories';
import { approvalStages, loadStages, planStages } from './stages';
import { TeamService } from './team.service';

export interface ProjectView extends Project {
  client_name: string;
  assigned_designer_name: string | null;
  assigned_installer_name: string | null;
}

/**
 * Told after a project lands on a new stage (staff move or client decision). Other modules add
 * themselves (inventory reserves stock), so projects depends on none of them. A failing listener
 * is logged and never undoes the move.
 */
export const stageListeners: ((projectId: string, stage: string, last: boolean) => Promise<void>)[] = [];

/** What a Designer may change on a project assigned to them. The rest is the Admin's. */
const DESIGNER_FIELDS = new Set(['current_stage']);

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
    private readonly team: TeamService,
  ) {}

  /* ------------------------------------------------------------------ */
  /* Stages (Settings > Project stages)                                  */
  /* ------------------------------------------------------------------ */

  stages(): Promise<ProjectStageConfig[]> {
    return loadStages(this.db);
  }

  /**
   * Admin only (controller). Renamed stages take their projects with them;
   * a stage still holding projects cannot be removed (409 with the counts).
   */
  async saveStages(principal: AuthPrincipal, input: unknown): Promise<ProjectStageConfig[]> {
    const plan = planStages(await this.stages(), input);
    const inUse = await this.db.saveProjectStages(plan.stages, plan.renames, plan.removed, principal.name);
    if (Object.keys(inUse).length) {
      const list = Object.entries(inUse).map(([name, n]) => `${n} at "${name}"`).join(', ');
      throw new ConflictException({ message: `Move these projects to another stage first: ${list}.`, in_use: inUse });
    }
    await this.activity.record({
      principal,
      action: 'project_stages_update',
      targetTable: 'site_settings',
      targetId: 'site',
      details: { stages: plan.stages.map((stage) => stage.name), renamed: plan.renames, removed: plan.removed },
    });
    return plan.stages;
  }

  private async afterStage(projectId: string, stage: string): Promise<void> {
    if (!stageListeners.length) return;
    const last = (await this.stages()).at(-1)?.name === stage;
    for (const listener of stageListeners) {
      await listener(projectId, stage, last).catch((error: Error) => new Logger(ProjectsService.name).error(`Stage listener failed: ${error.message}`));
    }
  }

  /** The configured stage called `name`, or a 400 naming the choices. */
  private async stage(name: string): Promise<ProjectStageConfig> {
    const stages = await this.stages();
    const found = stages.find((stage) => stage.name === name);
    if (!found) throw new BadRequestException(`Stage must be one of: ${stages.map((stage) => stage.name).join(', ')}`);
    return found;
  }

  /* ------------------------------------------------------------------ */
  /* Reads                                                               */
  /* ------------------------------------------------------------------ */

  async list(principal: AuthPrincipal): Promise<ProjectView[]> {
    const rows = await this.db.projects.findWhere(this.access.projectScope(principal), {
      orderBy: { updated_at: 'desc' },
    });
    return this.forViewer(principal, await this.decorate(rows));
  }

  async findOne(principal: AuthPrincipal, id: string): Promise<ProjectView> {
    const [view] = this.forViewer(principal, await this.decorate([await this.access.requireProject(principal, id)]));
    return view!;
  }

  /** Clients see who works on their project by name only; staff ids are internal. */
  private forViewer(principal: AuthPrincipal, views: ProjectView[]): ProjectView[] {
    if (!this.access.isClient(principal)) return views;
    return views.map((view) => ({ ...view, assigned_designer_id: null, assigned_installer_id: null }));
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

    const [documents, invoices, activity, client, [view], stages, team] = await Promise.all([
      this.db.documents.findWhere(
        { ...own, ...(isClient && { client_visible: true }) },
        { orderBy: { upload_date: 'desc' } },
      ),
      // Invoices are the Admin's; a client sees their own, never Drafts; a Designer sees none.
      isClient || this.access.isAdmin(principal)
        ? this.db.invoices.findWhere(
            { ...own, ...(isClient && { status: { not: 'Draft' } }) },
            { orderBy: { created_at: 'desc' } },
          )
        : Promise.resolve([]),
      isClient ? Promise.resolve([]) : this.activity.listForTarget('projects', id),
      this.db.clients.findById(project.client_id),
      this.decorate([project]),
      this.stages(),
      this.team.view(principal, project),
    ]);
    // The Admin's page also shows what happened to the installers' dates and approvals (no amounts are ever logged).
    const termsActivity = this.access.isAdmin(principal)
      ? await this.team.termsActivity(team.filter((member) => member.role === 'Installer').map((member) => member.id))
      : [];
    const position = stages.findIndex((stage) => stage.name === project.status);

    return {
      project: this.forViewer(principal, [view!])[0]!,
      client: client ? { id: client.id, name: client.name, email: client.email } : null,
      documents: documents.map(({ storage_url: key, ...document }) => ({ ...document, category: categoryOf(document), preview: previewOf(key) })),
      invoices,
      activity: [...activity, ...termsActivity].sort((a, b) => b.created_at.localeCompare(a.created_at)),
      /** Designers and installers; an installer's dates and pay only for the Admin and that installer. */
      team,
      /** The configured stages, with the current position marked. */
      timeline: stages.map((stage, index) => ({
        stage: stage.name,
        position: index,
        reached: index <= position,
        current: index === position,
      })),
      /** True when this project is sitting on the client's desk for a decision. */
      awaiting_client_decision: approvalStages(stages).includes(project.status),
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

    const stage = dto.status ? await this.stage(dto.status) : (await this.stages())[0]!;
    const now = new Date().toISOString();

    const created = await this.db.projects.create({
      client_id: dto.client_id,
      name: dto.name.trim(),
      type: dto.type,
      status: stage.name,
      progress_pct: stage.progress,
      current_stage: dto.current_stage ?? null,
      assigned_designer_id: dto.assigned_designer_id ?? null,
      assigned_installer_id: dto.assigned_installer_id ?? null,
      // Closed by default: the Admin sends a project to the portal on purpose.
      client_visible: dto.client_visible ?? false,
      // The client's own address unless the Admin says the work is elsewhere.
      site_address: dto.site_address?.trim() || client.address || null,
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
    await this.db.teamStore.backfill(created.id);
    await this.notifyNewAssignees(principal, created);
    await this.notifyClient(created);
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

    const patch: Partial<Project> = { updated_at: new Date().toISOString() };
    if (dto.name !== undefined) patch.name = dto.name.trim();
    if (dto.type !== undefined) patch.type = dto.type;
    if (dto.current_stage !== undefined) patch.current_stage = dto.current_stage;
    if (dto.client_visible !== undefined) patch.client_visible = dto.client_visible;
    if (dto.site_address !== undefined) patch.site_address = dto.site_address?.trim() || null;

    const updated = await this.db.projects.update(id, patch);
    if (!updated) throw new NotFoundException('Project not found');

    // Visibility gets its own entry: it is operationally meaningful and has its own control.
    if (dto.client_visible !== undefined && dto.client_visible !== project.client_visible) {
      await this.activity.record({
        principal,
        action: 'project_visibility_change',
        targetTable: 'projects',
        targetId: id,
        details: { from: project.client_visible, to: dto.client_visible },
      });
    }
    await this.activity.record({
      principal,
      action: 'project_update',
      targetTable: 'projects',
      targetId: id,
      details: { fields },
    });
    await this.notifyClient(updated, project);

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
    const stage = await this.stage(dto.status);
    if (project.status === dto.status) {
      // Not an error — a drag that lands back where it started is a no-op.
      return this.findOne(principal, id);
    }

    await this.db.projects.update(id, {
      status: dto.status,
      progress_pct: stage.progress,
      current_stage: dto.current_stage ?? project.current_stage,
      updated_at: new Date().toISOString(),
    });
    await this.afterStage(id, dto.status);

    await this.activity.record({
      principal,
      action: 'project_stage_change',
      targetTable: 'projects',
      targetId: id,
      details: { from: project.status, to: dto.status, name: project.name },
    });
    await this.notifyClient({ ...project, status: dto.status }, project);
    return this.findOne(principal, id);
  }

  /**
   * Client approves the design (portal Project Detail). Client only
   * (controller); requireProject limits it to their own shared projects.
   *
   * Advances the approval stage to the one after it. This is the forward half
   * of the design-approval loop the App Flow doc calls the critical path.
   */
  async approve(principal: AuthPrincipal, id: string, dto: ProjectDecisionDto): Promise<ProjectView> {
    const project = await this.access.requireProject(principal, id);
    const { at, next } = await this.decisionStages(project);
    if (!at || !next) {
      throw new BadRequestException(
        `There is nothing to approve on this project right now — it is at the ${project.status} stage.`,
      );
    }

    await this.db.projects.update(id, {
      status: next.name,
      progress_pct: next.progress,
      current_stage: `Approved by the client (${at.name})`,
      updated_at: new Date().toISOString(),
    });
    await this.afterStage(id, next.name);

    await this.activity.record({
      principal,
      action: 'project_design_approved',
      targetTable: 'projects',
      targetId: id,
      details: { from: at.name, to: next.name, note: dto.note ?? null },
    });
    await this.notifyStaffOfDecision(project, `Approved by the client: ${project.name}`, dto.note ?? undefined);
    return this.findOne(principal, id);
  }

  /**
   * Client requests changes (portal Project Detail).
   *
   * Sends the project BACK one stage, which is what "Request Changes restarts
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
    const { at, previous } = await this.decisionStages(project);
    if (!at || !previous) {
      throw new BadRequestException(
        `Changes can only be requested while a stage is awaiting your approval. This project is at the ${project.status} stage.`,
      );
    }
    if (!dto.note || dto.note.trim().length === 0) {
      throw new BadRequestException('Please tell us what you would like changed.');
    }

    await this.db.projects.update(id, {
      status: previous.name,
      progress_pct: previous.progress,
      current_stage: `Client requested changes at ${at.name}`,
      updated_at: new Date().toISOString(),
    });
    await this.afterStage(id, previous.name);

    await this.activity.record({
      principal,
      action: 'project_changes_requested',
      targetTable: 'projects',
      targetId: id,
      details: { from: at.name, to: previous.name, note: dto.note.trim() },
    });
    await this.notifyStaffOfDecision(project, `Changes requested on ${project.name}`, dto.note.trim());
    return this.findOne(principal, id);
  }

  /** Admin only (controller). */
  /**
   * Needs the Admin's password again. Documents and invoices belong to the
   * client: they are unlinked and stay on the client's record, never deleted.
   */
  async remove(principal: AuthPrincipal, id: string, password?: string): Promise<{ id: string; deleted: true }> {
    const project = await this.db.projects.findById(id);
    if (!project) throw new NotFoundException('Project not found');
    await confirmPassword(this.db, principal, password);

    const detached = await this.db.deleteProject(id);

    await this.activity.record({
      principal,
      action: 'project_delete',
      targetTable: 'projects',
      targetId: id,
      details: { name: project.name, detached_documents: detached.documents, detached_invoices: detached.invoices },
    });
    return { id, deleted: true };
  }

  /* ------------------------------------------------------------------ */

  /** The approval stage and its neighbours, when `project` is at it. */
  private async decisionStages(project: Project) {
    const stages = await this.stages();
    const index = stages.findIndex((stage) => stage.approval && stage.name === project.status);
    if (index < 0) return { at: undefined, previous: undefined, next: undefined };
    return { at: stages[index], previous: stages[index - 1], next: stages[index + 1] };
  }

  private async decorate(projects: Project[]): Promise<ProjectView[]> {
    const clientIds = [...new Set(projects.map((project) => project.client_id))];
    const [clients, team] = await Promise.all([this.db.clients.findWhere({ id: { in: clientIds } }), this.team.names(projects)]);
    const clientName = new Map(clients.map((c) => [c.id, c.name]));

    return projects.map((project) => ({
      ...project,
      client_name: clientName.get(project.client_id) ?? 'Unknown client',
      // Everyone on the team, joined; the first of each is still assigned_*_id.
      assigned_designer_name: team.get(project.id)?.designer ?? null,
      assigned_installer_name: team.get(project.id)?.installer ?? null,
    }));
  }

  /** Only a Designer (or a legacy Installer) is assigned to a project. */
  private async assertAssignable(staffId: string | null | undefined): Promise<void> {
    if (!staffId) return;
    const staff = await this.db.staffUsers.findById(staffId);
    if (!staff || (staff.role !== 'Designer' && staff.role !== 'Installer')) {
      throw new BadRequestException('Assign someone with the Designer or Installer role.');
    }
  }

  /**
   * The client's bell (and devices): a project just shared with them, or a
   * shared one that moved stage. Only staff changes call this, never the
   * client's own approve / request-changes.
   */
  private async notifyClient(project: Project, before?: Project): Promise<void> {
    if (!project.client_visible) return;
    const shared = !before?.client_visible;
    if (!shared && before.status === project.status) return;
    // Entering the approval stage is the one move that asks the client to do something.
    const needsApproval = !shared && (await this.stages()).some((stage) => stage.approval && stage.name === project.status);
    await this.notifications.notifyClient(project.client_id, {
      kind: 'project',
      title: shared
        ? `${project.name} is now in your portal`
        : needsApproval
          ? `${project.name} needs your approval`
          : `${project.name} has moved to ${project.status}`,
      body: needsApproval ? 'Review the design, then approve it or ask for changes.' : undefined,
      link: `/projects/${project.id}`,
    });
  }

  /** The client decided: every Admin and whoever designs or installs it hears, never the client themselves. */
  private async notifyStaffOfDecision(project: Project, title: string, body?: string): Promise<void> {
    const ids = await this.access.staffOn([project]);
    for (const admin of await this.db.staffUsers.findAll((row) => row.role === 'Admin')) ids.add(admin.id);
    for (const id of ids) await this.notifications.notify(id, { kind: 'project', title, body, link: `/projects/${project.id}` });
  }

  /** The bell, for whoever a new project starts with (later additions go through TeamService.add). */
  private async notifyNewAssignees(principal: AuthPrincipal, project: Project): Promise<void> {
    const fresh = new Set(
      [project.assigned_designer_id, project.assigned_installer_id].filter((id): id is string => Boolean(id) && id !== principal.id),
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
