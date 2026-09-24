/**
 * Which consultation times can be booked. Pure functions, no database, so the
 * rules can be checked on their own (slots.test.ts).
 *
 * Times are wall-clock times at the studio. The studio is in Leicester, so
 * every day's schedule is read in Europe/London whatever the server's zone,
 * and the clocks changing in March and October are handled by the zone rules.
 */

export const ZONE = 'Europe/London';

export const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface DayHours {
  open: boolean;
  /** When the first consultation starts, "HH:MM". */
  first: string;
  /** The latest a consultation may start, "HH:MM". */
  last: string;
  /** No consultation may overlap one of these. */
  breaks: Array<{ start: string; end: string }>;
}

export type FieldRule = 'required' | 'optional' | 'off';

export interface BookingConfig {
  week: Record<Weekday, DayHours>;
  /** How long one consultation lasts. */
  slotMinutes: number;
  /** Time kept free after each one (travel, notes). */
  gapMinutes: number;
  /** Consultations per day at most. 0 = no limit beyond the slots themselves. */
  maxPerDay: number;
  /** How many days ahead a visitor may book. */
  horizonDays: number;
  /** How much notice a visitor must give. */
  noticeHours: number;
  /** What the details step asks for. Name and email are always required. */
  fields: { phone: FieldRule; address: FieldRule; postcode: FieldRule; notes: FieldRule };
  /** Services that can be booked, by slug. Empty = every published service. */
  services: string[];
}

const open = (first: string, last: string, breaks: DayHours['breaks'] = []): DayHours => ({
  open: true,
  first,
  last,
  breaks,
});
const closed: DayHours = { open: false, first: '10:00', last: '16:00', breaks: [] };

/** What a new install starts with: the studio's published opening hours. */
export const DEFAULT_CONFIG: BookingConfig = {
  week: {
    sunday: closed,
    monday: closed,
    tuesday: open('10:00', '15:30'),
    wednesday: open('10:00', '15:30'),
    thursday: open('10:00', '15:30'),
    friday: open('10:00', '15:30', [{ start: '12:30', end: '14:30' }]),
    saturday: open('10:00', '15:30'),
  },
  slotMinutes: 60,
  gapMinutes: 30,
  maxPerDay: 0,
  horizonDays: 60,
  noticeHours: 24,
  fields: { phone: 'required', address: 'off', postcode: 'optional', notes: 'optional' },
  services: [],
};

export const toMinutes = (hhmm: string): number => {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const pad = (n: number) => String(n).padStart(2, '0');
export const toHhmm = (minutes: number): string => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

const PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/** An instant as the studio's calendar date and clock time. */
export function studioParts(instant: Date): { date: string; time: string } {
  const get = (type: string) => PARTS.formatToParts(instant).find((part) => part.type === type)?.value ?? '00';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

/** The instant a studio date and clock time fall on. */
export function studioInstant(date: string, hhmm: string): Date {
  const [y = 0, mo = 1, d = 1] = date.split('-').map(Number);
  const wanted = Date.UTC(y, mo - 1, d) + toMinutes(hhmm) * 60_000;
  // How far the studio's clock is ahead of UTC at instant t.
  const offset = (t: number) => {
    const parts = studioParts(new Date(t));
    const [py = 0, pmo = 1, pd = 1] = parts.date.split('-').map(Number);
    return Date.UTC(py, pmo - 1, pd) + toMinutes(parts.time) * 60_000 - t;
  };
  // Twice, so a time just after the clocks change lands on the right side.
  const first = wanted - offset(wanted);
  return new Date(wanted - offset(first));
}

/** Calendar arithmetic on YYYY-MM-DD, independent of any zone. */
export function addDays(date: string, days: number): string {
  const [y = 0, m = 1, d = 1] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function weekdayOf(date: string): Weekday {
  const [y = 0, m = 1, d = 1] = date.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]!;
}

/**
 * The start times of one day's consultations: from `first`, one every
 * slot + gap, up to `last`. A consultation that would run into a break is
 * moved to the end of that break, and the day carries on from there.
 */
export function daySlots(day: DayHours, slotMinutes: number, gapMinutes: number): string[] {
  if (!day.open) return [];
  const breaks = day.breaks.map((b) => [toMinutes(b.start), toMinutes(b.end)] as const);
  const last = toMinutes(day.last);
  const out: string[] = [];
  let t = toMinutes(day.first);
  while (t <= last) {
    const clash = breaks.find(([start, end]) => t < end && t + slotMinutes > start);
    if (clash) {
      t = clash[1];
      continue;
    }
    out.push(toHhmm(t));
    t += slotMinutes + gapMinutes;
  }
  return out;
}

export interface Taken {
  starts_at: string;
  ends_at: string;
}

/**
 * Every bookable time from `from` to `to` (inclusive, studio dates), as
 * { date: [times] }. Days with nothing free are left out.
 *
 * Staff booking on a client's behalf skip the visitor-only rules: the notice
 * period and how far ahead. Nobody can book the past, a taken time, or past
 * the day's limit.
 */
export function availability(
  config: BookingConfig,
  from: string,
  to: string,
  taken: Taken[],
  now: Date,
  staff = false,
): Record<string, string[]> {
  const today = studioParts(now).date;
  const earliest = now.getTime() + (staff ? 0 : config.noticeHours * 3_600_000);
  const horizon = staff ? '9999-12-31' : addDays(today, config.horizonDays);

  const booked = taken.map((row) => ({
    start: Date.parse(row.starts_at),
    end: Date.parse(row.ends_at),
    date: studioParts(new Date(row.starts_at)).date,
  }));

  const out: Record<string, string[]> = {};
  for (let date = from < today ? today : from; date <= to && date <= horizon; date = addDays(date, 1)) {
    if (config.maxPerDay > 0 && booked.filter((row) => row.date === date).length >= config.maxPerDay) continue;
    const times = daySlots(config.week[weekdayOf(date)], config.slotMinutes, config.gapMinutes).filter((time) => {
      const start = studioInstant(date, time).getTime();
      const end = start + config.slotMinutes * 60_000;
      return start >= earliest && !booked.some((row) => start < row.end && end > row.start);
    });
    if (times.length) out[date] = times;
  }
  return out;
}
