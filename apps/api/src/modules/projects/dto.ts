import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

import { PROJECT_STAGES, ProjectStage, SERVICE_TYPES, ServiceType } from '../../common/types/domain';

export class CreateProjectDto {
  @IsString() client_id!: string;

  @IsString() @MinLength(2, { message: 'Enter a project name' }) @MaxLength(160) name!: string;

  @IsIn(SERVICE_TYPES, { message: `Type must be one of: ${SERVICE_TYPES.join(', ')}` })
  type!: ServiceType;

  @IsOptional() @IsIn(PROJECT_STAGES) status?: ProjectStage;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) progress_pct?: number;
  @IsOptional() @IsString() @MaxLength(80) current_stage?: string | null;
  @IsOptional() @IsString() assigned_designer_id?: string | null;
  @IsOptional() @IsBoolean() client_visible?: boolean;
}

export class UpdateProjectDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(160) name?: string;
  @IsOptional() @IsIn(SERVICE_TYPES) type?: ServiceType;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) progress_pct?: number;
  @IsOptional() @IsString() @MaxLength(80) current_stage?: string | null;
  @IsOptional() @IsString() assigned_designer_id?: string | null;
  /** The admin's "send to client" toggle. */
  @IsOptional() @IsBoolean() client_visible?: boolean;
}

/** PATCH /projects/:id/stage — Kanban drag-and-drop and the "Move to…" menu. */
export class UpdateProjectStageDto {
  @IsIn(PROJECT_STAGES, { message: `Stage must be one of: ${PROJECT_STAGES.join(', ')}` })
  status!: ProjectStage;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) progress_pct?: number;
  @IsOptional() @IsString() @MaxLength(80) current_stage?: string | null;
}

/** Approve / Request Changes from the client portal. */
export class ProjectDecisionDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
