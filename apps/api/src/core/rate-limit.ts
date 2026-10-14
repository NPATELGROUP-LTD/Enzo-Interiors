import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';

/**
 * Where rate-limit counters live.
 *
 * With REDIS_URL set they are in Redis, so a limit holds across restarts and
 * across more than one API container — the way large sites do it, and what
 * stops an attacker resetting a lockout by waiting for a deploy. Without it
 * (host dev), they are in memory.
 *
 * Fail-open, on purpose: if Redis stops answering, the counters drop back to
 * this process's memory and the API keeps serving. Limits get looser for a
 * while; the site never goes down because a cache did. Commands fail fast
 * (no offline queue, one retry) so a dead Redis costs milliseconds, not the
 * request.
 */
@Injectable()
export class RateLimitStore implements ThrottlerStorage, OnApplicationShutdown {
  private readonly logger = new Logger(RateLimitStore.name);
  /** Also CacheService's connection: one Redis client per process. */
  readonly redis: Redis | null;
  private readonly remote: ThrottlerStorageRedisService | null;
  private readonly local = new ThrottlerStorageService();
  /** Plain counters (sign-in lockouts) when Redis is not there. */
  private readonly memory = new Map<string, { value: number; expires: number }>();
  private lastWarning = 0;

  constructor() {
    const url = process.env.REDIS_URL?.trim();
    this.redis = url
      ? new Redis(url, { maxRetriesPerRequest: 1, enableOfflineQueue: false, connectTimeout: 2_000 })
      : null;
    this.redis?.on('error', (error: Error) => this.warn(error));
    this.remote = this.redis ? new ThrottlerStorageRedisService(this.redis) : null;
    if (!this.redis) this.logger.warn('REDIS_URL is unset, so rate limits are kept in memory (per process, reset on restart).');
  }

  /** The throttler's own counter, atomic in Redis (a Lua script). */
  async increment(key: string, ttl: number, limit: number, blockDuration: number, name: string) {
    if (this.remote) {
      try {
        return await this.remote.increment(key, ttl, limit, blockDuration, name);
      } catch (error) {
        this.warn(error);
      }
    }
    return this.local.increment(key, ttl, limit, blockDuration, name);
  }

  /** Adds one to `key`, which expires `windowMs` after its first hit. Returns the new count. */
  async hit(key: string, windowMs: number): Promise<number> {
    const k = `rl:${key}`;
    if (this.redis) {
      try {
        const [[, count]] = (await this.redis.multi().incr(k).pexpire(k, windowMs, 'NX').exec()) as [[null, number]];
        return count;
      } catch (error) {
        this.warn(error);
      }
    }
    const now = Date.now();
    const entry = this.memory.get(k);
    const next = entry && entry.expires > now ? { ...entry, value: entry.value + 1 } : { value: 1, expires: now + windowMs };
    this.memory.set(k, next);
    this.sweep(now);
    return next.value;
  }

  /** Sets `key` for `ms`: a lock. */
  async set(key: string, ms: number): Promise<void> {
    const k = `rl:${key}`;
    if (this.redis) {
      try {
        await this.redis.set(k, '1', 'PX', ms);
        return;
      } catch (error) {
        this.warn(error);
      }
    }
    this.memory.set(k, { value: 1, expires: Date.now() + ms });
  }

  /** Milliseconds until `key` expires; 0 if it is not set. */
  async remaining(key: string): Promise<number> {
    const k = `rl:${key}`;
    if (this.redis) {
      try {
        return Math.max(0, await this.redis.pttl(k));
      } catch (error) {
        this.warn(error);
      }
    }
    return Math.max(0, (this.memory.get(k)?.expires ?? 0) - Date.now());
  }

  async clear(...keys: string[]): Promise<void> {
    const list = keys.map((key) => `rl:${key}`);
    for (const k of list) this.memory.delete(k);
    if (!this.redis || !list.length) return;
    try {
      await this.redis.del(...list);
    } catch (error) {
      this.warn(error);
    }
  }

  onApplicationShutdown(): void {
    this.redis?.disconnect(false);
    this.local.onApplicationShutdown();
  }

  private sweep(now: number): void {
    if (this.memory.size < 5_000) return;
    for (const [key, entry] of this.memory) if (entry.expires <= now) this.memory.delete(key);
  }

  /** Once a minute at most, so a Redis outage is one line a minute in the log, not one per request. */
  private warn(error: unknown): void {
    if (Date.now() - this.lastWarning < 60_000) return;
    this.lastWarning = Date.now();
    this.logger.warn(`Redis unavailable, rate limits are in memory for now: ${error instanceof Error ? error.message : String(error)}`);
  }
}
