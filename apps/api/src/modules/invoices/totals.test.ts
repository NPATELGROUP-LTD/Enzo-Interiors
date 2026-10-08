import assert from 'node:assert/strict';
import { test } from 'node:test';

import { splitGross, sumMoney, totalsOf } from './totals';

test('3 x 33.33 is exactly 99.99, and VAT rounds once on the subtotal', () => {
  assert.deepEqual(totalsOf([{ quantity: 3, unit_price: 33.33 }], 20), { subtotal: 99.99, discount: 0, net: 99.99, vat: 20, gross: 119.99 });
});

test('lines are rounded to the penny before they are added', () => {
  // 0.1 + 0.2 and 1.005 x 1 are where floats go wrong
  assert.equal(totalsOf([{ quantity: 1, unit_price: 0.1 }, { quantity: 1, unit_price: 0.2 }], 0).gross, 0.3);
  assert.equal(totalsOf([{ quantity: 2.5, unit_price: 1.01 }], 0).net, 2.53); // 2.525 rounds up
  assert.equal(sumMoney([0.1, 0.2, 0.3]), 0.6);
});

test('the discount comes off before VAT, and quantity-only rows add nothing', () => {
  // The business's own invoice: £13,970.48 of work, £1,720.48 off, no VAT.
  const lines = [{ quantity: 9, unit_price: 0 }, { quantity: 1, unit_price: 13_970.48 }];
  assert.deepEqual(totalsOf(lines, 0, 1720.48), { subtotal: 13_970.48, discount: 1720.48, net: 12_250, vat: 0, gross: 12_250 });
  assert.deepEqual(totalsOf([{ quantity: 1, unit_price: 100 }], 20, 10), { subtotal: 100, discount: 10, net: 90, vat: 18, gross: 108 });
  assert.ok(totalsOf([{ quantity: 1, unit_price: 5 }], 20, 6).net < 0); // the service refuses this
});

test('a legacy gross amount splits back into net and VAT', () => {
  assert.deepEqual(splitGross(120, 20), { subtotal: 100, discount: 0, net: 100, vat: 20, gross: 120 });
});
