import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Module,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';

import { CurrentUser, Roles } from '../../common/decorators';
import { AuthPrincipal } from '../../common/types/principal';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  CreateProjectDto,
  ProjectDecisionDto,
  SaveProjectStagesDto,
  UpdateProjectDto,
  UpdateProjectStageDto,
} from './dto';
import { ProjectsService } from './projects.service';

/**
 * The CRM's projects.
 *
 * Every route names its roles. Admin: everything. Designer (and Installer,
 * treated the same): the projects assigned to them, stage and progress only.
 * Client: their own shared projects, through the four routes the portal
 * calls (list, detail, approve, request changes). Editors never get in.
 */
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  /** Admin Kanban/list, and the portal's My Projects, both read from here. */
  @Get()
  @Roles('Admin', 'Designer', 'Installer', 'Client')
  list(@CurrentUser() principal: AuthPrincipal) {
    return this.projects.list(principal);
  }

  /** The ordered stage list: board columns, pickers, the portal's timeline. Before :id. */
  @Get('stages')
  @Roles('Admin', 'Designer', 'Installer', 'Client')
  stages() {
    return this.projects.stages();
  }

  /** Settings > Project stages. Renames move projects; removing a stage in use is a 409. */
  @Put('stages')
  @Roles('Admin')
  saveStages(@CurrentUser() principal: AuthPrincipal, @Body() dto: SaveProjectStagesDto) {
    return this.projects.saveStages(principal, dto.stages);
  }

  @Get(':id')
  @Roles('Admin', 'Designer', 'Installer')
  findOne(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.projects.findOne(principal, id);
  }

  /** Aggregate feed for Project Detail (timeline, documents, invoices, activity). */
  @Get(':id/detail')
  @Roles('Admin', 'Designer', 'Installer', 'Client')
  detail(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.projects.detail(principal, id);
  }

  @Post()
  @Roles('Admin')
  create(@CurrentUser() principal: AuthPrincipal, @Body() dto: CreateProjectDto) {
    return this.projects.create(principal, dto);
  }

  /** A Designer may send progress_pct and current_stage only (ProjectsService). */
  @Put(':id')
  @Roles('Admin', 'Designer', 'Installer')
  update(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projects.update(principal, id, dto);
  }

  /** The documented Kanban stage endpoint. */
  @Patch(':id/stage')
  @Roles('Admin', 'Designer', 'Installer')
  changeStage(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateProjectStageDto,
  ) {
    return this.projects.changeStage(principal, id, dto);
  }

  /* ---- The design-approval loop, driven from the client portal ---- */

  @Post(':id/approve')
  @Roles('Client')
  @HttpCode(200)
  approve(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: ProjectDecisionDto,
  ) {
    return this.projects.approve(principal, id, dto);
  }

  @Post(':id/request-changes')
  @Roles('Client')
  @HttpCode(200)
  requestChanges(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: ProjectDecisionDto,
  ) {
    return this.projects.requestChanges(principal, id, dto);
  }

  /** Refuses while invoices reference it; documents are detached, not deleted. */
  @Delete(':id')
  @Roles('Admin')
  remove(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.projects.remove(principal, id);
  }
}

@Module({
  imports: [NotificationsModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
})
export class ProjectsModule {}
