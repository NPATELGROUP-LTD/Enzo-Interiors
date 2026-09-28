import { Plus, X } from '@phosphor-icons/react';
import clsx from 'clsx';
import { useEffect, useMemo, useState } from 'react';

import { Button, ErrorState, FIELD_BASE, LoadingState, Select, Toggle } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
import type { CmsEntrySummary } from '@/types/cms';

/* The shape apps/api/src/modules/booking/slots.ts validates and stores. */

type FieldRule = 'required' | 'optional' | 'off';
interface DayHours {
  open: boolean;
  first: string;
  last: string;
  breaks: Array<{ start: string; end: string }>;
}
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
type Day = (typeof DAYS)[number];

export interface BookingConfig {
  week: Record<Day, DayHours>;
  slotMinutes: number;
  gapMinutes: number;
  maxPerDay: number;
  horizonDays: number;
  noticeHours: number;
  fields: { phone: FieldRule; address: FieldRule; postcode: FieldRule; notes: FieldRule };
  services: string[];
}

const toMinutes = (hhmm: string) => {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const toHhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/**
 * The same walk the API does (slots.ts daySlots), so the admin sees exactly
 * which times a visitor will be offered before saving. Kept in step by hand:
 * the API is still the one that decides.
 */
function previewSlots(day: DayHours, slot: number, gap: number): string[] {
  if (!day.open || slot < 15) return [];
  const breaks = day.breaks.map((b) => [toMinutes(b.start), toMinutes(b.end)] as const);
  const out: string[] = [];
  let t = toMinutes(day.first);
  const last = toMinutes(day.last);
  while (t <= last && out.length < 48) {
    const clash = breaks.find(([start, end]) => t < end && t + slot > start && end > t);
    if (clash) {
      t = clash[1];
      continue;
    }
    out.push(toHhmm(t));
    t += slot + gap;
  }
  return out;
}

// FIELD_BASE is full width; these sit in a row, so they size themselves.
const INLINE_FIELD = FIELD_BASE.replace('w-full ', '');
const TIME_INPUT = clsx(INLINE_FIELD, 'w-[7.5rem] tabular');
const NUMBER_INPUT = clsx(INLINE_FIELD, 'w-24 tabular');
const HEADING = 'text-lg font-semibold tracking-tight text-ink';
const HELP = 'mt-1 text-sm leading-relaxed text-ink-muted';
const FIELD_NAMES = { phone: 'Phone number', address: 'Address', postcode: 'Postcode', notes: 'Notes' } as const;

function NumberRow({
  label,
  hint,
  unit,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-x-6 gap-y-1 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        <span className="block text-[13px] text-ink-muted">{hint}</span>
      </span>
      <span className="flex items-center gap-2 whitespace-nowrap text-sm text-ink-muted">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={Number.isFinite(value) ? value : ''}
          onChange={(event) => onChange(event.target.valueAsNumber)}
          className={NUMBER_INPUT}
        />
        {unit}
      </span>
    </label>
  );
}

/** Settings › Booking: when consultations can be booked and what the form asks. */
export function BookingSchedule() {
  const toast = useToast();
  const settings = useQuery<{ config: BookingConfig; updated_at: string | null; updated_by: string | null }>('/booking/settings');
  const services = useQuery<CmsEntrySummary[]>('/cms/collections/services');
  const [config, setConfig] = useState<BookingConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings.data) setConfig(settings.data.config);
  }, [settings.data]);

  const dirty = useMemo(
    () => !!config && !!settings.data && JSON.stringify(config) !== JSON.stringify(settings.data.config),
    [config, settings.data],
  );

  if (settings.error) return <ErrorState message={settings.error} onRetry={settings.refetch} />;
  if (!config) return <LoadingState label="Loading the schedule…" />;

  const setDay = (day: Day, patch: Partial<DayHours>) =>
    setConfig({ ...config, week: { ...config.week, [day]: { ...config.week[day], ...patch } } });

  const save = async () => {
    setSaving(true);
    try {
      settings.setData(await api.put('/booking/settings', { config }));
      toast.success('Booking settings saved. The website offers the new times straight away.');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not save the booking settings.');
    } finally {
      setSaving(false);
    }
  };

  const published = (services.data ?? []).filter((row) => !row.isNew);
  const perDay = DAYS.map((day) => previewSlots(config.week[day], config.slotMinutes, config.gapMinutes).length);

  return (
    <div className="max-w-3xl">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className={HEADING}>Booking</h2>
          <p className={clsx(HELP, 'max-w-[60ch]')}>
            When visitors can book a free consultation on the website, and what the form asks them.
            Times already booked are never offered, here or on the website.
          </p>
        </div>
        <Button variant="primary" onClick={save} loading={saving} disabled={!dirty}>
          Save changes
        </Button>
      </header>

      {/* ------------------------------------------------------------ Week */}
      <section aria-labelledby="booking-week" className="mt-8">
        <h3 id="booking-week" className="text-[15px] font-semibold text-ink">
          Weekly hours
        </h3>
        <p className={HELP}>
          The first and last time a consultation can <em>start</em>. Breaks are skipped: a consultation that
          would run into one starts when it ends.
        </p>
        <ul className="mt-4 flex flex-col">
          {DAYS.map((day, index) => {
            const hours = config.week[day];
            const slots = previewSlots(hours, config.slotMinutes, config.gapMinutes);
            const name = day[0]!.toUpperCase() + day.slice(1);
            return (
              <li key={day} className={clsx('py-4', index > 0 && 'border-t border-border/70')}>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                  <span className="w-40 shrink-0">
                    <Toggle label={name} checked={hours.open} onChange={(open) => setDay(day, { open })} />
                  </span>
                  {hours.open ? (
                    <>
                      <label className="flex items-center gap-2 whitespace-nowrap text-[13px] text-ink-muted">
                        From
                        <input
                          type="time"
                          aria-label={`${name}: first start`}
                          value={hours.first}
                          onChange={(event) => setDay(day, { first: event.target.value })}
                          className={TIME_INPUT}
                        />
                      </label>
                      <label className="flex items-center gap-2 whitespace-nowrap text-[13px] text-ink-muted">
                        last start
                        <input
                          type="time"
                          aria-label={`${name}: last start`}
                          value={hours.last}
                          onChange={(event) => setDay(day, { last: event.target.value })}
                          className={TIME_INPUT}
                        />
                      </label>
                      {hours.breaks.length < 6 ? (
                        <Button
                          variant="ghost"
                          icon={<Plus size={14} />}
                          onClick={() => setDay(day, { breaks: [...hours.breaks, { start: '12:30', end: '13:30' }] })}
                          className="text-[13px]"
                        >
                          Break
                        </Button>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-[13px] text-ink-muted">Closed: no bookings</span>
                  )}
                </div>

                {hours.open && hours.breaks.length ? (
                  <ul className="mt-3 flex flex-col gap-2 sm:pl-44">
                    {hours.breaks.map((item, at) => (
                      <li key={at} className="flex flex-wrap items-center gap-2 text-[13px] text-ink-muted">
                        Break
                        <input
                          type="time"
                          aria-label={`${name}: break ${at + 1} starts`}
                          value={item.start}
                          onChange={(event) =>
                            setDay(day, { breaks: hours.breaks.map((b, i) => (i === at ? { ...b, start: event.target.value } : b)) })
                          }
                          className={TIME_INPUT}
                        />
                        to
                        <input
                          type="time"
                          aria-label={`${name}: break ${at + 1} ends`}
                          value={item.end}
                          onChange={(event) =>
                            setDay(day, { breaks: hours.breaks.map((b, i) => (i === at ? { ...b, end: event.target.value } : b)) })
                          }
                          className={TIME_INPUT}
                        />
                        <button
                          type="button"
                          aria-label={`Remove ${name}'s break ${at + 1}`}
                          onClick={() => setDay(day, { breaks: hours.breaks.filter((_, i) => i !== at) })}
                          className="flex h-8 w-8 items-center justify-center rounded-control text-ink-muted hover:bg-ink/[0.06] hover:text-ink"
                        >
                          <X size={14} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {hours.open ? (
                  <p className="tabular mt-2 text-[13px] text-ink-muted sm:pl-44">
                    {slots.length ? (
                      <>
                        <span className="font-medium text-ink">{slots.length} times:</span> {slots.join(', ')}
                      </>
                    ) : (
                      <span className="text-warning">No times fit. Check the hours and breaks.</span>
                    )}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {/* ------------------------------------------------------------ Rules */}
      <section aria-labelledby="booking-rules" className="mt-10 border-t border-border pt-7">
        <h3 id="booking-rules" className="text-[15px] font-semibold text-ink">
          Consultations
        </h3>
        <div className="mt-2 flex flex-col divide-y divide-border/70">
          <NumberRow
            label="How long each one lasts"
            hint="Also how long a booking blocks in the diary."
            unit="minutes"
            min={15}
            max={480}
            value={config.slotMinutes}
            onChange={(slotMinutes) => setConfig({ ...config, slotMinutes })}
          />
          <NumberRow
            label="Time between them"
            hint="Kept free after each one, for travel and notes."
            unit="minutes"
            min={0}
            max={240}
            value={config.gapMinutes}
            onChange={(gapMinutes) => setConfig({ ...config, gapMinutes })}
          />
          <NumberRow
            label="Most in one day"
            hint={`0 means no limit beyond the times themselves (up to ${Math.max(...perDay)} a day now).`}
            unit="a day"
            min={0}
            max={50}
            value={config.maxPerDay}
            onChange={(maxPerDay) => setConfig({ ...config, maxPerDay })}
          />
          <NumberRow
            label="How far ahead visitors can book"
            hint="You can always book further ahead from Bookings."
            unit="days"
            min={1}
            max={365}
            value={config.horizonDays}
            onChange={(horizonDays) => setConfig({ ...config, horizonDays })}
          />
          <NumberRow
            label="Notice needed"
            hint="Nobody can book a time sooner than this from now."
            unit="hours"
            min={0}
            max={336}
            value={config.noticeHours}
            onChange={(noticeHours) => setConfig({ ...config, noticeHours })}
          />
        </div>
      </section>

      {/* ------------------------------------------------------------ Form */}
      <section aria-labelledby="booking-form" className="mt-10 border-t border-border pt-7">
        <h3 id="booking-form" className="text-[15px] font-semibold text-ink">
          What the form asks
        </h3>
        <p className={HELP}>Name and email are always required. The wording of every step is in CMS › Book a consultation.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {(Object.keys(FIELD_NAMES) as Array<keyof typeof FIELD_NAMES>).map((key) => (
            <Select
              key={key}
              label={FIELD_NAMES[key]}
              value={config.fields[key]}
              onChange={(event) =>
                setConfig({ ...config, fields: { ...config.fields, [key]: event.target.value as FieldRule } })
              }
            >
              <option value="required">Required</option>
              <option value="optional">Optional</option>
              <option value="off">Not asked</option>
            </Select>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ Services */}
      <section aria-labelledby="booking-services" className="mt-10 border-t border-border pt-7">
        <h3 id="booking-services" className="text-[15px] font-semibold text-ink">
          What can be booked
        </h3>
        <p className={HELP}>Leave all unticked to take bookings for every service on the website.</p>
        {services.error ? (
          <ErrorState message={services.error} onRetry={services.refetch} />
        ) : services.data && published.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">
            No services are published yet. Publish one in CMS › Services and it can be booked here.
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
          {published.map((row) => (
            <label key={row.slug} className="flex min-h-9 items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={config.services.includes(row.slug)}
                onChange={(event) =>
                  setConfig({
                    ...config,
                    services: event.target.checked
                      ? [...config.services, row.slug]
                      : config.services.filter((slug) => slug !== row.slug),
                  })
                }
                className="h-4 w-4 accent-green-900"
              />
              {row.title}
            </label>
          ))}
        </div>
      </section>

      {settings.data?.updated_by ? (
        <p className="mt-10 text-xs text-ink-muted">
          Last changed by {settings.data.updated_by}
          {settings.data.updated_at ? `, ${new Date(settings.data.updated_at).toLocaleString('en-GB')}` : ''}.
        </p>
      ) : null}
    </div>
  );
}
