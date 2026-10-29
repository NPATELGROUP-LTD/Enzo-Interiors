import {
  BadRequestException,
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
  ServiceUnavailableException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Transform, Type } from 'class-transformer';
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
  EnquiryMessage,
  EnquirySource,
  SUBMISSION_STATUSES,
  SubmissionStatus,
} from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { ActivityLogService } from '../../core/activity-log.service';
import { MailService, templates } from '../../core/mail.service';
import { DatabaseService } from '../../data/database.service';
import { NotificationsModule, NotificationsService } from '../notifications/notifications.module';
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

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
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

export class ReplyEnquiryDto {
  @IsString()
  @MaxLength(5000)
  body!: string;
}

/** An enquiry with the replies sent from it, oldest first. */
export type EnquiryDetail = ContactSubmission & { messages: EnquiryMessage[] };

const SOURCE_OF: Record<EnquiryKind, EnquirySource> = { contact: 'Contact', quote: 'Quote', booking: 'Booking' };

/** A reply goes out as plain text: line breaks kept, control characters dropped, no run of blank lines. */
export function plainText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('')
    .filter((char) => char === '\n' || char === '\t' || (char >= ' ' && char !== '\u007f'))
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

@Injectable()
export class EnquiriesService {
  private readonly logger = new Logger(EnquiriesService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly mail: MailService,
    private readonly settings: SiteSettingsService,
    private readonly activity: ActivityLogService,
    private readonly notifications: NotificationsService,
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

  /** The enquiry and the replies sent from it. */
  async detail(id: string): Promise<EnquiryDetail> {
    const [row, messages] = await Promise.all([
      this.findOne(id),
      this.db.enquiryMessages.findWhere({ enquiry_id: id }, { orderBy: { sent_at: 'asc' } }),
    ]);
    return { ...row, messages };
  }

  /**
   * Sends `body` to the enquirer and keeps it on the enquiry. The first reply moves a New
   * enquiry to Contacted (one conditional UPDATE, so a status an Admin just set is not undone).
   * Nothing is stored unless the mail was accepted: an Admin must know when it did not go.
   */
  async reply(principal: AuthPrincipal, id: string, dto: ReplyEnquiryDto): Promise<{ message: EnquiryMessage; enquiry: ContactSubmission }> {
    const enquiry = await this.findOne(id);
    const body = plainText(dto.body);
    if (!body) throw new BadRequestException('Write a message first.');
    if (!(await this.deliverReply(principal, enquiry, body))) {
      throw new ServiceUnavailableException('The mail server did not accept the message, so nothing was sent. Check the API logs.');
    }
    const message = await this.db.enquiryMessages.create({
      enquiry_id: id,
      direction: 'out',
      body,
      to_address: enquiry.email,
      sent_by: principal.name,
      sent_at: new Date().toISOString(),
    });
    await this.db.contactSubmissions.updateWhere({ id, status: 'New' }, { status: 'Contacted' });
    await this.activity.record({
      principal,
      action: 'enquiry_reply',
      targetTable: 'contact_submissions',
      targetId: id,
      details: { name: enquiry.name },
    });
    return { message, enquiry: await this.findOne(id) };
  }

  /**
   * The ONE place a reply leaves the building: the studio mailbox, Reply-To the notification
   * address so the answer lands where the team reads. Phase 8 swaps this body for the sending
   * staff member's own linked Gmail; `by` is there for that. True = the mail was accepted.
   */
  private async deliverReply(_by: AuthPrincipal, enquiry: ContactSubmission, body: string): Promise<boolean> {
    const [replyTo] = await this.settings.notificationRecipients();
    return this.mail.send({ to: enquiry.email, replyTo, ...templates.enquiryReply(enquiry.name, body) });
  }

  /** One row in the inbox, tagged with where it came from. A booking calls this too and tells people itself. */
  store(input: Pick<ContactSubmission, 'kind' | 'name' | 'email' | 'phone' | 'service_interest' | 'message' | 'details'>): Promise<ContactSubmission> {
    return this.db.contactSubmissions.create({
      ...input,
      source: SOURCE_OF[input.kind],
      status: 'New',
      created_at: new Date().toISOString(),
    });
  }

  async create(dto: CreateEnquiryDto): Promise<void> {
    const details = dto.details && Object.keys(dto.details).length ? dto.details : null;
    const row = await this.store({
      kind: dto.kind,
      name: dto.name.trim(),
      email: dto.email.trim(),
      phone: dto.phone?.trim() || null,
      service_interest: details?.service ?? null,
      message: dto.message?.trim() ?? '',
      details,
    });
    // Stored first, told second: nothing below may lose the lead.
    await this.announce(row);
  }

  /**
   * The bell and every Admin's devices, the studio's email, and the visitor's confirmation.
   * Each on its own, so one failing never costs the others; the visitor is thanked even when
   * the studio list is empty, and the studio is told even when the visitor's mail bounces.
   */
  private async announce(row: ContactSubmission): Promise<void> {
    const studio = await this.settings.notificationRecipients();
    if (!studio.length) this.logger.warn(`Enquiry ${row.id} saved, but there is nobody to email.`);
    const results = await Promise.allSettled([
      this.notifications.notifyAdmins({
        kind: 'enquiry',
        title: `New enquiry from ${row.name}`,
        body: row.service_interest ?? (row.message.slice(0, 120) || null),
        link: '/enquiries',
      }),
      studio.length
        ? this.mail.send({
            to: studio,
            replyTo: row.email,
            ...templates.enquiry({
              kind: row.kind,
              name: row.name,
              email: row.email,
              phone: row.phone,
              message: row.message,
              details: row.details,
            }),
          })
        : null,
      this.settings
        .contactLine()
        .then((contact) => this.mail.send({ to: row.email, replyTo: studio[0], ...templates.enquiryReceived(contact) })),
    ]);
    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error(`Enquiry ${row.id}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
      }
    }
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
    return this.enquiries.detail(id);
  }

  @Patch(':id')
  @Roles('Admin')
  update(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string, @Body() dto: UpdateEnquiryDto) {
    return this.enquiries.setStatus(principal, id, dto);
  }

  /** Emails the enquirer from the studio mailbox and keeps the message on the enquiry. */
  @Post(':id/reply')
  @HttpCode(201)
  @Roles('Admin')
  @Throttle({ default: { limit: 20, ttl: 15 * 60_000 } })
  reply(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string, @Body() dto: ReplyEnquiryDto) {
    return this.enquiries.reply(principal, id, dto);
  }
}

@Module({
  imports: [SiteSettingsModule, NotificationsModule],
  controllers: [EnquiriesController],
  providers: [EnquiriesService],
  exports: [EnquiriesService],
})
export class EnquiriesModule {}
