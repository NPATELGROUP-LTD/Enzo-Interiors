import {
  BadRequestException,
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
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { CurrentUser, Roles } from '../../common/decorators';
import { hashPassword, verify } from '../auth/auth.service';
import {
  BusinessSettings,
  NotificationPreference,
  STAFF_ROLES,
  SavedReplyTemplate,
  StaffRole,
  StaffUser,
} from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { ActivityLogService } from '../../core/activity-log.service';
import { DatabaseService } from '../../data/database.service';

/* -------------------------------------------------------------------------- */
/* DTOs                                                                       */
/* -------------------------------------------------------------------------- */

export class UpdateBusinessSettingsDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(160) business_name?: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) vat_rate?: number;
  @IsOptional() @IsString() @MaxLength(500) logo_url?: string | null;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'Brand colour must be a hex value such as #173C30' })
  brand_primary_color?: string;

  @IsOptional() @IsEmail({}, { message: 'Enter a valid email address' }) email_from_address?: string | null;
}

export class CreateStaffDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsEmail({}, { message: 'Enter a valid email address' }) email!: string;
  @IsIn(STAFF_ROLES, { message: `Role must be one of: ${STAFF_ROLES.join(', ')}` }) role!: StaffRole;

  @IsString() @MinLength(12, { message: 'Use at least 12 characters' }) @MaxLength(72) password!: string;
}

export class UpdateStaffDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsIn(STAFF_ROLES) role?: StaffRole;
  @IsOptional() @IsString() @MinLength(12, { message: 'Use at least 12 characters' }) @MaxLength(72) password?: string;
}

export class UpdateNotificationPreferencesDto {
  @IsOptional() @IsBoolean() email_enabled?: boolean;
  @IsOptional() @IsBoolean() sms_enabled?: boolean;
  @IsOptional() @IsBoolean() in_app_enabled?: boolean;
}

export class SavedReplyDto {
  @IsString() @MinLength(2) @MaxLength(120) title!: string;
  @IsString() @MinLength(2) body!: string;
  /** True to share with the whole team (staff_id null). Admin only. */
  @IsOptional() @IsBoolean() is_shared?: boolean;
}

export class ChangePasswordDto {
  @IsString() current_password!: string;
  @IsString() @MinLength(12, { message: 'Use at least 12 characters' }) @MaxLength(72) new_password!: string;
}

/** Staff as returned over the wire — never carries the credential. */
export type StaffView = Omit<StaffUser, 'password_hash'>;

const toStaffView = (staff: StaffUser): StaffView => {
  const { password_hash, ...rest } = staff;
  return rest;
};

/* -------------------------------------------------------------------------- */
/* Service                                                                    */
/* -------------------------------------------------------------------------- */

