// npm test — node's own runner through tsx. The Redis half runs when
// REDIS_URL is set (docker compose up -d redis); the fail-open half always.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { RateLimitStore } from './rate-limit';

async function exercise(store: RateLimitStore, prefix: string) {
  assert.equal(await store.hit(`${prefix}:a`, 5_000), 1);
  assert.equal(await store.hit(`${prefix}:a`, 5_000), 2);
  await store.set(`${prefix}:lock`, 60_000);
  const left = await store.remaining(`${prefix}:lock`);
  assert.ok(left > 55_000 && left <= 60_000, `lock has ${left}ms`);
  await store.clear(`${prefix}:a`, `${prefix}:lock`);
  assert.equal(await store.remaining(`${prefix}:lock`), 0);
  assert.equal(await store.hit(`${prefix}:a`, 5_000), 1);
  const record = await store.increment(`${prefix}:t`, 60_000, 1, 60_000, 'default');
  assert.equal(record.totalHits, 1);
  assert.equal((await store.increment(`${prefix}:t`, 60_000, 1, 60_000, 'default')).isBlocked, true);
  await store.clear(`${prefix}:a`);
}

test('counters, locks and the throttler work in Redis', { skip: !process.env.REDIS_URL }, async () => {
  const store = new RateLimitStore();
  await exercise(store, `test:${Date.now()}`);
  store.onApplicationShutdown();
});

test('with Redis unreachable the same calls fall back to memory instead of failing', async () => {
  const saved = process.env.REDIS_URL;
  process.env.REDIS_URL = 'redis://127.0.0.1:1';
  const store = new RateLimitStore();
  try {
    await exercise(store, 'down');
  } finally {
    store.onApplicationShutdown();
    process.env.REDIS_URL = saved;
  }
});
