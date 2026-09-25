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
import {
  CreateProjectDto,
  ProjectDecisionDto,
  UpdateProjectDto,
  UpdateProjectStageDto,
} from './dto';
import { ProjectsService } from './projects.service';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  /** Admin Kanban/list, and the portal's My Projects, both read from here. */
  @Get()
  list(@CurrentUser() principal: AuthPrincipal) {
    return this.projects.list(principal);
  }

  @Get(':id')
  findOne(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.projects.findOne(principal, id);
  }

  /** Aggregate feed for Project Detail (timeline, documents, activity). */
  @Get(':id/detail')
  detail(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.projects.detail(principal, id);
  }

  @Post()
  @Roles('Admin', 'Designer')
  create(@CurrentUser() principal: AuthPrincipal, @Body() dto: CreateProjectDto) {
    return this.projects.create(principal, dto);
  }

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

  @Delete(':id')
  @Roles('Admin')
  remove(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.projects.remove(principal, id);
  }
}

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
