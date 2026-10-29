// npm test — node's own runner through tsx, no framework.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addMissing, addProductionStage, deletedKeys, isNotFound, untouched } from './import-content';

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

test('deleted entries are keyed by collection and slug; malformed logs are skipped', () => {
  const keys = deletedKeys([
    { details: { collection: 'faqs', slug: 'parking' } },
    { details: { collection: 'faqs' } },
    { details: { slug: 'orphan' } },
    { details: null },
  ]);
  assert.deepEqual([...keys], ['faqs/parking']);
});

test('only a 404 from HeadObject means the image is missing', () => {
  assert.equal(isNotFound({ name: 'NotFound', $metadata: { httpStatusCode: 404 } }), true);
  assert.equal(isNotFound({ name: 'UnknownError', $metadata: { httpStatusCode: 404 } }), true);
  assert.equal(isNotFound({ name: 'Forbidden', $metadata: { httpStatusCode: 403 } }), false);
  assert.equal(isNotFound({ name: 'TimeoutError' }), false);
  assert.equal(isNotFound(null), false);
});

test('an edited home page gains the Production stage once, before Fitting', () => {
  const stage = (title: string) => ({ title, datum: '', body: '' });
  const shipped = { process: { stages: ['Consultation', 'Making', 'Production', 'Fitting', 'Handover'].map(stage) } };
  const edited = { process: { heading: 'Mine', stages: ['Consultation', 'Making', 'Fitting', 'Handover'].map(stage) } };
  const added = addProductionStage(edited, shipped) as { process: { heading: string; stages: Array<{ title: string }> } };
  assert.deepEqual(added.process.stages.map((s) => s.title), ['Consultation', 'Making', 'Production', 'Fitting', 'Handover']);
  assert.equal(added.process.heading, 'Mine', 'the rest of their edit is kept');
  assert.equal(addProductionStage(added, shipped), null, 'nothing to add the second time');
});
