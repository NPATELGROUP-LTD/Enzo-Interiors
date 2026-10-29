import assert from 'node:assert/strict';
import { test } from 'node:test';

import { sortRows } from './sortRows.ts';

const rows = [
  { n: 'INV-10', amount: 5, due: null },
  { n: 'inv-9', amount: 120, due: '2026-02-01' },
  { n: 'Éclair', amount: 20, due: '2026-01-01' },
];

test('numbers as numbers, text by natural order without case or accents', () => {
  assert.deepEqual(sortRows(rows, (r) => r.amount, 'asc').map((r) => r.amount), [5, 20, 120]);
  assert.deepEqual(sortRows(rows, (r) => r.amount, 'desc').map((r) => r.amount), [120, 20, 5]);
  assert.deepEqual(sortRows(rows, (r) => r.n, 'asc').map((r) => r.n), ['Éclair', 'inv-9', 'INV-10']);
});

test('empty values are last in both directions, and ties keep their order', () => {
  assert.deepEqual(sortRows(rows, (r) => r.due, 'asc').map((r) => r.n), ['Éclair', 'inv-9', 'INV-10']);
  assert.deepEqual(sortRows(rows, (r) => r.due, 'desc').map((r) => r.n), ['inv-9', 'Éclair', 'INV-10']);
  const tied = [{ k: 1, id: 'a' }, { k: 1, id: 'b' }];
  assert.deepEqual(sortRows(tied, (r) => r.k, 'desc').map((r) => r.id), ['a', 'b']);
});
