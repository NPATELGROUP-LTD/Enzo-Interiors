import { randomInt } from 'node:crypto';

import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { Response } from 'express';

import { CurrentUser, Public, Roles } from '../../common/decorators';
import { APPOINTMENT_STATUSES, Appointment, AppointmentStatus } from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { ActivityLogService } from '../../core/activity-log.service';
import { BookingMail, MailService, templates } from '../../core/mail.service';
import { DatabaseService } from '../../data/database.service';
import { NotificationsModule, NotificationsService } from '../notifications/notifications.module';
import { SiteSettingsModule, SiteSettingsService } from '../site-settings/site-settings.module';
import {
  BookingConfig,
  DEFAULT_CONFIG,
  DayHours,
  FieldRule,
  WEEKDAYS,
  ZONE,
  addDays,
  availability,
  studioInstant,
  studioParts,
  toMinutes,
} from './slots';

/* -------------------------------------------------------------------------- */
/* DTOs                                                                       */
/* -------------------------------------------------------------------------- */

const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateBookingDto {
  @Matches(/^[a-z0-9][a-z0-9-]{0,62}$/, { message: 'Choose a service.' })
  service!: string;

  @Matches(DATE, { message: 'Choose a day.' })
  date!: string;

  @Matches(TIME, { message: 'Choose a time.' })
  time!: string;

  @IsString()
  @MinLength(1, { message: 'Enter your name.' })
  @MaxLength(120)
  name!: string;

  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(254)
  email!: string;

  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsString() @MaxLength(12) postcode?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  /** The quote tier handed over from a service page's quote form. */
  @IsOptional() @IsString() @MaxLength(60) tier?: string;

  /** Honeypot. A bot that fills it gets a quiet 204. */
  @IsOptional() @IsString() @MaxLength(500) website?: string;
}

export class UpdateAppointmentDto {
  @IsOptional() @Matches(DATE, { message: 'Choose a day.' }) date?: string;
  @IsOptional() @Matches(TIME, { message: 'Choose a time.' }) time?: string;
  @IsOptional() @IsIn(APPOINTMENT_STATUSES) status?: AppointmentStatus;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @IsOptional() @IsEmail({}, { message: 'Enter a valid email address.' }) @MaxLength(254) email?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsString() @MaxLength(12) postcode?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  /** Email the customer about a new time or a cancellation. Default true. */
  @IsOptional() @IsBoolean() notify?: boolean;
}

export class BookingSettingsDto {
  @IsObject()
  config!: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/* Config validation                                                          */
/* -------------------------------------------------------------------------- */

const NAMES: Record<string, string> = Object.fromEntries(
  WEEKDAYS.map((day) => [day, day[0]!.toUpperCase() + day.slice(1)]),
);

function int(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new BadRequestException(`${label} must be a whole number from ${min} to ${max}.`);
  }
  return value;
}

function hhmm(value: unknown, label: string): string {
  if (typeof value !== 'string' || !TIME.test(value)) throw new BadRequestException(`${label} must be a time such as 09:30.`);
  return value;
}

/**
 * The admin's schedule, checked field by field with messages a person can act
 * on, and rebuilt from scratch so nothing unexpected is ever stored.
 */
export function parseConfig(input: Record<string, unknown>): BookingConfig {
  const week = (input.week ?? {}) as Record<string, Record<string, unknown> | undefined>;
  const parsedWeek = {} as BookingConfig['week'];
  for (const day of WEEKDAYS) {
    const raw = week[day] ?? {};
    const name = NAMES[day];
    const hours: DayHours = {
      open: raw.open === true,
      first: hhmm(raw.first ?? '10:00', `${name}'s first start`),
      last: hhmm(raw.last ?? '16:00', `${name}'s last start`),
      breaks: [],
    };
    if (!Array.isArray(raw.breaks ?? [])) throw new BadRequestException(`${name}'s breaks are not a list.`);
    for (const item of (raw.breaks ?? []) as Array<Record<string, unknown>>) {
      const start = hhmm(item?.start, `A break on ${name}`);
      const end = hhmm(item?.end, `A break on ${name}`);
      if (toMinutes(end) <= toMinutes(start)) throw new BadRequestException(`A break on ${name} ends before it starts.`);
      hours.breaks.push({ start, end });
    }
    if (hours.breaks.length > 6) throw new BadRequestException(`${name} has more than 6 breaks.`);
    hours.breaks.sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
    if (hours.open && toMinutes(hours.last) < toMinutes(hours.first)) {
      throw new BadRequestException(`${name}'s last start is before its first.`);
    }
    parsedWeek[day] = hours;
  }

  const rawFields = (input.fields ?? {}) as Record<string, unknown>;
  const rule = (key: string): FieldRule => {
    const value = rawFields[key] ?? DEFAULT_CONFIG.fields[key as keyof BookingConfig['fields']];
    if (value !== 'required' && value !== 'optional' && value !== 'off') {
      throw new BadRequestException(`"${key}" must be required, optional or off.`);
    }
    return value;
  };

  const services = input.services ?? [];
  if (!Array.isArray(services) || services.length > 50 || !services.every((s) => typeof s === 'string' && s.length <= 63)) {
    throw new BadRequestException('Bookable services must be a list of service ids.');
  }

  return {
    week: parsedWeek,
    slotMinutes: int(input.slotMinutes, 'Consultation length', 15, 480),
    gapMinutes: int(input.gapMinutes, 'Time between consultations', 0, 240),
    maxPerDay: int(input.maxPerDay, 'Consultations per day', 0, 50),
    horizonDays: int(input.horizonDays, 'How far ahead', 1, 365),
    noticeHours: int(input.noticeHours, 'Notice needed', 0, 336),
    fields: { phone: rule('phone'), address: rule('address'), postcode: rule('postcode'), notes: rule('notes') },
    services: [...new Set(services as string[])],
  };
}

