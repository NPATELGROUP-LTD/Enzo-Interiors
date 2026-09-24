import clsx from 'clsx';
import {
  CaretLeft,
  CaretRight,
  Plus,
} from '@phosphor-icons/react';
import { useMemo, useState, type FormEvent } from 'react';

import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  Select,
  StatusTag,
  TableSkeleton,
  Tabs,
  Toggle,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { dateTime, relative, time } from '@/lib/format';
import { bookingTone } from '@/lib/status';
import type { AvailabilitySetting, Booking, Client, ServiceType } from '@/types/api';
import { SERVICE_LABELS, SERVICE_TYPES } from '@/types/api';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Monday-first grid for a month, padded to whole weeks. */
function monthGrid(year: number, month: number): Array<Date | null> {
  const first = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  // getUTCDay is Sunday-first; shift so Monday is column 0.
  const leading = (first.getUTCDay() + 6) % 7;

  const cells: Array<Date | null> = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(Date.UTC(year, month, day)));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function BookingsPage() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const bookings = useQuery<Booking[]>('/bookings');
  const clients = useQuery<Client[]>('/clients');
  const availability = useQuery<AvailabilitySetting[]>('/availability');

  const [tab, setTab] = useState('calendar');
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    client_id: '',
    service_type: 'Kitchen' as ServiceType,
    date: '',
    time: '10:00',
    status: 'Pending' as Booking['status'],
  });
  const [cancelling, setCancelling] = useState<Booking | null>(null);

  /** date (YYYY-MM-DD) -> bookings, for the calendar density indicator. */
  const byDay = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const booking of bookings.data ?? []) {
      const key = booking.date_time.slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), booking]);
    }
    return map;
  }, [bookings.data]);

  const upcoming = useMemo(() => {
    const now = new Date().toISOString();
    return (bookings.data ?? [])
      .filter((booking) => booking.date_time >= now && booking.status !== 'Cancelled')
      .sort((a, b) => a.date_time.localeCompare(b.date_time));
  }, [bookings.data]);

  const cells = monthGrid(cursor.year, cursor.month);
  const monthLabel = new Date(Date.UTC(cursor.year, cursor.month, 1)).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const shiftMonth = (delta: number) => {
    const next = new Date(Date.UTC(cursor.year, cursor.month + delta, 1));
    setCursor({ year: next.getUTCFullYear(), month: next.getUTCMonth() });
    setSelectedDay(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!form.client_id) return setFormError('Choose a client.');
    if (!form.date) return setFormError('Choose a date.');

    setSaving(true);
    try {
      await api.post<Booking>('/bookings', {
        client_id: form.client_id,
        service_type: form.service_type,
        date_time: new Date(`${form.date}T${form.time}:00`).toISOString(),
        status: form.status,
      });
      toast.success('Booking created.');
      setCreating(false);
      setForm({ client_id: '', service_type: 'Kitchen', date: '', time: '10:00', status: 'Pending' });
      await bookings.refetch();
    } catch (caught) {
      // The API refuses a closed day and names it.
      setFormError(caught instanceof ApiError ? caught.message : 'Could not create this booking.');
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (booking: Booking, status: Booking['status']) => {
    try {
      await api.put(`/bookings/${booking.id}`, { status });
      toast.success(`Booking ${status.toLowerCase()}.`);
      await bookings.refetch();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not update this booking.');
    }
  };

  const saveAvailability = async (day: AvailabilitySetting, patch: Partial<AvailabilitySetting>) => {
    try {
      await api.put('/availability', {
        day_of_week: day.day_of_week,
        start_time: patch.start_time ?? day.start_time,
        end_time: patch.end_time ?? day.end_time,
        slot_duration_mins: patch.slot_duration_mins ?? day.slot_duration_mins,
        is_closed: patch.is_closed ?? day.is_closed,
      });
      toast.success(`${DAY_NAMES[day.day_of_week]} hours updated.`);
      await availability.refetch();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not update working hours.');
    }
  };

  const selectedBookings = selectedDay ? (byDay.get(selectedDay) ?? []) : upcoming.slice(0, 6);

  return (
    <>
      <PageHeader
        title="Bookings & Availability"
        description="Consultations, site visits and the working hours behind the booking wizard."
        actions={
          <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setCreating(true)}>
            New booking
          </Button>
        }
      />

      <Tabs
        tabs={[
          { id: 'calendar', label: 'Calendar' },
          { id: 'upcoming', label: 'Upcoming', count: upcoming.length },
          { id: 'availability', label: 'Working hours' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {bookings.error ? (
        <ErrorState message={bookings.error} onRetry={bookings.refetch} />
      ) : null}

      {tab === 'calendar' && !bookings.error ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink">{monthLabel}</h2>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  aria-label="Previous month"
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-control bg-ink/[0.05] text-ink-muted hover:bg-ink/[0.09] hover:text-ink"
                >
                  <CaretLeft size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  aria-label="Next month"
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-control bg-ink/[0.05] text-ink-muted hover:bg-ink/[0.09] hover:text-ink"
                >
                  <CaretRight size={16} aria-hidden="true" />
                </button>
              </div>
            </div>

            {bookings.loading ? (
              <TableSkeleton rows={5} columns={7} />
            ) : (
              <>
                <div className="grid grid-cols-7 gap-1">
                  {DAY_SHORT.map((day) => (
                    <div key={day} className="label-eyebrow py-1 text-center">
                      {day}
                    </div>
                  ))}
                  {cells.map((cell, index) => {
                    if (!cell) return <div key={`pad-${index}`} />;
                    const key = cell.toISOString().slice(0, 10);
                    const dayBookings = (byDay.get(key) ?? []).filter(
                      (booking) => booking.status !== 'Cancelled',
                    );
                    const isToday = key === new Date().toISOString().slice(0, 10);
                    const isSelected = key === selectedDay;

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedDay(isSelected ? null : key)}
                        aria-label={`${cell.getUTCDate()} ${monthLabel}, ${dayBookings.length} booking${dayBookings.length === 1 ? '' : 's'}`}
                        aria-pressed={isSelected}
                        className={clsx(
                          'flex min-h-16 flex-col items-start gap-1 rounded-[10px] p-2 text-left transition-colors lg:min-h-[5.5rem]',
                          isSelected
                            ? 'bg-green-900 text-on-primary'
                            : isToday
                              ? 'bg-green-100 ring-2 ring-inset ring-green-900'
                              : 'bg-ink/[0.035] hover:bg-green-100',
                        )}
                      >
                        <span
                          className={clsx(
                            'tabular text-xs font-semibold',
                            isSelected ? 'text-on-primary' : isToday ? 'text-green-900' : 'text-ink',
                          )}
                        >
                          {cell.getUTCDate()}
                        </span>
                        {/*
                          Density indicator. Bars carry the count visually, but
                          the count is also in the aria-label above, so this is
                          never the only signal.
                        */}
                        {dayBookings.length > 0 ? (
                          <span className="flex w-full flex-col gap-0.5">
                            {dayBookings.slice(0, 3).map((booking) => (
                              <span
                                key={booking.id}
                                className={clsx('h-1 w-full rounded-full', isSelected ? 'bg-on-primary' : 'bg-green-900')}
                              />
                            ))}
                            {dayBookings.length > 3 ? (
                              <span className="tabular text-[10px] text-ink-muted">
                                +{dayBookings.length - 3}
                              </span>
                            ) : null}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </Card>

          <Card>
            <p className="label-eyebrow">
              {selectedDay
                ? new Date(`${selectedDay}T00:00:00Z`).toLocaleDateString('en-GB', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    timeZone: 'UTC',
                  })
                : 'Coming up'}
            </p>
            {selectedBookings.length === 0 ? (
              <p className="py-8 text-center text-ink-muted">
                {selectedDay ? 'Nothing booked on this day.' : 'No upcoming appointments.'}
              </p>
            ) : (
              <ul className="mt-3 rows">
                {selectedBookings
                  .sort((a, b) => a.date_time.localeCompare(b.date_time))
                  .map((booking) => (
                    <li key={booking.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="tabular font-semibold text-ink">
                            {selectedDay ? time(booking.date_time) : dateTime(booking.date_time)}
                          </p>
                          <p className="truncate text-ink">{booking.client_name}</p>
                          <p className="text-xs text-ink-muted">
                            {SERVICE_LABELS[booking.service_type]}
                          </p>
                        </div>
                        <StatusTag tone={bookingTone(booking.status)}>{booking.status}</StatusTag>
                      </div>
                      {booking.status === 'Pending' ? (
                        <div className="mt-2 flex gap-2">
                          <Button
                            variant="secondary"
                            className="min-h-9 px-2 text-xs"
                            onClick={() => void setStatus(booking, 'Confirmed')}
                          >
                            Confirm
                          </Button>
                          <Button
                            variant="destructive"
                            className="min-h-9 px-2 text-xs"
                            onClick={() => setCancelling(booking)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  ))}
              </ul>
            )}
          </Card>
        </div>
      ) : null}

      {tab === 'upcoming' && !bookings.error ? (
        bookings.loading ? (
          <Card className="p-0">
            <TableSkeleton rows={5} columns={4} />
          </Card>
        ) : upcoming.length === 0 ? (
          <Card className="p-0">
            <EmptyState
              title="Nothing coming up"
              message="No confirmed or pending appointments are scheduled."
              action={
                <Button variant="primary" onClick={() => setCreating(true)}>
                  New booking
                </Button>
              }
            />
          </Card>
        ) : (
          <Card>
            <ul className="rows">
              {upcoming.map((booking) => (
                <li
                  key={booking.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{booking.client_name}</p>
                    <p className="text-xs text-ink-muted">
                      {SERVICE_LABELS[booking.service_type]} · {dateTime(booking.date_time)} (
                      {relative(booking.date_time)})
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusTag tone={bookingTone(booking.status)}>{booking.status}</StatusTag>
                    {booking.status === 'Pending' ? (
                      <Button
                        variant="secondary"
                        className="min-h-9 px-2 text-xs"
                        onClick={() => void setStatus(booking, 'Confirmed')}
                      >
                        Confirm
                      </Button>
                    ) : null}
                    {booking.status !== 'Cancelled' ? (
                      <Button
                        variant="destructive"
                        className="min-h-9 px-2 text-xs"
                        onClick={() => setCancelling(booking)}
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )
      ) : null}

      {tab === 'availability' ? (
        availability.loading ? (
          <Card className="p-0">
            <TableSkeleton rows={7} columns={4} />
          </Card>
        ) : (
          <Card>
            <p className="label-eyebrow">Working hours</p>
            <p className="mt-1 text-ink-muted">
              These drive the slots offered by the public booking wizard.
              {isAdmin ? '' : ' Only an Admin can change them.'}
            </p>
            <ul className="mt-4 rows">
              {(availability.data ?? []).map((day) => (
                <li key={day.id} className="flex flex-wrap items-end gap-3 py-3 first:pt-0">
                  <p className="w-24 shrink-0 font-semibold text-ink">
                    {DAY_NAMES[day.day_of_week]}
                  </p>

                  <div className="flex-1">
                    <Toggle
                      label={day.is_closed ? 'Closed' : 'Open'}
                      checked={!day.is_closed}
                      disabled={!isAdmin}
                      onChange={(next) => void saveAvailability(day, { is_closed: !next })}
                    />
                  </div>

                  {!day.is_closed ? (
                    <>
                      <label className="flex flex-col gap-1">
                        <span className="label-eyebrow">Opens</span>
                        <input
                          type="time"
                          defaultValue={day.start_time}
                          disabled={!isAdmin}
                          onBlur={(event) =>
                            event.target.value !== day.start_time &&
                            void saveAvailability(day, { start_time: event.target.value })
                          }
                          className="min-h-11 rounded-control border border-border bg-surface px-2 text-ink focus:border-green-900 disabled:opacity-60"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="label-eyebrow">Closes</span>
                        <input
                          type="time"
                          defaultValue={day.end_time}
                          disabled={!isAdmin}
                          onBlur={(event) =>
                            event.target.value !== day.end_time &&
                            void saveAvailability(day, { end_time: event.target.value })
                          }
                          className="min-h-11 rounded-control border border-border bg-surface px-2 text-ink focus:border-green-900 disabled:opacity-60"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="label-eyebrow">Slot (mins)</span>
                        <input
                          type="number"
                          min={15}
                          max={480}
                          step={15}
                          defaultValue={day.slot_duration_mins}
                          disabled={!isAdmin}
                          onBlur={(event) =>
                            Number(event.target.value) !== day.slot_duration_mins &&
                            void saveAvailability(day, {
                              slot_duration_mins: Number(event.target.value),
                            })
                          }
                          className="tabular min-h-11 w-24 rounded-control border border-border bg-surface px-2 text-ink focus:border-green-900 disabled:opacity-60"
                        />
                      </label>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        )
      ) : null}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New booking"
        description="Create a consultation or site visit directly."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreating(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="booking-form" variant="primary" loading={saving}>
              Create booking
            </Button>
          </>
        }
      >
        <form id="booking-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Select
            label="Client"
            value={form.client_id}
            onChange={(event) => setForm({ ...form, client_id: event.target.value })}
            required
          >
            <option value="">Choose a client…</option>
            {(clients.data ?? []).map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </Select>

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Service"
              value={form.service_type}
              onChange={(event) =>
                setForm({ ...form, service_type: event.target.value as ServiceType })
              }
            >
              {SERVICE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {SERVICE_LABELS[type]}
                </option>
              ))}
            </Select>
            <Select
              label="Status"
              value={form.status}
              onChange={(event) =>
                setForm({ ...form, status: event.target.value as Booking['status'] })
              }
            >
              <option value="Pending">Pending</option>
              <option value="Confirmed">Confirmed</option>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Date"
              type="date"
              value={form.date}
              onChange={(event) => setForm({ ...form, date: event.target.value })}
              required
            />
            <Input
              label="Time"
              type="time"
              value={form.time}
              onChange={(event) => setForm({ ...form, time: event.target.value })}
              required
            />
          </div>

          {formError ? (
            <p role="alert" className="rounded-control border border-danger/30 bg-danger-bg px-3 py-2 text-danger">
              {formError}
            </p>
          ) : null}
        </form>
      </Modal>

      <ConfirmDialog
        open={cancelling !== null}
        title="Cancel this booking?"
        message={`This marks ${cancelling?.client_name ?? 'the client'}'s appointment as cancelled. The record is kept for your history.`}
        confirmLabel="Cancel booking"
        onConfirm={async () => {
          if (cancelling) await setStatus(cancelling, 'Cancelled');
          setCancelling(null);
        }}
        onCancel={() => setCancelling(null)}
      />
    </>
  );
}
