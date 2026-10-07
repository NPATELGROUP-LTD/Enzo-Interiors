import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

import { AccessService } from '../../common/access/access.service';
import { CurrentUser, Public, Roles } from '../../common/decorators';
import {
  BOOKING_STATUSES,
  AvailabilitySetting,
  Booking,
  BookingStatus,
  SERVICE_TYPES,
  ServiceType,
} from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { ActivityLogService } from '../../core/activity-log.service';
import { DatabaseService } from '../../data/database.service';

/* -------------------------------------------------------------------------- */
/* DTOs                                                                       */
/* -------------------------------------------------------------------------- */

export class CreateBookingDto {
  @IsString() client_id!: string;
  @IsIn(SERVICE_TYPES) service_type!: ServiceType;
  @IsDateString({}, { message: 'Enter a valid date and time' }) date_time!: string;
  @IsOptional() @IsIn(BOOKING_STATUSES) status?: BookingStatus;
}

export class UpdateBookingDto {
  @IsOptional() @IsIn(SERVICE_TYPES) service_type?: ServiceType;
  @IsOptional() @IsDateString() date_time?: string;
  @IsOptional() @IsIn(BOOKING_STATUSES) status?: BookingStatus;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class UpdateAvailabilityDto {
  @Type(() => Number)
  @IsInt()
  @Min(0, { message: 'Day of week runs 0 (Sunday) to 6 (Saturday)' })
  @Max(6)
  day_of_week!: number;

  @Matches(TIME_PATTERN, { message: 'Start time must be HH:MM in 24-hour format' })
  start_time!: string;

  @Matches(TIME_PATTERN, { message: 'End time must be HH:MM in 24-hour format' })
  end_time!: string;

  @Type(() => Number)
  @IsInt()
  @Min(15, { message: 'Slots must be at least 15 minutes' })
  @Max(480)
  slot_duration_mins!: number;

  @IsBoolean() is_closed!: boolean;
}

/* -------------------------------------------------------------------------- */
/* Service                                                                    */
/* -------------------------------------------------------------------------- */

export interface BookingView extends Booking {
  client_name: string;
  client_email: string;
}

@Injectable()
export class BookingsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly access: AccessService,
    private readonly activity: ActivityLogService,
  ) {}

  async list(principal: AuthPrincipal): Promise<BookingView[]> {
    const all = await this.db.bookings.findAll();
    const scoped = await this.access.scopeToVisibleClients(principal, all, (row) => row.client_id);
    const clients = await this.db.clients.findAll();
    const byId = new Map(clients.map((client) => [client.id, client]));

    return scoped
      .sort((a, b) => a.date_time.localeCompare(b.date_time))
      .map((booking) => {
        const client = byId.get(booking.client_id);
        return {
          ...booking,
          client_name: client?.name ?? 'Unknown client',
          client_email: client?.email ?? '',
        };
      });
  }

  /** Upcoming, not-cancelled bookings — the dashboard tile and the portal's next appointment. */
  async upcoming(principal: AuthPrincipal, limit = 10): Promise<BookingView[]> {
    const now = new Date().toISOString();
    const bookings = await this.list(principal);
    return bookings
      .filter((booking) => booking.date_time >= now && booking.status !== 'Cancelled')
      .slice(0, limit);
  }

  async findOne(principal: AuthPrincipal, id: string): Promise<BookingView> {
    const booking = await this.db.bookings.findById(id);
    if (!booking) throw new NotFoundException('Booking not found');
    await this.access.assertClientAccess(principal, booking.client_id);
    const all = await this.list(principal);
    const found = all.find((row) => row.id === id);
    if (!found) throw new NotFoundException('Booking not found');
    return found;
  }

  async create(principal: AuthPrincipal, dto: CreateBookingDto): Promise<BookingView> {
    await this.access.assertClientAccess(principal, dto.client_id);
    const client = await this.db.clients.findById(dto.client_id);
    if (!client) throw new BadRequestException('Client does not exist');

    await this.assertWithinWorkingHours(dto.date_time);

    const created = await this.db.bookings.create({
      client_id: dto.client_id,
      service_type: dto.service_type,
      date_time: new Date(dto.date_time).toISOString(),
      status: dto.status ?? 'Pending',
      created_at: new Date().toISOString(),
    });

    await this.activity.record({
      principal,
      action: 'booking_create',
      targetTable: 'bookings',
      targetId: created.id,
      details: { client: client.name, service_type: created.service_type, date_time: created.date_time },
    });
    return this.findOne(principal, created.id);
  }

  async update(principal: AuthPrincipal, id: string, dto: UpdateBookingDto): Promise<BookingView> {
    const booking = await this.db.bookings.findById(id);
    if (!booking) throw new NotFoundException('Booking not found');
    await this.access.assertClientAccess(principal, booking.client_id);

    if (dto.date_time) await this.assertWithinWorkingHours(dto.date_time);

    const patch: Partial<Booking> = {};
    if (dto.service_type !== undefined) patch.service_type = dto.service_type;
    if (dto.date_time !== undefined) patch.date_time = new Date(dto.date_time).toISOString();
    if (dto.status !== undefined) patch.status = dto.status;

    await this.db.bookings.update(id, patch);
    await this.activity.record({
      principal,
      action: dto.status && dto.status !== booking.status ? 'booking_status_change' : 'booking_update',
      targetTable: 'bookings',
      targetId: id,
      details: dto.status ? { from: booking.status, to: dto.status } : { fields: Object.keys(dto) },
    });
    return this.findOne(principal, id);
  }

  async remove(principal: AuthPrincipal, id: string): Promise<{ id: string; deleted: true }> {
    const booking = await this.db.bookings.findById(id);
    if (!booking) throw new NotFoundException('Booking not found');
    await this.access.assertClientAccess(principal, booking.client_id);

    await this.db.bookings.delete(id);
    await this.activity.record({
      principal,
      action: 'booking_delete',
      targetTable: 'bookings',
      targetId: id,
      details: { date_time: booking.date_time },
    });
    return { id, deleted: true };
  }

  /* ---- Availability ---- */

  /** Working hours, ordered Sunday to Saturday. */
  async availability(): Promise<AvailabilitySetting[]> {
    const rows = await this.db.availabilitySettings.findAll();
    return rows.sort((a, b) => a.day_of_week - b.day_of_week);
  }

  /**
   * Bookable slots for a given date, derived from working hours minus the
   * bookings already taken. Powers the public booking wizard's time step.
   */
  async slotsFor(dateIso: string): Promise<{ date: string; slots: string[] }> {
    const date = new Date(`${dateIso.slice(0, 10)}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Enter a valid date');

    const settings = await this.availability();
    const day = settings.find((row) => row.day_of_week === date.getUTCDay());
    if (!day || day.is_closed) return { date: dateIso.slice(0, 10), slots: [] };

    const taken = new Set(
      (await this.db.bookings.findAll((row) => row.status !== 'Cancelled'))
        .filter((row) => row.date_time.slice(0, 10) === dateIso.slice(0, 10))
        .map((row) => row.date_time.slice(11, 16)),
    );

    const slots: string[] = [];
    const [startH = 9, startM = 0] = day.start_time.split(':').map(Number);
    const [endH = 17, endM = 0] = day.end_time.split(':').map(Number);
    let cursor = startH * 60 + startM;
    const end = endH * 60 + endM;

    while (cursor + day.slot_duration_mins <= end) {
      const label = `${String(Math.floor(cursor / 60)).padStart(2, '0')}:${String(cursor % 60).padStart(2, '0')}`;
      if (!taken.has(label)) slots.push(label);
      cursor += day.slot_duration_mins;
    }
    return { date: dateIso.slice(0, 10), slots };
  }

  async updateAvailability(
    principal: AuthPrincipal,
    dto: UpdateAvailabilityDto,
  ): Promise<AvailabilitySetting> {
    if (!dto.is_closed && dto.start_time >= dto.end_time) {
      throw new BadRequestException('Closing time must be after opening time');
    }

    const existing = await this.db.availabilitySettings.findOne(
      (row) => row.day_of_week === dto.day_of_week,
    );

    const saved = existing
      ? await this.db.availabilitySettings.update(existing.id, {
          start_time: dto.start_time,
          end_time: dto.end_time,
          slot_duration_mins: dto.slot_duration_mins,
          is_closed: dto.is_closed,
        })
      : await this.db.availabilitySettings.create({
          day_of_week: dto.day_of_week,
          start_time: dto.start_time,
          end_time: dto.end_time,
          slot_duration_mins: dto.slot_duration_mins,
          is_closed: dto.is_closed,
        });

    if (!saved) throw new NotFoundException('Availability row not found');

    await this.activity.record({
      principal,
      action: 'availability_update',
      targetTable: 'availability_settings',
      targetId: saved.id,
      details: { day_of_week: dto.day_of_week, start_time: dto.start_time, end_time: dto.end_time, is_closed: dto.is_closed },
    });
    return saved;
  }

  /**
   * Warn rather than refuse when a booking falls outside working hours: the
   * founder legitimately takes the occasional out-of-hours appointment, and a
   * hard block would make the CRM less useful than the diary it replaces.
   * Genuinely invalid input (a closed day) is still refused.
   */
  private async assertWithinWorkingHours(dateTime: string): Promise<void> {
    const when = new Date(dateTime);
    if (Number.isNaN(when.getTime())) throw new BadRequestException('Enter a valid date and time');

    const settings = await this.availability();
    const day = settings.find((row) => row.day_of_week === when.getUTCDay());
    if (day?.is_closed) {
      const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      throw new BadRequestException(
        `The studio is closed on ${names[when.getUTCDay()]}. Change the working hours in Settings if you need to book that day.`,
      );
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Controllers                                                                */
/* -------------------------------------------------------------------------- */

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get()
  list(@CurrentUser() principal: AuthPrincipal) {
    return this.bookings.list(principal);
  }

  @Get('upcoming')
  upcoming(@CurrentUser() principal: AuthPrincipal, @Query('limit') limit?: string) {
    return this.bookings.upcoming(principal, limit ? Number(limit) : 10);
  }

  @Get(':id')
  findOne(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.bookings.findOne(principal, id);
  }

  @Post()
  @Roles('Admin', 'Designer', 'Installer')
  create(@CurrentUser() principal: AuthPrincipal, @Body() dto: CreateBookingDto) {
    return this.bookings.create(principal, dto);
  }

  @Put(':id')
  @Roles('Admin', 'Designer', 'Installer')
  update(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateBookingDto,
  ) {
    return this.bookings.update(principal, id, dto);
  }

  @Delete(':id')
  @Roles('Admin')
  remove(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.bookings.remove(principal, id);
  }
}

@Controller('availability')
export class AvailabilityController {
  constructor(private readonly bookings: BookingsService) {}

  /** Public: the website booking wizard needs opening hours before login. */
  @Public()
  @Get()
  list() {
    return this.bookings.availability();
  }

  /** Public: bookable slots for a date, for the wizard's time-slot step. */
  @Public()
  @Get('slots')
  slots(@Query('date') date: string) {
    return this.bookings.slotsFor(date ?? new Date().toISOString());
  }

  @Put()
  @Roles('Admin')
  update(@CurrentUser() principal: AuthPrincipal, @Body() dto: UpdateAvailabilityDto) {
    return this.bookings.updateAvailability(principal, dto);
  }
}

@Module({
  controllers: [BookingsController, AvailabilityController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
