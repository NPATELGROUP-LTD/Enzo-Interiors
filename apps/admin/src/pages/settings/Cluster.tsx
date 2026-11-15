import { useEffect, useRef, useState, type ReactNode } from 'react';

import { ErrorState, LoadingState, PaneHeader, StatusTag } from '@/components/ui';
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

const REFRESH_MS = 5_000;
const KEEP = 60; // readings kept per graph: five minutes at one every five seconds
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
const tone = (pct: number) => (pct > 85 ? 'var(--danger)' : pct > 60 ? 'var(--warning)' : 'var(--success)');

/** How long a replica needs to catch up, from its last readings. Null when the gap is not shrinking. */
function eta(samples: number[]): string | null {
  const first = samples[0];
  const last = samples[samples.length - 1];
  if (first === undefined || last === undefined || samples.length < 2 || last <= 0) return null;
  const rate = (first - last) / ((samples.length - 1) * (REFRESH_MS / 1000));
  if (rate <= 0) return null;
  const seconds = Math.ceil(last / rate);
  return seconds < 90 ? `about ${seconds} s left` : `about ${Math.ceil(seconds / 60)} min left`;
}

/** A gauge that fills smoothly to its value (CSS transition on the stroke). */
function Ring({ pct, label, value, color = tone(pct) }: { pct: number; label: string; value: string; color?: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <div role="img" aria-label={`${label}: ${value}`} className="flex flex-col items-center gap-1">
      <div className="relative h-20 w-20">
        <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
          <circle cx="40" cy="40" r={r} fill="none" stroke="var(--border)" strokeWidth="7" />
          <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - clamped / 100)} style={{ transition: 'stroke-dashoffset 900ms ease, stroke 400ms' }} />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[15px] font-semibold tabular-nums text-ink">{value}</span>
      </div>
      <span className="text-[11px] text-ink-muted">{label}</span>
    </div>
  );
}

/** A small line graph of the last readings, scaled to `max` (or its own peak). */
function Spark({ values, max, color, label }: { values: number[]; max?: number; color: string; label: string }) {
  const w = 240;
  const h = 44;
  const top = Math.max(max ?? 0, ...values, 1e-9);
  const pts = values.map((v, i) => [values.length < 2 ? w : (i / (KEEP - 1)) * w + w - ((values.length - 1) / (KEEP - 1)) * w, h - 3 - (Math.min(v, top) / top) * (h - 8)] as const);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const first = pts[0];
  const last = pts[pts.length - 1];
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-11 w-full">
      <line x1="0" x2={w} y1={h - 1} y2={h - 1} stroke="var(--border)" strokeWidth="1" />
      {first && last && pts.length > 1 ? (
        <>
          <polygon points={`${first[0]},${h - 1} ${line} ${last[0]},${h - 1}`} fill={color} opacity="0.14" />
          <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </>
      ) : null}
    </svg>
  );
}

