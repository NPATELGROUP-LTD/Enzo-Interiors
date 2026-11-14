import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import clsx from 'clsx';
import { useEffect, useState } from 'react';

import { clock, STUDIO_ZONE, type StaffAvailability } from '@/components/booking/DayTimePicker';
import { ErrorState } from '@/components/ui';

/** A consultation as GET /appointments sends it. */
export interface Appointment {
  id: string;
  reference: string;
  service: string;
  service_label: string;
  starts_at: string;
  ends_at: string;
  status: 'Confirmed' | 'Cancelled';
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  postcode: string | null;
  notes: string | null;
  details: Record<string, string> | null;
  source: 'website' | 'admin';
  created_by: string | null;
  cancelled_at: string | null;
  created_at: string;
}

const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: STUDIO_ZONE });
const DAYKEY = new Intl.DateTimeFormat('en-CA', { timeZone: STUDIO_ZONE });
/** The studio's calendar day of an instant, as YYYY-MM-DD. */
export const dayKey = (iso: string) => DAYKEY.format(new Date(iso));
/** The studio's clock time of an instant, "09:30". */
export const at = (iso: string) => clock(TIME.format(new Date(iso)));

const pad = (n: number) => String(n).padStart(2, '0');
const minutes = (hhmm: string) => {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
/** Calendar-day maths on YYYY-MM-DD keys (UTC, so no clock change can skip or repeat a day). */
export function addDays(key: string, days: number): string {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
const weekdayOf = (key: string) => (new Date(`${key}T12:00:00Z`).getUTCDay() + 6) % 7;
export const mondayOf = (key: string) => addDays(key, -weekdayOf(key));
const fmt = (key: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).format(new Date(`${key}T12:00:00Z`));

/** True below md: the week shows one day, as a phone has no room for seven columns. */
export function useNarrow(): boolean {
  const query = '(max-width: 767px)';
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const on = () => setNarrow(list.matches);
    list.addEventListener('change', on);
    return () => list.removeEventListener('change', on);
  }, []);
  return narrow;
}

