import { CalendarPlus, CaretLeft, CaretRight, EnvelopeSimple, MapPin, Phone } from '@phosphor-icons/react';
import clsx from 'clsx';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';

import { DayTimePicker, STUDIO_ZONE, clock, type StaffAvailability } from '@/components/booking/DayTimePicker';
import { Button, ConfirmDialog, EmptyState, ErrorState, Input, LoadingState, Modal, Tabs, Textarea } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
import type { CmsEntrySummary } from '@/types/cms';

interface Appointment {
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

const DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: STUDIO_ZONE });
const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: STUDIO_ZONE });
const STAMP = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: STUDIO_ZONE });
const dayKey = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: STUDIO_ZONE }).format(new Date(iso));
const at = (iso: string) => clock(TIME.format(new Date(iso)));

type Tab = 'upcoming' | 'past' | 'cancelled';

/**
 * Consultations booked on the website or here. Admin only. Opening one shows
 * everything the customer gave and lets you move or cancel it; the customer
 * is emailed either way. The address carries the state, so the menu bar and
 * the bell can link straight in: `?view=past|cancelled` picks the list,
 * `?open=<id>` opens one booking, `?new=1` the new-booking form, `#month` the
 * month at a glance.
 */
export function AppointmentsPage() {
  const appointments = useQuery<Appointment[]>('/appointments');
  const [params, setParams] = useSearchParams();
  const { hash } = useLocation();
  const view = params.get('view');
  const tab: Tab = view === 'past' || view === 'cancelled' ? view : 'upcoming';
  const creating = params.get('new') === '1';
  const openId = params.get('open');

  /**
   * Changes some of the address's parameters and keeps the rest. Read from
   * the live address rather than this render's, so two changes in a row (book,
   * then close the form) both land.
   */
  const update = (changes: Record<string, string | null>, replace = false) =>
    setParams(
      () => {
        const next = new URLSearchParams(window.location.search);
        for (const [key, value] of Object.entries(changes)) {
          if (value === null) next.delete(key);
          else next.set(key, value);
        }
        return next;
      },
      { replace },
    );
  const setTab = (next: Tab) => update({ view: next === 'upcoming' ? null : next, open: null });
  const setCreating = (on: boolean) => update({ new: on ? '1' : null }, !on);

  // The menu bar's "Month at a glance" link, once there is a month to show.
  const loaded = !!appointments.data;
  useEffect(() => {
    if (hash === '#month' && loaded) {
      document.getElementById('month')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [hash, loaded]);

  const groups = useMemo(() => {
    const now = Date.now();
    const rows = (appointments.data ?? []).filter((row) =>
      tab === 'cancelled'
        ? row.status === 'Cancelled'
        : row.status === 'Confirmed' && (tab === 'upcoming' ? Date.parse(row.ends_at) >= now : Date.parse(row.ends_at) < now),
    );
    if (tab !== 'upcoming') rows.reverse();
    const byDay = new Map<string, Appointment[]>();
    for (const row of rows) byDay.set(dayKey(row.starts_at), [...(byDay.get(dayKey(row.starts_at)) ?? []), row]);
    return [...byDay.entries()];
  }, [appointments.data, tab]);

  const counts = useMemo(() => {
    const now = Date.now();
    const rows = appointments.data ?? [];
    return {
      upcoming: rows.filter((r) => r.status === 'Confirmed' && Date.parse(r.ends_at) >= now).length,
      past: rows.filter((r) => r.status === 'Confirmed' && Date.parse(r.ends_at) < now).length,
      cancelled: rows.filter((r) => r.status === 'Cancelled').length,
    };
  }, [appointments.data]);

  const open = appointments.data?.find((row) => row.id === openId) ?? null;
  const setOpen = (id: string | null) => update({ open: id }, !id);
  const replace = (next: Appointment) =>
    appointments.setData((list) => (list ?? []).map((row) => (row.id === next.id ? next : row)));

  if (appointments.error) return <ErrorState message={appointments.error} onRetry={appointments.refetch} />;
  if (!appointments.data) return <LoadingState label="Loading bookings…" />;

  const todayKey = dayKey(new Date().toISOString());

  // A day picked in the calendar: show its list, then scroll to it.
  const jump = (key: string) => {
    const row = appointments.data?.find((item) => item.status === 'Confirmed' && dayKey(item.starts_at) === key);
    if (!row) return;
    setTab(Date.parse(row.ends_at) >= Date.now() ? 'upcoming' : 'past');
    requestAnimationFrame(() =>
      document.getElementById(`day-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  };

  return (
    <div className="grid items-start gap-x-10 gap-y-8 px-5 pb-16 pt-6 sm:px-8 lg:pt-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          tabs={[
            { id: 'upcoming', label: 'Upcoming', count: counts.upcoming },
            { id: 'past', label: 'Past', count: counts.past },
            { id: 'cancelled', label: 'Cancelled', count: counts.cancelled },
          ]}
          active={tab}
          onChange={(id) => setTab(id as Tab)}
        />
        <span className="mb-4">
          <Button variant="primary" icon={<CalendarPlus size={16} />} onClick={() => setCreating(true)}>
            New booking
          </Button>
        </span>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          title={tab === 'upcoming' ? 'Nothing booked yet' : tab === 'past' ? 'No past bookings' : 'Nothing cancelled'}
          message={
            tab === 'upcoming'
              ? 'Bookings made on the website appear here straight away.'
              : tab === 'past'
                ? 'Consultations move here once they have happened.'
                : 'Cancelled bookings are kept here for the record.'
          }
          action={
            tab === 'upcoming' ? (
              <Button variant="primary" icon={<CalendarPlus size={16} />} onClick={() => setCreating(true)}>
                New booking
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="mt-2 flex flex-col gap-8">
          {groups.map(([key, rows]) => (
            <section key={key} id={`day-${key}`} className="scroll-mt-4" aria-label={DAY.format(new Date(rows[0]!.starts_at))}>
              <h2 className="mb-2 flex items-baseline gap-2 text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
                {DAY.format(new Date(rows[0]!.starts_at))}
                {key === todayKey ? <span className="normal-case tracking-normal text-green-900 dark:text-ink">Today</span> : null}
              </h2>
              <ul className="rounded-card bg-surface p-1.5 shadow-soft">
                {rows.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => setOpen(row.id)}
                      className="grid w-full grid-cols-[4.5rem_minmax(0,1fr)] items-baseline gap-x-4 gap-y-0.5 rounded-[10px] px-3 py-3 text-left transition-colors hover:bg-ink/[0.03] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring/40 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto]"
                    >
                      <span className={clsx('tabular text-[15px] font-semibold', row.status === 'Cancelled' ? 'text-ink-muted line-through' : 'text-ink')}>
                        {at(row.starts_at)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-ink">{row.name}</span>
                        <span className="block truncate text-[13px] text-ink-muted">
                          {[row.service_label, row.postcode, row.phone].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <span className="col-start-2 text-[12px] text-ink-muted sm:col-start-3">
                        {row.source === 'admin' ? `Booked by ${row.created_by ?? 'staff'}` : 'Website'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      </div>

      <MonthGlance appointments={appointments.data} today={todayKey} onPick={jump} />

      {open ? (
        <AppointmentDialog appointment={open} onClose={() => setOpen(null)} onChanged={replace} />
      ) : null}
      <NewBookingDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(row) => {
          appointments.setData((list) => [...(list ?? []), row].sort((a, b) => a.starts_at.localeCompare(b.starts_at)));
          setTab('upcoming');
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

const MONTH_NAME = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const pad = (n: number) => String(n).padStart(2, '0');

/** The month at a glance: how many consultations each day holds. A day with any jumps to it. */
function MonthGlance({
  appointments,
  today,
  onPick,
}: {
  appointments: Appointment[];
  today: string;
  onPick: (key: string) => void;
}) {
  const [view, setView] = useState(today.slice(0, 7));
  const [year, month] = view.split('-').map(Number) as [number, number];
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const offset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const perDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of appointments) {
      if (row.status !== 'Confirmed') continue;
      const key = dayKey(row.starts_at);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [appointments]);
  const inMonth = [...perDay.entries()].filter(([key]) => key.startsWith(view)).reduce((sum, [, n]) => sum + n, 0);
  const move = (delta: number) => {
    const next = new Date(Date.UTC(year, month - 1 + delta, 1));
    setView(`${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}`);
  };

  return (
    <aside id="month" aria-label="Month at a glance" className="scroll-mt-6 xl:sticky xl:top-6">
      <div className="rounded-card bg-surface p-4 shadow-soft">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => move(-1)}
            aria-label="Previous month"
            className="flex h-8 w-8 items-center justify-center rounded-control text-ink-muted hover:bg-ink/[0.06] hover:text-ink"
          >
            <CaretLeft size={16} aria-hidden="true" />
          </button>
          <span className="text-sm font-semibold text-ink" aria-live="polite">
            {MONTH_NAME.format(new Date(Date.UTC(year, month - 1, 1)))}
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
        <div className="grid grid-cols-7 gap-0.5 text-center">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
            <span key={i} className="py-1 text-[11px] font-semibold text-ink-muted">
              {day}
            </span>
          ))}
          {Array.from({ length: offset }, (_, i) => (
            <span key={`blank-${i}`} />
          ))}
          {Array.from({ length: days }, (_, i) => {
            const key = `${view}-${pad(i + 1)}`;
            const count = perDay.get(key) ?? 0;
            return (
              <button
                key={key}
                type="button"
                disabled={!count}
                onClick={() => onPick(key)}
                aria-label={`${i + 1}: ${count ? `${count} booked` : 'nothing booked'}`}
                className={clsx(
                  'tabular relative mx-auto flex h-9 w-9 flex-col items-center justify-center rounded-full text-[13px] transition-colors',
                  count ? 'bg-green-100 font-semibold text-green-900 hover:bg-green-900 hover:text-on-primary' : 'text-ink-muted',
                  key === today && 'ring-1 ring-inset ring-green-900/50',
                )}
              >
                {i + 1}
                {count > 1 ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-green-900 px-1 text-[10px] text-on-primary">
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[13px] text-ink-muted">
          {inMonth ? `${inMonth} consultation${inMonth === 1 ? '' : 's'} this month.` : 'Nothing booked this month.'}
        </p>
      </div>
      <p className="mt-3 px-1 text-[13px] leading-relaxed text-ink-muted">
        Opening hours, breaks and the booking form&apos;s questions are in{' '}
        <Link to="/settings/booking" className="text-link">
          Settings › Booking
        </Link>
        .
      </p>
    </aside>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 py-1.5 text-sm">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{children}</dd>
    </div>
  );
}

function AppointmentDialog({
  appointment: row,
  onClose,
  onChanged,
}: {
  appointment: Appointment;
  onClose: () => void;
  onChanged: (row: Appointment) => void;
}) {
  const toast = useToast();
  const [moving, setMoving] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [pending, setPending] = useState(false);
  const cancelled = row.status === 'Cancelled';

  const update = async (body: Record<string, unknown>, done: string) => {
    setPending(true);
    try {
      onChanged(await api.put<Appointment>(`/appointments/${row.id}`, body));
      toast.success(done);
      setMoving(false);
      setDate(null);
      setTime(null);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'That did not save.');
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={row.name}
      description={`${row.service_label} · ${DAY.format(new Date(row.starts_at))} at ${at(row.starts_at)}`}
      width={moving ? 'lg' : 'md'}
    >
      {moving ? (
        <div>
          <p className="mb-4 text-sm text-ink-muted">Pick the new day and time. {row.name} is emailed the change.</p>
          <DayTimePicker
            date={date}
            time={time}
            except={row.id}
            onChange={(d, t) => {
              setDate(d);
              setTime(t);
            }}
          />
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setMoving(false)}>
              Back
            </Button>
            <Button
              variant="primary"
              loading={pending}
              disabled={!date || !time}
              onClick={() =>
                void update(
                  { date, time, ...(cancelled ? { status: 'Confirmed' } : {}) },
                  cancelled ? 'Booked again. The customer has been emailed.' : 'Moved. The customer has been emailed.',
                )
              }
            >
              {cancelled ? 'Book this time' : 'Move booking'}
            </Button>
          </div>
        </div>
      ) : (
        <>
          {cancelled ? (
            <p className="mb-4 rounded-control bg-warning-bg px-3 py-2 text-sm text-warning">
              Cancelled{row.cancelled_at ? ` ${STAMP.format(new Date(row.cancelled_at))}` : ''}. The time is free again.
            </p>
          ) : null}
          <dl>
            <Detail label="Reference">
              <span className="tabular font-semibold tracking-wide">{row.reference}</span>
            </Detail>
            <Detail label="Email">
              <a href={`mailto:${row.email}`} className="text-link inline-flex items-center gap-1.5">
                <EnvelopeSimple size={14} aria-hidden="true" />
                {row.email}
              </a>
            </Detail>
            {row.phone ? (
              <Detail label="Phone">
                <a href={`tel:${row.phone.replace(/\s+/g, '')}`} className="text-link inline-flex items-center gap-1.5">
                  <Phone size={14} aria-hidden="true" />
                  {row.phone}
                </a>
              </Detail>
            ) : null}
            {row.address || row.postcode ? (
              <Detail label="Address">
                <span className="inline-flex items-start gap-1.5">
                  <MapPin size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-muted" />
                  {[row.address, row.postcode].filter(Boolean).join(', ')}
                </span>
              </Detail>
            ) : null}
            {Object.entries(row.details ?? {}).map(([key, value]) => (
              <Detail key={key} label={key}>
                {value}
              </Detail>
            ))}
            {row.notes ? (
              <Detail label="Notes">
                <span className="whitespace-pre-wrap">{row.notes}</span>
              </Detail>
            ) : null}
            <Detail label="Booked">
              {STAMP.format(new Date(row.created_at))} · {row.source === 'admin' ? `by ${row.created_by ?? 'staff'}` : 'on the website'}
            </Detail>
          </dl>
          <div className="mt-6 flex flex-wrap justify-between gap-2">
            {cancelled ? (
              <span />
            ) : (
              <Button variant="destructive" onClick={() => setConfirmCancel(true)}>
                Cancel booking
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose}>
                Close
              </Button>
              <Button variant="primary" onClick={() => setMoving(true)}>
                {cancelled ? 'Book again…' : 'Move…'}
              </Button>
            </div>
          </div>
        </>
      )}
      <ConfirmDialog
        open={confirmCancel}
        title={`Cancel ${row.name}'s consultation?`}
        message="They are emailed that it is cancelled, and the time becomes free on the website again."
        confirmLabel="Cancel booking"
        pending={pending}
        onConfirm={() => {
          setConfirmCancel(false);
          void update({ status: 'Cancelled' }, 'Cancelled. The customer has been emailed.');
        }}
        onCancel={() => setConfirmCancel(false)}
      />
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */

const FIELD_LABELS = { phone: 'Phone', address: 'Address', postcode: 'Postcode', notes: 'Notes' } as const;

/**
 * The website's booking steps on one sheet: what, when, who. The customer
 * gets the same confirmation email as a website booking.
 */
function NewBookingDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (row: Appointment) => void;
}) {
  const toast = useToast();
  const services = useQuery<CmsEntrySummary[]>(open ? '/cms/collections/services' : null);
  const [rules, setRules] = useState<StaffAvailability | null>(null);
  const [service, setService] = useState('');
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', postcode: '', notes: '' });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const bookable = (services.data ?? []).filter(
    (row) => !row.isNew && (!rules?.services.length || rules.services.includes(row.slug)),
  );
  const fields = rules?.fields ?? { phone: 'required', address: 'off', postcode: 'optional', notes: 'optional' };
  const keys = (Object.keys(FIELD_LABELS) as Array<keyof typeof FIELD_LABELS>).filter((key) => fields[key] !== 'off');
  const ready =
    !!service &&
    !!date &&
    !!time &&
    form.name.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) &&
    keys.every((key) => fields[key] !== 'required' || form[key].trim());

  const close = () => {
    setService('');
    setDate(null);
    setTime(null);
    setForm({ name: '', email: '', phone: '', address: '', postcode: '', notes: '' });
    setError(null);
    onClose();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const body = Object.fromEntries(
        Object.entries({ service, date, time, ...form }).filter(([, value]) => typeof value === 'string' && value.trim()),
      );
      const row = await api.post<Appointment>('/appointments', body);
      onCreated(row);
      toast.success(`Booked. ${row.name} has been emailed the confirmation.`);
      close();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That did not book. Try again.');
      if (caught instanceof ApiError && caught.status === 409) setTime(null);
    } finally {
      setPending(false);
    }
  };

  const heading = 'mb-3 text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-muted';

  return (
    <Modal open={open} onClose={close} title="New booking" description="Book a consultation for a customer." width="lg">
      <form onSubmit={submit} className="flex flex-col gap-8" noValidate>
        <section aria-labelledby="new-service">
          <h3 id="new-service" className={heading}>
            1. What
          </h3>
          {services.error ? <ErrorState message={services.error} onRetry={services.refetch} /> : null}
          <div role="radiogroup" aria-label="Service" className="flex flex-wrap gap-2">
            {bookable.map((row) => (
              <button
                key={row.slug}
                type="button"
                role="radio"
                aria-checked={service === row.slug}
                onClick={() => setService(row.slug)}
                className={clsx(
                  'min-h-9 rounded-control px-3.5 text-sm font-medium transition-colors',
                  service === row.slug ? 'bg-green-900 text-on-primary' : 'bg-ink/[0.05] text-ink hover:bg-green-100 hover:text-green-900',
                )}
              >
                {row.title}
              </button>
            ))}
          </div>
        </section>

        {open ? (
          <section aria-labelledby="new-when">
            <h3 id="new-when" className={heading}>
              2. When
            </h3>
            <DayTimePicker
              date={date}
              time={time}
              onRules={setRules}
              onChange={(d, t) => {
                setDate(d);
                setTime(t);
              }}
            />
          </section>
        ) : null}

        <section aria-labelledby="new-who">
          <h3 id="new-who" className={heading}>
            3. Who
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Name" required autoComplete="off" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Email" type="email" required autoComplete="off" hint="The confirmation goes here." value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            {keys
              .filter((key) => key !== 'notes')
              .map((key) => (
                <Input
                  key={key}
                  label={FIELD_LABELS[key]}
                  required={fields[key] === 'required'}
                  autoComplete="off"
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              ))}
            {keys.includes('notes') ? (
              <div className="sm:col-span-2">
                <Textarea label="Notes" required={fields.notes === 'required'} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            ) : null}
          </div>
        </section>

        {error ? (
          <p role="alert" className="rounded-control bg-danger-bg px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-end gap-3">
          {date && time ? (
            <span className="mr-auto text-sm text-ink">
              {new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })} at {clock(time)}
            </span>
          ) : null}
          <Button type="button" variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={pending} disabled={!ready}>
            Book and email the customer
          </Button>
        </div>
      </form>
    </Modal>
  );
}