@Injectable()
export class SettingsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly activity: ActivityLogService,
  ) {}

  /* ---- Business profile ---- */

  async businessSettings(): Promise<BusinessSettings> {
    return this.db.settings();
  }

  async updateBusinessSettings(
    principal: AuthPrincipal,
    dto: UpdateBusinessSettingsDto,
  ): Promise<BusinessSettings> {
    const current = await this.db.settings();
    const existing = await this.db.businessSettings.findById(current.id);

    const saved = existing
      ? await this.db.businessSettings.update(current.id, dto as Partial<BusinessSettings>)
      : await this.db.businessSettings.create({ ...current, ...dto });

    if (!saved) throw new NotFoundException('Business settings not found');

    await this.activity.record({
      principal,
      action: 'business_settings_update',
      targetTable: 'business_settings',
      targetId: saved.id,
      details: { fields: Object.keys(dto) },
    });
    return saved;
  }

  /* ---- Team ---- */

  async listStaff(): Promise<StaffView[]> {
    const staff = await this.db.staffUsers.findAll();
    return staff.sort((a, b) => a.name.localeCompare(b.name)).map(toStaffView);
  }

  async createStaff(principal: AuthPrincipal, dto: CreateStaffDto): Promise<StaffView> {
    const clash = await this.db.staffUsers.findOne(
      (row) => row.email.toLowerCase() === dto.email.trim().toLowerCase(),
    );
    if (clash) throw new BadRequestException('A team member with that email already exists');

    const now = new Date().toISOString();
    const created = await this.db.staffUsers.create({
      name: dto.name.trim(),
      email: dto.email.trim().toLowerCase(),
      password_hash: await hashPassword(dto.password),
      role: dto.role,
      token_version: 0,
      reset_token_hash: null,
      reset_expires_at: null,
      created_at: now,
      updated_at: now,
    });

    await this.activity.record({
      principal,
      action: 'staff_create',
      targetTable: 'staff_users',
      targetId: created.id,
      details: { name: created.name, role: created.role },
    });
    return toStaffView(created);
  }

  async updateStaff(principal: AuthPrincipal, id: string, dto: UpdateStaffDto): Promise<StaffView> {
    const existing = await this.db.staffUsers.findById(id);
    if (!existing) throw new NotFoundException('Team member not found');

    if (dto.email && dto.email.toLowerCase() !== existing.email.toLowerCase()) {
      const clash = await this.db.staffUsers.findOne(
        (row) => row.email.toLowerCase() === dto.email!.trim().toLowerCase(),
      );
      if (clash) throw new BadRequestException('A team member with that email already exists');
    }

    // Guard against locking the business out of its own CRM by demoting the
    // last Admin — there would then be nobody who could promote anyone back.
    if (dto.role && dto.role !== 'Admin' && existing.role === 'Admin') {
      const admins = await this.db.staffUsers.count((row) => row.role === 'Admin');
      if (admins <= 1) {
        throw new BadRequestException(
          'This is the only Admin account. Promote another team member to Admin before changing this one.',
        );
      }
    }

    const patch: Partial<StaffUser> = { updated_at: new Date().toISOString() };
    if (dto.name !== undefined) patch.name = dto.name.trim();
    if (dto.email !== undefined) patch.email = dto.email.trim().toLowerCase();
    if (dto.role !== undefined) patch.role = dto.role;
    if (dto.password !== undefined) {
      patch.password_hash = await hashPassword(dto.password);
      patch.token_version = existing.token_version + 1;
    }

    const updated = await this.db.staffUsers.update(id, patch);
    if (!updated) throw new NotFoundException('Team member not found');

    await this.activity.record({
      principal,
      action: dto.role && dto.role !== existing.role ? 'staff_role_change' : 'staff_update',
      targetTable: 'staff_users',
      targetId: id,
      details:
        dto.role && dto.role !== existing.role
          ? { name: updated.name, from: existing.role, to: dto.role }
          : { name: updated.name, fields: Object.keys(dto) },
    });
    return toStaffView(updated);
  }

  async removeStaff(principal: AuthPrincipal, id: string) {
    const staff = await this.db.staffUsers.findById(id);
    if (!staff) throw new NotFoundException('Team member not found');

    if (staff.id === principal.id) {
      throw new BadRequestException('You cannot delete your own account.');
    }
    if (staff.role === 'Admin') {
      const admins = await this.db.staffUsers.count((row) => row.role === 'Admin');
      if (admins <= 1) {
        throw new BadRequestException('This is the only Admin account and cannot be deleted.');
      }
    }

    const [clients, projects] = await Promise.all([
      this.db.clients.count((row) => row.assigned_staff_id === id),
      this.db.projects.count((row) => row.assigned_designer_id === id),
    ]);
    if (clients > 0 || projects > 0) {
      throw new BadRequestException(
        `${staff.name} is still assigned to ${clients} client(s) and ${projects} project(s). ` +
          'Reassign that work before removing the account.',
      );
    }

    await this.db.staffUsers.delete(id);
    await this.db.notificationPreferences.deleteMany(
      (row) => row.owner_type === 'Staff' && row.owner_id === id,
    );

    await this.activity.record({
      principal,
      action: 'staff_delete',
      targetTable: 'staff_users',
      targetId: id,
      details: { name: staff.name, role: staff.role },
    });
    return { id, deleted: true as const };
  }

  /* ---- Notification preferences ---- */

  /**
   * The caller's own preferences, created on first read so a principal that
   * predates the preferences table still gets sensible defaults.
   *
   * These toggles are stored faithfully but NOTHING sends: real email and SMS
   * delivery is permanently out of scope this phase.
   */
  async notificationPreferences(principal: AuthPrincipal): Promise<NotificationPreference> {
    const existing = await this.db.notificationPreferences.findOne(
      (row) => row.owner_id === principal.id && row.owner_type === principal.kind,
    );
    if (existing) return existing;

    return this.db.notificationPreferences.create({
      owner_id: principal.id,
      owner_type: principal.kind,
      email_enabled: true,
      sms_enabled: false,
      in_app_enabled: true,
    });
  }

  async updateNotificationPreferences(
    principal: AuthPrincipal,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreference> {
    const current = await this.notificationPreferences(principal);
    const updated = await this.db.notificationPreferences.update(current.id, dto);
    if (!updated) throw new NotFoundException('Notification preferences not found');
    return updated;
  }

  /* ---- Password ---- */

  /**
   * Change your own password.
   *
   * Not mounted in v1: staff use PUT /auth/password, which also re-issues
   * the token. Kept hashed so remounting this is safe.
   */
  async changePassword(principal: AuthPrincipal, dto: ChangePasswordDto): Promise<{ ok: true }> {
    if (principal.kind === 'Staff') {
      const staff = await this.db.staffUsers.findById(principal.id);
      if (!staff || !(await verify(dto.current_password, staff.password_hash))) {
        throw new BadRequestException('Your current password is not correct');
      }
      await this.db.staffUsers.update(principal.id, {
        password_hash: await hashPassword(dto.new_password),
        token_version: staff.token_version + 1,
        updated_at: new Date().toISOString(),
      });
    } else {
      const client = await this.db.clients.findById(principal.id);
      if (!client || !(await verify(dto.current_password, client.password_hash))) {
        throw new BadRequestException('Your current password is not correct');
      }
      await this.db.clients.update(principal.id, {
        password_hash: await hashPassword(dto.new_password),
        updated_at: new Date().toISOString(),
      });
    }

    await this.activity.record({
      principal,
      action: 'password_change',
      targetTable: principal.kind === 'Staff' ? 'staff_users' : 'clients',
      targetId: principal.id,
      details: null,
    });
    return { ok: true };
  }

  /* ---- Saved replies ---- */

  /** The caller's own templates plus the shared/global ones. */
  async savedReplies(principal: AuthPrincipal): Promise<SavedReplyTemplate[]> {
    const rows = await this.db.savedReplyTemplates.findAll(
      (row) => row.staff_id === null || row.staff_id === principal.id,
    );
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

  /* ---- Audit log ---- */

  async activityLogs(limit: number) {
    return this.activity.list(limit);
  }
}

/* -------------------------------------------------------------------------- */
/* Controllers                                                                */
/* -------------------------------------------------------------------------- */

@Controller('business-settings')
export class BusinessSettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** Readable by any authenticated principal — the portal needs VAT and brand. */
  @Get()
  get() {
    return this.settings.businessSettings();
  }

  @Put()
  @Roles('Admin')
  update(@CurrentUser() principal: AuthPrincipal, @Body() dto: UpdateBusinessSettingsDto) {
    return this.settings.updateBusinessSettings(principal, dto);
  }
}

