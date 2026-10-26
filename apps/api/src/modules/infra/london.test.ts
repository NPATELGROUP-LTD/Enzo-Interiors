import assert from 'node:assert/strict';
import { test } from 'node:test';

import { londonNow } from './london';

test('London time follows summer time, so 08:00 is not always 08:00 UTC', () => {
  assert.deepEqual(londonNow(new Date('2026-07-01T07:30:00Z')), { day: '2026-07-01', hour: 8 });
  assert.deepEqual(londonNow(new Date('2026-12-01T07:30:00Z')), { day: '2026-12-01', hour: 7 });
});

test('late evening UTC in summer is already tomorrow in London', () => {
  assert.deepEqual(londonNow(new Date('2026-07-01T23:30:00Z')), { day: '2026-07-02', hour: 0 });
});
