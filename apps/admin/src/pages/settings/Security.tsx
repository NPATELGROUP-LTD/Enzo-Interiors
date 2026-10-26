import clsx from 'clsx';
import { useCallback, useEffect, useState } from 'react';

import { Button, EmptyState, ErrorState, FIELD_BASE, LoadingState, PaneHeader, SettingsGroup, StatusTag, Tabs, type StatusTone } from '@/components/ui';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
import type { ActivityLog } from '@/types/api';

/* The shape apps/api/src/data/access-store.ts serves. */
interface AccessEvent {
  id: string;
  at: string;
  kind: 'signin' | 'request';
  actor_name: string | null;
  actor_role: string | null;
  method: string;
  route: string;
  target_id: string | null;
  status: number;
  ip: string | null;
  country: string | null;
  device: string | null;
}

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'signins', label: 'Sign-ins' },
  { id: 'failures', label: 'Refused' },
  { id: 'changes', label: 'Changes' },
];
const WHEN = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'medium' });

const tone = (status: number): StatusTone => (status >= 500 ? 'danger' : status === 429 || status === 401 || status === 403 ? 'warning' : status >= 400 ? 'info' : 'success');
const words = (action: string) => action.replace(/_/g, ' ').replace(/^./, (letter) => letter.toUpperCase());

/** Settings › Security (Infra manager): who signed in and what they changed, from where. */
export function Security() {
  const [view, setView] = useState('access');
  return (
    <div className="max-w-4xl">
      <PaneHeader
        title="Security"
        help="Who signed in, what they changed, and what was refused, with where from. The address a failed sign-in typed is masked, and nothing from a request is kept. Kept for 90 days."
      />
      <div className="mt-4">
        <Tabs
          tabs={[
            { id: 'access', label: 'Access' },
            { id: 'activity', label: 'Activity' },
          ]}
          active={view}
          onChange={setView}
        />
      </div>
      {view === 'access' ? <Access /> : <Activity />}
    </div>
  );
}

function Access() {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [events, setEvents] = useState<AccessEvent[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [more, setMore] = useState(false);

  // Wait for the typing to stop before asking.
  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const path = useCallback(
    (before?: string) => `/access-log?filter=${filter}${q ? `&q=${encodeURIComponent(q)}` : ''}${before ? `&before=${encodeURIComponent(before)}` : ''}`,
    [filter, q],
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      const page = await api.get<{ events: AccessEvent[]; next: string | null }>(path());
      setEvents(page.events);
      setNext(page.next);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load the access log.');
    }
  }, [path]);

  useEffect(() => {
    setEvents(null);
    void load();
  }, [load]);

  const loadMore = async () => {
    if (!next) return;
    setMore(true);
    try {
      const page = await api.get<{ events: AccessEvent[]; next: string | null }>(path(next));
      setEvents((current) => [...(current ?? []), ...page.events]);
      setNext(page.next);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load more.');
    } finally {
      setMore(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs tabs={FILTERS} active={filter} onChange={setFilter} />
        <input
          type="search"
          aria-label="Search by name or IP address"
          placeholder="Name or IP address"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className={clsx(FIELD_BASE, 'mb-4 w-full sm:w-64')}
        />
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : !events ? (
        <LoadingState label="Loading the access log…" />
      ) : (
        <SettingsGroup>
          {events.length ? (
            events.map((event) => (
              <div key={event.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusTag tone={tone(event.status)}>{event.status}</StatusTag>
                    <span className="break-all text-sm font-medium text-ink">
                      {event.kind === 'signin' ? 'Signed in' : `${event.method} ${event.route}`}
                    </span>
                  </div>
                  <p className="mt-0.5 break-words text-[13px] text-ink-muted">
                    {event.actor_name ?? 'Not signed in'}
                    {event.actor_role ? ` · ${event.actor_role}` : ''}
                    {event.target_id ? ` · ${event.target_id}` : ''}
                  </p>
                </div>
                <div className="shrink-0 text-xs leading-relaxed text-ink-muted sm:text-right">
                  <p>{WHEN.format(new Date(event.at))}</p>
                  <p className="break-all">{[event.ip, event.country, event.device].filter(Boolean).join(' · ') || 'Where from is not known'}</p>
                </div>
              </div>
            ))
          ) : (
            <EmptyState title="Nothing here" message="Sign-ins, changes and refusals appear as they happen." />
          )}
          {next ? (
            <div className="px-4 py-3">
              <Button variant="ghost" loading={more} onClick={() => void loadMore()}>
                Show older
              </Button>
            </div>
          ) : null}
        </SettingsGroup>
      )}
    </>
  );
}

/** The audit trail of changes. The server leaves out client and business details; the platform's own rows keep theirs. */
function Activity() {
  const logs = useQuery<ActivityLog[]>('/activity-logs?limit=200');
  if (logs.error) return <ErrorState message={logs.error} onRetry={logs.refetch} />;
  if (!logs.data) return <LoadingState label="Loading changes…" />;
  return (
    <SettingsGroup>
      {logs.data.length ? (
        logs.data.map((row) => (
          <div key={row.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">{words(row.action)}</p>
              <p className="mt-0.5 break-words text-[13px] text-ink-muted">
                {row.actor_name} · {row.target_table.replace(/_/g, ' ')} · {row.target_id}
              </p>
              {row.details ? (
                <p className="mt-0.5 break-words text-xs text-ink-muted">
                  {Object.entries(row.details)
                    .map(([key, value]) => `${key}: ${String(value)}`)
                    .join(' · ')}
                </p>
              ) : null}
            </div>
            <p className="shrink-0 text-xs text-ink-muted sm:text-right">{WHEN.format(new Date(row.created_at))}</p>
          </div>
        ))
      ) : (
        <EmptyState title="No changes yet" message="Changes made in the admin appear here." />
      )}
    </SettingsGroup>
  );
}