/* -------------------------------------------------------------------------- */
/* Service                                                                    */
/* -------------------------------------------------------------------------- */

const ID = 'booking';
const REFERENCE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DAY = new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** "Tuesday 14 October 2026 at 10:00", in studio time. */
export function describeWhen(iso: string): string {
  return `${DAY.format(new Date(iso)).replace(',', '')} at ${studioParts(new Date(iso)).time}`;
}

/** What the public booking form needs besides the slots. */
export interface PublicBookingRules {
  fields: BookingConfig['fields'];
  /** Empty = every published service. */
  services: string[];
  slotMinutes: number;
  horizonDays: number;
}

@Injectable()
export class BookingService {
  private readonly adminUrl = (process.env.ADMIN_URL ?? 'http://localhost:5174').replace(/\/+$/, '');

  constructor(
    private readonly db: DatabaseService,
    private readonly mail: MailService,
    private readonly activity: ActivityLogService,
    private readonly siteSettings: SiteSettingsService,
    private readonly notifications: NotificationsService,
  ) {}

  /* ---- Settings ---- */

  async config(): Promise<BookingConfig> {
    const row = await this.db.bookingSettings.findById(ID);
    if (!row) return DEFAULT_CONFIG;
    // Stored configs from an older release get any rule added since.
    return { ...DEFAULT_CONFIG, ...(row.config as Partial<BookingConfig>) };
  }

  async settings(): Promise<{ config: BookingConfig; updated_at: string | null; updated_by: string | null }> {
    const row = await this.db.bookingSettings.findById(ID);
    return { config: await this.config(), updated_at: row?.updated_at ?? null, updated_by: row?.updated_by ?? null };
  }

  async saveSettings(principal: AuthPrincipal, dto: BookingSettingsDto) {
    const config = parseConfig(dto.config);
    const data = { config: config as unknown as Record<string, unknown>, updated_at: new Date().toISOString(), updated_by: principal.name };
    if (await this.db.bookingSettings.findById(ID)) await this.db.bookingSettings.update(ID, data);
    else await this.db.bookingSettings.create({ id: ID, ...data });
    await this.activity.record({
      principal,
      action: 'booking_settings_update',
      targetTable: 'booking_settings',
      targetId: ID,
      details: { slotMinutes: config.slotMinutes, maxPerDay: config.maxPerDay },
    });
    return this.settings();
  }

  /* ---- Availability ---- */

  private async taken(exceptId?: string) {
    return this.db.appointments.findAll((row) => row.slot !== null && row.id !== exceptId);
  }

  async available(from: string, to: string, staff: boolean, exceptId?: string) {
    if (!DATE.test(from) || !DATE.test(to) || to < from || addDays(from, 62) < to) {
      throw new BadRequestException('Ask for up to 62 days at a time, as YYYY-MM-DD.');
    }
    const config = await this.config();
    const days = availability(config, from, to, await this.taken(exceptId), new Date(), staff);
    const rules: PublicBookingRules = {
      fields: config.fields,
      services: config.services,
      slotMinutes: config.slotMinutes,
      horizonDays: config.horizonDays,
    };
    return { zone: ZONE, days, ...rules };
  }

  private async assertFree(date: string, time: string, staff: boolean, exceptId?: string): Promise<void> {
    const { days } = await this.available(date, date, staff, exceptId);
    if (!days[date]?.includes(time)) {
      throw new ConflictException('That time is no longer free. Choose another.');
    }
  }

  /* ---- Bookings ---- */

