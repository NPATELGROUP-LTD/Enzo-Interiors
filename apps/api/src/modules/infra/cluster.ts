import * as os from 'node:os';
import { monitorEventLoopDelay } from 'node:perf_hooks';

import { S3Client } from '@aws-sdk/client-s3';
import { Injectable, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import Redis from 'ioredis';

import { CacheService } from '../../core/cache';
import { type BucketUse, countBucket } from './buckets';

/*
 * Settings › Cluster (Infra only, read-only): which API copy is doing what, and how far
 * the second Postgres, Redis and MinIO have caught up. Everything is optional config, so
 * a single-node install answers { enabled: false }:
 *   INSTANCE_NAME      this copy's name (ha-app-1), written as a heartbeat every 15 s
 *   CLUSTER_INSTANCES  the names to look for, comma separated
 *   PATRONI_NODES      mesh addresses of the Patroni REST API (port 8008)
 *   REDIS_NODES        host:port of each Redis (REDIS_PASSWORD)
 *   MINIO_NODES        http://host:9000 of each MinIO (the S3_* service user)
 * Responses carry counts, offsets and "Node 1/2" labels: no address, key or password.
 */
const list = (value: string | undefined): string[] => (value ?? '').split(',').map((item) => item.trim()).filter(Boolean);
const HEARTBEAT_MS = 15_000;
const TIMEOUT_MS = 2_000;
/** A section that has not answered by then is shown as down: one dead node must never hide the rest of the page. */
const SECTION_MS = 4_500;
const MINIO_CACHE_MS = 10_000;

function capped<T>(work: Promise<T>, fallback: T): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), SECTION_MS);
  });
  return Promise.race([work.catch(() => fallback), late]).finally(() => clearTimeout(timer));
}

export interface Heartbeat {
  at: number;
  uptime_seconds: number;
  load_1m: number;
  cpus: number;
  memory_used_bytes: number;
  memory_total_bytes: number;
  process_rss_bytes: number;
  event_loop_p99_ms: number;
}

export interface PatroniMember {
  name: string;
  role: string;
  state: string;
  timeline: number | null;
  lag_bytes: number | null;
}

/** Patroni's GET /cluster. Lag is only given for replicas, and "unknown" is not a number. */
export function parsePatroni(json: unknown): PatroniMember[] {
  const members = (json as { members?: unknown })?.members;
  if (!Array.isArray(members)) return [];
  return members.map((raw) => {
    const m = raw as Record<string, unknown>;
    return {
      name: String(m.name ?? '?'),
      role: String(m.role ?? '?'),
      state: String(m.state ?? '?'),
      timeline: typeof m.timeline === 'number' ? m.timeline : null,
      lag_bytes: typeof m.lag === 'number' ? m.lag : null,
    };
  });
}

/** A Postgres node as the page sees it: Patroni drops a stopped member from /cluster, so `up` also says who is missing. */
export type PgNode = PatroniMember & { up: boolean };

/** Joins Patroni's member list with who actually answered, and adds a row for every listed host that is in neither. */
export function mergePatroni(members: PatroniMember[], answeredNames: Array<string | null>, hosts: number): PgNode[] {
  const names = new Set(answeredNames.filter((name): name is string => !!name));
  const anyNameless = answeredNames.some((name) => name === null);
  const nodes: PgNode[] = members.map((m) => ({ ...m, up: names.has(m.name) || (anyNameless && names.size === 0) }));
  for (let i = nodes.length; i < hosts; i++) nodes.push({ name: `Node ${i + 1}`, role: 'unknown', state: 'not answering', timeline: null, lag_bytes: null, up: false });
  return nodes;
}

export interface RedisRole {
  role: string;
  /** The master's own offset, or the replica's `slave_repl_offset`. */
  offset: number | null;
  link_up: boolean | null;
}

/** INFO replication. */
export function parseRedisInfo(text: string): RedisRole {
  const field = (name: string) => new RegExp(`^${name}:(.*)$`, 'm').exec(text)?.[1]?.trim();
  const role = field('role') ?? '?';
  const raw = role === 'master' ? field('master_repl_offset') : field('slave_repl_offset');
  const link = field('master_link_status');
  return { role, offset: raw !== undefined && Number.isFinite(Number(raw)) ? Number(raw) : null, link_up: link === undefined ? null : link === 'up' };
}

/** How many bytes each replica is behind the master; null when there is no master to compare with. */
export function redisBehind(nodes: RedisRole[]): Array<number | null> {
  const master = nodes.find((node) => node.role === 'master')?.offset ?? null;
  return nodes.map((node) => (node.role === 'master' ? 0 : master !== null && node.offset !== null ? Math.max(0, master - node.offset) : null));
}