/** One card in the page. */
function Panel({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="text-[13px] font-semibold text-ink-muted">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}
const CARD = 'rounded-[10px] border border-border bg-surface p-4';

/** Two nodes joined by a line; dashes run along it from the source while data is flowing. */
function Link({ from, to, ok, busy, note }: { from: string; to: string; ok: boolean; busy: boolean; note: string }) {
  const color = ok ? 'var(--success)' : 'var(--warning)';
  return (
    <div className="flex items-center gap-3">
      <span className="rounded-full border border-border px-3 py-1 text-[13px] font-medium text-ink">{from}</span>
      <svg viewBox="0 0 100 12" preserveAspectRatio="none" className="h-3 min-w-16 flex-1" aria-hidden="true">
        <line x1="0" x2="100" y1="6" y2="6" stroke={color} strokeWidth="2" strokeDasharray="6 6" className={busy ? 'cl-flow' : undefined} vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="rounded-full border border-border px-3 py-1 text-[13px] font-medium text-ink">{to}</span>
      <span className="ml-1 text-[13px] text-ink-muted">{note}</span>
    </div>
  );
}

/** Settings › Cluster (Infra manager): load per API copy, and how far the second Postgres, Redis and MinIO have caught up. Read-only, and it refreshes itself. */
export function Cluster({ compact = false }: { compact?: boolean }) {
  const query = useQuery<Cluster>('/infra/cluster');
  const data = query.data;
  const series = useRef(new Map<string, number[]>());
  const seen = useRef(0);
  const [, setNow] = useState(0);

  // Re-read every few seconds without a click (not while the tab is hidden), and tick a clock for "updated Ns ago".
  useEffect(() => {
    const read = setInterval(() => {
      if (!document.hidden) void query.refetch();
    }, REFRESH_MS);
    const tick = setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      clearInterval(read);
      clearInterval(tick);
    };
  }, [query.refetch]);

  if (query.error && !data) return <ErrorState message={query.error} onRetry={query.refetch} />;
  if (!data) return <LoadingState label="Loading the cluster…" />;
  if (!data.enabled) {
    return (
      <div className="max-w-3xl">
        <PaneHeader title="Cluster" help="This server runs on its own, so there is no second copy to compare." />
      </div>
    );
  }

  // Remember one reading per refresh for the graphs (the page's own memory: the server keeps no history).
  const at = Date.parse(data.generated_at);
  const fresh = at !== seen.current;
  const push = (key: string, value: number | null) => {
    const rows = series.current.get(key) ?? [];
    if (fresh && value !== null) rows.push(value);
    if (rows.length > KEEP) rows.splice(0, rows.length - KEEP);
    series.current.set(key, rows);
    return rows;
  };

  const instances = data.instances.map((item) => ({
    ...item,
    cpu: push(`cpu:${item.name}`, item.beat ? (item.beat.load_1m / Math.max(item.beat.cpus, 1)) * 100 : null),
    loop: push(`loop:${item.name}`, item.beat ? item.beat.event_loop_p99_ms : null),
  }));
  const members = data.postgres.reachable ? data.postgres.members.map((m) => ({ ...m, lag: push(`pg:${m.name}`, m.role === 'leader' ? null : m.lag_bytes) })) : [];
  const nodes = data.redis.map((n) => ({ ...n, lag: push(`redis:${n.label}`, n.role === 'master' ? null : n.bytes_behind) }));
  const [one, two] = data.minio;
  const buckets = (one?.buckets ?? []).map((bucket) => {
    const other = two?.buckets.find((b) => b.id === bucket.id);
    const files = other ? other.files - bucket.files : 0;
    return { bucket, other, files, bytes: other ? other.bytes - bucket.bytes : 0, lag: push(`minio:${bucket.id}`, Math.abs(files)) };
  });
  seen.current = at;

  const upCount = instances.filter((i) => i.up).length;
  const pgBehind = members.some((m) => m.role !== 'leader' && (m.lag_bytes ?? 1) > 0);
  const redisBehind = nodes.some((n) => n.role !== 'master' && ((n.bytes_behind ?? 1) > 0 || n.link_up === false));
  const filesApart = buckets.some((b) => b.files !== 0 || b.bytes !== 0 || b.bucket.error);
  const ago = Math.max(0, Math.round((Date.now() - at) / 1000));
  const stale = ago > 20;

  const liveTag = (
    <span className="flex items-center gap-2 text-[13px] text-ink-muted" role="status">
      <span className={`h-2.5 w-2.5 rounded-full ${stale ? 'bg-warning' : 'bg-success cl-live'}`} aria-hidden="true" />
      {stale ? `No update for ${ago} s` : `Live · updated ${ago} s ago`}
    </span>
  );

  return (
    <div className={compact ? '' : 'max-w-5xl'}>
      <style>{`@media (prefers-reduced-motion: no-preference){@keyframes cl-flow{to{stroke-dashoffset:-24}}.cl-flow{animation:cl-flow 1s linear infinite}@keyframes cl-live{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--success) 55%,transparent)}100%{box-shadow:0 0 0 8px transparent}}.cl-live{animation:cl-live 1.6s ease-out infinite}}`}</style>
      {compact ? (
        <div className="flex justify-end">{liveTag}</div>
      ) : (
        <PaneHeader title="Cluster" help="Which copy of the site is doing what, and how far the second database, cache and file store have caught up. Counts only; nothing from a client." action={liveTag} />
      )}

      <div className={`${compact ? 'mt-2' : 'mt-6'} grid grid-cols-2 gap-3 lg:grid-cols-4`}>
        {[
          { label: 'Site copies', value: `${upCount} of ${instances.length} up`, ok: instances.length > 0 && upCount === instances.length },
          { label: 'Database', value: !data.postgres.reachable ? 'No answer' : pgBehind ? 'Catching up' : 'In sync', ok: data.postgres.reachable && !pgBehind },
          { label: 'Cache', value: nodes.length === 0 ? 'Not listed' : redisBehind ? 'Catching up' : 'In sync', ok: nodes.length > 0 && !redisBehind },
          { label: 'Files', value: buckets.length === 0 ? 'Not listed' : filesApart ? 'Catching up' : 'Same on both', ok: buckets.length > 0 && !filesApart },
        ].map((tile) => (
          <div key={tile.label} className={CARD}>
            <p className="text-[12px] text-ink-muted">{tile.label}</p>
            <p className="mt-1 flex items-center gap-2 text-[15px] font-semibold text-ink">
              <span className="h-2.5 w-2.5 rounded-full transition-colors duration-500" style={{ background: tile.ok ? 'var(--success)' : 'var(--warning)' }} aria-hidden="true" />
              {tile.value}
            </p>
          </div>
        ))}
      </div>

      <Panel title="Site copies (API)">
        {instances.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {instances.map(({ name, up, beat, cpu, loop }) => {
              const memPct = beat ? (beat.memory_used_bytes / Math.max(beat.memory_total_bytes, 1)) * 100 : 0;
              const cpuPct = cpu[cpu.length - 1] ?? 0;
              return (
                <div key={name} className={CARD}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">{name}</p>
                      <p className="text-[12px] text-ink-muted">{beat ? `Up ${upFor(beat.uptime_seconds)} · ${beat.cpus} cores` : 'No heartbeat in the last 45 seconds.'}</p>
                    </div>
                    <StatusTag tone={up ? 'success' : 'danger'}>{up ? 'Up' : 'Down'}</StatusTag>
                  </div>
                  {beat ? (
                    <>
                      <div className="mt-3 flex justify-around">
                        <Ring pct={cpuPct} label="CPU load" value={`${Math.round(cpuPct)}%`} />
                        <Ring pct={memPct} label={`Memory · ${size(beat.memory_used_bytes)}`} value={`${Math.round(memPct)}%`} />
                      </div>
                      <p className="mt-3 text-[11px] text-ink-muted">CPU load, last five minutes</p>
                      <Spark values={cpu} max={100} color={tone(cpuPct)} label={`${name} CPU load history`} />
                      <p className="mt-2 text-[11px] text-ink-muted">Event-loop delay now {beat.event_loop_p99_ms} ms (a busy server runs behind)</p>
                      <Spark values={loop} color="var(--info, var(--success))" label={`${name} event-loop delay history`} />
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className={CARD}>No copies are listed on this server.</div>
        )}
      </Panel>

      <div className={compact ? 'grid items-start gap-x-5 lg:grid-cols-2' : undefined}>
      <Panel title="Database (PostgreSQL)">
        <div className={`${CARD} space-y-4`}>
          {data.postgres.reachable ? (
            members.map((member) => {
              const leader = member.role === 'leader';
              const left = leader ? null : eta(member.lag);
              return (
                <div key={member.name}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-ink">
                      {member.name} · {ROLE[member.role] ?? member.role}
                      <span className="ml-2 text-[12px] font-normal text-ink-muted">
                        {member.state}
                        {member.timeline ? ` · timeline ${member.timeline}` : ''}
                      </span>
                    </p>
                    <span className="flex items-center gap-2">
                      {leader ? (
                        <StatusTag tone="info">Takes all writes</StatusTag>
                      ) : member.lag_bytes === null ? (
                        <StatusTag tone="warning">Lag unknown</StatusTag>
                      ) : member.lag_bytes === 0 ? (
                        <StatusTag tone="success">In sync</StatusTag>
                      ) : (
                        <StatusTag tone="warning">{size(member.lag_bytes)} behind</StatusTag>
                      )}
                      {left ? <span className="text-[13px] text-ink-muted">{left}</span> : null}
                    </span>
                  </div>
                  {leader ? null : (
                    <>
                      <Link from={members.find((m) => m.role === 'leader')?.name ?? 'Primary'} to={member.name} ok={member.lag_bytes === 0} busy={member.state === 'streaming' || (member.lag_bytes ?? 0) > 0} note={member.lag_bytes === 0 ? 'streaming, nothing behind' : member.lag_bytes === null ? '' : `${size(member.lag_bytes)} to go`} />
                      <Spark values={member.lag} color="var(--warning)" label={`${member.name} replication lag history`} />
                    </>
                  )}
                </div>
              );
            })
          ) : (
            <p className="text-sm text-ink-muted">Patroni did not answer. No database node could be asked who the primary is.</p>
          )}
        </div>
      </Panel>

      <Panel title="Cache (Redis)">
        <div className={`${CARD} space-y-4`}>
          {nodes.length ? (
            nodes.map((node) => {
              const master = node.role === 'master';
              const left = master ? null : eta(node.lag);
              return (
                <div key={node.label}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-ink">
                      {node.label} · {node.role ? (ROLE[node.role] ?? node.role) : 'Not answering'}
                      {!master && node.link_up === false ? <span className="ml-2 text-[12px] font-normal text-danger">Link to the master is down.</span> : null}
                    </p>
                    <span className="flex items-center gap-2">
                      {!node.up ? <StatusTag tone="danger">Down</StatusTag> : master ? <StatusTag tone="info">Master</StatusTag> : node.bytes_behind === null ? <StatusTag tone="warning">Unknown</StatusTag> : node.bytes_behind === 0 && node.link_up !== false ? <StatusTag tone="success">In sync</StatusTag> : <StatusTag tone="warning">{size(node.bytes_behind)} behind</StatusTag>}
                      {left ? <span className="text-[13px] text-ink-muted">{left}</span> : null}
                    </span>
                  </div>
                  {master || !node.up ? null : (
                    <>
                      <Link from={nodes.find((n) => n.role === 'master')?.label ?? 'Master'} to={node.label} ok={node.bytes_behind === 0 && node.link_up !== false} busy={node.link_up !== false} note={node.bytes_behind === 0 ? 'nothing behind' : node.bytes_behind === null ? '' : `${size(node.bytes_behind)} to go`} />
                      <Spark values={node.lag} color="var(--warning)" label={`${node.label} replication gap history`} />
                    </>
                  )}
                </div>
              );
            })
          ) : (
            <p className="text-sm text-ink-muted">No Redis nodes are listed on this server.</p>
          )}
        </div>
      </Panel>

      </div>

      <Panel title="Files (MinIO)">
        <div className={`${CARD} space-y-4`}>
          {buckets.length && two ? (
            buckets.map(({ bucket, other, files, bytes, lag }) => {
              const left = eta(lag);
              const total = Math.max(bucket.files, other?.files ?? 0, 1);
              return (
                <div key={bucket.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-ink">{BUCKET_LABEL[bucket.id]}</p>
                    <span className="flex items-center gap-2">
                      {bucket.error ? <StatusTag tone="warning">Check</StatusTag> : files === 0 && bytes === 0 ? <StatusTag tone="success">Same on both</StatusTag> : <StatusTag tone="warning">{count.format(Math.abs(files))} file{Math.abs(files) === 1 ? '' : 's'} apart</StatusTag>}
                      {left ? <span className="text-[13px] text-ink-muted">{left}</span> : null}
                    </span>
                  </div>
                  {bucket.error ? (
                    <p className="mt-1 text-[12px] text-ink-muted">{bucket.error}</p>
                  ) : (
                    [{ label: one?.label ?? 'Node 1', files: bucket.files, bytes: bucket.bytes }, { label: two.label, files: other?.files ?? 0, bytes: other?.bytes ?? 0 }].map((side) => (
                      <div key={side.label} className="mt-2 flex items-center gap-3 text-[12px] text-ink-muted">
                        <span className="w-14 shrink-0">{side.label}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
                          <div className="h-full rounded-full" style={{ width: `${(side.files / total) * 100}%`, background: files === 0 ? 'var(--success)' : 'var(--warning)', transition: 'width 900ms ease, background 400ms' }} />
                        </div>
                        <span className="w-40 shrink-0 text-right tabular-nums">
                          {count.format(side.files)} files · {size(side.bytes)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              );
            })
          ) : (
            <p className="text-sm text-ink-muted">Two file stores are not listed on this server.</p>
          )}
          <p className="text-[12px] text-ink-muted">File counts are read up to five minutes apart, so a small gap right after an upload is normal.</p>
        </div>
      </Panel>

      <p className={`${compact ? 'mt-6' : 'mt-10'} text-xs text-ink-muted`}>This page refreshes itself every few seconds while it is open. A returning node shows how far behind it is; the time left is worked out from the last few readings, so it appears once the gap has started to shrink. The graphs start when you open the page.</p>
    </div>
  );
}
