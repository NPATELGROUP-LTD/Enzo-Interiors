import { IsArray, IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { ProjectStage, SERVICE_TYPES, ServiceType } from '../../common/types/domain';

/** POST /projects — Admin only. */
export class CreateProjectDto {
  @IsString() @MaxLength(64) client_id!: string;

  @IsString() @MinLength(2, { message: 'Enter a project name' }) @MaxLength(160) name!: string;

  @IsIn(SERVICE_TYPES, { message: `Type must be one of: ${SERVICE_TYPES.join(', ')}` })
  type!: ServiceType;

  /** One of the configured stages (checked by ProjectsService); omitted = the first. */
  @IsOptional() @IsString() @MaxLength(40) status?: ProjectStage;
  @IsOptional() @IsString() @MaxLength(80) current_stage?: string | null;
  @IsOptional() @IsString() @MaxLength(64) assigned_designer_id?: string | null;
  @IsOptional() @IsString() @MaxLength(64) assigned_installer_id?: string | null;
  /** Off unless the Admin sends it to the client. */
  @IsOptional() @IsBoolean() client_visible?: boolean;
}

/**
 * PUT /projects/:id. A Designer may send only current_stage (ProjectsService);
 * progress always follows the stage; the rest is the Admin's. The client is fixed at creation:
 * moving a project would strand its documents and invoices. Who works on it is
 * POST /projects/:id/team (team.controller.ts), not a field here.
 */
export class UpdateProjectDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(160) name?: string;
  @IsOptional() @IsIn(SERVICE_TYPES) type?: ServiceType;
  @IsOptional() @IsString() @MaxLength(80) current_stage?: string | null;
  /** The admin's "send to client" toggle. */
  @IsOptional() @IsBoolean() client_visible?: boolean;
}

/** PATCH /projects/:id/stage — Kanban drag-and-drop and the "Move to…" menu. */
export class UpdateProjectStageDto {
  /** One of the configured stages (checked by ProjectsService). */
  @IsString() @MaxLength(40) status!: ProjectStage;

  @IsOptional() @IsString() @MaxLength(80) current_stage?: string | null;
}

/** PUT /projects/stages — Admin only. Each item is checked in stages.ts planStages. */
export class SaveProjectStagesDto {
  @IsArray() stages!: unknown[];
}

/** Approve / Request Changes from the client portal. */
export class ProjectDecisionDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
