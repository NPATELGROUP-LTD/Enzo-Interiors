import { CalendarPlus, EnvelopeSimple, MapPin, Phone, Plus } from '@phosphor-icons/react';
import clsx from 'clsx';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

import {
  addDays,
  at,
  dayKey,
  MonthCalendar,
  useNarrow,
  WeekCalendar,
  mondayOf,
  type Appointment,
} from '@/components/booking/Calendars';
import { DayTimePicker, STUDIO_ZONE, clock, studioToday, type StaffAvailability } from '@/components/booking/DayTimePicker';
import { Button, ConfirmDialog, EmptyState, ErrorState, Input, LoadingState, Modal, PageHeader, Tabs, Textarea } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
import type { CmsEntrySummary } from '@/types/cms';

const DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: STUDIO_ZONE });
const STAMP = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: STUDIO_ZONE });

type Mode = 'week' | 'month' | 'list';
type Filter = 'upcoming' | 'past' | 'cancelled';
const MODES: Array<{ id: Mode; label: string }> = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'list', label: 'List' },
];
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Consultations booked on the website or here. Admin only. The week is the default: click a free
 * time to book it, drag a booking to move it. Month and List are the other views. Opening a booking
 * shows everything the customer gave and lets you move or cancel it; the customer is emailed either
 * way. The address carries the state, so the menu bar and the bell can link straight in:
 * `?view=week|month|list` (`past` / `cancelled` are the List's other lists), `?open=<id>` opens one
 * booking, `?new=1` the new-booking form (`&date=&time=` prefilled), `#month` the month.
 */
export function AppointmentsPage() {
  const toast = useToast();
  const appointments = useQuery<Appointment[]>('/appointments');
  const [params, setParams] = useSearchParams();
  const { hash } = useLocation();
  const narrow = useNarrow();
  const view = params.get('view');
  const mode: Mode = view === 'month' ? 'month' : view === 'list' || view === 'past' || view === 'cancelled' ? 'list' : 'week';
  const filter: Filter = view === 'past' || view === 'cancelled' ? view : 'upcoming';
  const creating = params.get('new') === '1';
  const openId = params.get('open');
  const today = useMemo(studioToday, []);
  const [anchor, setAnchor] = useState(() => {
    const asked = params.get('date');
    return asked && ISO_DAY.test(asked) ? asked : today;
  });

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
  const setMode = (next: Mode) => update({ view: next === 'week' ? null : next, open: null });
  const setFilter = (next: Filter) => update({ view: next === 'upcoming' ? 'list' : next, open: null });
  const closeForm = () => update({ new: null, time: null }, true);

  // The old "Month at a glance" link.
  useEffect(() => {
    if (hash === '#month') update({ view: 'month' }, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash]);

  // The week's free times (staff rules; Google Calendar busy time is already left out).
  const monday = mondayOf(anchor);
  const free = useQuery<StaffAvailability>(
    mode === 'week' ? `/appointments/availability?from=${monday}&to=${addDays(monday, 6)}` : null,
  );

  const confirmed = useMemo(() => (appointments.data ?? []).filter((row) => row.status === 'Confirmed'), [appointments.data]);

  const groups = useMemo(() => {
    const now = Date.now();
    const rows = (appointments.data ?? []).filter((row) =>
      filter === 'cancelled'
        ? row.status === 'Cancelled'
        : row.status === 'Confirmed' && (filter === 'upcoming' ? Date.parse(row.ends_at) >= now : Date.parse(row.ends_at) < now),
    );
    if (filter !== 'upcoming') rows.reverse();
    const byDay = new Map<string, Appointment[]>();
    for (const row of rows) byDay.set(dayKey(row.starts_at), [...(byDay.get(dayKey(row.starts_at)) ?? []), row]);
    return [...byDay.entries()];
  }, [appointments.data, filter]);

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
  const replace = (next: Appointment) => {
    appointments.setData((list) => (list ?? []).map((row) => (row.id === next.id ? next : row)));
    void free.refetch();
  };

  // A booking dropped on a free time in the week: ask, then move it (the customer is emailed).
  const [moveTo, setMoveTo] = useState<{ row: Appointment; date: string; time: string } | null>(null);
  const [moving, setMoving] = useState(false);
  const move = async () => {
    if (!moveTo) return;
    setMoving(true);
    try {
      replace(await api.put<Appointment>(`/appointments/${moveTo.row.id}`, { date: moveTo.date, time: moveTo.time }));
      toast.success('Moved. The customer has been emailed.');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'That did not move.');
      void free.refetch();
    } finally {
      setMoving(false);
      setMoveTo(null);
    }
  };

  if (appointments.error) return <ErrorState message={appointments.error} onRetry={appointments.refetch} />;
  if (!appointments.data) return <LoadingState label="Loading bookings…" />;

  const tall = 'pointer-coarse:min-h-12';
  const askedDate = params.get('date') ?? '';
  const askedTime = params.get('time') ?? '';

  return (
    <div className="flex h-full flex-col px-5 pb-5 pt-3 sm:px-8">
      {/* The shell's section name is not needed here; an empty heading keeps it from showing. */}
      <PageHeader title="" />

      <div className="mb-4 flex shrink-0 flex-wrap items-center gap-3">
        <div className="[&>div]:mb-0">
          <Tabs tabs={MODES} active={mode} onChange={(id) => setMode(id as Mode)} />
        </div>
        {mode === 'list' ? (
          <div className="[&>div]:mb-0">
            <Tabs
              tabs={[
                { id: 'upcoming', label: 'Upcoming', count: counts.upcoming },
                { id: 'past', label: 'Past', count: counts.past },
                { id: 'cancelled', label: 'Cancelled', count: counts.cancelled },
              ]}
              active={filter}
              onChange={(id) => setFilter(id as Filter)}
            />
          </div>
        ) : null}
        <div className="ml-auto">
          <Button
            variant="primary"
            className={tall}
            icon={<Plus size={16} aria-hidden="true" />}
            onClick={() => update({ new: '1' })}
          >
            New booking
          </Button>
        </div>
      </div>

      {mode === 'week' ? (
        <WeekCalendar
          bookings={confirmed}
          free={free.data}
          loading={free.loading}
          error={free.error}
          onRetry={free.refetch}
          anchor={anchor}
          onAnchor={setAnchor}
          today={today}
          narrow={narrow}
          onOpen={setOpen}
          onBook={(date, time) => {
            setAnchor(date);
            update({ new: '1', date, time });
          }}
          onMove={(row, date, time) => setMoveTo({ row, date, time })}
        />
      ) : mode === 'month' ? (
        <MonthCalendar
          bookings={confirmed}
          anchor={anchor}
          onAnchor={setAnchor}
          today={today}
          onOpen={setOpen}
          onPickDay={(key) => {
            setAnchor(key);
            setMode('week');
          }}
        />
      ) : groups.length === 0 ? (
        <EmptyState
          title={filter === 'upcoming' ? 'Nothing booked yet' : filter === 'past' ? 'No past bookings' : 'Nothing cancelled'}
          message={
            filter === 'upcoming'
              ? 'Bookings made on the website appear here straight away.'
              : filter === 'past'
                ? 'Consultations move here once they have happened.'
                : 'Cancelled bookings are kept here for the record.'
          }
          action={
            filter === 'upcoming' ? (
              <Button variant="primary" icon={<CalendarPlus size={16} />} onClick={() => update({ new: '1' })}>
                New booking
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto">
          {groups.map(([key, rows]) => (
            <section key={key} aria-label={DAY.format(new Date(rows[0]!.starts_at))}>
              <h2 className="mb-2 flex items-baseline gap-2 text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
                {DAY.format(new Date(rows[0]!.starts_at))}
                {key === today ? <span className="normal-case tracking-normal text-green-900 dark:text-ink">Today</span> : null}
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
                          {[row.service_label, row.postcode].filter(Boolean).join(' · ')}
                        </span>
                        {row.phone ? <span className="tabular block text-[13px] text-ink-muted">{row.phone}</span> : null}
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

      {open ? (
        <AppointmentDialog
          appointment={open}
          onClose={() => setOpen(null)}
          onChanged={replace}
          onDeleted={(id) => {
            setOpen(null);
            appointments.setData((list) => (list ?? []).filter((row) => row.id !== id));
            void free.refetch();
          }}
        />
      ) : null}
      {creating ? (
        <NewBookingDialog
          initial={ISO_DAY.test(askedDate) && /^\d{1,2}:\d{2}$/.test(askedTime) ? { date: askedDate, time: askedTime } : null}
          onClose={closeForm}
          onCreated={(row) => {
            appointments.setData((list) => [...(list ?? []), row].sort((a, b) => a.starts_at.localeCompare(b.starts_at)));
            setAnchor(dayKey(row.starts_at));
            void free.refetch();
          }}
        />
      ) : null}
      <ConfirmDialog
        open={!!moveTo}
        title={`Move ${moveTo?.row.name ?? ''}'s consultation?`}
        message={
          moveTo
            ? `From ${DAY.format(new Date(moveTo.row.starts_at))} at ${at(moveTo.row.starts_at)} to ${DAY.format(new Date(`${moveTo.date}T12:00:00Z`))} at ${clock(moveTo.time)}. They are emailed the change.`
            : ''
        }
        confirmLabel="Move and email"
        tone="primary"
        pending={moving}
        onConfirm={() => void move()}
        onCancel={() => setMoveTo(null)}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

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
  onDeleted,
}: {
  appointment: Appointment;
  onClose: () => void;
  onChanged: (row: Appointment) => void;
  onDeleted: (id: string) => void;
}) {
  const toast = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const remove = async (password: string) => {
    setPending(true);
    try {
      await api.delete(`/appointments/${row.id}`, { password });
      toast.success(`${row.name}'s booking deleted.`);
      onDeleted(row.id);
    } catch (caught) {
      // Stays open: a mistyped password is retyped, not re-clicked from the start.
      toast.error(caught instanceof ApiError ? caught.message : 'Could not delete this booking.');
    } finally {
      setPending(false);
    }
  };
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
            <div className="flex gap-2">
              {cancelled ? null : (
                <Button variant="destructive" onClick={() => setConfirmCancel(true)}>
                  Cancel booking
                </Button>
              )}
              <Button variant="secondary" onClick={() => setConfirmDelete(true)}>
                Delete…
              </Button>
            </div>
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
      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${row.name}'s booking?`}
        message={
          <>
            <p>
              This permanently removes the booking ({row.reference}) and frees its time. The customer is not emailed and
              nothing is kept.
            </p>
            <p className="mt-2 text-ink-muted">It cannot be undone. To keep a record, cancel it instead.</p>
          </>
        }
        confirmLabel="Delete booking"
        password
        pending={pending}
        onConfirm={(password) => void remove(password)}
        onCancel={() => setConfirmDelete(false)}
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
  initial,
  onClose,
  onCreated,
}: {
  /** A free time clicked in the week. */
  initial: { date: string; time: string } | null;
  onClose: () => void;
  onCreated: (row: Appointment) => void;
}) {
  const toast = useToast();
  const services = useQuery<CmsEntrySummary[]>('/cms/collections/services');
  const [rules, setRules] = useState<StaffAvailability | null>(null);
  const [service, setService] = useState('');
  const [date, setDate] = useState<string | null>(initial?.date ?? null);
  const [time, setTime] = useState<string | null>(initial?.time ?? null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', postcode: '', notes: '' });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const bookable = (services.data ?? []).filter(
    (row) => !row.isNew && (!rules?.services.length || rules.services.includes(row.slug)),
  );
  const fields = rules?.fields ?? { phone: 'required', address: 'optional', postcode: 'required', notes: 'optional' };
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
    <Modal open onClose={close} title="New booking" description="Book a consultation for a customer." width="lg">
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
