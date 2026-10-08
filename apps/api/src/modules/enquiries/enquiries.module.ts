import {
  Body,
  Controller,
  Get,
  HttpCode,
  Injectable,
  Logger,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsDateString,
  IsInt,
  IsObject,
  Max,
  Min,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateBy,
  ValidationOptions,
} from 'class-validator';
import type { Response } from 'express';

import { CurrentUser, Public, Roles } from '../../common/decorators';
import {
  ContactSubmission,
  ENQUIRY_KINDS,
  EnquiryKind,
  SUBMISSION_STATUSES,
  SubmissionStatus,
} from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { ActivityLogService } from '../../core/activity-log.service';
import { MailService, templates } from '../../core/mail.service';
import { DatabaseService } from '../../data/database.service';
import { SiteSettingsModule, SiteSettingsService } from '../site-settings/site-settings.module';

/** At most 20 flat string fields of at most 500 characters: a form's extras, nothing more. */
function IsFlatDetails(options?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'isFlatDetails',
      validator: {
        validate: (value: unknown) =>
          value !== null &&
          typeof value === 'object' &&
          !Array.isArray(value) &&
          Object.entries(value as Record<string, unknown>).length <= 20 &&
          Object.entries(value as Record<string, unknown>).every(
            ([key, v]) => key.length <= 60 && typeof v === 'string' && v.length <= 500,
          ),
        defaultMessage: () => 'details must be at most 20 short text fields.',
      },
    },
    options,
  );
}

export class CreateEnquiryDto {
  @IsIn(ENQUIRY_KINDS)
  kind!: EnquiryKind;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(254)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  message?: string;

  @IsOptional()
  @IsObject()
  @IsFlatDetails()
  details?: Record<string, string>;

  /** Honeypot. Hidden from people; a bot that fills it gets a quiet 204. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  website?: string;
}

export class ListEnquiriesQuery {
  @IsOptional()
  @IsIn(SUBMISSION_STATUSES)
  status?: SubmissionStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  /** The `created_at` of the last row you have; the next page is older than it. */
  @IsOptional()
  @IsDateString()
  before?: string;
}

export class UpdateEnquiryDto {
  @IsIn(SUBMISSION_STATUSES, { message: `Status must be one of: ${SUBMISSION_STATUSES.join(', ')}` })
  status!: SubmissionStatus;
}

@Injectable()
export class EnquiriesService {
  private readonly logger = new Logger(EnquiriesService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly mail: MailService,
    private readonly settings: SiteSettingsService,
    private readonly activity: ActivityLogService,
  ) {}

  /** Newest first, filtered and cut in SQL. `new_count` feeds the menu badge. */
  async list(query: ListEnquiriesQuery) {
    const limit = query.limit ?? 30;
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.before ? { created_at: { lt: new Date(query.before) } } : {}),
    };
    const [rows, new_count] = await Promise.all([
      this.db.contactSubmissions.findWhere(where, { orderBy: { created_at: 'desc' }, take: limit + 1 }),
      this.db.contactSubmissions.countWhere({ status: 'New' }),
    ]);
    return { items: rows.slice(0, limit), has_more: rows.length > limit, new_count };
  }

  async findOne(id: string): Promise<ContactSubmission> {
    const row = await this.db.contactSubmissions.findById(id);
    if (!row) throw new NotFoundException('Enquiry not found');
    return row;
  }

  async setStatus(principal: AuthPrincipal, id: string, dto: UpdateEnquiryDto): Promise<ContactSubmission> {
    const existing = await this.findOne(id);
    const updated = await this.db.contactSubmissions.update(id, { status: dto.status });
    if (!updated) throw new NotFoundException('Enquiry not found');
    await this.activity.record({
      principal,
      action: 'enquiry_status_change',
      targetTable: 'contact_submissions',
      targetId: id,
      details: { from: existing.status, to: dto.status, name: existing.name },
    });
    return updated;
  }

  async create(dto: CreateEnquiryDto): Promise<void> {
    const details = dto.details && Object.keys(dto.details).length ? dto.details : null;
    const row = await this.db.contactSubmissions.create({
      kind: dto.kind,
      name: dto.name.trim(),
      email: dto.email.trim(),
      phone: dto.phone?.trim() || null,
      service_interest: details?.service ?? null,
      message: dto.message?.trim() ?? '',
      details,
      status: 'New',
      created_at: new Date().toISOString(),
    });

    const to = await this.settings.notificationRecipients();
    if (!to.length) {
      this.logger.warn(`Enquiry ${row.id} saved, but there is nobody to notify.`);
      return;
    }
    // Stored first, emailed second: a mail outage must not lose the lead.
    await this.mail.send({
      to,
      replyTo: row.email,
      ...templates.enquiry({
        kind: row.kind,
        name: row.name,
        email: row.email,
        phone: row.phone,
        message: row.message,
        details: row.details,
      }),
    });
  }
}

@Controller('enquiries')
export class EnquiriesController {
  constructor(private readonly enquiries: EnquiriesService) {}

  @Public()
  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  async create(@Body() dto: CreateEnquiryDto, @Res({ passthrough: true }) res: Response) {
    if (dto.website) {
      res.status(204);
      return;
    }
    await this.enquiries.create(dto);
    return { ok: true };
  }

  @Get()
  @Roles('Admin')
  list(@Query() query: ListEnquiriesQuery) {
    return this.enquiries.list(query);
  }

  @Get(':id')
  @Roles('Admin')
  findOne(@Param('id') id: string) {
    return this.enquiries.findOne(id);
  }

  @Patch(':id')
  @Roles('Admin')
  update(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string, @Body() dto: UpdateEnquiryDto) {
    return this.enquiries.setStatus(principal, id, dto);
  }
}

@Module({
  imports: [SiteSettingsModule],
  controllers: [EnquiriesController],
  providers: [EnquiriesService],
})
export class EnquiriesModule {}
