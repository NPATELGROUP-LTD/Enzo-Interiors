import { ArrowClockwise } from '@phosphor-icons/react';

import { Button, ErrorState, LoadingState, PaneHeader, SettingsGroup, SettingsRow, StatusTag } from '@/components/ui';
import { useQuery } from '@/hooks/useApi';

/* The shape apps/api/src/modules/infra serves: counts and sizes, nothing about a client. */
interface Stats {
  generated_at: string;
  release: string | null;
  uptime_seconds: number;
  checks: Array<{ id: string; label: string; ok: boolean; hint: string }>;
  database: { ping_ms: number; bytes: number; connections: number; max_connections: number; tables: Array<{ name: string; bytes: number; rows: number }> } | null;
  storage: Array<{ id: 'public' | 'private'; files: number; bytes: number; partial: boolean; error: string | null }> | null;
  cache: { backend: 'redis' | 'memory'; reachable: boolean; keys: number; memory_bytes: number | null; hits: number; misses: number };
  traffic: {
    hours: Array<{ hour: string; errors: number; refused: number }>;
    errors: number;
    refused: number;
    failed_signins: number;
    failed_signin_addresses: number;
    top_error_routes: Array<{ route: string; count: number }>;
  };
  problems_7d: { urgent: number; error: number; security: number };
  totals: { clients: number; projects: number; staff: number };
}

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];
function size(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${UNITS[unit]}`;
}

const count = new Intl.NumberFormat('en-GB');
const CLOCK = new Intl.DateTimeFormat('en-GB', { timeStyle: 'short' });
const upFor = (seconds: number) => (seconds >= 86_400 ? `${Math.floor(seconds / 86_400)} d ${Math.floor((seconds % 86_400) / 3_600)} h` : seconds >= 3_600 ? `${Math.floor(seconds / 3_600)} h` : `${Math.max(1, Math.floor(seconds / 60))} min`);
const BUCKET_LABEL = { public: 'Website images', private: 'Client documents' } as const;

/** Settings › Health (Infra manager): sizes, the cache, the last day of failures and which switches are set. */
export function Health() {
  const query = useQuery<Stats>('/infra/stats');
  const stats = query.data;
  if (query.error) return <ErrorState message={query.error} onRetry={query.refetch} />;
  if (!stats) return <LoadingState label="Loading health…" />;

  const { checks, database, storage, cache, traffic, problems_7d: problems, totals } = stats;
  const failing = checks.filter((check) => !check.ok);
  const lookups = cache.hits + cache.misses;
  const peak = Math.max(1, ...traffic.hours.map((row) => row.errors + row.refused));

  return (
    <div className="max-w-3xl">
      <PaneHeader
        title="Health"
        help="How the platform is doing: storage, the database, the cache and the last day of errors. Counts and sizes only; nothing from a client."
        action={
          <Button icon={<ArrowClockwise size={16} />} onClick={query.refetch}>
            Refresh
          </Button>
        }
      />

      <SettingsGroup title={failing.length ? `Needs attention (${failing.length})` : 'Checks'}>
        {[...failing, ...checks.filter((check) => check.ok)].map((check) => (
          <SettingsRow key={check.id} label={check.label} help={check.ok ? undefined : check.hint}>
            <StatusTag tone={check.ok ? 'success' : 'warning'}>{check.ok ? 'OK' : 'Check'}</StatusTag>
          </SettingsRow>
        ))}
      </SettingsGroup>

      <SettingsGroup title="Database">
        {database ? (
          <>
            <SettingsRow label="Size">{size(database.bytes)}</SettingsRow>
            <SettingsRow label="Connections" help="In use, out of what PostgreSQL allows.">
              {database.connections} of {database.max_connections}
            </SettingsRow>
            <SettingsRow label="Response time">{database.ping_ms} ms</SettingsRow>
            {database.tables.map((table) => (
              <SettingsRow key={table.name} label={table.name} help={table.rows > 0 ? `About ${count.format(table.rows)} row${table.rows === 1 ? '' : 's'}` : undefined}>
                {size(table.bytes)}
              </SettingsRow>
            ))}
          </>
        ) : (
          <SettingsRow label="The database did not answer" />
        )}
      </SettingsGroup>

      <SettingsGroup title="File storage">
        {storage ? (
          storage.map((bucket) => (
            <SettingsRow
              key={bucket.id}
              label={BUCKET_LABEL[bucket.id]}
              help={bucket.error ?? `${count.format(bucket.files)}${bucket.partial ? '+' : ''} file${bucket.files === 1 ? '' : 's'}${bucket.partial ? ' (counted up to a limit)' : ''}`}
            >
              {bucket.error ? <StatusTag tone="warning">Check</StatusTag> : size(bucket.bytes)}
            </SettingsRow>
          ))
        ) : (
          <SettingsRow label="File storage is not set up on this server" />
        )}
        <SettingsRow label="Disk space on the server" help="Not visible from here. Coolify warns you when it passes your limit." />
      </SettingsGroup>

      <SettingsGroup title="Cache">
        <SettingsRow label="Kept in" help={cache.backend === 'redis' ? undefined : 'This process only: restarts empty it and the limits are not shared.'}>
          {cache.backend === 'redis' ? (cache.reachable ? 'Redis' : <StatusTag tone="warning">Redis not answering</StatusTag>) : 'Memory'}
        </SettingsRow>
        <SettingsRow label="Entries">{count.format(cache.keys)}</SettingsRow>
        {cache.memory_bytes !== null ? <SettingsRow label="Memory used">{size(cache.memory_bytes)}</SettingsRow> : null}
        <SettingsRow label="Found when looked for" help="Since the last restart.">
          {lookups ? `${Math.round((cache.hits / lookups) * 100)}% of ${count.format(lookups)}` : 'No lookups yet'}
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Last 24 hours">
        <div className="px-4 py-3">
          <div
            role="img"
            aria-label={`Server errors and refused requests by hour over the last 24 hours: ${traffic.errors} errors, ${traffic.refused} refused`}
            className="flex h-20 items-end gap-[3px]"
          >
            {traffic.hours.map((row) => (
              <div key={row.hour} title={`${CLOCK.format(new Date(row.hour))}: ${row.errors} errors, ${row.refused} refused`} className="flex h-full flex-1 flex-col justify-end">
                <div className="w-full rounded-t-[2px] bg-warning/60" style={{ height: `${(row.refused / peak) * 100}%` }} />
                <div className="w-full bg-danger" style={{ height: `${(row.errors / peak) * 100}%` }} />
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-ink-muted">
            <span>24 hours ago</span>
            <span>now</span>
          </div>
          <p className="mt-2 text-[13px] text-ink-muted">
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-danger align-middle" aria-hidden="true" /> Server errors
            <span className="ml-3 mr-1 inline-block h-2 w-2 rounded-full bg-warning/60 align-middle" aria-hidden="true" /> Refused
          </p>
        </div>
        <SettingsRow label="Server errors">{count.format(traffic.errors)}</SettingsRow>
        <SettingsRow label="Refused requests" help="Signed out, not allowed, not found, or stopped by the rate limit.">
          {count.format(traffic.refused)}
        </SettingsRow>
        <SettingsRow label="Failed sign-ins">
          {count.format(traffic.failed_signins)} from {count.format(traffic.failed_signin_addresses)} address{traffic.failed_signin_addresses === 1 ? '' : 'es'}
        </SettingsRow>
        {traffic.top_error_routes.map((row) => (
          <SettingsRow key={row.route} label={<span className="break-all font-mono text-[13px]">{row.route}</span>} help="Most server errors">
            {count.format(row.count)}
          </SettingsRow>
        ))}
      </SettingsGroup>

      <SettingsGroup title="Problems emailed, last 7 days">
        <SettingsRow label="Urgent">{problems.urgent}</SettingsRow>
        <SettingsRow label="Error">{problems.error}</SettingsRow>
        <SettingsRow label="Security">{problems.security}</SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="On the platform">
        <SettingsRow label="Clients">{count.format(totals.clients)}</SettingsRow>
        <SettingsRow label="Projects">{count.format(totals.projects)}</SettingsRow>
        <SettingsRow label="Staff accounts">{count.format(totals.staff)}</SettingsRow>
      </SettingsGroup>

      <p className="mt-10 text-xs text-ink-muted">
        {stats.release ? `Release ${stats.release} · ` : ''}up for {upFor(stats.uptime_seconds)} · counted at {CLOCK.format(new Date(stats.generated_at))}. Numbers are up to a minute old; storage sizes up to ten.
      </p>
    </div>
  );
}
