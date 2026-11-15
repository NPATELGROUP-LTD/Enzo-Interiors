import { ArrowClockwise } from '@phosphor-icons/react';
import { useEffect, useRef } from 'react';

import { Button, ErrorState, LoadingState, PaneHeader, SettingsGroup, SettingsRow, StatusTag } from '@/components/ui';
import { useQuery } from '@/hooks/useApi';

/* The shape apps/api/src/modules/infra/cluster.ts serves: counts, offsets and "Node 1/2" labels. */
interface Beat {
  at: number;
  uptime_seconds: number;
  load_1m: number;
  cpus: number;
  memory_used_bytes: number;
  memory_total_bytes: number;
  process_rss_bytes: number;
  event_loop_p99_ms: number;
}
interface Bucket {
  id: 'public' | 'private';
  files: number;
  bytes: number;
  partial: boolean;
  error: string | null;
}
type Cluster =
  | { enabled: false }
  | {
      enabled: true;
      generated_at: string;
      instances: Array<{ name: string; up: boolean; beat: Beat | null }>;
      postgres: { reachable: boolean; members: Array<{ name: string; role: string; state: string; timeline: number | null; lag_bytes: number | null }> };
      redis: Array<{ label: string; up: boolean; role: string | null; link_up: boolean | null; bytes_behind: number | null }>;
      minio: Array<{ label: string; buckets: Bucket[] }>;
    };

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
const upFor = (seconds: number) => (seconds >= 86_400 ? `${Math.floor(seconds / 86_400)} d ${Math.floor((seconds % 86_400) / 3_600)} h` : seconds >= 3_600 ? `${Math.floor(seconds / 3_600)} h` : `${Math.max(1, Math.floor(seconds / 60))} min`);
const ROLE: Record<string, string> = { leader: 'Primary', sync_standby: 'Sync standby', replica: 'Replica', master: 'Master', slave: 'Replica' };
const BUCKET_LABEL = { public: 'Website images', private: 'Client documents' } as const;

function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
  return (
    <div role="img" aria-label={`${label}: ${pct}%`} className="h-2 w-28 overflow-hidden rounded-full bg-surface-muted">
      <div className={pct > 85 ? 'h-full bg-danger' : pct > 60 ? 'h-full bg-warning' : 'h-full bg-success'} style={{ width: `${pct}%` }} />
    </div>
  );
}

/**
 * How long a replica needs to catch up, from its last few readings: the gap's fall per second.
 * Null when it is not shrinking (or there are fewer than two readings).
 */
function eta(samples: Array<{ at: number; behind: number }>): string | null {
  const first = samples[0];
  const last = samples[samples.length - 1];
  if (!first || !last || last.at <= first.at || last.behind <= 0) return null;
  const rate = (first.behind - last.behind) / ((last.at - first.at) / 1000);
  if (rate <= 0) return null;
  const seconds = Math.ceil(last.behind / rate);
  return seconds < 90 ? `about ${seconds} s left` : `about ${Math.ceil(seconds / 60)} min left`;
}

