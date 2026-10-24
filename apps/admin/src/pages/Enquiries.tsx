import { CaretLeft, CaretRight, EnvelopeSimple, UserPlus } from '@phosphor-icons/react';
import clsx from 'clsx';
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useCmsShell } from '@/components/layout/AdminLayout';
import { Button, EmptyState, ErrorState, LoadingState, StatusTag, Tabs } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { ApiError, api } from '@/lib/api';
import { dateTime, relative } from '@/lib/format';
import { submissionTone } from '@/lib/status';
import { SUBMISSION_STATUSES, type ContactSubmission, type SubmissionStatus } from '@/types/api';

interface Page {
  items: ContactSubmission[];
  has_more: boolean;
  new_count: number;
}

const KIND: Record<ContactSubmission['kind'], string> = {
  contact: 'Contact form',
  quote: 'Quote request',
  booking: 'Booking request',
};
const FILTERS = [{ id: 'all', label: 'All' }, ...SUBMISSION_STATUSES.map((id) => ({ id, label: id }))];
const FOCUS = 'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring/40';

/**
 * The inbox for what visitors send from the website (Admin only). Rows are the
 * CMS overview's rows; the open one shows in a sidebar with its status and a
 * shortcut to add the sender as a client.
 */
export function EnquiriesPage() {
  const toast = useToast();
  const { refreshEnquiries } = useCmsShell();
  const [params, setParams] = useSearchParams();
  const filter = FILTERS.find(({ id }) => id === params.get('view'))?.id ?? 'all';
  const openId = params.get('id');

  const [items, setItems] = useState<ContactSubmission[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (before?: string) => {
      setLoading(true);
      setError(null);
      try {
        const query = new URLSearchParams({ limit: '30' });
        if (filter !== 'all') query.set('status', filter);
        if (before) query.set('before', before);
        const page = await api.get<Page>(`/enquiries?${query}`);
        setItems((current) => (before ? [...current, ...page.items] : page.items));
        setHasMore(page.has_more);
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'Could not load enquiries.');
      } finally {
        setLoading(false);
      }
    },
    [filter],
  );
  useEffect(() => void load(), [load]);

  const open = items.find((row) => row.id === openId) ?? null;
  const select = (id: string | null) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (id) next.set('id', id);
      else next.delete('id');
      return next;
    });

  const setStatus = async (row: ContactSubmission, status: SubmissionStatus) => {
    setSaving(true);
    try {
      const updated = await api.patch<ContactSubmission>(`/enquiries/${row.id}`, { status });
      // A row that no longer matches the open filter leaves the list.
      setItems((current) =>
        current.flatMap((item) =>
          item.id !== row.id ? [item] : filter === 'all' || filter === status ? [updated] : [],
        ),
      );
      refreshEnquiries();
      toast.success(`${row.name} marked ${status.toLowerCase()}.`);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not change the status.');
    } finally {
      setSaving(false);
    }
  };

  const addClient = (row: ContactSubmission) => {
    const query = new URLSearchParams({ new: '1', name: row.name, email: row.email });
    if (row.phone) query.set('phone', row.phone);
    return `/clients?${query}`;
  };

  return (
    <div className="px-5 pb-16 pt-6 sm:px-8 lg:pt-8">
      <div className={clsx(open && 'max-xl:hidden')}>
        <Tabs
          tabs={FILTERS}
          active={filter}
          onChange={(id) => setParams(id === 'all' ? {} : { view: id })}
        />
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : loading && items.length === 0 ? (
        <LoadingState label="Loading enquiries…" />
      ) : items.length === 0 ? (
        <EmptyState
          title="No enquiries"
          message={
            filter === 'all'
              ? 'Messages sent from the website’s contact, quote and booking forms land here.'
              : 'Nothing has this status. Try another tab.'
          }
        />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-x-8 gap-y-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <section aria-label="Enquiries" className={clsx(open && 'max-xl:hidden')}>
            <ul className="rounded-card bg-surface p-1.5 shadow-soft">
              {items.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => select(row.id)}
                    aria-current={row.id === openId}
                    className={clsx(
                      'group flex w-full items-start gap-3 rounded-[10px] px-3 py-3 text-left transition-colors hover:bg-ink/[0.025]',
                      row.id === openId && 'bg-ink/[0.04]',
                      FOCUS,
                    )}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-green-100 text-green-900">
                      <EnvelopeSimple size={18} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className={clsx('min-w-0 truncate text-ink', row.status === 'New' ? 'font-bold' : 'font-semibold')}>
                          {row.name}
                        </span>
                        <span className="shrink-0 text-xs text-ink-muted">{KIND[row.kind]}</span>
                      </span>
                      {/* Two lines, wrapped; the full text opens with the row. */}
                      <span className="mt-0.5 line-clamp-2 text-[13px] text-ink-muted [overflow-wrap:anywhere]">
                        {row.message || row.email}
                      </span>
                      <span className="mt-1.5 flex items-center gap-2 text-xs text-ink-muted">
                        {row.status === 'New' ? null : <StatusTag tone={submissionTone(row.status)}>{row.status}</StatusTag>}
                        {relative(row.created_at)}
                      </span>
                    </span>
                    {row.status === 'New' ? <StatusTag tone="warning">New</StatusTag> : null}
                    <CaretRight size={14} aria-hidden="true" className="mt-2 shrink-0 text-ink-muted" />
                  </button>
                </li>
              ))}
            </ul>
            {hasMore ? (
              <div className="mt-4 flex justify-center">
                <Button
                  variant="secondary"
                  loading={loading}
                  onClick={() => void load(items[items.length - 1]?.created_at)}
                >
                  Show older
                </Button>
              </div>
            ) : null}
          </section>

          <aside
            aria-label="Enquiry"
            className={clsx('rounded-card bg-surface p-5 shadow-soft xl:sticky xl:top-6', !open && 'max-xl:hidden')}
          >
            {open ? (
              <div className="flex flex-col gap-5">
                <button
                  type="button"
                  onClick={() => select(null)}
                  className={clsx('-my-2 -ml-2 flex min-h-11 w-fit items-center gap-1 rounded-control pr-2 text-[13px] font-semibold text-ink-muted hover:text-ink xl:hidden', FOCUS)}
                >
                  <CaretLeft size={16} aria-hidden="true" />
                  All enquiries
                </button>
                <div>
                  <h2 className="text-lg font-semibold text-ink">{open.name}</h2>
                  <p className="mt-0.5 text-[13px] text-ink-muted">
                    {KIND[open.kind]} · {dateTime(open.created_at)}
                  </p>
                </div>
                <dl className="grid gap-3 text-[13px]">
                  <div>
                    <dt className="text-ink-muted">Email</dt>
                    <dd>
                      <a href={`mailto:${open.email}`} className="text-link">
                        {open.email}
                      </a>
                    </dd>
                  </div>
                  {open.phone ? (
                    <div>
                      <dt className="text-ink-muted">Phone</dt>
                      <dd>
                        <a href={`tel:${open.phone}`} className="text-link">
                          {open.phone}
                        </a>
                      </dd>
                    </div>
                  ) : null}
                  {Object.entries(open.details ?? {}).map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-ink-muted">{key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())}</dt>
                      <dd className="break-words text-ink">{value}</dd>
                    </div>
                  ))}
                </dl>
                {open.message ? (
                  <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-ink">{open.message}</p>
                ) : null}
                <div>
                  <p className="mb-2 text-[13px] font-semibold text-ink-muted">Status</p>
                  <Tabs
                    tabs={SUBMISSION_STATUSES.map((id) => ({ id, label: id }))}
                    active={open.status}
                    onChange={(id) => {
                      if (!saving) void setStatus(open, id as SubmissionStatus);
                    }}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link to={addClient(open)}>
                    <Button variant="primary" icon={<UserPlus size={16} aria-hidden="true" />}>
                      Add as client
                    </Button>
                  </Link>
                  <a href={`mailto:${open.email}`}>
                    <Button variant="secondary">Reply by email</Button>
                  </a>
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-ink-muted">Choose an enquiry to read it and change its status.</p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
