import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Injectable,
  Logger,
  Module,
  OnApplicationBootstrap,
  OnModuleDestroy,
  Post,
  Put,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

import { CurrentUser, Public, Roles } from '../../common/decorators';
import { OpeningHours, SITE_STATUSES, SiteSettings, SiteStatus } from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { ActivityLogService } from '../../core/activity-log.service';
import { MailService, templates } from '../../core/mail.service';
import { RevalidateService } from '../../core/revalidate.service';
import { DatabaseService } from '../../data/database.service';
import { fromCompany, parseOpeningHours } from './opening-hours';

const ID = 'site';
const PREVIEW_AUDIENCE = 'preview';

export class UpdateSiteSettingsDto {
  @IsIn(SITE_STATUSES)
  status!: SiteStatus;

  /** ISO-8601 with offset, or null for "no date yet". */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601({ strict: true })
  launch_at!: string | null;

  @IsArray()
  @ArrayMaxSize(10)
  @IsEmail({}, { each: true, message: 'Each notification address must be a valid email.' })
  @MaxLength(254, { each: true })
  notification_emails!: string[];

  /** Media ids. Omitted = unchanged; null = the shipped default. */
  @IsOptional() @ValidateIf((_, value) => value !== null) @IsString() @MaxLength(120) logo_light_id?: string | null;
  @IsOptional() @ValidateIf((_, value) => value !== null) @IsString() @MaxLength(120) logo_dark_id?: string | null;
  @IsOptional() @ValidateIf((_, value) => value !== null) @IsString() @MaxLength(120) favicon_id?: string | null;
  @IsOptional() @ValidateIf((_, value) => value !== null) @IsString() @MaxLength(120) favicon_dark_id?: string | null;
}

export class OpeningHoursDto {
  /** Checked field by field in parseOpeningHours. */
  @IsObject()
  hours!: Record<string, unknown>;
}

export class PreviewDto {
  @IsString()
  @MaxLength(2000)
  token!: string;
}

/** What the public site is told. Notification addresses never leave the API. */
export interface PublicSiteStatus {
  status: SiteStatus;
  launchAt: string | null;
  /** Media ids; null = what the site ships with. */
  brand: { logoLight: string | null; logoDark: string | null; favicon: string | null; faviconDark: string | null };
  /** Null = the company record's hours (nothing saved in Settings yet). */
  openingHours: OpeningHours | null;
}

const BRAND_KEYS = ['logo_light_id', 'logo_dark_id', 'favicon_id', 'favicon_dark_id'] as const;

/**
 * General site settings: whether the public site is live or showing its
 * coming-soon page, when it launches, and who receives enquiry emails.
 */