  /** The service as the site publishes it; its name is kept on the booking. */
  private async serviceLabel(slug: string): Promise<string> {
    const config = await this.config();
    const entry = await this.db.cmsEntries.findOne(
      (row) => row.collection === 'services' && row.slug === slug && row.published !== null,
    );
    if (!entry || (config.services.length > 0 && !config.services.includes(slug))) {
      throw new BadRequestException('That service cannot be booked. Choose another.');
    }
    const body = entry.published!;
    return String(body.shortName ?? body.title ?? slug);
  }

  /** Applies the form's field rules: required ones must be there, "off" ones are dropped. */
  private async contactFields(dto: Pick<CreateBookingDto, 'phone' | 'address' | 'postcode' | 'notes'>) {
    const { fields } = await this.config();
    const labels = { phone: 'your phone number', address: 'your address', postcode: 'your postcode', notes: 'a note' };
    const out: Record<'phone' | 'address' | 'postcode' | 'notes', string | null> = {
      phone: null,
      address: null,
      postcode: null,
      notes: null,
    };
    for (const key of ['phone', 'address', 'postcode', 'notes'] as const) {
      const value = dto[key]?.trim() || null;
      if (fields[key] === 'required' && !value) throw new BadRequestException(`Enter ${labels[key]}.`);
      out[key] = fields[key] === 'off' ? null : value;
    }
    if (out.postcode) out.postcode = out.postcode.toUpperCase();
    return out;
  }

  async create(dto: CreateBookingDto, principal: AuthPrincipal | null): Promise<Appointment> {
    const staff = principal !== null;
    const service_label = await this.serviceLabel(dto.service);
    const contact = await this.contactFields(dto);
    await this.assertFree(dto.date, dto.time, staff);

    const { slotMinutes } = await this.config();
    const start = studioInstant(dto.date, dto.time);
    const now = new Date().toISOString();
    let created: Appointment;
    try {
      created = await this.db.appointments.create({
        reference: `EZ-${Array.from({ length: 6 }, () => REFERENCE_CHARS[randomInt(REFERENCE_CHARS.length)]).join('')}`,
        service: dto.service,
        service_label,
        starts_at: start.toISOString(),
        ends_at: new Date(start.getTime() + slotMinutes * 60_000).toISOString(),
        slot: start.toISOString(),
        status: 'Confirmed',
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
        ...contact,
        details: dto.tier ? { Tier: dto.tier.trim() } : null,
        source: staff ? 'admin' : 'website',
        created_by: principal?.name ?? null,
        cancelled_at: null,
        created_at: now,
        updated_at: now,
      });
    } catch (error) {
      // Two people chose the same time at the same moment; the unique slot
      // column let the first one in. (A reference clash would land here too,
      // at odds of one in ~900 million, and the retry is the same.)
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException('That time was just taken. Choose another.');
      }
      throw error;
    }

