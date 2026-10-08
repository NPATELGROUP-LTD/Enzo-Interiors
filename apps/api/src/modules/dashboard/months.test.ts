import assert from 'node:assert/strict';
import { test } from 'node:test';

import { lastMonths } from './months';

test('twelve months back across a year boundary, oldest first', () => {
  const months = lastMonths('2026-02', 12);
  assert.equal(months.length, 12);
  assert.equal(months[0]!.month, '2025-03');
  assert.equal(months[0]!.label, 'Mar');
  assert.equal(months[11]!.month, '2026-02');
  assert.ok(months.every((m) => m.value === 0));
});