function Nav({
  title,
  sub,
  onPrev,
  onNext,
  onToday,
  what,
}: {
  title: string;
  /** Smaller print after the title; hidden on a phone. */
  sub?: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  what: string;
}) {
  const arrow =
    'flex h-8 w-8 items-center justify-center rounded-control text-ink-muted transition-colors hover:bg-ink/[0.06] hover:text-ink pointer-coarse:h-11 pointer-coarse:w-11';
  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-border px-3 py-2">
      <button type="button" onClick={onPrev} aria-label={`Previous ${what}`} className={arrow}>
        <CaretLeft size={16} aria-hidden="true" />
      </button>
      <button type="button" onClick={onNext} aria-label={`Next ${what}`} className={arrow}>
        <CaretRight size={16} aria-hidden="true" />
      </button>
      <h2 className="ml-2 min-w-0 flex-1 truncate text-[15px] font-semibold text-ink" aria-live="polite">
        {title}
        {sub ? <span className="ml-2 font-normal text-ink-muted max-sm:hidden">{sub}</span> : null}
      </h2>
      <button
        type="button"
        onClick={onToday}
        className="rounded-control px-3 text-sm font-semibold text-ink-muted transition-colors hover:bg-ink/[0.06] hover:text-ink min-h-8 pointer-coarse:min-h-11"
      >
        Today
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Week                                                                       */
/* -------------------------------------------------------------------------- */

const PX = 1.15; // pixels per minute
const HATCH = 'repeating-linear-gradient(135deg, transparent 0 7px, color-mix(in srgb, currentColor 7%, transparent) 7px 8px)';

/**
 * The week (a single day on a phone). Every time the website could book is a clickable white cell;
 * everything else is hatched: closed, breaks, past, and time busy in the studio's Google Calendar
 * (the API leaves all of those out of the free times). Drag a booking onto a free cell to move it.
 * A touch screen has no drag: tap a booking, then Move.
 */
export function WeekCalendar({
  bookings,
  free,
  loading,
  error,
  onRetry,
  anchor,
  onAnchor,
  today,
  narrow,
  onOpen,
  onBook,
  onMove,
}: {
  bookings: Appointment[];
  free: StaffAvailability | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  anchor: string;
  onAnchor: (key: string) => void;
  today: string;
  narrow: boolean;
  onOpen: (id: string) => void;
  onBook: (date: string, time: string) => void;
  onMove: (row: Appointment, date: string, time: string) => void;
}) {
  const monday = mondayOf(anchor);
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const days = narrow ? [anchor] : week;
  const step = narrow ? 1 : 7;
  const slot = free?.slotMinutes ?? 60;
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const byDay = (key: string) => bookings.filter((row) => dayKey(row.starts_at) === key);

  // The hours shown: 9 to 5 at least, wider if anything this week falls outside.
  const starts = [9 * 60];
  const ends = [17 * 60];
  for (const key of days) {
    for (const time of free?.days[key] ?? []) {
      starts.push(minutes(time));
      ends.push(minutes(time) + slot);
    }
    for (const row of byDay(key)) {
      const start = minutes(at(row.starts_at));
      starts.push(start);
      ends.push(start + (Date.parse(row.ends_at) - Date.parse(row.starts_at)) / 60_000);
    }
  }
  const from = Math.floor(Math.min(...starts) / 60) * 60;
  const to = Math.min(24 * 60, Math.ceil(Math.max(...ends) / 60) * 60);
  const height = (to - from) * PX;
  const hours = Array.from({ length: (to - from) / 60 }, (_, i) => from + i * 60);
  const now = Date.now();

  const title = narrow
    ? fmt(anchor, { weekday: 'short', day: 'numeric', month: 'long' })
    : `${fmt(week[0]!, { day: 'numeric', month: 'short' })} – ${fmt(week[6]!, { day: 'numeric', month: 'short', year: 'numeric' })}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-card bg-surface shadow-soft">
      <Nav
        title={title}
        what={narrow ? 'day' : 'week'}
        onPrev={() => onAnchor(addDays(anchor, -step))}
        onNext={() => onAnchor(addDays(anchor, step))}
        onToday={() => onAnchor(today)}
      />

      {narrow ? (
        <div className="grid shrink-0 grid-cols-7 gap-1 border-b border-border px-2 py-2" role="group" aria-label="Days of the week">
          {week.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onAnchor(key)}
              aria-pressed={key === anchor}
              className={clsx(
                'tabular flex min-h-12 flex-col items-center justify-center rounded-control text-[11px] font-semibold uppercase transition-colors',
                key === anchor ? 'bg-green-900 text-on-primary' : 'text-ink-muted hover:bg-ink/[0.06]',
              )}
            >
              {fmt(key, { weekday: 'narrow' })}
              <span className={clsx('text-[15px] normal-case', key !== anchor && key === today && 'text-green-900 dark:text-ink')}>
                {Number(key.slice(8))}
              </span>
              <span className={clsx('mt-0.5 h-1 w-1 rounded-full', byDay(key).length ? (key === anchor ? 'bg-on-primary' : 'bg-green-900') : 'bg-transparent')} />
            </button>
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="p-4">
          <ErrorState message={error} onRetry={onRetry} />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto" aria-busy={loading}>
          <div className="grid min-w-0" style={{ gridTemplateColumns: `3rem repeat(${days.length}, minmax(0, 1fr))` }}>
            <div className="sticky top-0 z-20 border-b border-border bg-surface" />
            {days.map((key) => (
              <div
                key={key}
                className="sticky top-0 z-20 flex items-baseline justify-center gap-1.5 border-b border-l border-border bg-surface py-2 text-[13px] text-ink-muted"
              >
                <span className="font-semibold uppercase tracking-[0.04em]">{fmt(key, { weekday: 'short' })}</span>
                <span
                  className={clsx(
                    'tabular flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[13px] font-semibold',
                    key === today ? 'bg-green-900 text-on-primary' : 'text-ink',
                  )}
                >
                  {Number(key.slice(8))}
                </span>
              </div>
            ))}

            <div className="relative" style={{ height }} aria-hidden="true">
              {hours.map((minute) => (
                <span
                  key={minute}
                  className="tabular absolute right-2 -translate-y-1/2 text-[11px] text-ink-muted first:translate-y-0"
                  style={{ top: (minute - from) * PX }}
                >
                  {clock(`${minute / 60}:00`)}
                </span>
              ))}
            </div>

            {days.map((key) => (
              <div key={key} className="relative border-l border-border text-ink" style={{ height, backgroundImage: HATCH }}>
                {hours.map((minute) => (
                  <div
                    key={minute}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 border-t border-border/70"
                    style={{ top: (minute - from) * PX }}
                  />
                ))}

                {(free?.days[key] ?? []).map((time) => {
                  const cell = `${key}T${time}`;
                  return (
                    <button
                      key={time}
                      type="button"
                      onClick={() => onBook(key, time)}
                      onDragOver={(event) => {
                        if (!dragId) return;
                        event.preventDefault();
                        setOver(cell);
                      }}
                      onDragLeave={() => setOver((current) => (current === cell ? null : current))}
                      onDrop={(event) => {
                        event.preventDefault();
                        const row = bookings.find((item) => item.id === dragId);
                        setDragId(null);
                        setOver(null);
                        if (row) onMove(row, key, time);
                      }}
                      aria-label={`Book ${fmt(key, { weekday: 'long', day: 'numeric', month: 'long' })} at ${clock(time)}`}
                      className={clsx(
                        'group tabular absolute inset-x-[3px] flex items-start rounded-[8px] px-2 py-1 text-left text-[11px] ring-1 ring-inset ring-border transition-colors',
                        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring/40',
                        over === cell
                          ? 'bg-green-100 text-green-900 ring-2 ring-green-900'
                          : 'bg-surface text-ink-muted/70 hover:bg-green-100 hover:text-green-900',
                      )}
                      style={{ top: (minutes(time) - from) * PX + 1, height: slot * PX - 2 }}
                    >
                      {clock(time)}
                      <span className="ml-1.5 hidden font-semibold group-hover:inline group-focus-visible:inline">Book</span>
                    </button>
                  );
                })}

                {byDay(key).map((row) => {
                  const start = minutes(at(row.starts_at));
                  const length = (Date.parse(row.ends_at) - Date.parse(row.starts_at)) / 60_000;
                  const past = Date.parse(row.ends_at) < now;
                  return (
                    <button
                      key={row.id}
                      type="button"
                      draggable={!past}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', row.id);
                        setDragId(row.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOver(null);
                      }}
                      onClick={() => onOpen(row.id)}
                      aria-label={`${at(row.starts_at)}, ${row.name}, ${row.service_label}`}
                      className={clsx(
                        'absolute inset-x-[3px] z-10 overflow-hidden rounded-[8px] border-l-[3px] border-green-900 bg-green-100 px-2 py-1 text-left text-green-900',
                        'shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring/40',
                        past ? 'opacity-60' : 'cursor-grab active:cursor-grabbing',
                        dragId === row.id && 'opacity-40',
                      )}
                      style={{ top: (start - from) * PX + 1, height: Math.max(length * PX - 2, 26) }}
                    >
                      <span className="tabular block text-[11px] font-semibold leading-tight">{at(row.starts_at)}</span>
                      <span className="block truncate text-[13px] font-semibold leading-tight">{row.name}</span>
                      {length * PX > 56 ? <span className="block truncate text-[11px] leading-tight opacity-80">{row.service_label}</span> : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="shrink-0 border-t border-border px-4 py-2 text-[12px] text-ink-muted">
        {narrow
          ? 'Hatched: closed, past or busy. Tap a free time to book, a booking to move it.'
          : 'Hatched time is closed, on a break, past, or busy in the studio’s Google Calendar. Click a free time to book it; drag a booking onto one to move it.'}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Month                                                                      */
/* -------------------------------------------------------------------------- */

/** The month: each day's consultations. A day opens in the week view; a booking opens itself. */
export function MonthCalendar({
  bookings,
  anchor,
  onAnchor,
  today,
  onPickDay,
  onOpen,
}: {
  bookings: Appointment[];
  anchor: string;
  onAnchor: (key: string) => void;
  today: string;
  onPickDay: (key: string) => void;
  onOpen: (id: string) => void;
}) {
  const month = anchor.slice(0, 7);
  const first = `${month}-01`;
  const [year, number] = month.split('-').map(Number) as [number, number];
  const length = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const offset = weekdayOf(first);
  const cells: Array<string | null> = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length }, (_, i) => `${month}-${pad(i + 1)}`),
  ];
  while (cells.length % 7) cells.push(null);

  const perDay = new Map<string, Appointment[]>();
  for (const row of bookings) {
    const key = dayKey(row.starts_at);
    if (key.startsWith(month)) perDay.set(key, [...(perDay.get(key) ?? []), row]);
  }
  const total = [...perDay.values()].reduce((sum, rows) => sum + rows.length, 0);
  const shift = (delta: number) => onAnchor(new Date(Date.UTC(year, number - 1 + delta, 1, 12)).toISOString().slice(0, 10));

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-card bg-surface shadow-soft">
      <Nav
        title={fmt(first, { month: 'long', year: 'numeric' })}
        sub={total ? `${total} consultation${total === 1 ? '' : 's'}` : 'Nothing booked'}
        what="month"
        onPrev={() => shift(-1)}
        onNext={() => shift(1)}
        onToday={() => onAnchor(today)}
      />
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="grid grid-cols-7">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <span key={day} className="border-b border-border py-2 text-center text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-muted">
              {day}
            </span>
          ))}
          {cells.map((key, i) => {
            if (!key) return <div key={`blank-${i}`} className="min-h-14 border-b border-l border-border bg-ink/[0.02] sm:min-h-28" />;
            const rows = perDay.get(key) ?? [];
            return (
              <div key={key} className="min-h-14 border-b border-l border-border p-1 sm:min-h-28 sm:p-1.5">
                <button
                  type="button"
                  onClick={() => onPickDay(key)}
                  aria-label={`${fmt(key, { weekday: 'long', day: 'numeric', month: 'long' })}: ${rows.length ? `${rows.length} booked` : 'nothing booked'}`}
                  className={clsx(
                    'tabular flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-[13px] font-semibold transition-colors',
                    key === today ? 'bg-green-900 text-on-primary' : 'text-ink hover:bg-ink/[0.06]',
                  )}
                >
                  {Number(key.slice(8))}
                </button>
                <div className="mt-1 hidden flex-col gap-0.5 sm:flex">
                  {rows.slice(0, 3).map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => onOpen(row.id)}
                      className="flex min-w-0 items-baseline gap-1.5 rounded-[6px] bg-green-100 px-1.5 py-0.5 text-left text-[12px] text-green-900 transition-colors hover:bg-green-900 hover:text-on-primary"
                    >
                      <span className="tabular shrink-0 font-semibold">{at(row.starts_at)}</span>
                      <span className="truncate">{row.name}</span>
                    </button>
                  ))}
                  {rows.length > 3 ? (
                    <button type="button" onClick={() => onPickDay(key)} className="px-1.5 text-left text-[12px] font-semibold text-ink-muted hover:text-ink">
                      +{rows.length - 3} more
                    </button>
                  ) : null}
                </div>
                {rows.length ? (
                  <span className="tabular mx-auto mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-[11px] font-semibold text-green-900 sm:hidden">
                    {rows.length}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