    if (principal) {
      await this.activity.record({
        principal,
        action: 'appointment_create',
        targetTable: 'appointments',
        targetId: created.id,
        details: { reference: created.reference, starts_at: created.starts_at },
      });
    }
    await this.announce(created, principal);
    return created;
  }

  async list(): Promise<Appointment[]> {
    return (await this.db.appointments.findAll()).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }

  async update(principal: AuthPrincipal, id: string, dto: UpdateAppointmentDto): Promise<Appointment> {
    const current = await this.db.appointments.findById(id);
    if (!current) throw new NotFoundException('That booking no longer exists.');

    const was = studioParts(new Date(current.starts_at));
    const date = dto.date ?? was.date;
    const time = dto.time ?? was.time;
    const status = dto.status ?? current.status;
    const moved = date !== was.date || time !== was.time;
    const reopened = status === 'Confirmed' && current.status === 'Cancelled';

    const patch: Partial<Appointment> = { updated_at: new Date().toISOString() };
    if (dto.name?.trim()) patch.name = dto.name.trim();
    if (dto.email?.trim()) patch.email = dto.email.trim().toLowerCase();
    for (const key of ['phone', 'address', 'postcode', 'notes'] as const) {
      if (dto[key] !== undefined) patch[key] = dto[key]?.trim() || null;
    }

    if (status === 'Cancelled') {
      Object.assign(patch, { status, slot: null, cancelled_at: current.cancelled_at ?? new Date().toISOString() });
    } else if (moved || reopened) {
      await this.assertFree(date, time, true, id);
      const { slotMinutes } = await this.config();
      const start = studioInstant(date, time);
      Object.assign(patch, {
        status,
        starts_at: start.toISOString(),
        ends_at: new Date(start.getTime() + slotMinutes * 60_000).toISOString(),
        slot: start.toISOString(),
        cancelled_at: null,
      });
    }

    let updated: Appointment | null;
    try {
      updated = await this.db.appointments.update(id, patch);
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw new ConflictException('That time was just taken. Choose another.');
      throw error;
    }
    if (!updated) throw new NotFoundException('That booking no longer exists.');

    await this.activity.record({
      principal,
      action: status === 'Cancelled' && current.status !== 'Cancelled' ? 'appointment_cancel' : 'appointment_update',
      targetTable: 'appointments',
      targetId: id,
      details: { reference: updated.reference, starts_at: updated.starts_at, status: updated.status },
    });

    if (dto.notify !== false) {
      const contact = await this.contactLine();
      if (status === 'Cancelled' && current.status !== 'Cancelled') {
        await this.mail.send({ to: updated.email, replyTo: await this.replyTo(), ...templates.bookingCancelled(this.toMail(updated), contact) });
      } else if (reopened) {
        await this.mail.send({ to: updated.email, replyTo: await this.replyTo(), ...templates.bookingConfirmed(this.toMail(updated), contact) });
      } else if (moved) {
        await this.mail.send({ to: updated.email, replyTo: await this.replyTo(), ...templates.bookingMoved(this.toMail(updated), contact) });
      }
    }
    return updated;
  }

  /* ---- Telling people ---- */

  private toMail(row: Appointment): BookingMail {
    return {
      reference: row.reference,
      name: row.name,
      email: row.email,
      phone: row.phone,
      service: row.service_label,
      when: describeWhen(row.starts_at),
      address: row.address,
      postcode: row.postcode,
      notes: row.notes,
      details: row.details,
    };
  }

  private async replyTo(): Promise<string | undefined> {
    return (await this.siteSettings.notificationRecipients())[0];
  }

  /** "call us on 07777 333052", from the published company details. */
  private async contactLine(): Promise<string> {
    const company = await this.db.cmsEntries.findOne((row) => row.collection === 'company');
    const phone = (company?.published?.phone as { display?: string } | undefined)?.display;
    return phone ? `call us on ${phone}` : 'call the studio';
  }

  /** The customer's confirmation, the studio's email, and the admins' bell. */
  private async announce(row: Appointment, by: AuthPrincipal | null): Promise<void> {
    const link = `${this.adminUrl}/bookings?open=${row.id}`;
    const studio = await this.siteSettings.notificationRecipients();
    const mail = this.toMail(row);
    await Promise.all([
      this.mail.send({ to: row.email, replyTo: studio[0], ...templates.bookingConfirmed(mail, await this.contactLine()) }),
      studio.length ? this.mail.send({ to: studio, replyTo: row.email, ...templates.bookingReceived(mail, link) }) : null,
      this.notifications.notifyAdmins(
        {
          kind: 'booking',
          title: by ? `${by.name} booked ${row.name}` : `New booking: ${row.name}`,
          body: `${row.service_label} · ${mail.when}`,
          link: `/bookings?open=${row.id}`,
        },
        by?.id,
      ),
    ]);
  }
}

/* -------------------------------------------------------------------------- */
/* Controllers                                                                */
/* -------------------------------------------------------------------------- */

/** What the website's booking page calls. */
@Controller('booking')
export class PublicBookingController {
  constructor(private readonly booking: BookingService) {}

  @Public()
  @Get('availability')
  availability(@Query('from') from = '', @Query('to') to = '') {
    return this.booking.available(from, to, false);
  }

  @Public()
  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  async create(@Body() dto: CreateBookingDto, @Res({ passthrough: true }) res: Response) {
    if (dto.website) {
      res.status(204);
      return;
    }
    const row = await this.booking.create(dto, null);
    return { reference: row.reference, starts_at: row.starts_at, when: describeWhen(row.starts_at) };
  }

  @Get('settings')
  @Roles('Admin')
  settings() {
    return this.booking.settings();
  }

  @Put('settings')
  @Roles('Admin')
  saveSettings(@CurrentUser() principal: AuthPrincipal, @Body() dto: BookingSettingsDto) {
    return this.booking.saveSettings(principal, dto);
  }
}

/** The admin's Bookings screen. */
@Controller('appointments')
@Roles('Admin')
export class AppointmentsController {
  constructor(private readonly booking: BookingService) {}

  @Get()
  list() {
    return this.booking.list();
  }

  /** Staff rules: no notice period or horizon. `except` frees a booking's own time while moving it. */
  @Get('availability')
  availability(@Query('from') from = '', @Query('to') to = '', @Query('except') except?: string) {
    return this.booking.available(from, to, true, except);
  }

  @Post()
  create(@CurrentUser() principal: AuthPrincipal, @Body() dto: CreateBookingDto) {
    return this.booking.create(dto, principal);
  }

  @Put(':id')
  update(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string, @Body() dto: UpdateAppointmentDto) {
    return this.booking.update(principal, id, dto);
  }
}

@Module({
  imports: [SiteSettingsModule, NotificationsModule],
  controllers: [PublicBookingController, AppointmentsController],
  providers: [BookingService],
})
export class BookingModule {}
