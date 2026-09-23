import { Body, Controller, HttpCode, Injectable, Logger, Module, Post, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  IsEmail,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateBy,
  ValidationOptions,
} from 'class-validator';
import type { Response } from 'express';

import { Public } from '../../common/decorators';
import { ENQUIRY_KINDS, EnquiryKind } from '../../common/types/domain';
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

@Injectable()
export class EnquiriesService {
  private readonly logger = new Logger(EnquiriesService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly mail: MailService,
    private readonly settings: SiteSettingsService,
  ) {}

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
}

@Module({
  imports: [SiteSettingsModule],
  controllers: [EnquiriesController],
  providers: [EnquiriesService],
})
export class EnquiriesModule {}
