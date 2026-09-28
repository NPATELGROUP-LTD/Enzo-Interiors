import { Plus, X } from '@phosphor-icons/react';
import clsx from 'clsx';
import { useEffect, useState } from 'react';

import { Button, ErrorState, FIELD_BASE, LoadingState, Textarea, Toggle } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';

/* The shape apps/api/src/modules/site-settings/opening-hours.ts validates and stores. */
interface Hours {
  weekly: Record<string, Array<{ open: string; close: string }>>;
  notes: Record<string, string>;
  note: string;
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const INLINE_FIELD = FIELD_BASE.replace('w-full ', '');
const TIME_INPUT = clsx(INLINE_FIELD, 'w-[7.5rem] tabular');
const HELP = 'mt-1 text-sm leading-relaxed text-ink-muted';

/**
 * Settings › Opening hours: when the studio is open, as the website shows it
 * (footer, contact page, beside the booking form, and to search engines).
 * Separate from Settings › Booking, which decides when consultations start.
 */
export function OpeningHours() {
  const toast = useToast();
  const settings = useQuery<{ hours: Hours; saved: boolean }>('/settings/opening-hours');
  const [hours, setHours] = useState<Hours | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings.data) setHours(settings.data.hours);
  }, [settings.data]);

  if (settings.error) return <ErrorState message={settings.error} onRetry={settings.refetch} />;
  if (!hours || !settings.data) return <LoadingState label="Loading opening hours…" />;

  const dirty = JSON.stringify(hours) !== JSON.stringify(settings.data.hours);
  const setWindows = (day: string, windows: Hours['weekly'][string]) =>
    setHours({ ...hours, weekly: { ...hours.weekly, [day]: windows } });
  const setNote = (day: string, note: string) => setHours({ ...hours, notes: { ...hours.notes, [day]: note } });

  const save = async () => {
    setSaving(true);
    try {
      settings.setData(await api.put('/settings/opening-hours', { hours }));
      toast.success('Opening hours saved. The website updates in a few seconds.');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not save the opening hours.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-ink">Opening hours</h2>
          <p className={clsx(HELP, 'max-w-[60ch]')}>
            When the studio is open, as the website shows it: in the footer, on the contact page, beside the
            booking form and to search engines. When consultations can be booked is set in Booking.
          </p>
        </div>
        <Button variant="primary" onClick={save} loading={saving} disabled={!dirty}>
          Save changes
        </Button>
      </header>

      {settings.data.saved ? null : (
        <p className="mt-5 rounded-[10px] bg-green-100 px-4 py-3 text-sm text-ink">
          These are the hours from Company details. Once you save here, this page is where they are changed.
        </p>
      )}

      <ul className="mt-6 flex flex-col">
        {DAYS.map((day, index) => {
          const windows = hours.weekly[day] ?? [];
          const name = day[0]!.toUpperCase() + day.slice(1);
          const last = windows[windows.length - 1];
          return (
            <li key={day} className={clsx('py-4', index > 0 && 'border-t border-border/70')}>
              <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
                <span className="w-40 shrink-0">
                  <Toggle
                    label={name}
                    checked={windows.length > 0}
                    onChange={(open) => setWindows(day, open ? [{ open: '10:00', close: '17:00' }] : [])}
                  />
                </span>
                {windows.length ? (
                  <div className="flex flex-col gap-2">
                    {windows.map((window, at) => (
                      <div key={at} className="flex flex-wrap items-center gap-2 text-[13px] text-ink-muted">
                        <input
                          type="time"
                          aria-label={`${name}: opens`}
                          value={window.open}
                          onChange={(event) =>
                            setWindows(day, windows.map((w, i) => (i === at ? { ...w, open: event.target.value } : w)))
                          }
                          className={TIME_INPUT}
                        />
                        to
                        <input
                          type="time"
                          aria-label={`${name}: closes`}
                          value={window.close}
                          onChange={(event) =>
                            setWindows(day, windows.map((w, i) => (i === at ? { ...w, close: event.target.value } : w)))
                          }
                          className={TIME_INPUT}
                        />
                        {windows.length > 1 ? (
                          <button
                            type="button"
                            aria-label={`Remove ${name}'s hours ${window.open} to ${window.close}`}
                            onClick={() => setWindows(day, windows.filter((_, i) => i !== at))}
                            className="flex h-8 w-8 items-center justify-center rounded-control text-ink-muted hover:bg-ink/[0.06] hover:text-ink pointer-coarse:h-11 pointer-coarse:w-11"
                          >
                            <X size={14} aria-hidden="true" />
                          </button>
                        ) : null}
                      </div>
                    ))}
                    {windows.length < 3 && last && last.close < '21:00' ? (
                      <Button
                        variant="ghost"
                        icon={<Plus size={14} />}
                        className="self-start text-[13px]"
                        // A lunch break by default: reopen an hour after the last close.
                        onClick={() => {
                          const [h = 0, m = 0] = last.close.split(':').map(Number);
                          const at = (hour: number) => `${String(Math.min(hour, 23)).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                          setWindows(day, [...windows, { open: at(h + 1), close: at(h + 3) }]);
                        }}
                      >
                        Add hours
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <span className="pt-1 text-[13px] text-ink-muted">Closed</span>
                )}
              </div>
              <label className="mt-3 block sm:pl-44">
                <span className="sr-only">Note for {name}</span>
                <input
                  type="text"
                  value={hours.notes[day] ?? ''}
                  maxLength={120}
                  placeholder={`Note for ${name} (optional)`}
                  onChange={(event) => setNote(day, event.target.value)}
                  className={clsx(FIELD_BASE, 'text-[13px]')}
                />
              </label>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 border-t border-border pt-7">
        <Textarea
          label="Note under the hours"
          hint="Shown once, under the whole list. For example: consultation calls are available by appointment, outside these hours."
          value={hours.note}
          maxLength={300}
          onChange={(event) => setHours({ ...hours, note: event.target.value })}
        />
      </div>
    </div>
  );
}
