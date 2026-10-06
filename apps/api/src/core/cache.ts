import { Injectable, Logger } from '@nestjs/common';

import { RateLimitStore } from './rate-limit';

const TEN_MINUTES = 10 * 60 * 1000;

/**
 * A small read-through cache for things that are slow or rate-limited to
 * fetch (Google's free/busy, the site bundle) and version counters.
 *
 * Same rules as the rate-limit counters (rate-limit.ts), and the same Redis
 * connection: in Redis when REDIS_URL is set, otherwise in this process's
 * memory; and fail-open, so a Redis outage means misses, never errors. Values
 * are JSON, keys are prefixed `cache:`.
 *
 * Hits and misses are counted and logged at most every ten minutes, so the
 * log shows whether a cache is earning its keep.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly memory = new Map<string, { value: string; expires: number }>();
  /** Misses in progress, so concurrent callers of wrap() share one fetch. */
  private readonly inflight = new Map<string, Promise<unknown>>();
  private hits = 0;
  private misses = 0;
  private lastReport = Date.now();
  private lastWarning = 0;

  constructor(private readonly store: RateLimitStore) {}

  async get<T>(key: string): Promise<T | undefined> {
    const raw = await this.read(`cache:${key}`);
    if (raw === undefined) this.misses++;
    else this.hits++;
    this.report();
    return raw === undefined ? undefined : (JSON.parse(raw) as T);
  }

  async set(key: string, value: unknown, ttlMs: number): Promise<void> {
    const k = `cache:${key}`;
    const raw = JSON.stringify(value);
    const redis = this.store.redis;
    if (redis) {
      try {
        await redis.set(k, raw, 'PX', ttlMs);
        return;
      } catch (error) {
        this.warn(error);
      }
    }
    this.memory.set(k, { value: raw, expires: Date.now() + ttlMs });
    this.sweep();
  }

  async del(key: string): Promise<void> {
    const k = `cache:${key}`;
    this.memory.delete(k);
    try {
      await this.store.redis?.del(k);
    } catch (error) {
      this.warn(error);
    }
  }

  /** The cached value, or fn()'s result cached for ttlMs. Concurrent misses call fn once. */
  async wrap<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) return cached;
    const running = this.inflight.get(key);
    if (running) return running as Promise<T>;
    const promise = (async () => {
      try {
        const value = await fn();
        await this.set(key, value, ttlMs);
        return value;
      } finally {
        this.inflight.delete(key);
      }
    })();
    this.inflight.set(key, promise);
    return promise;
  }

  /** Adds one and returns the new value: a version to put in other keys. Never expires. */
  async incr(key: string): Promise<number> {
    const k = `cache:${key}`;
    const redis = this.store.redis;
    if (redis) {
      try {
        return await redis.incr(k);
      } catch (error) {
        this.warn(error);
      }
    }
    const next = Number(this.memory.get(k)?.value ?? 0) + 1;
    this.memory.set(k, { value: String(next), expires: Infinity });
    return next;
  }

  private async read(k: string): Promise<string | undefined> {
    const redis = this.store.redis;
    if (redis) {
      try {
        return (await redis.get(k)) ?? undefined;
      } catch (error) {
        this.warn(error);
      }
    }
    const entry = this.memory.get(k);
    if (!entry) return undefined;
    if (entry.expires > Date.now()) return entry.value;
    this.memory.delete(k);
    return undefined;
  }

  private sweep(): void {
    if (this.memory.size < 5_000) return;
    const now = Date.now();
    for (const [key, entry] of this.memory) if (entry.expires <= now) this.memory.delete(key);
  }

  private report(): void {
    if (Date.now() - this.lastReport < TEN_MINUTES) return;
    const total = this.hits + this.misses;
    this.logger.log(`Cache: ${this.hits} hits, ${this.misses} misses (${Math.round((this.hits / total) * 100)}% hit) in the last ${Math.round((Date.now() - this.lastReport) / 60_000)} minutes.`);
    this.hits = 0;
    this.misses = 0;
    this.lastReport = Date.now();
  }

  /** Once a minute at most, as in rate-limit.ts. */
  private warn(error: unknown): void {
    if (Date.now() - this.lastWarning < 60_000) return;
    this.lastWarning = Date.now();
    this.logger.warn(`Redis unavailable, caching in memory for now: ${error instanceof Error ? error.message : String(error)}`);
  }
}