@Controller('staff')
@Roles('Admin', 'Designer', 'Installer')
export class StaffController {
  constructor(private readonly settings: SettingsService) {}

  /** All staff can see the team list — needed to assign a designer. */
  @Get()
  list() {
    return this.settings.listStaff();
  }

  @Post()
  @Roles('Admin')
  create(@CurrentUser() principal: AuthPrincipal, @Body() dto: CreateStaffDto) {
    return this.settings.createStaff(principal, dto);
  }

  @Put(':id')
  @Roles('Admin')
  update(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.settings.updateStaff(principal, id, dto);
  }

  @Delete(':id')
  @Roles('Admin')
  remove(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.settings.removeStaff(principal, id);
  }
}

@Controller('notification-preferences')
export class NotificationPreferencesController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get(@CurrentUser() principal: AuthPrincipal) {
    return this.settings.notificationPreferences(principal);
  }

  @Put()
  update(
    @CurrentUser() principal: AuthPrincipal,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.settings.updateNotificationPreferences(principal, dto);
  }
}

@Controller('account')
export class AccountController {
  constructor(private readonly settings: SettingsService) {}

  @Put('password')
  changePassword(@CurrentUser() principal: AuthPrincipal, @Body() dto: ChangePasswordDto) {
    return this.settings.changePassword(principal, dto);
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
  update(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: SavedReplyDto,
  ) {
    return this.settings.updateSavedReply(principal, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.settings.removeSavedReply(principal, id);
  }
}

/** The Settings security audit log. Admin only — it spans every client. */
@Controller('activity-logs')
@Roles('Admin')
export class ActivityLogsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  list(@Query('limit') limit?: string) {
    const parsed = Number(limit);
    return this.settings.activityLogs(Number.isFinite(parsed) && parsed > 0 ? parsed : 200);
  }
}

@Module({
  controllers: [
    BusinessSettingsController,
    StaffController,
    NotificationPreferencesController,
    AccountController,
    SavedRepliesController,
    ActivityLogsController,
  ],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
