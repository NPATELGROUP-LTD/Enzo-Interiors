import { timingSafeEqual } from 'node:crypto';

import {
  ArgumentsHost,
  BadRequestException,
  Body,
  Catch,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpException,
  Module,
  NotFoundException,
  Post,
  Put,
  Query,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import { APP_FILTER, BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { Throttle } from '@nestjs/throttler';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEmail, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Request } from 'express';

import { CurrentUser, Public, Roles } from '../../common/decorators';
import type { AlertEvent, AlertKind } from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { ActivityLogService } from '../../core/activity-log.service';
import { whereFrom } from '../../core/alert-scrub';
import { ALERT_SAMPLES, SAMPLE_IDS } from '../../core/alert-samples';
import { AlertService } from '../../core/alert.service';
import { MailService } from '../../core/mail.service';
import { corsOrigins } from '../../core/origins';
import type { AccessFilter } from '../../data/access-store';
import { DatabaseService } from '../../data/database.service';

const ID = 'alerts';
const KINDS: AlertKind[] = ['urgent', 'error', 'security'];

export class UpdateAlertsDto {
  @IsArray()
  @ArrayMaxSize(10)
  @IsEmail({}, { each: true, message: 'Each address must be a valid email.' })
  @MaxLength(254, { each: true })
  recipients!: string[];

  @IsBoolean()
  errors_on!: boolean;

  @IsOptional()
  @IsBoolean()
  digest_on?: boolean;
}

export class TestAlertDto {
  /** One of the sample alerts (GET /alerts/samples). */
  @IsOptional()
  @IsIn(SAMPLE_IDS)
  sample?: string;

  /** Older callers: the first sample of that kind. */
  @IsOptional()
  @IsIn(KINDS)
  kind?: AlertKind;
}

/** From the admin or the portal, when something in the browser threw. */
export class BrowserReportDto {
  @IsIn(['admin', 'portal'])
  app!: 'admin' | 'portal';

  @IsString()
  @MaxLength(300)
  message!: string;

  /** `file.js:12`, never a full address. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;
}

/** From the website's server, when a page failed to render. */
export class WebReportDto {
  @IsString()
  @MaxLength(300)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  route?: string;
}

const same = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

/**
 * Settings › Alerts for the Infra manager, and the two public doors errors
 * come in through. Nothing here reads business data.
 */
@Controller('alerts')
export class AlertsController {
  constructor(
    private readonly alerts: AlertService,
    private readonly db: DatabaseService,
    private readonly mail: MailService,
    private readonly activity: ActivityLogService,
  ) {}

  @Get()
  @Roles('Infra')
  async overview() {
    const row = await this.db.alertSettings.findById(ID);
    const recent = await this.db.alertEvents.findWhere({}, { orderBy: { last_at: 'desc' }, take: 20 });
    return {
      recipients: row?.recipients ?? [],
      errors_on: row?.errors_on ?? true,
      digest_on: row?.digest_on ?? true,
      updated_at: row?.updated_at ?? null,
      updated_by: row?.updated_by ?? null,
      /** Only that it exists: the addresses themselves stay in the server's settings. */
      fallback_recipients: row?.recipients.length ? 0 : (await this.alerts.recipients()).length,
      from: this.alerts.sender,
      mail_enabled: this.mail.enabled,
      recent: recent as AlertEvent[],
    };
  }

  @Put()
  @Roles('Infra')
  async update(@CurrentUser() principal: AuthPrincipal, @Body() dto: UpdateAlertsDto) {
    const patch = {
      recipients: [...new Set(dto.recipients.map((address) => address.trim().toLowerCase()))],
      errors_on: dto.errors_on,
      ...(dto.digest_on === undefined ? {} : { digest_on: dto.digest_on }),
      updated_at: new Date().toISOString(),
      updated_by: principal.name,
    };
    if (await this.db.alertSettings.findById(ID)) await this.db.alertSettings.update(ID, patch);
    else await this.db.alertSettings.create({ id: ID, digest_on: true, digest_day: null, ...patch });
    this.alerts.forgetSettings();
    await this.activity.record({
      principal,
      action: 'alert_settings_update',
      targetTable: 'alert_settings',
      targetId: ID,
      details: { recipients: patch.recipients.length, errors_on: patch.errors_on, digest_on: dto.digest_on ?? null },
    });
    return this.overview();
  }

  /** Every kind of alert the platform sends, with the facts and advice a real one carries. */
  @Get('samples')
  @Roles('Infra')
  samples() {
    return this.alerts.samples();
  }

  @Post('test')
  @Roles('Infra')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 15 * 60_000 } })
  async test(@Body() dto: TestAlertDto) {
    if (!this.mail.enabled) throw new ServiceUnavailableException('Email is not configured on the server (SMTP_HOST).');
    const sample = dto.sample ?? ALERT_SAMPLES.find((row) => row.kind === (dto.kind ?? 'error'))!.id;
    const { sent, to } = await this.alerts.sendTest(sample);
    if (!to.length) throw new BadRequestException('Add a recipient first, or set ALERT_TO on the server.');
    if (!sent) throw new ServiceUnavailableException('The test email could not be sent. The server log says why.');
    return { to, from: this.alerts.sender };
  }

  /**
   * Open to anyone who can reach the API, so it is small: a page of known
   * origins only, 10 reports per 15 minutes per address, 300 characters a
   * report, and its own small email budget (alert.service). Origin is a
   * browser-honoured header, not a lock: it stops other sites' pages, not curl.
   */
  @Public()
  @Post('browser')
  @HttpCode(204)
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  browser(@Req() request: Request, @Body() dto: BrowserReportDto): void {
    if (!corsOrigins().includes(request.headers.origin ?? '')) throw new ForbiddenException();
    this.alerts.report({ kind: 'error', source: dto.app, title: dto.message, location: dto.location });
  }

  /** The website's server tells us, with a secret the browser never sees. Off until ALERT_SHARED_SECRET is set. */
  @Public()
  @Post('web')
  @HttpCode(204)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  web(@Headers('x-alert-secret') secret: string | undefined, @Body() dto: WebReportDto): void {
    const expected = process.env.ALERT_SHARED_SECRET;
    if (!expected) throw new NotFoundException();
    if (!secret || !same(secret, expected)) throw new ForbiddenException();
    this.alerts.report({ kind: 'error', source: 'web', title: dto.message, route: dto.route });
  }
}

