// npm test. The in-memory path (no REDIS_URL); Redis serves the same calls.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CacheService } from './cache';
import { RateLimitStore } from './rate-limit';

test('wrap fetches once for concurrent misses, values expire, incr counts', async () => {
  const saved = process.env.REDIS_URL;
  delete process.env.REDIS_URL;
  const store = new RateLimitStore();
  const cache = new CacheService(store);
  try {
    let calls = 0;
    const fetch = async () => {
      calls++;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { busy: ['10:00'] };
    };
    const results = await Promise.all([cache.wrap('k', 50, fetch), cache.wrap('k', 50, fetch), cache.wrap('k', 50, fetch)]);
    assert.equal(calls, 1);
    assert.deepEqual(results[2], { busy: ['10:00'] });
    assert.deepEqual(await cache.get('k'), { busy: ['10:00'] });

    await new Promise((resolve) => setTimeout(resolve, 60));
    assert.equal(await cache.get('k'), undefined);
    await cache.wrap('k', 50, fetch);
    assert.equal(calls, 2);

    assert.equal(await cache.incr('v'), 1);
    assert.equal(await cache.incr('v'), 2);
  } finally {
    store.onApplicationShutdown();
    if (saved !== undefined) process.env.REDIS_URL = saved;
  }
});
