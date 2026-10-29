// npm test — node's own runner through tsx, no framework.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { categoryOf, parseCategories, resolveCategories } from './categories';

test('categories: the document types until a list is saved', () => {
  assert.deepEqual(resolveCategories(null), ['Contract', 'Invoice', 'Plan', 'MoodBoard', 'Other']);
  assert.deepEqual(resolveCategories([]), ['Contract', 'Invoice', 'Plan', 'MoodBoard', 'Other']);
  assert.deepEqual(resolveCategories(['Survey']), ['Survey']);
  assert.equal(categoryOf({ category: null, type: 'Plan' }), 'Plan');
  assert.equal(categoryOf({ category: 'Survey', type: 'Other' }), 'Survey');
});

test('categories: bad lists are refused with a reason', () => {
  assert.deepEqual(parseCategories([' Survey ', 'Quote']), ['Survey', 'Quote']);
  assert.throws(() => parseCategories([]), /between 1 and 30/);
  assert.throws(() => parseCategories('Survey'), /between 1 and 30/);
  assert.throws(() => parseCategories(Array.from({ length: 31 }, (_, i) => `C${i}`)), /between 1 and 30/);
  assert.throws(() => parseCategories(['  ']), /needs a name/);
  assert.throws(() => parseCategories([5]), /needs a name/);
  assert.throws(() => parseCategories(['x'.repeat(41)]), /too long/);
  assert.throws(() => parseCategories(['Plan', 'plan']), /two categories called/);
});
