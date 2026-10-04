// npm test — node's own runner through tsx, no framework.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addMissing, untouched } from './import-content';

const body = { title: 'Kitchens', hero: { image: 'pf-1', alt: 'x' } };
const entry = (patch: Record<string, unknown> = {}) => ({
  updated_by: 'content import',
  review_at: null,
  draft: body,
  // As JSONB hands it back: same content, keys reordered.
  published: { hero: { alt: 'x', image: 'pf-1' }, title: 'Kitchens' },
  ...patch,
});

test('only entries no person has touched follow the shipped copy', () => {
  assert.equal(untouched(entry()), true);
  assert.equal(untouched(entry({ updated_by: 'Neel Patel' })), false, 'saved, published or reverted by someone');
  assert.equal(untouched(entry({ draft: { ...body, title: 'Changed' } })), false, 'unpublished edits');
  assert.equal(untouched(entry({ review_at: '2026-10-01T10:00:00.000Z' })), false, 'waiting on review');
  assert.equal(untouched(entry({ published: null })), false, 'never published');
});

test('edited entries only gain keys they lack', () => {
  assert.deepEqual(addMissing({ a: '', b: { c: 1 } }, { a: 'new', b: { c: 2, d: 3 }, e: 4 }), { a: '', b: { c: 1, d: 3 }, e: 4 });
  assert.equal(addMissing({ a: 1 }, { a: 2 }), null);
});
