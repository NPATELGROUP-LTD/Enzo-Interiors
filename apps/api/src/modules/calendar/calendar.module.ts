import { createHash, randomUUID } from 'node:crypto';

import { BadRequestException, Body, Controller, Delete, Get, Injectable, Logger, Module, Put, Query, Res } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import { IsString, MaxLength, MinLength } from 'class-validator';
import type { Response as ExpressResponse } from 'express';

import { CurrentUser, Public, Roles } from '../../common/decorators';
import { Appointment, CalendarConnection } from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { ActivityLogService } from '../../core/activity-log.service';
import { CacheService } from '../../core/cache';
import { open, seal } from '../../core/crypto';
import { RateLimitStore } from '../../core/rate-limit';
import { DatabaseService } from '../../data/database.service';
import { NotificationsModule, NotificationsService } from '../notifications/notifications.module';
import { Taken, addDays, studioParts } from '../booking/slots';

/**
 * Copies consultation bookings into the studio's Google Calendar, and reads
 * that calendar back so a time the studio is busy is not offered on the site.
 *
 * One connection, the row with id "studio", made by an Admin through Google's
 * consent screen. Only the refresh token is stored, sealed (core/crypto.ts);
 * access tokens live in this process's memory. Nothing here may break a
 * booking: reads fall back to a stale copy, then to "not busy", and writes
 * happen after the booking is saved, are retried once, and end in the bell.
 */

const ID = 'studio';
const GOOGLE_API = 'https://www.googleapis.com/calendar/v3';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  'openid',
  'email',
];
/**
 * Google's own limits are far higher; this keeps a bug or a flood from using
 * them up. Reads and writes (token refreshes count as writes) have separate
 * budgets, so busy-time reads can never starve a booking's event.
 */
const CALLS_PER_MINUTE = 60;
/** No Google call may hold up a visitor's page or booking for longer. */
const timeout = () => AbortSignal.timeout(5_000);

export class SelectCalendarDto {
  @IsString() @MinLength(1) @MaxLength(300) calendarId!: string;
}

interface GoogleEvent {
  id: string;
  status?: string;
  transparency?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  extendedProperties?: { private?: Record<string, string> };
}

/** The ranges that touch `from` to `to`, give or take a day as everywhere else. */
export function inRange(list: Taken[], from: string, to: string): Taken[] {
  const min = Date.parse(`${addDays(from, -1)}T00:00:00Z`);
  const max = Date.parse(`${addDays(to, 2)}T00:00:00Z`);
  return list.filter((r) => Date.parse(r.ends_at) > min && Date.parse(r.starts_at) < max);
}

/**
 * A Google event id for a booking. Google wants a-v and 0-9 (base32hex), 5 to
 * 1024 characters; hex fits. `generation` moves on when the earlier id was deleted.
 */
export const eventId = (appointmentId: string, generation: number): string =>
  createHash('sha256').update(`${appointmentId}:${generation}`).digest('hex');

/** What the booking's calendar event needs, given the calendar events now go to. */
export function plan(row: Appointment, calendarId: string): 'none' | 'delete' | 'insert' | 'patch' | 'move' {
  if (row.status === 'Cancelled') return row.google_event_id ? 'delete' : 'none';
  if (!row.google_event_id) return 'insert';
  return (row.google_calendar_id ?? calendarId) === calendarId ? 'patch' : 'move';
}

