import assert from 'node:assert/strict';
import { test } from 'node:test';

import { splitGross, sumMoney, totalsOf } from './totals';

test('3 x 33.33 is exactly 99.99, and VAT rounds once on the subtotal', () => {
  assert.deepEqual(totalsOf([{ quantity: 3, unit_price: 33.33 }], 20), { net: 99.99, vat: 20, gross: 119.99 });
});

test('lines are rounded to the penny before they are added', () => {
  // 0.1 + 0.2 and 1.005 x 1 are where floats go wrong
  assert.equal(totalsOf([{ quantity: 1, unit_price: 0.1 }, { quantity: 1, unit_price: 0.2 }], 0).gross, 0.3);
  assert.equal(totalsOf([{ quantity: 2.5, unit_price: 1.01 }], 0).net, 2.53); // 2.525 rounds up
  assert.equal(sumMoney([0.1, 0.2, 0.3]), 0.6);
});

test('a legacy gross amount splits back into net and VAT', () => {
  assert.deepEqual(splitGross(120, 20), { net: 100, vat: 20, gross: 120 });
});
