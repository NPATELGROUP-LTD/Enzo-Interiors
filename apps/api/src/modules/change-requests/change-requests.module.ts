import { BadRequestException, Body, Controller, ForbiddenException, Get, HttpCode, Injectable, Module, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { AccessService } from '../../common/access/access.service';
import { CurrentUser, Roles } from '../../common/decorators';
import { ChangeRequest } from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { DatabaseService } from '../../data/database.service';
import { ClientsModule } from '../clients/clients.module';
import { ClientsService } from '../clients/clients.service';
import { NotificationsModule, NotificationsService } from '../notifications/notifications.module';
import { ProjectsModule } from '../projects/projects.controller';
import { ProjectsService } from '../projects/projects.service';

const KINDS = ['client_details', 'project_stage'] as const;
const STATUSES = ['Pending', 'Approved', 'Declined'] as const;

/** POST /change-requests. Field limits match UpdateClientDto. */
export class CreateChangeRequestDto {
  @IsIn(KINDS) kind!: ChangeRequest['kind'];
  /** client_details: the client. */
  @IsOptional() @IsString() @MaxLength(64) client_id?: string;
  /** project_stage: the project, and the stage it should move to. */
  @IsOptional() @IsString() @MaxLength(64) project_id?: string;
  @IsOptional() @IsString() @MaxLength(40) status?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(500) address?: string;
  @IsOptional() @IsString() @MaxLength(5000) notes?: string;
  /** Why, for the Admin. */
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class ListChangeRequestsDto {
  @IsOptional() @IsIn(STATUSES) status?: ChangeRequest['status'];
  @IsOptional() @IsString() @MaxLength(64) client_id?: string;
  @IsOptional() @IsString() @MaxLength(64) project_id?: string;
}

const CLIENT_FIELDS = ['phone', 'address', 'notes'] as const;

/**
 * Changes a Designer or Installer asks an Admin to make: a client's phone,
 * address or notes (Designer), or a project's stage (Installer). The request
 * keeps what would have been sent; approving replays it through ClientsService
 * or ProjectsService as the deciding Admin, so the usual checks and the
 * activity log apply. One pending request per person, target and kind: asking
 * again replaces it.
 */
@Injectable()
export class ChangeRequestsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly access: AccessService,
    private readonly clients: ClientsService,
    private readonly projects: ProjectsService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Admin: everyone's. Designer/Installer: their own. Newest first, 50 at most. */
  list(principal: AuthPrincipal, query: ListChangeRequestsDto): Promise<ChangeRequest[]> {
    return this.db.changeRequests.findWhere(
      {
        ...(query.status ? { status: query.status } : {}),
        ...(query.client_id ? { client_id: query.client_id } : {}),
        ...(query.project_id ? { project_id: query.project_id } : {}),
        ...(this.access.isAdmin(principal) ? {} : { requested_by: principal.id }),
      },
      { orderBy: { created_at: 'desc' }, take: 50 },
    );
  }

  async create(principal: AuthPrincipal, dto: CreateChangeRequestDto): Promise<ChangeRequest> {
    const note = dto.note?.trim() || null;
    let target: { client_id: string; project_id: string | null; payload: Record<string, string>; title: string; link: string };

    if (dto.kind === 'client_details') {
      // Installers do not edit clients, not even by asking.
      if (principal.role !== 'Designer') throw new ForbiddenException('Only a Designer can ask to change client details.');
      if (!dto.client_id) throw new BadRequestException('Choose a client.');
      const client = await this.clients.findOne(principal, dto.client_id);
      const payload: Record<string, string> = {};
      for (const key of CLIENT_FIELDS) if (dto[key] !== undefined && dto[key] !== (client[key] ?? '')) payload[key] = dto[key]!;
      if (!Object.keys(payload).length) throw new BadRequestException('Nothing has changed.');
      target = {
        client_id: client.id,
        project_id: null,
        payload,
        title: `${principal.name} asks to change ${client.name}'s ${Object.keys(payload).join(', ')}`,
        link: `/clients/${client.id}`,
      };
    } else {
      if (!dto.project_id || !dto.status) throw new BadRequestException('Choose a project and a stage.');
      const project = await this.access.requireProject(principal, dto.project_id);
      if (!(await this.projects.stages()).some((stage) => stage.name === dto.status)) {
        throw new BadRequestException(`"${dto.status}" is not one of the project stages.`);
      }
      if (project.status === dto.status) throw new BadRequestException(`The project is already at ${dto.status}.`);
      target = {
        client_id: project.client_id,
        project_id: project.id,
        payload: { status: dto.status },
        title: `${principal.name} asks to move ${project.name} to ${dto.status}`,
        link: `/projects/${project.id}`,
      };
    }

    const { title, link, ...fields } = target;
    const [open] = await this.db.changeRequests.findWhere({
      kind: dto.kind,
      requested_by: principal.id,
      client_id: fields.client_id,
      project_id: fields.project_id,
      status: 'Pending',
    });
    const saved = open
      ? (await this.db.changeRequests.update(open.id, { payload: fields.payload, note, created_at: new Date().toISOString() }))!
      : await this.db.changeRequests.create({
          ...fields,
          kind: dto.kind,
          requested_by: principal.id,
          requested_name: principal.name,
          note,
          status: 'Pending',
          decided_by: null,
          decided_at: null,
          created_at: new Date().toISOString(),
        });
    await this.notifications.notifyAdmins({ kind: 'request', title, body: note, link });
    return saved;
  }

  /**
   * Admin only (controller). Claimed with one conditional UPDATE so two Admins
   * cannot both apply it; if applying fails it goes back to Pending.
   */
  async decide(principal: AuthPrincipal, id: string, approve: boolean): Promise<ChangeRequest> {
    const decided = { status: approve ? 'Approved' : 'Declined', decided_by: principal.id, decided_at: new Date().toISOString() } as const;
    if (!(await this.db.changeRequests.updateWhere({ id, status: 'Pending' }, decided))) {
      throw new NotFoundException('This request was already decided or no longer exists.');
    }
    const request = (await this.db.changeRequests.findById(id))!;
    if (approve) {
      try {
        if (request.kind === 'client_details') {
          // An emptied field is stored as '' in the request and as null on the client.
          const patch = Object.fromEntries(Object.entries(request.payload).map(([key, value]) => [key, value || null]));
          await this.clients.update(principal, request.client_id, patch);
        } else await this.projects.changeStage(principal, request.project_id!, { status: String(request.payload.status) });
      } catch (error) {
        await this.db.changeRequests.update(id, { status: 'Pending', decided_by: null, decided_at: null });
        throw error;
      }
    }
    const what = request.kind === 'client_details' ? 'your client details change' : `moving the project to ${String(request.payload.status)}`;
    await this.notifications.notify(request.requested_by, {
      kind: 'request',
      title: `${principal.name} ${approve ? 'approved' : 'declined'} ${what}`,
      link: request.project_id ? `/projects/${request.project_id}` : `/clients/${request.client_id}`,
    });
    return { ...request, ...decided };
  }
}

@Controller('change-requests')
export class ChangeRequestsController {
  constructor(private readonly requests: ChangeRequestsService) {}

  @Get()
  @Roles('Admin', 'Designer', 'Installer')
  list(@CurrentUser() principal: AuthPrincipal, @Query() query: ListChangeRequestsDto) {
    return this.requests.list(principal, query);
  }

  @Post()
  @Roles('Designer', 'Installer')
  create(@CurrentUser() principal: AuthPrincipal, @Body() dto: CreateChangeRequestDto) {
    return this.requests.create(principal, dto);
  }

  @Post(':id/approve')
  @Roles('Admin')
  @HttpCode(200)
  approve(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.requests.decide(principal, id, true);
  }

  @Post(':id/decline')
  @Roles('Admin')
  @HttpCode(200)
  decline(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.requests.decide(principal, id, false);
  }
}

@Module({
  imports: [ClientsModule, ProjectsModule, NotificationsModule],
  controllers: [ChangeRequestsController],
  providers: [ChangeRequestsService],
})
export class ChangeRequestsModule {}