class GoogleError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);
  private readonly adminUrl = (process.env.ADMIN_URL ?? 'http://localhost:5174').replace(/\/+$/, '');
  private token: { value: string; expires: number } | null = null;
  private refreshing: Promise<string> | null = null;
  /** Syncs of one booking run one after another, so a quick edit never inserts twice. */
  private readonly chains = new Map<string, Promise<void>>();
  private lastWarning = 0;

  constructor(
    private readonly db: DatabaseService,
    private readonly cache: CacheService,
    private readonly limits: RateLimitStore,
    private readonly jwt: JwtService,
    private readonly activity: ActivityLogService,
    private readonly notifications: NotificationsService,
  ) {}

  /** The feature is hidden until Google's keys (and the key that seals the token) are set. */
  configured(): boolean {
    return Boolean(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CALENDAR_REDIRECT_URI && process.env.APP_ENCRYPTION_KEY,
    );
  }

  async status() {
    const row = await this.db.calendarConnections.findById(ID);
    if (!this.configured() || !row) return { configured: this.configured(), connected: false };
    return {
      configured: true,
      connected: true,
      email: row.google_email,
      calendarId: row.calendar_id,
      calendarName: row.calendar_name,
      status: row.status,
    };
  }

  /** The connection, only while Google still accepts it. */
  private async active(): Promise<CalendarConnection | null> {
    if (!this.configured()) return null;
    const row = await this.db.calendarConnections.findById(ID);
    return row?.status === 'connected' ? row : null;
  }

  /** Booking availability and anything cached from the calendar starts over. */
  private async changed(): Promise<void> {
    this.token = null;
    await Promise.all([this.cache.incr('booking:v'), this.cache.del('calendar:list')]);
  }

  /* ---- Connecting ---- */

  async connectUrl(principal: AuthPrincipal): Promise<{ url: string }> {
    if (!this.configured()) throw new BadRequestException('Google Calendar is not set up on this server.');
    const staff = await this.db.staffUsers.findById(principal.id);
    // A nonce (spent once, in callback) and the token version (a password change voids it) tie the state to this one sign-in.
    const claims = { purpose: 'calendar', staff: principal.id, tv: staff?.token_version, nonce: randomUUID() };
    return this.jwt.signAsync(claims, { expiresIn: '10m' }).then((state) => ({
      url:
        'https://accounts.google.com/o/oauth2/v2/auth?' +
        new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!,
          redirect_uri: process.env.GOOGLE_CALENDAR_REDIRECT_URI!,
          response_type: 'code',
          scope: SCOPES.join(' '),
          access_type: 'offline',
          // Without this Google only sends a refresh token the first time ever.
          prompt: 'consent',
          state,
        }),
    }));
  }

  /** Where Google sends the Admin back to. Returns the page to land on. */
  async callback(code: string, state: string): Promise<'connected' | 'error'> {
    try {
      const claims = await this.jwt.verifyAsync<{ purpose?: string; staff?: string; tv?: number; nonce?: string }>(state);
      if (claims.purpose !== 'calendar' || !claims.staff || !claims.nonce) throw new Error('Not a calendar state');
      // Spent once: a replayed callback is refused.
      if ((await this.limits.hit(`calendar:state:${claims.nonce}`, 10 * 60_000)) > 1) throw new Error('State already used');
      const staff = await this.db.staffUsers.findById(claims.staff);
      if (!staff || staff.role !== 'Admin' || staff.token_version !== claims.tv || !this.configured()) throw new Error('Not an Admin connecting');

      const res = await fetch(TOKEN_URL, {
        method: 'POST',
        signal: timeout(),
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          redirect_uri: process.env.GOOGLE_CALENDAR_REDIRECT_URI!,
          grant_type: 'authorization_code',
        }),
      });
      const body = (await res.json()) as { refresh_token?: string; id_token?: string; scope?: string };
      if (!res.ok || !body.refresh_token || !body.id_token) throw new Error(`Google refused the code (${res.status})`);
      // Google lets people untick what they grant; all of it is needed.
      if (SCOPES.slice(0, 2).some((scope) => !body.scope?.split(' ').includes(scope))) throw new Error('Calendar access was not granted');

      // Straight from Google over TLS, so the claims are read, not the signature.
      const id = JSON.parse(Buffer.from(body.id_token.split('.')[1] ?? '', 'base64url').toString()) as {
        aud?: string; iss?: string; exp?: number; email?: string;
      };
      if (
        id.aud !== process.env.GOOGLE_CLIENT_ID ||
        !['https://accounts.google.com', 'accounts.google.com'].includes(id.iss ?? '') ||
        (id.exp ?? 0) * 1000 < Date.now() ||
        !id.email
      ) {
        throw new Error('Google sent an ID token that does not check out');
      }

      const now = new Date().toISOString();
      const existing = await this.db.calendarConnections.findById(ID);
      // Reconnecting the same Google account keeps the calendar that was chosen.
      const same = existing?.google_email === id.email;
      const data = {
        staff_user_id: null,
        google_email: id.email,
        calendar_id: same ? existing!.calendar_id : 'primary',
        calendar_name: same ? existing!.calendar_name : null,
        refresh_token_enc: seal(body.refresh_token),
        status: 'connected' as const,
        connected_by: staff.name,
        updated_at: now,
      };
      if (existing) await this.db.calendarConnections.update(ID, data);
      else await this.db.calendarConnections.create({ id: ID, ...data, created_at: now });
      await this.changed();
      await this.activity.record({
        principal: { id: staff.id, kind: 'Staff', role: staff.role, name: staff.name, email: staff.email },
        action: 'calendar_connect',
        targetTable: 'calendar_connections',
        targetId: ID,
        details: { email: id.email },
      });
      return 'connected';
    } catch (error) {
      this.logger.warn(`Google Calendar connect failed: ${error instanceof Error ? error.message : String(error)}`);
      return 'error';
    }
  }

  async disconnect(principal: AuthPrincipal): Promise<void> {
    const row = await this.db.calendarConnections.findById(ID);
    if (!row) return;
    try {
      await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', signal: timeout(), body: new URLSearchParams({ token: open(row.refresh_token_enc) }) });
    } catch (error) {
      // Still disconnect: the studio can also remove access in their Google account.
      this.logger.warn(`Could not revoke Google's access: ${error instanceof Error ? error.message : String(error)}`);
    }
    await this.db.appointments.updateWhere({ calendar_connection_id: ID }, { google_event_id: null, calendar_connection_id: null });
    await this.db.calendarConnections.delete(ID);
    await this.changed();
    await this.activity.record({ principal, action: 'calendar_disconnect', targetTable: 'calendar_connections', targetId: ID, details: { email: row.google_email } });
  }

  async calendars(): Promise<Array<{ id: string; name: string; primary: boolean }>> {
    if (!(await this.active())) throw new BadRequestException('Connect Google Calendar first.');
    return this.cache.wrap('calendar:list', 5 * 60_000, async () => {
      const res = await this.api('GET', `${GOOGLE_API}/users/me/calendarList?minAccessRole=writer`, undefined, 'reads');
      const list = ((await res.json()) as { items?: Array<{ id: string; summary: string; summaryOverride?: string; primary?: boolean; accessRole: string }> }).items ?? [];
      return list
        .filter((c) => c.accessRole === 'owner' || c.accessRole === 'writer')
        .map((c) => ({ id: c.id, name: c.summaryOverride ?? c.summary, primary: c.primary === true }));
    });
  }

  async selectCalendar(principal: AuthPrincipal, calendarId: string) {
    const chosen = (await this.calendars()).find((c) => c.id === calendarId);
    if (!chosen) throw new BadRequestException('Choose one of your calendars.');
    await this.db.calendarConnections.update(ID, { calendar_id: chosen.id, calendar_name: chosen.name, updated_at: new Date().toISOString() });
    await this.changed();
    await this.activity.record({ principal, action: 'calendar_change', targetTable: 'calendar_connections', targetId: ID, details: { calendar: chosen.name } });
    return this.status();
  }

  /* ---- Talking to Google ---- */

  /** Every call to Google goes through here, so the budget is one place. Throws on any failure. */
  private async api(method: string, url: string, body?: unknown, budget: 'reads' | 'writes' = 'writes'): Promise<Response> {
    if ((await this.limits.hit(`google:${budget}`, 60_000)) > CALLS_PER_MINUTE) {
      if (Date.now() - this.lastWarning > 60_000) {
        this.lastWarning = Date.now();
        this.logger.warn(`More than ${CALLS_PER_MINUTE} Google Calendar calls in a minute; skipping until it eases.`);
      }
      throw new GoogleError(429, 'Google Calendar call budget used up');
    }
    const res = await fetch(url, {
      method,
      signal: timeout(),
      headers: { authorization: `Bearer ${await this.accessToken()}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new GoogleError(res.status, `Google answered ${res.status} to ${method} ${url.replace(GOOGLE_API, '')}`);
    return res;
  }

  private accessToken(): Promise<string> {
    if (this.token && this.token.expires - 60_000 > Date.now()) return Promise.resolve(this.token.value);
    this.refreshing ??= this.refresh().finally(() => (this.refreshing = null));
    return this.refreshing;
  }

  private async refresh(): Promise<string> {
    const row = await this.active();
    if (!row) throw new GoogleError(401, 'Google Calendar is not connected');
    if ((await this.limits.hit('google:writes', 60_000)) > CALLS_PER_MINUTE) throw new GoogleError(429, 'Google Calendar call budget used up');
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      signal: timeout(),
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: open(row.refresh_token_enc),
        grant_type: 'refresh_token',
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
    if (body.error === 'invalid_grant') {
      // Revoked, or the password changed. Say so once, then stop asking until reconnected.
      await this.db.calendarConnections.update(ID, { status: 'needs_reconnect', updated_at: new Date().toISOString() });
      await this.cache.incr('booking:v');
      await this.notifications.notifyAdmins({
        kind: 'booking',
        title: 'Google Calendar needs reconnecting',
        body: 'Bookings are no longer copied to it, and its busy times are not blocked.',
        link: '/settings/booking',
      });
      throw new GoogleError(401, 'Google no longer accepts the connection');
    }
    if (!res.ok || !body.access_token) throw new GoogleError(res.status, `Google token refresh answered ${res.status}`);
    this.token = { value: body.access_token, expires: Date.now() + (body.expires_in ?? 3600) * 1000 };
    return body.access_token;
  }

  /* ---- Busy times ---- */

  /**
   * When the studio is busy in its calendar from `from` to `to` (studio
   * dates), as the same ranges bookings use.
   *
   * What a visitor asks for is never passed on to Google: one window, from
   * yesterday to the end of the booking horizon, is read for the calendar at
   * most once a minute, and every range is cut from that. If Google fails, the
   * last copy up to 10 minutes old is used; if there is none, nothing is busy,
   * so bookings keep working through an outage.
   *
   * `fresh` (a booking being made) reads just that day from Google, now. Only
   * someone about to book gets there, and booking is rate limited already.
   */
  async busy(from: string, to: string, horizonDays: number, fresh = false, staff = false): Promise<Taken[]> {
    const row = await this.active();
    if (!row) return [];
    if (fresh) {
      try {
        return await this.fetchBusy(row.calendar_id, from, to);
      } catch (error) {
        this.logger.warn(`Booking for ${from} accepted without a fresh Google Calendar check: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    const list = inRange(await this.window(row, horizonDays), from, to);
    // Staff may look past the booking horizon; what lies beyond the window is read directly (reads budget applies).
    const end = addDays(studioParts(new Date()).date, horizonDays);
    if (!staff || to <= end) return list;
    try {
      return [...list, ...(await this.fetchBusy(row.calendar_id, from > end ? from : addDays(end, 1), to))];
    } catch (error) {
      this.logger.warn(`Busy times past the booking window unavailable: ${error instanceof Error ? error.message : String(error)}`);
      return list;
    }
  }

  private window(row: CalendarConnection, horizonDays: number): Promise<Taken[]> {
    const key = `calendar:busy:${row.calendar_id}:${horizonDays}`;
    return this.cache.wrap(key, 60_000, async () => {
      try {
        const today = studioParts(new Date()).date;
        const list = await this.fetchBusy(row.calendar_id, today, addDays(today, horizonDays));
        await this.cache.set(`${key}:stale`, list, 10 * 60_000);
        return list;
      } catch (error) {
        const stale = await this.cache.get<Taken[]>(`${key}:stale`);
        this.logger.warn(`Google Calendar busy times unavailable, using ${stale ? 'the last copy' : 'none'}: ${error instanceof Error ? error.message : String(error)}`);
        return stale ?? [];
      }
    });
  }

  private async fetchBusy(calendarId: string, from: string, to: string): Promise<Taken[]> {
    // Wide by a day each way, as booking's own query is: the studio's zone is never far off UTC.
    const query = new URLSearchParams({
      timeMin: `${addDays(from, -1)}T00:00:00Z`,
      timeMax: `${addDays(to, 2)}T00:00:00Z`,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '2500',
    });
    const items: GoogleEvent[] = [];
    // Each page is a call against the reads budget; 10 pages is 25,000 events.
    for (let page = 0, next: string | undefined; page < 10; page++) {
      if (next) query.set('pageToken', next);
      const res = await this.api('GET', `${GOOGLE_API}/calendars/${encodeURIComponent(calendarId)}/events?${query}`, undefined, 'reads');
      const body = (await res.json()) as { items?: GoogleEvent[]; nextPageToken?: string };
      items.push(...(body.items ?? []));
      if (!(next = body.nextPageToken)) break;
    }
    return items
      .filter(
        (e) =>
          e.status !== 'cancelled' &&
          e.transparency !== 'transparent' &&
          e.extendedProperties?.private?.enzo !== '1' &&
          // All-day events are notes (holidays, birthdays), not time spent.
          e.start?.dateTime &&
          e.end?.dateTime,
      )
      .map((e) => ({ starts_at: new Date(e.start!.dateTime!).toISOString(), ends_at: new Date(e.end!.dateTime!).toISOString() }));
  }

  /* ---- Copying bookings ---- */

  /**
   * Brings the booking's calendar event in line with the booking: added,
   * changed or removed. Never throws and never waits for Google on the
   * caller's behalf (call it with `void`). Tries twice, then tells the admins.
   */
  sync(id: string): Promise<void> {
    const next = (this.chains.get(id) ?? Promise.resolve())
      .then(() => this.syncOnce(id))
      .catch((error) => this.logger.warn(`Calendar sync of ${id} crashed: ${error instanceof Error ? error.message : String(error)}`));
    this.chains.set(id, next);
    void next.finally(() => this.chains.get(id) === next && this.chains.delete(id));
    return next;
  }

  private async syncOnce(id: string): Promise<void> {
    let reference = id;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const row = await this.db.appointments.findById(id); // the latest, not what the caller saw
        const conn = row && (await this.active());
        if (!row || !conn) return;
        reference = row.reference;
        await this.writeEvent(row, conn);
        return;
      } catch (error) {
        this.logger.warn(`Calendar sync of ${reference} failed (attempt ${attempt}): ${error instanceof Error ? error.message : String(error)}`);
        if (attempt === 1) await new Promise((resolve) => setTimeout(resolve, 2_000));
      }
    }
    // A reconnect notice has been sent already if that was the cause.
    try {
      if (await this.active()) {
        await this.notifications.notifyAdmins({
          kind: 'booking',
          title: `Couldn't add booking ${reference} to Google Calendar`,
          body: 'Add it by hand if it matters.',
          link: `/bookings?open=${id}`,
        });
      }
    } catch (error) {
      this.logger.warn(`Could not tell the admins about ${reference}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async writeEvent(row: Appointment, conn: CalendarConnection): Promise<void> {
    const events = (calendarId: string) => `${GOOGLE_API}/calendars/${encodeURIComponent(calendarId)}/events`;
    const gone = (error: unknown) => error instanceof GoogleError && (error.status === 404 || error.status === 410);
    const eventCalendar = row.google_calendar_id ?? conn.calendar_id;
    const todo = plan(row, conn.calendar_id);
    if (todo === 'none') return;

    // Taking the event out of the calendar it is in, whether the booking is cancelled or the calendar changed.
    if (todo === 'delete' || todo === 'move') {
      await this.api('DELETE', `${events(eventCalendar)}/${encodeURIComponent(row.google_event_id!)}`).catch((error) => {
        if (!gone(error)) throw error;
      });
      await this.db.appointments.update(row.id, { google_event_id: null, calendar_connection_id: null, google_calendar_id: null });
      if (todo === 'delete') return;
    }

    const event = this.eventBody(row);
    if (todo === 'patch') {
      try {
        await this.api('PATCH', `${events(eventCalendar)}/${encodeURIComponent(row.google_event_id!)}`, event);
        return;
      } catch (error) {
        if (!gone(error)) throw error; // deleted in Google: add it again
      }
    }
    const id = await this.insertEvent(events(conn.calendar_id), row.id, event);
    await this.db.appointments.update(row.id, { google_event_id: id, calendar_connection_id: conn.id, google_calendar_id: conn.calendar_id });
  }

  /**
   * Adds the event under an id made from the booking's, so an insert that
   * timed out but reached Google is found again (409) instead of doubled.
   * Google keeps a deleted event's id for good, so a booking cancelled and
   * reopened gets the next generation's id.
   */
  private async insertEvent(url: string, appointmentId: string, event: object): Promise<string> {
    for (let generation = 0; generation < 5; generation++) {
      const id = eventId(appointmentId, generation);
      try {
        await this.api('POST', url, { ...event, id });
        return id;
      } catch (error) {
        if (!(error instanceof GoogleError && error.status === 409)) throw error;
        const existing = (await (await this.api('GET', `${url}/${id}`, undefined, 'reads')).json()) as { status?: string };
        if (existing.status !== 'cancelled') {
          await this.api('PATCH', `${url}/${id}`, event); // ours from an earlier try: bring it up to date
          return id;
        }
      }
    }
    throw new Error('No unused calendar event id for this booking');
  }

  private eventBody(row: Appointment) {
    const where = [row.address, row.postcode].filter(Boolean).join(', ');
    return {
      summary: `Consultation: ${row.name} (${row.service_label})`,
      description: [
        `Reference: ${row.reference}`,
        `Email: ${row.email}`,
        row.phone && `Phone: ${row.phone}`,
        where && `Address: ${where}`,
        row.notes && `Notes: ${row.notes}`,
        `Open in admin: ${this.adminUrl}/bookings?open=${row.id}`,
      ]
        .filter(Boolean)
        .join('\n'),
      ...(where ? { location: where } : {}),
      start: { dateTime: row.starts_at, timeZone: 'Europe/London' },
      end: { dateTime: row.ends_at, timeZone: 'Europe/London' },
      // Ours: busy() skips these, or every booking would block its own time twice.
      extendedProperties: { private: { enzo: '1', enzoRef: row.reference } },
    };
  }
}

@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get('status')
  @Roles('Admin')
  status() {
    return this.calendar.status();
  }

  @Get('connect')
  @Roles('Admin')
  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  connect(@CurrentUser() principal: AuthPrincipal) {
    return this.calendar.connectUrl(principal);
  }

  /** Google sends the browser here; no token, the signed state says who started it. */
  @Public()
  @Get('callback')
  @Throttle({ default: { limit: 20, ttl: 15 * 60_000 } })
  async callback(@Query('code') code = '', @Query('state') state = '', @Res() res: ExpressResponse) {
    const outcome = code && state ? await this.calendar.callback(code, state) : 'error';
    res.redirect(`${(process.env.ADMIN_URL ?? 'http://localhost:5174').replace(/\/+$/, '')}/settings/booking?calendar=${outcome}`);
  }

  @Get('calendars')
  @Roles('Admin')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  calendars() {
    return this.calendar.calendars();
  }

  @Put('calendar')
  @Roles('Admin')
  select(@CurrentUser() principal: AuthPrincipal, @Body() dto: SelectCalendarDto) {
    return this.calendar.selectCalendar(principal, dto.calendarId);
  }

  @Delete()
  @Roles('Admin')
  async disconnect(@CurrentUser() principal: AuthPrincipal) {
    await this.calendar.disconnect(principal);
    return this.calendar.status();
  }
}

@Module({
  imports: [NotificationsModule],
  controllers: [CalendarController],
  providers: [CalendarService],
  exports: [CalendarService],
})
export class CalendarModule {}