@Injectable()
export class SiteSettingsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(SiteSettingsService.name);
  private launchTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly db: DatabaseService,
    private readonly activity: ActivityLogService,
    private readonly revalidate: RevalidateService,
    private readonly mail: MailService,
    private readonly jwt: JwtService,
  ) {}

  /** The row, created with defaults on first read. A fresh install starts on coming soon. */
  async get(): Promise<SiteSettings> {
    const existing = await this.db.siteSettings.findById(ID);
    if (existing) return existing;
    return this.db.siteSettings.create({
      id: ID,
      status: 'coming_soon',
      launch_at: null,
      notification_emails: [],
      logo_light_id: 'logo-forest',
      logo_dark_id: 'logo-white',
      favicon_id: null,
      favicon_dark_id: null,
      opening_hours: null,
      updated_at: new Date().toISOString(),
      updated_by: null,
    });
  }

  async publicStatus(): Promise<PublicSiteStatus> {
    const row = await this.get();
    return {
      status: row.status,
      launchAt: row.launch_at,
      brand: {
        logoLight: row.logo_light_id,
        logoDark: row.logo_dark_id,
        favicon: row.favicon_id,
        faviconDark: row.favicon_dark_id,
      },
      openingHours: row.opening_hours,
    };
  }

  /** The hours Settings edits: what was saved, else the company record's. */
  async openingHours(): Promise<{ hours: OpeningHours; saved: boolean }> {
    const row = await this.get();
    if (row.opening_hours) return { hours: row.opening_hours, saved: true };
    const company = await this.db.cmsEntries.findOne((entry) => entry.collection === 'company');
    return { hours: fromCompany(company?.published ?? company?.draft), saved: false };
  }

  async saveOpeningHours(principal: AuthPrincipal, dto: OpeningHoursDto): Promise<{ hours: OpeningHours; saved: boolean }> {
    await this.get();
    const hours = parseOpeningHours(dto.hours);
    await this.db.siteSettings.update(ID, {
      opening_hours: hours,
      updated_at: new Date().toISOString(),
      updated_by: principal.name,
    });
    await this.activity.record({
      principal,
      action: 'opening_hours_update',
      targetTable: 'site_settings',
      targetId: ID,
      details: {},
    });
    await this.revalidate.ping('opening hours');
    return { hours, saved: true };
  }

  /** Where enquiries go: the configured list, else the bootstrap admin. */
  async notificationRecipients(): Promise<string[]> {
    const row = await this.get();
    if (row.notification_emails.length) return row.notification_emails;
    const fallback = process.env.ADMIN_EMAIL?.trim();
    return fallback ? [fallback] : [];
  }

  async update(principal: AuthPrincipal, dto: UpdateSiteSettingsDto): Promise<SiteSettings> {
    const current = await this.get();
    const emails = [...new Set(dto.notification_emails.map((e) => e.trim().toLowerCase()))];
    const brand: Partial<SiteSettings> = {};
    for (const key of BRAND_KEYS) {
      const id = dto[key];
      // The admin resends every slot on each save; only a new choice is checked,
      // or a default whose media row is missing would block every save.
      if (id === undefined || id === current[key]) continue;
      if (id !== null && !(await this.db.mediaAssets.findById(id))) {
        throw new BadRequestException('That image is no longer in the media library. Choose another.');
      }
      brand[key] = id;
    }
    const saved = (await this.db.siteSettings.update(ID, {
      status: dto.status,
      launch_at: dto.launch_at ? new Date(dto.launch_at).toISOString() : null,
      notification_emails: emails,
      ...brand,
      updated_at: new Date().toISOString(),
      updated_by: principal.name,
    }))!;
    await this.activity.record({
      principal,
      action: 'site_settings_update',
      targetTable: 'site_settings',
      targetId: ID,
      details: { status: saved.status, launch_at: saved.launch_at },
    });
    await this.revalidate.ping('site settings');
    this.armLaunchTimer(saved.launch_at);
    return saved;
  }

  async sendTest(principal: AuthPrincipal): Promise<{ sent: boolean; to: string[] }> {
    if (!this.mail.enabled) {
      throw new ServiceUnavailableException('Email is not configured on the server (SMTP_HOST).');
    }
    const to = await this.notificationRecipients();
    if (!to.length) throw new BadRequestException('Add a notification address first.');
    const sent = await this.mail.send({ to, ...templates.test() });
    if (!sent) throw new ServiceUnavailableException('The mail server refused the message. Check the API logs.');
    this.logger.log(`Test email sent by ${principal.email}`);
    return { sent, to };
  }

  /** A 10-minute token that lets whoever holds it see the site before launch. */
  async previewToken(): Promise<{ token: string }> {
    const token = await this.jwt.signAsync({ aud: PREVIEW_AUDIENCE }, { expiresIn: '10m' });
    return { token };
  }

  async checkPreview(token: string): Promise<{ ok: true }> {
    try {
      await this.jwt.verifyAsync(token, { audience: PREVIEW_AUDIENCE });
    } catch {
      throw new UnauthorizedException('That preview link has expired.');
    }
    return { ok: true };
  }

  /* ---- Launch timer ---- */

  async onApplicationBootstrap(): Promise<void> {
    const row = await this.get();
    this.armLaunchTimer(row.launch_at);
  }

  onModuleDestroy(): void {
    if (this.launchTimer) clearTimeout(this.launchTimer);
  }

  /**
   * At launch_at the site's cached pages still say "coming soon", so drop them.
   * setTimeout caps at ~24.8 days, hence the re-arm in chunks.
   *
   * ponytail: one process, one timer. With several API replicas each fires its
   * own (harmless, just repeated revalidation); across a restart it is re-armed
   * on boot. A missed launch still self-heals on the site's own revalidate
   * window.
   */
  private armLaunchTimer(launchAt: string | null): void {
    if (this.launchTimer) clearTimeout(this.launchTimer);
    this.launchTimer = null;
    if (!launchAt) return;
    const remaining = new Date(launchAt).getTime() - Date.now();
    if (remaining <= 0) return;
    const CHUNK = 24 * 24 * 60 * 60 * 1000;
    this.launchTimer = setTimeout(() => {
      if (remaining > CHUNK) return this.armLaunchTimer(launchAt);
      this.logger.log('Launch time reached; revalidating the public site.');
      void this.revalidate.ping('launch');
    }, Math.min(remaining, CHUNK));
    this.launchTimer.unref();
  }
}

@Controller()
export class SiteSettingsController {
  constructor(private readonly settings: SiteSettingsService) {}

  @Get('settings')
  @Roles('Admin')
  get() {
    return this.settings.get();
  }

  @Put('settings')
  @Roles('Admin')
  update(@CurrentUser() principal: AuthPrincipal, @Body() dto: UpdateSiteSettingsDto) {
    return this.settings.update(principal, dto);
  }

  @Get('settings/opening-hours')
  @Roles('Admin')
  openingHours() {
    return this.settings.openingHours();
  }

  @Put('settings/opening-hours')
  @Roles('Admin')
  saveOpeningHours(@CurrentUser() principal: AuthPrincipal, @Body() dto: OpeningHoursDto) {
    return this.settings.saveOpeningHours(principal, dto);
  }

  @Post('settings/test-email')
  @Roles('Admin')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  testEmail(@CurrentUser() principal: AuthPrincipal) {
    return this.settings.sendTest(principal);
  }

  @Post('settings/preview-token')
  @Roles('Admin', 'Editor', 'Designer')
  @HttpCode(200)
  previewToken() {
    return this.settings.previewToken();
  }

  /** Called server-to-server by apps/web's /api/preview before it enables draft mode. */
  @Public()
  @Post('content/preview')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 15 * 60_000 } })
  preview(@Body() dto: PreviewDto) {
    return this.settings.checkPreview(dto.token);
  }
}

@Module({
  controllers: [SiteSettingsController],
  providers: [SiteSettingsService],
  exports: [SiteSettingsService],
})
export class SiteSettingsModule {}
