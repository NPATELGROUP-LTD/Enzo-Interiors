import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { AccessService } from '../../common/access/access.service';
import { PROJECT_STAGES, Project, ProjectStage } from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { ActivityLogService } from '../../core/activity-log.service';
import { DatabaseService } from '../../data/database.service';
import {
  CreateProjectDto,
  ProjectDecisionDto,
  UpdateProjectDto,
  UpdateProjectStageDto,
} from './dto';

export interface ProjectView extends Project {
  client_name: string;
  assigned_designer_name: string | null;
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

@Injectable()
export class ProjectsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly access: AccessService,
    private readonly activity: ActivityLogService,
  ) {}

  /* ------------------------------------------------------------------ */
  /* Reads                                                               */
  /* ------------------------------------------------------------------ */

  async list(principal: AuthPrincipal): Promise<ProjectView[]> {
    const all = await this.db.projects.findAll();

    // A client sees only their own AND only those the admin has shared. Staff
    // scoping is the usual assigned-clients rule.
    const visible =
      principal.kind === 'Client'
        ? all.filter((project) => project.client_id === principal.id && project.client_visible)
        : await this.access.scopeToVisibleClients(principal, all, (row) => row.client_id);

    return this.decorate(visible);
  }

  async findOne(principal: AuthPrincipal, id: string): Promise<ProjectView> {
    const project = await this.access.requireProject(principal, id);
    const [decorated] = await this.decorate([project]);
    if (!decorated) throw new NotFoundException('Project not found');
    return decorated;
  }

  /** Everything the Project Detail screen needs, in one round trip. */
  async detail(principal: AuthPrincipal, id: string) {
    const project = await this.access.requireProject(principal, id);
    const isClient = principal.kind === 'Client';

    const [documents, invoices, activity, client] = await Promise.all([
      this.db.documents.findAll((row) => row.project_id === id),
      this.db.invoices.findAll((row) => row.project_id === id),
      this.activity.listForTarget('projects', id),
      this.db.clients.findById(project.client_id),
    ]);

    const [view] = await this.decorate([project]);

    return {
      project: view,
      client: client ? { id: client.id, name: client.name, email: client.email } : null,
      // A client never sees documents the admin has kept internal.
      documents: documents
        .filter((document) => !isClient || document.client_visible)
        .sort((a, b) => b.upload_date.localeCompare(a.upload_date)),
      invoices: invoices.sort((a, b) => b.created_at.localeCompare(a.created_at)),
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

  async create(principal: AuthPrincipal, dto: CreateProjectDto): Promise<ProjectView> {
    await this.access.assertClientAccess(principal, dto.client_id);
    const client = await this.db.clients.findById(dto.client_id);
    if (!client) throw new BadRequestException('Client does not exist');
    if (dto.assigned_designer_id) await this.assertStaffExists(dto.assigned_designer_id);

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
      client_visible: dto.client_visible ?? true,
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
    return this.findOne(principal, created.id);
  }

  async update(principal: AuthPrincipal, id: string, dto: UpdateProjectDto): Promise<ProjectView> {
    const project = await this.access.requireProject(principal, id);
    if (principal.kind === 'Client') {
      throw new ForbiddenException('Clients cannot edit project records');
    }
    if (dto.assigned_designer_id) await this.assertStaffExists(dto.assigned_designer_id);

    const patch: Partial<Project> = { updated_at: new Date().toISOString() };
    if (dto.name !== undefined) patch.name = dto.name.trim();
    if (dto.type !== undefined) patch.type = dto.type;
    if (dto.current_stage !== undefined) patch.current_stage = dto.current_stage;
    if (dto.assigned_designer_id !== undefined) patch.assigned_designer_id = dto.assigned_designer_id;
    if (dto.client_visible !== undefined) patch.client_visible = dto.client_visible;
    if (dto.progress_pct !== undefined) {
      patch.progress_pct = Math.max(0, Math.min(100, Math.round(dto.progress_pct)));
    }

    await this.db.projects.update(id, patch);

    // Two changes the audit trail should distinguish, because both are
    // operationally meaningful and get their own admin UI control.
    if (dto.assigned_designer_id !== undefined && dto.assigned_designer_id !== project.assigned_designer_id) {
      await this.activity.record({
        principal,
        action: 'project_assign_designer',
        targetTable: 'projects',
        targetId: id,
        details: { from: project.assigned_designer_id, to: dto.assigned_designer_id },
      });
    }
    if (dto.client_visible !== undefined && dto.client_visible !== project.client_visible) {
      await this.activity.record({
        principal,
        action: 'project_visibility_change',
        targetTable: 'projects',
        targetId: id,
        details: { client_visible: dto.client_visible },
      });
    }
    await this.activity.record({
      principal,
      action: 'project_update',
      targetTable: 'projects',
      targetId: id,
      details: { fields: Object.keys(dto) },
    });

    return this.findOne(principal, id);
  }

  /**
   * PATCH /projects/:id/stage — the Kanban drag-and-drop and the "Move to…"
   * menu both land here.
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
    if (principal.kind === 'Client') {
      throw new ForbiddenException('Clients cannot move a project between stages');
    }
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
   * Client approves the design (portal Project Detail).
   *
   * Advances Approval -> Installation. This is the forward half of the
   * design-approval loop the App Flow doc calls the critical path.
   */
  async approve(principal: AuthPrincipal, id: string, dto: ProjectDecisionDto): Promise<ProjectView> {
    const project = await this.requireClientOwnedProject(principal, id);
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
    const project = await this.requireClientOwnedProject(principal, id);
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

  async remove(principal: AuthPrincipal, id: string): Promise<{ id: string; deleted: true }> {
    const project = await this.db.projects.findById(id);
    if (!project) throw new NotFoundException('Project not found');

    const invoiceCount = await this.db.invoices.count((row) => row.project_id === id);
    if (invoiceCount > 0) {
      throw new BadRequestException(
        `Cannot delete "${project.name}" while ${invoiceCount} invoice${invoiceCount === 1 ? '' : 's'} reference it. ` +
          'Detach or delete those invoices first.',
      );
    }

    // Documents belong to the project; detach rather than delete so the file
    // stays on the client's record instead of silently disappearing.
    const documents = await this.db.documents.findAll((row) => row.project_id === id);
    for (const document of documents) {
      await this.db.documents.update(document.id, { project_id: null });
    }
    await this.db.projects.delete(id);

    await this.activity.record({
      principal,
      action: 'project_delete',
      targetTable: 'projects',
      targetId: id,
      details: { name: project.name, detached_documents: documents.length },
    });
    return { id, deleted: true };
  }

  /* ------------------------------------------------------------------ */

  private async decorate(projects: Project[]): Promise<ProjectView[]> {
    const [clients, staff] = await Promise.all([
      this.db.clients.findAll(),
      this.db.staffUsers.findAll(),
    ]);
    const clientName = new Map(clients.map((c) => [c.id, c.name]));
    const staffName = new Map(staff.map((s) => [s.id, s.name]));

    return projects
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .map((project) => ({
        ...project,
        client_name: clientName.get(project.client_id) ?? 'Unknown client',
        assigned_designer_name: project.assigned_designer_id
          ? (staffName.get(project.assigned_designer_id) ?? null)
          : null,
      }));
  }

  private async assertStaffExists(staffId: string): Promise<void> {
    const staff = await this.db.staffUsers.findById(staffId);
    if (!staff) throw new BadRequestException('Assigned designer does not exist');
  }

  private async requireClientOwnedProject(
    principal: AuthPrincipal,
    id: string,
  ): Promise<Project> {
    if (principal.kind !== 'Client') {
      throw new ForbiddenException('Only the client can make this decision on their own project');
    }
    const project = await this.db.projects.findById(id);
    if (!project || project.client_id !== principal.id || !project.client_visible) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }
}
