import { Controller, Get, Injectable, Module, Query } from '@nestjs/common';

import { CurrentUser, Roles } from '../../common/decorators';
import { AuthPrincipal } from '../../common/types/principal';
import { ActivityLogService } from '../../core/activity-log.service';

/**
 * What is left of the CRM's settings module: the audit-log viewer (Admin). Everything else it held moved or was superseded:
 * business profile -> site settings / the Company entry, staff -> Settings >
 * Users (modules/auth/users.ts), password and notification preferences for the
 * portal -> modules/auth/portal-account.ts.
 */

@Injectable()
export class SettingsService {
  constructor(private readonly activity: ActivityLogService) {}

  async activityLogs(limit: number) {
    return this.activity.list(limit);
  }
}

/** Rows about the platform itself: an Infra manager sees what was changed on these. Anything else is the business's. */
const PLATFORM_TABLES = new Set(['staff_users', 'staff_removal_requests', 'alert_settings', 'site_settings']);

/**
 * The audit log. The Admin sees all of it. The Infra manager sees who did what
 * and when, but `details` (client and staff names, invoice numbers, amounts,
 * document names) only on the platform's own rows, so the business's data
 * stays the business's.
 */
@Controller('activity-logs')
@Roles('Admin', 'Infra')
export class ActivityLogsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  async list(@CurrentUser() principal: AuthPrincipal, @Query('limit') limit?: string) {
    const parsed = Number(limit);
    const rows = await this.settings.activityLogs(Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 500) : 200);
    if (principal.role !== 'Infra') return rows;
    return rows.map((row) => (PLATFORM_TABLES.has(row.target_table) ? row : { ...row, details: null }));
  }
}

@Module({
  controllers: [ActivityLogsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
