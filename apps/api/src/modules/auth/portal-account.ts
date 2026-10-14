import { Body, Controller, Get, Injectable, NotFoundException, Put } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsBoolean, IsOptional } from 'class-validator';

import { CurrentUser, Roles } from '../../common/decorators';
import { NotificationPreference } from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { ClientIp } from '../../core/client-ip';
import { DatabaseService } from '../../data/database.service';
import { AuthService, LoginResult } from './auth.service';
import { ChangePasswordDto } from './dto';

/**
 * The portal's own account routes. Client-only (@Roles('Client')): staff change
 * their password at PUT /auth/password and have no preferences screen.
 */

export class UpdateNotificationPreferencesDto {
  @IsOptional() @IsBoolean() email_enabled?: boolean;
  @IsOptional() @IsBoolean() sms_enabled?: boolean;
  @IsOptional() @IsBoolean() in_app_enabled?: boolean;
}

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

  async update(principal: AuthPrincipal, dto: UpdateNotificationPreferencesDto): Promise<NotificationPreference> {
    const current = await this.preferences(principal);
    const updated = await this.db.notificationPreferences.update(current.id, dto);
    if (!updated) throw new NotFoundException('Notification preferences not found');
    return updated;
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
}

@Controller('notification-preferences')
@Roles('Client')
export class PortalPreferencesController {
  constructor(private readonly account: PortalAccountService) {}

  @Get()
  get(@CurrentUser() principal: AuthPrincipal) {
    return this.account.preferences(principal);
  }

  @Put()
  update(@CurrentUser() principal: AuthPrincipal, @Body() dto: UpdateNotificationPreferencesDto) {
    return this.account.update(principal, dto);
  }
}
