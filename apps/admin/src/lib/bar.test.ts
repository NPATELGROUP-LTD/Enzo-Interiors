import assert from 'node:assert/strict';
import { test } from 'node:test';

import { barSplit } from './bar.ts';

const pages = ['Dashboard', 'Projects', 'Clients', 'Bookings', 'Enquiries', 'Messages', 'Team', 'Invoices', 'Settings'];

test('a phone shows four pages and More', () => {
  for (const width of [320, 375]) {
    const { shown, more } = barSplit(pages, width);
    assert.deepEqual(shown, ['Dashboard', 'Projects', 'Clients', 'Bookings']);
    assert.equal(more.length, 5);
  }
});

test('a wider screen shows more of them, up to seven and More', () => {
  assert.equal(barSplit(pages, 430).shown.length, 5);
  assert.equal(barSplit(pages, 768).shown.length, 7);
  assert.equal(barSplit(pages, 1000).shown.length, 7);
});

test('no More when everything fits', () => {
  assert.deepEqual(barSplit(pages.slice(0, 5), 375), { shown: pages.slice(0, 5), more: [] });
  assert.deepEqual(barSplit(pages.slice(0, 7), 768).more, []);
});
