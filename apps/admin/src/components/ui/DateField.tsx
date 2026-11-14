import clsx from 'clsx';
import { CalendarBlank, CaretLeft, CaretRight } from '@phosphor-icons/react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';

/**
 * The app's own date picker, in place of the browser's: a month grid in the
 * app's look, Monday first. It takes and gives plain `YYYY-MM-DD` strings, like
 * a native date input, and <Input type="date"> uses it, so every date field in
 * the admin looks and behaves the same.
 *
 * The calendar is a manual popover (top layer) so a modal's edge or a table's
 * scroll box can never clip it; it opens below the field, or above when there is
 * no room.
 */

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const pad = (n: number) => String(n).padStart(2, '0');
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (value: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
};
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export function DateField({
  id,
  value,
  onChange,
  min,
  max,
  required,
  disabled,
  invalid,
  describedBy,
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = fromIso(value);
  const [view, setView] = useState(() => selected ?? new Date());
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const today = toIso(new Date());

  // Opening shows the month of the chosen date (or this month) and places the panel.
  useLayoutEffect(() => {
    const el = panel.current;
    if (!el) return;
    if (open) {
      setView(selected ?? new Date());
      const box = trigger.current!.getBoundingClientRect();
      const width = Math.min(304, window.innerWidth - 16);
      el.style.width = `${width}px`;
      el.style.left = `${Math.max(8, Math.min(box.left, window.innerWidth - width - 8))}px`;
      if (!el.matches(':popover-open')) el.showPopover();
      const height = el.offsetHeight;
      const below = window.innerHeight - box.bottom;
      el.style.top = `${below >= height + 12 || box.top < height + 12 ? box.bottom + 6 : box.top - height - 6}px`;
      requestAnimationFrame(() => el.querySelector<HTMLElement>('[data-day][tabindex="0"]')?.focus());
    } else if (el.matches(':popover-open')) {
      el.hidePopover();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // A manual popover has no light dismiss.
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !trigger.current?.contains(target)) setOpen(false);
    };
    const resize = () => setOpen(false);
    document.addEventListener('pointerdown', away);
    window.addEventListener('resize', resize);
    return () => {
      document.removeEventListener('pointerdown', away);
      window.removeEventListener('resize', resize);
    };
  }, [open]);

  // Six weeks from the Monday on or before the 1st, so the grid never changes height.
  const days = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const start = addDays(first, -((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [view]);

  const blocked = (iso: string) => (min !== undefined && iso < min) || (max !== undefined && iso > max);
  const pick = (iso: string) => {
    if (blocked(iso)) return;
    onChange(iso);
    setOpen(false);
    trigger.current?.focus();
  };
  const focusDay = (d: Date) => {
    setView(new Date(d.getFullYear(), d.getMonth(), 1));
    requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>(`[data-day="${toIso(d)}"]`)?.focus());
  };
  const onGridKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const at = fromIso((document.activeElement as HTMLElement | null)?.dataset.day ?? '');
    if (event.key === 'Escape') {
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
      return;
    }
    if (!at) return;
    const step: Record<string, Date> = {
      ArrowLeft: addDays(at, -1),
      ArrowRight: addDays(at, 1),
      ArrowUp: addDays(at, -7),
      ArrowDown: addDays(at, 7),
      PageUp: new Date(at.getFullYear(), at.getMonth() - 1, at.getDate()),
      PageDown: new Date(at.getFullYear(), at.getMonth() + 1, at.getDate()),
      Home: addDays(at, -((at.getDay() + 6) % 7)),
      End: addDays(at, 6 - ((at.getDay() + 6) % 7)),
    };
    if (step[event.key]) {
      event.preventDefault();
      focusDay(step[event.key]!);
    }
  };

  const nav = 'flex h-8 w-8 items-center justify-center rounded-control text-ink-muted hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring/40';
  const month = view.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  // Only one day is in the tab order: the chosen one, else today, else the 1st.
  const stop = selected && selected.getMonth() === view.getMonth() && selected.getFullYear() === view.getFullYear() ? toIso(selected) : today.slice(0, 7) === toIso(view).slice(0, 7) ? today : toIso(new Date(view.getFullYear(), view.getMonth(), 1));

  return (
    <div className="relative">
      <button
        ref={trigger}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        onClick={() => setOpen((was) => !was)}
        className={clsx(
          'flex w-full min-h-11 items-center justify-between gap-2 rounded-[7px] border bg-surface px-3 text-left text-ink shadow-card pointer-fine:min-h-9',
          'transition-[border-color,box-shadow] duration-[160ms] focus-visible:border-green-900 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring/35 disabled:opacity-60',
          invalid ? 'border-danger' : 'border-border',
          className,
        )}
      >
        <span className={clsx('truncate', !selected && 'text-ink-muted/70')}>
          {selected ? selected.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'Choose a date'}
        </span>
        <CalendarBlank size={16} aria-hidden="true" className="shrink-0 text-ink-muted" />
      </button>
      {/* Keeps a required field required for the form's own validation. */}
      {required ? <input aria-hidden="true" tabIndex={-1} required value={value} readOnly className="pointer-events-none absolute inset-0 opacity-0" /> : null}

      <div
        ref={panel}
        popover="manual"
        role="dialog"
        aria-label="Choose a date"
        onKeyDown={onGridKey}
        className="glass fixed inset-auto m-0 rounded-[12px] border border-glass-border p-3 text-sm text-ink shadow-window"
      >
        <div className="mb-2 flex items-center justify-between">
          <p aria-live="polite" className="px-1 text-sm font-semibold">
            {month}
          </p>
          <div className="flex gap-0.5">
            <button type="button" aria-label="Previous month" className={nav} onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}>
              <CaretLeft size={14} weight="bold" aria-hidden="true" />
            </button>
            <button type="button" aria-label="Next month" className={nav} onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}>
              <CaretRight size={14} weight="bold" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-ink-muted" aria-hidden="true">
          {WEEKDAYS.map((day) => (
            <span key={day} className="py-1">
              {day}
            </span>
          ))}
        </div>
        <div role="grid" className="grid grid-cols-7 gap-y-0.5">
          {days.map((d) => {
            const iso = toIso(d);
            const inMonth = d.getMonth() === view.getMonth();
            const isSelected = iso === value;
            return (
              <button
                key={iso}
                type="button"
                data-day={iso}
                tabIndex={iso === stop ? 0 : -1}
                disabled={blocked(iso)}
                aria-pressed={isSelected}
                aria-label={d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                onClick={() => pick(iso)}
                className={clsx(
                  'tabular mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring/40 disabled:cursor-not-allowed disabled:opacity-30',
                  isSelected
                    ? 'bg-green-900 font-semibold text-on-primary'
                    : iso === today
                      ? 'font-semibold text-green-900 ring-1 ring-inset ring-green-900/60 hover:bg-surface-muted'
                      : inMonth
                        ? 'text-ink hover:bg-surface-muted'
                        : 'text-ink-muted/60 hover:bg-surface-muted',
                )}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-border/70 pt-2 text-[13px] font-semibold">
          {required ? (
            <span />
          ) : (
            <button type="button" className="rounded-control px-2 py-1 text-ink-muted hover:bg-surface-muted hover:text-ink" onClick={() => { onChange(''); setOpen(false); }}>
              Clear
            </button>
          )}
          <button type="button" disabled={blocked(today)} className="rounded-control px-2 py-1 text-green-900 hover:bg-surface-muted disabled:opacity-40" onClick={() => pick(today)}>
            Today
          </button>
        </div>
      </div>
    </div>
  );
}
