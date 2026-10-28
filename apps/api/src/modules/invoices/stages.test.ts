import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DEFAULT_STAGES, stageAmounts } from './stages';

const sum = (values: number[]) => Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;

test('the default 50/40/10 sums exactly to the gross, the last stage taking the rounding', () => {
  assert.deepEqual(stageAmounts(1000, DEFAULT_STAGES), [500, 400, 100]);
  // 33.33 x .5 = 16.665 -> 16.67 (half up), 13.332 -> 13.33, remainder 3.33
  const odd = stageAmounts(33.33, DEFAULT_STAGES);
  assert.deepEqual(odd, [16.67, 13.33, 3.33]);
  assert.equal(sum(odd), 33.33);
  // Thirds never leave a penny behind.
  const thirds = stageAmounts(100, [
    { mode: 'percent', value: 33.33 },
    { mode: 'percent', value: 33.33 },
    { mode: 'percent', value: 33.34 },
  ]);
  assert.equal(sum(thirds), 100);
});

test('percent and fixed stages can be mixed when they add up', () => {
  // £300 fixed + 70% of 1000 = 1000
  assert.deepEqual(stageAmounts(1000, [{ mode: 'fixed', value: 300 }, { mode: 'percent', value: 70 }]), [300, 700]);
  assert.deepEqual(stageAmounts(250.5, [{ mode: 'fixed', value: 250.5 }]), [250.5]);
});

test('stages that do not add up to the whole are refused', () => {
  assert.throws(() => stageAmounts(1000, [{ mode: 'percent', value: 50 }, { mode: 'percent', value: 40 }]), /add up/);
  assert.throws(() => stageAmounts(1000, [{ mode: 'fixed', value: 300 }, { mode: 'percent', value: 50 }]), /add up/);
  assert.throws(() => stageAmounts(1000, [{ mode: 'fixed', value: 1200 }]), /add up/);
  assert.throws(() => stageAmounts(0, DEFAULT_STAGES), /above £0/);
  assert.throws(() => stageAmounts(1000, [{ mode: 'percent', value: 120 }]), /100%/);
  assert.deepEqual(stageAmounts(1000, []), []);
});