/** Settings › Cluster (Infra manager): load per API copy, and how far the second Postgres, Redis and MinIO have caught up. Read-only. */
export function Cluster() {
  const query = useQuery<Cluster>('/infra/cluster');
  const data = query.data;
  const history = useRef(new Map<string, Array<{ at: number; behind: number }>>());

  // While a copy is behind the page re-reads every 10 s, so the catch-up shows moving.
  useEffect(() => {
    const timer = setInterval(query.refetch, 10_000);
    return () => clearInterval(timer);
  }, [query.refetch]);

  if (query.error) return <ErrorState message={query.error} onRetry={query.refetch} />;
  if (!data) return <LoadingState label="Loading the cluster…" />;
  if (!data.enabled) {
    return (
      <div className="max-w-3xl">
        <PaneHeader title="Cluster" help="This server runs on its own, so there is no second copy to compare." />
      </div>
    );
  }

  const remember = (key: string, behind: number | null) => {
    if (behind === null) return null;
    const rows = history.current.get(key) ?? [];
    const at = Date.parse(data.generated_at);
    if (rows[rows.length - 1]?.at !== at) rows.push({ at, behind });
    history.current.set(key, rows.slice(-6));
    return eta(history.current.get(key) ?? []);
  };

  const [one, two] = data.minio;
  const mismatches = (one?.buckets ?? []).map((bucket) => {
    const other = two?.buckets.find((b) => b.id === bucket.id);
    return { bucket, files: other ? other.files - bucket.files : 0, bytes: other ? other.bytes - bucket.bytes : 0 };
  });

  return (
    <div className="max-w-3xl">
      <PaneHeader
        title="Cluster"
        help="Which copy of the site is doing what, and how far the second database, cache and file store have caught up. Counts only; nothing from a client."
        action={
          <Button icon={<ArrowClockwise size={16} />} onClick={query.refetch}>
            Refresh
          </Button>
        }
      />

      <SettingsGroup title="Site copies (API)">
        {data.instances.length ? (
          data.instances.map(({ name, up, beat }) => (
            <SettingsRow
              key={name}
              label={name}
              help={beat ? `Up ${upFor(beat.uptime_seconds)} · load ${beat.load_1m} on ${beat.cpus} cores · memory ${size(beat.memory_used_bytes)} of ${size(beat.memory_total_bytes)} · event loop ${beat.event_loop_p99_ms} ms` : 'No heartbeat in the last 45 seconds.'}
            >
              {beat ? <Bar value={beat.load_1m} max={beat.cpus} label={`${name} CPU load`} /> : null}
              <StatusTag tone={up ? 'success' : 'danger'}>{up ? 'Up' : 'Down'}</StatusTag>
            </SettingsRow>
          ))
        ) : (
          <SettingsRow label="No copies are listed on this server" />
        )}
      </SettingsGroup>

      <SettingsGroup title="Database (PostgreSQL)">
        {data.postgres.reachable ? (
          data.postgres.members.map((member) => {
            const left = member.role === 'leader' ? null : remember(`pg:${member.name}`, member.lag_bytes);
            return (
              <SettingsRow key={member.name} label={`${member.name} · ${ROLE[member.role] ?? member.role}`} help={`${member.state}${member.timeline ? ` · timeline ${member.timeline}` : ''}`}>
                {member.role === 'leader' ? (
                  <StatusTag tone="info">Takes all writes</StatusTag>
                ) : member.lag_bytes === null ? (
                  <StatusTag tone="warning">Lag unknown</StatusTag>
                ) : member.lag_bytes === 0 ? (
                  <StatusTag tone="success">In sync</StatusTag>
                ) : (
                  <>
                    <StatusTag tone="warning">{size(member.lag_bytes)} behind</StatusTag>
                    {left ? <span className="text-[13px] text-ink-muted">{left}</span> : null}
                  </>
                )}
              </SettingsRow>
            );
          })
        ) : (
          <SettingsRow label="Patroni did not answer" help="No database node could be asked who the primary is." />
        )}
      </SettingsGroup>

      <SettingsGroup title="Cache (Redis)">
        {data.redis.length ? (
          data.redis.map((node) => {
            const left = remember(`redis:${node.label}`, node.role === 'master' ? null : node.bytes_behind);
            return (
              <SettingsRow key={node.label} label={`${node.label} · ${node.role ? (ROLE[node.role] ?? node.role) : 'Not answering'}`} help={node.role !== 'master' && node.link_up === false ? 'Link to the master is down.' : undefined}>
                {!node.up ? (
                  <StatusTag tone="danger">Down</StatusTag>
                ) : node.role === 'master' ? (
                  <StatusTag tone="info">Master</StatusTag>
                ) : node.bytes_behind === null ? (
                  <StatusTag tone="warning">Unknown</StatusTag>
                ) : node.bytes_behind === 0 && node.link_up !== false ? (
                  <StatusTag tone="success">In sync</StatusTag>
                ) : (
                  <>
                    <StatusTag tone="warning">{size(node.bytes_behind)} behind</StatusTag>
                    {left ? <span className="text-[13px] text-ink-muted">{left}</span> : null}
                  </>
                )}
              </SettingsRow>
            );
          })
        ) : (
          <SettingsRow label="No Redis nodes are listed on this server" />
        )}
      </SettingsGroup>

      <SettingsGroup title="Files (MinIO)">
        {mismatches.length && two ? (
          mismatches.map(({ bucket, files, bytes }) => {
            const left = remember(`minio:${bucket.id}`, Math.abs(files));
            return (
              <SettingsRow
                key={bucket.id}
                label={BUCKET_LABEL[bucket.id]}
                help={bucket.error ? bucket.error : `${one?.label}: ${count.format(bucket.files)} files, ${size(bucket.bytes)}. ${two.label}: ${count.format(bucket.files + files)} files, ${size(bucket.bytes + bytes)}. Counted up to five minutes ago.`}
              >
                {bucket.error ? (
                  <StatusTag tone="warning">Check</StatusTag>
                ) : files === 0 && bytes === 0 ? (
                  <StatusTag tone="success">Same on both</StatusTag>
                ) : (
                  <>
                    <StatusTag tone="warning">{count.format(Math.abs(files))} file{Math.abs(files) === 1 ? '' : 's'} apart</StatusTag>
                    {left ? <span className="text-[13px] text-ink-muted">{left}</span> : null}
                  </>
                )}
              </SettingsRow>
            );
          })
        ) : (
          <SettingsRow label="Two file stores are not listed on this server" />
        )}
      </SettingsGroup>

      <p className="mt-10 text-xs text-ink-muted">A returning node shows how far behind it is; the time left is worked out from the last few readings, so it appears once the gap has started to shrink.</p>
    </div>
  );
}
