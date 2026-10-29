import { Body, Controller, Get, HttpCode, Injectable, NotFoundException, Post, Put } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, ValidateNested } from 'class-validator';

import { CurrentUser, Roles } from '../../common/decorators';
import { NotificationPreference } from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { ClientIp } from '../../core/client-ip';
import { DatabaseService } from '../../data/database.service';
import { NOTIFY_CATEGORIES, choicesOf } from '../notifications/preferences';
import { AuthService, LoginResult } from './auth.service';
import { ChangePasswordDto } from './dto';

/**
 * The portal's own account routes. Client-only (@Roles('Client')): staff change
 * their password at PUT /auth/password and have no preferences screen.
 */

/** How one kind of update may reach the client. */
class ChannelChoicesDto {
  @IsOptional() @IsBoolean() in_app?: boolean;
  @IsOptional() @IsBoolean() email?: boolean;
  @IsOptional() @IsBoolean() push?: boolean;
}

class CategoryChoicesDto {
  @IsOptional() @ValidateNested() @Type(() => ChannelChoicesDto) project?: ChannelChoicesDto;
  @IsOptional() @ValidateNested() @Type(() => ChannelChoicesDto) invoice?: ChannelChoicesDto;
  @IsOptional() @ValidateNested() @Type(() => ChannelChoicesDto) document?: ChannelChoicesDto;
  @IsOptional() @ValidateNested() @Type(() => ChannelChoicesDto) message?: ChannelChoicesDto;
}

export class UpdateNotificationPreferencesDto {
  @IsOptional() @IsBoolean() email_enabled?: boolean;
  @IsOptional() @IsBoolean() sms_enabled?: boolean;
  @IsOptional() @IsBoolean() in_app_enabled?: boolean;
  /** Per-type choices; only what is sent changes. */
  @IsOptional() @ValidateNested() @Type(() => CategoryChoicesDto) categories?: CategoryChoicesDto;
}

/** The row, plus the full grid of what each kind of update may do (defaults filled in). */
const view = (row: NotificationPreference) => ({ ...row, categories: choicesOf(row) });

@Injectable()
export class PortalAccountService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * The client's own row, made with defaults on first read. These toggles are
   * stored faithfully but nothing sends SMS, and email is the platform's own
   * transactional mail.
   */
  async preferences(principal: AuthPrincipal): Promise<NotificationPreference> {
    const where = { owner_id: principal.id, owner_type: 'Client' };
    return (
      (await this.db.notificationPreferences.findFirstWhere(where)) ??
      this.db.notificationPreferences.create({ ...where, email_enabled: true, sms_enabled: false, in_app_enabled: true } as Omit<NotificationPreference, 'id'>)
    );
  }

  async view(principal: AuthPrincipal) {
    return view(await this.preferences(principal));
  }

  async update(principal: AuthPrincipal, dto: UpdateNotificationPreferencesDto) {
    const current = await this.preferences(principal);
    const { categories, ...flags } = dto;
    const merged = { ...current.categories };
    for (const category of NOTIFY_CATEGORIES) {
      if (categories?.[category]) merged[category] = { ...merged[category], ...JSON.parse(JSON.stringify(categories[category])) };
    }
    const updated = await this.db.notificationPreferences.update(current.id, { ...flags, ...(categories ? { categories: merged } : {}) });
    if (!updated) throw new NotFoundException('Notification preferences not found');
    return view(updated);
  }
}

@Controller('account')
@Roles('Client')
export class PortalPasswordController {
  constructor(private readonly auth: AuthService) {}

  /** Returns a new session: the one that asked, like every other, is now void. */
  @Put('password')
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  changePassword(
    @CurrentUser() principal: AuthPrincipal,
    @Body() dto: ChangePasswordDto,
    @ClientIp() ip: string,
  ): Promise<LoginResult> {
    return this.auth.changeClientPassword(principal, dto.current_password, dto.new_password, ip);
  }

  /** "Keep this password": the portal stops asking them to change the emailed one. */
  @Post('password/keep')
  @HttpCode(204)
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  keepPassword(@CurrentUser() principal: AuthPrincipal): Promise<void> {
    return this.auth.keepClientPassword(principal);
  }
}

@Controller('notification-preferences')
@Roles('Client')
export class PortalPreferencesController {
  constructor(private readonly account: PortalAccountService) {}

  @Get()
  get(@CurrentUser() principal: AuthPrincipal) {
    return this.account.view(principal);
  }

  @Put()
  update(@CurrentUser() principal: AuthPrincipal, @Body() dto: UpdateNotificationPreferencesDto) {
    return this.account.update(principal, dto);
  }
}