/**
 * Nest's own error handling, plus a word to the alert service about every
 * failure that is the server's fault. A 503 is left out: the API sends one on
 * purpose (email not configured, a sign-in code that could not be sent) and
 * the health check already reports the one that matters.
 */
@Catch()
export class AlertingFilter extends BaseExceptionFilter {
  constructor(
    adapter: HttpAdapterHost,
    private readonly alerts: AlertService,
  ) {
    super(adapter.httpAdapter);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() === 'http') {
      const status = exception instanceof HttpException ? exception.getStatus() : 500;
      if (status >= 500 && status !== 503) {
        const request = host.switchToHttp().getRequest<Request>();
        const code = (exception as { code?: unknown })?.code;
        const message = exception instanceof Error ? exception.message : 'Unknown error';
        this.alerts.report({
          kind: 'error',
          source: 'api',
          // A database error's code (P2022) says more than its first line does.
          title: typeof code === 'string' && /^P\d{4}$/.test(code) ? `${code} ${message}` : message,
          // The route as written (/clients/:id), not the address asked for.
          route: `${request.method} ${request.route?.path ?? '(no route)'}`,
          location: whereFrom(exception) ?? undefined,
          status,
        });
      }
    }
    super.catch(exception, host);
  }
}

export class AccessLogQuery {
  @IsOptional()
  @IsIn(['all', 'signins', 'failures', 'changes'])
  filter?: AccessFilter;

  /** Part of a name, or an exact IP. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  q?: string;

  /** The `at` of the last row you have; the next page is older than it. */
  @IsOptional()
  @IsDateString()
  before?: string;
}

const PAGE = 100;

/**
 * Who signed in and what they changed, from where (core/access-log.service).
 * The Infra manager only: it carries IP addresses and client names, so not even
 * the Admin reads it. Looking at it is itself logged.
 */
@Controller('access-log')
export class AccessLogController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  @Roles('Infra')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async list(@Query() query: AccessLogQuery) {
    const rows = await this.db.accessStore.list({ filter: query.filter ?? 'all', q: query.q?.trim() || undefined, before: query.before, take: PAGE + 1 });
    const events = rows.slice(0, PAGE);
    return { events, next: rows.length > PAGE ? events[events.length - 1]!.at : null };
  }
}

@Module({
  controllers: [AlertsController, AccessLogController],
  providers: [{ provide: APP_FILTER, useClass: AlertingFilter }],
})
export class AlertsModule {}
