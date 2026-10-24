import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import clsx from 'clsx';
import { useEffect, useMemo, useState } from 'react';

import { ErrorState } from '@/components/ui';
import { useQuery } from '@/hooks/useApi';

export type FieldRule = 'required' | 'optional' | 'off';

/** GET /appointments/availability: staff rules (no notice period, no horizon). */
export interface StaffAvailability {
  days: Record<string, string[]>;
  fields: { phone: FieldRule; address: FieldRule; postcode: FieldRule; notes: FieldRule };
  services: string[];
  slotMinutes: number;
}

export const STUDIO_ZONE = 'Europe/London';
const pad = (n: number) => String(n).padStart(2, '0');
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Today in the studio's calendar, as YYYY-MM-DD. */
export function studioToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: STUDIO_ZONE }).format(new Date());
}

/** "9:5" -> "09:05": 24-hour, like every other time on the staff screens. */
export function clock(time: string): string {
  const [h = 0, m = 0] = time.split(':').map(Number);
  return `${pad(h)}:${pad(m)}`;
}

/**
 * A month of free days and, for the chosen day, its free times, straight from
 * the API, so the admin can only pick what the website would also allow
 * (bar the visitor-only notice period and horizon). `except` frees a booking's
 * own time while it is being moved.
 */
export function DayTimePicker({
  date,
  time,
  onChange,
  except,
  onRules,
}: {
  date: string | null;
  time: string | null;
  onChange: (date: string | null, time: string | null) => void;
  except?: string;
  onRules?: (rules: StaffAvailability) => void;
}) {
  const today = useMemo(studioToday, []);
  const [view, setView] = useState(() => (date ?? today).slice(0, 7));
  const [year, month] = view.split('-').map(Number) as [number, number];
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const offset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const from = `${view}-01`;
  const to = `${view}-${pad(days)}`;
  const free = useQuery<StaffAvailability>(
    `/appointments/availability?from=${from}&to=${to}${except ? `&except=${except}` : ''}`,
  );

  // Hand the form's rules up once they are known.
  const rules = free.data;
  useEffect(() => {
    if (rules) onRules?.(rules);
  }, [rules, onRules]);

  const move = (delta: number) => {
    const next = new Date(Date.UTC(year, month - 1 + delta, 1));
    setView(`${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}`);
  };
  const times = date ? (free.data?.days[date] ?? []) : [];

  return (
    <div className="grid gap-6 sm:grid-cols-[18rem_minmax(0,1fr)]">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => move(-1)}
            disabled={view <= today.slice(0, 7)}
            aria-label="Previous month"
            className="flex h-8 w-8 items-center justify-center rounded-control text-ink-muted hover:bg-ink/[0.06] hover:text-ink disabled:opacity-30"
          >
            <CaretLeft size={16} aria-hidden="true" />
          </button>
          <span className="text-sm font-semibold text-ink" aria-live="polite">
            {MONTH.format(new Date(Date.UTC(year, month - 1, 1)))}
          </span>
          <button
            type="button"
            onClick={() => move(1)}
            aria-label="Next month"
            className="flex h-8 w-8 items-center justify-center rounded-control text-ink-muted hover:bg-ink/[0.06] hover:text-ink"
          >
            <CaretRight size={16} aria-hidden="true" />
          </button>
        </div>
        {free.error ? (
          <ErrorState message={free.error} onRetry={free.refetch} />
        ) : (
          <div className="grid grid-cols-7 gap-0.5 text-center" aria-busy={free.loading}>
            {WEEKDAYS.map((day) => (
              <span key={day} className="py-1 text-[11px] font-semibold uppercase text-ink-muted">
                {day}
              </span>
            ))}
            {Array.from({ length: offset }, (_, i) => (
              <span key={`blank-${i}`} />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const iso = `${view}-${pad(i + 1)}`;
              const open = !!free.data?.days[iso]?.length;
              const selected = iso === date;
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={!open}
                  aria-pressed={selected}
                  aria-label={`${i + 1}${open ? `, ${free.data!.days[iso]!.length} free` : ', nothing free'}`}
                  onClick={() => onChange(iso, null)}
                  className={clsx(
                    'tabular mx-auto flex h-9 w-9 items-center justify-center rounded-full text-[13px] transition-colors',
                    selected
                      ? 'bg-green-900 font-semibold text-on-primary'
                      : open
                        ? 'font-medium text-ink hover:bg-green-100 hover:text-green-900'
                        : 'text-ink-muted/40',
                    iso === today && !selected && 'ring-1 ring-inset ring-green-900/40',
                    free.loading && 'animate-pulse',
                  )}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <p className="mb-3 text-sm font-semibold text-ink">
          {date
            ? new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
            : 'Choose a day'}
        </p>
        {date ? (
          times.length ? (
            <div className="flex flex-wrap gap-2">
              {times.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  aria-pressed={slot === time}
                  onClick={() => onChange(date, slot)}
                  className={clsx(
                    'tabular min-h-9 rounded-control px-3.5 text-sm font-medium transition-colors',
                    slot === time ? 'bg-green-900 text-on-primary' : 'bg-ink/[0.05] text-ink hover:bg-green-100 hover:text-green-900',
                  )}
                >
                  {clock(slot)}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-muted">Nothing free that day.</p>
          )
        ) : (
          <p className="text-sm text-ink-muted">
            Days with a free time are in bold. Taken times, closed days and breaks are left out.
          </p>
        )}
      </div>
    </div>
  );
}