@Injectable()
export class ClusterService implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer: NodeJS.Timeout | undefined;
  private readonly loop = monitorEventLoopDelay({ resolution: 20 });

  constructor(private readonly cache: CacheService) {}

  get enabled(): boolean {
    return !!(process.env.CLUSTER_INSTANCES || process.env.PATRONI_NODES || process.env.REDIS_NODES || process.env.MINIO_NODES);
  }

  onApplicationBootstrap(): void {
    const name = process.env.INSTANCE_NAME;
    if (!name || !this.enabled) return;
    this.loop.enable();
    const beat = () => void this.cache.set(`cluster:hb:${name}`, this.heartbeat(), HEARTBEAT_MS * 3).catch(() => undefined);
    beat();
    this.timer = setInterval(beat, HEARTBEAT_MS);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer);
    this.loop.disable();
  }

  private heartbeat(): Heartbeat {
    const p99 = this.loop.percentile(99) / 1e6;
    this.loop.reset();
    return {
      at: Date.now(),
      uptime_seconds: Math.round(process.uptime()),
      load_1m: Math.round((os.loadavg()[0] ?? 0) * 100) / 100,
      cpus: os.cpus().length,
      memory_used_bytes: os.totalmem() - os.freemem(),
      memory_total_bytes: os.totalmem(),
      process_rss_bytes: process.memoryUsage().rss,
      event_loop_p99_ms: Number.isFinite(p99) ? Math.round(p99 * 10) / 10 : 0,
    };
  }

  /** Five seconds old at most; the object-counting part is remembered for ten. */
  status() {
    if (!this.enabled) return Promise.resolve({ enabled: false as const });
    return this.cache.wrap('infra:cluster', 5_000, async () => {
      const nodes = list(process.env.MINIO_NODES).map((_, index) => ({ label: `Node ${index + 1}`, up: false, buckets: [] as BucketUse[] }));
      const [instances, postgres, redis, minio] = await Promise.all([
        this.instances(),
        capped(this.postgres(), { reachable: false, members: [] as PgNode[] }),
        capped(this.redis(), list(process.env.REDIS_NODES).map((_, index) => ({ label: `Node ${index + 1}`, up: false, role: null, link_up: null, bytes_behind: null }))),
        capped(this.minio(), nodes),
      ]);
      return { enabled: true as const, generated_at: new Date().toISOString(), instances, postgres, redis, minio };
    });
  }

  private async instances() {
    const rows = await Promise.all(
      list(process.env.CLUSTER_INSTANCES).map(async (name) => {
        const beat = await this.cache.get<Heartbeat>(`cluster:hb:${name}`);
        return { name, up: !!beat && Date.now() - beat.at < HEARTBEAT_MS * 3, beat: beat ?? null };
      }),
    );
    return rows;
  }

  /** Asks every Patroni who it is, and the first that answers for the whole cluster (lag, roles). */
  private async postgres() {
    const hosts = list(process.env.PATRONI_NODES);
    const asked = await Promise.all(
      hosts.map(async (host) => {
        try {
          // The body is read whatever the status: Patroni answers 503 on a replica.
          const res = await fetch(`http://${host}:8008/patroni`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
          const json = (await res.json()) as { patroni?: { name?: unknown } };
          return { host, answered: true, name: typeof json.patroni?.name === 'string' ? json.patroni.name : null };
        } catch {
          return { host, answered: false, name: null };
        }
      }),
    );
    const live = asked.filter((node) => node.answered);
    for (const node of live) {
      try {
        const res = await fetch(`http://${node.host}:8008/cluster`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (res.ok) return { reachable: true, members: mergePatroni(parsePatroni(await res.json()), live.map((l) => l.name), hosts.length) };
      } catch {
        /* try the next */
      }
    }
    return { reachable: false, members: [] as PgNode[] };
  }

  private async redis() {
    const nodes = list(process.env.REDIS_NODES);
    const infos = await Promise.all(
      nodes.map(async (node) => {
        const [host, port] = node.split(':');
        const client = new Redis({ host, port: Number(port) || 6379, password: process.env.REDIS_PASSWORD, connectTimeout: TIMEOUT_MS, commandTimeout: TIMEOUT_MS, maxRetriesPerRequest: 0, enableOfflineQueue: false, lazyConnect: true, retryStrategy: () => null });
        client.on('error', () => undefined);
        try {
          await client.connect();
          return parseRedisInfo(await client.info('replication'));
        } catch {
          return null;
        } finally {
          client.disconnect();
        }
      }),
    );
    const behind = redisBehind(infos.map((info) => info ?? { role: 'down', offset: null, link_up: null }));
    return infos.map((info, index) => ({ label: `Node ${index + 1}`, up: !!info, role: info?.role ?? null, link_up: info?.link_up ?? null, bytes_behind: info ? behind[index] : null }));
  }

  /** The same bucket counted on each MinIO: a gap between the two is what replication still owes. */
  private minio() {
    return this.cache.wrap('infra:cluster:minio', MINIO_CACHE_MS, async () => {
      const key = process.env.S3_ACCESS_KEY_ID;
      const secret = process.env.S3_SECRET_ACCESS_KEY;
      const nodes = list(process.env.MINIO_NODES);
      if (!key || !secret) return nodes.map((_, index) => ({ label: `Node ${index + 1}`, up: false, buckets: [] as BucketUse[] }));
      return Promise.all(
        nodes.map(async (endpoint, index) => {
          const client = new S3Client({ endpoint, region: process.env.S3_REGION ?? 'us-east-1', credentials: { accessKeyId: key, secretAccessKey: secret }, forcePathStyle: true, maxAttempts: 1 });
          const buckets = await Promise.all([
            countBucket(client, 'public', process.env.S3_PUBLIC_BUCKET ?? 'enzo-public'),
            countBucket(client, 'private', process.env.S3_PRIVATE_BUCKET ?? 'enzo-private'),
          ]);
          client.destroy();
          return { label: `Node ${index + 1}`, up: buckets.some((b) => !b.error), buckets };
        }),
      );
    });
  }
}
