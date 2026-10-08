import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { CurrentUser, Roles } from '../../common/decorators';
import { SavedReplyTemplate } from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { ActivityLogService } from '../../core/activity-log.service';
import { DatabaseService } from '../../data/database.service';

/**
 * What is left of the CRM's settings module: saved replies for the Messages
 * composer and the audit-log viewer (Admin). Everything else it held moved or was superseded:
 * business profile -> site settings / the Company entry, staff -> Settings >
 * Users (modules/auth/users.ts), password and notification preferences for the
 * portal -> modules/auth/portal-account.ts.
 */

export class SavedReplyDto {
  @IsString() @MinLength(2) @MaxLength(120) title!: string;
  @IsString() @MinLength(2) @MaxLength(5000) body!: string;
  /** True to share with the whole team (staff_id null). Admin only. */
  @IsOptional() @IsBoolean() is_shared?: boolean;
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly activity: ActivityLogService,
  ) {}

  /** The caller's own templates plus the shared/global ones. */
  async savedReplies(principal: AuthPrincipal): Promise<SavedReplyTemplate[]> {
    const rows = await this.db.savedReplyTemplates.findWhere({
      OR: [{ staff_id: null }, { staff_id: principal.id }],
    });
    return rows.sort((a, b) => a.title.localeCompare(b.title));
  }

  async createSavedReply(principal: AuthPrincipal, dto: SavedReplyDto): Promise<SavedReplyTemplate> {
    const shared = dto.is_shared === true;
    if (shared && principal.role !== 'Admin') {
      throw new ForbiddenException('Only an Admin can create a shared team template');
    }
    return this.db.savedReplyTemplates.create({
      staff_id: shared ? null : principal.id,
      title: dto.title.trim(),
      body: dto.body.trim(),
    });
  }

  async updateSavedReply(
    principal: AuthPrincipal,
    id: string,
    dto: SavedReplyDto,
  ): Promise<SavedReplyTemplate> {
    const existing = await this.db.savedReplyTemplates.findById(id);
    if (!existing) throw new NotFoundException('Template not found');
    this.assertCanEditTemplate(principal, existing);

    const updated = await this.db.savedReplyTemplates.update(id, {
      title: dto.title.trim(),
      body: dto.body.trim(),
      ...(dto.is_shared !== undefined && principal.role === 'Admin'
        ? { staff_id: dto.is_shared ? null : principal.id }
        : {}),
    });
    if (!updated) throw new NotFoundException('Template not found');
    return updated;
  }

  async removeSavedReply(principal: AuthPrincipal, id: string) {
    const existing = await this.db.savedReplyTemplates.findById(id);
    if (!existing) throw new NotFoundException('Template not found');
    this.assertCanEditTemplate(principal, existing);
    await this.db.savedReplyTemplates.delete(id);
    return { id, deleted: true as const };
  }

  /** Own templates are yours; shared ones belong to Admin. */
  private assertCanEditTemplate(principal: AuthPrincipal, template: SavedReplyTemplate): void {
    if (template.staff_id === null && principal.role !== 'Admin') {
      throw new ForbiddenException('Shared team templates can only be changed by an Admin');
    }
    if (template.staff_id !== null && template.staff_id !== principal.id && principal.role !== 'Admin') {
      throw new ForbiddenException('That template belongs to another team member');
    }
  }

  async activityLogs(limit: number) {
    return this.activity.list(limit);
  }
}

@Controller('saved-replies')
@Roles('Admin', 'Designer', 'Installer')
export class SavedRepliesController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  list(@CurrentUser() principal: AuthPrincipal) {
    return this.settings.savedReplies(principal);
  }

  @Post()
  create(@CurrentUser() principal: AuthPrincipal, @Body() dto: SavedReplyDto) {
    return this.settings.createSavedReply(principal, dto);
  }

  @Put(':id')
  update(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string, @Body() dto: SavedReplyDto) {
    return this.settings.updateSavedReply(principal, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.settings.removeSavedReply(principal, id);
  }
}

/** The security audit log. Admin only: it spans every client. */
@Controller('activity-logs')
@Roles('Admin')
export class ActivityLogsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  list(@Query('limit') limit?: string) {
    const parsed = Number(limit);
    return this.settings.activityLogs(Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 500) : 200);
  }
}

@Module({
  controllers: [SavedRepliesController, ActivityLogsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
