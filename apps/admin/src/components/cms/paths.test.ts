/**
 * The CMS path helpers.
 *
 *     npm test
 *
 * These four functions decide what happens to a live page's content when an
 * editor types in a box or clicks a bin icon, and they are the only logic in
 * the CMS with no server-side counterpart to catch a mistake. The cases below
 * are the ones that would go wrong quietly: editing inside a list, removing
 * the middle of a list, and mutating the caller's object by accident.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { blankLike, humanize, removeAt, setIn } from './paths.ts';

test('setIn writes deep into nested objects and lists', () => {
  const body = { hero: { title: 'Old', rooms: [{ label: 'A' }, { label: 'B' }] } };

  assert.deepEqual(setIn(body, ['hero', 'title'], 'New'), {
    hero: { title: 'New', rooms: [{ label: 'A' }, { label: 'B' }] },
  });

  assert.deepEqual(setIn(body, ['hero', 'rooms', 1, 'label'], 'Z'), {
    hero: { title: 'Old', rooms: [{ label: 'A' }, { label: 'Z' }] },
  });
});

test('setIn never mutates the value it was given', () => {
  // The editor keeps the previous draft to compare against for the "unsaved
  // changes" badge, so a mutation here would make every edit look saved.
  const body = { hero: { rooms: [{ label: 'A' }] } };
  const next = setIn(body, ['hero', 'rooms', 0, 'label'], 'B');

  assert.equal(body.hero.rooms[0]?.label, 'A');
  assert.notEqual(next, body);
});

test('setIn keeps arrays as arrays', () => {
  const next = setIn({ features: ['one', 'two'] }, ['features', 1], 'TWO') as {
    features: string[];
  };
  assert.ok(Array.isArray(next.features));
  assert.deepEqual(next.features, ['one', 'TWO']);
});

test('removeAt drops the right list item, not the last one', () => {
  const body = { process: [{ step: 'A' }, { step: 'B' }, { step: 'C' }] };

  assert.deepEqual(removeAt(body, ['process', 1]), {
    process: [{ step: 'A' }, { step: 'C' }],
  });
  assert.deepEqual(removeAt(body, ['process', 0]), {
    process: [{ step: 'B' }, { step: 'C' }],
  });
  // And leaves the original alone.
  assert.equal(body.process.length, 3);
});

test('removeAt drops a nested list item', () => {
  const body = { hero: { rooms: [{ id: 'a' }, { id: 'b' }] } };
  assert.deepEqual(removeAt(body, ['hero', 'rooms', 0]), { hero: { rooms: [{ id: 'b' }] } });
});

test('blankLike keeps the shape and empties the values', () => {
  assert.deepEqual(
    blankLike({ tier: 'Core', from: 4500, features: ['a', 'b'], nested: { desc: 'x' } }),
    { tier: '', from: 0, features: [], nested: { desc: '' } },
  );
});

test('humanize turns content keys into labels an editor can read', () => {
  assert.equal(humanize('navSummary'), 'Nav summary');
  assert.equal(humanize('hero_desc'), 'Hero desc');
  // The trailing identifier is dropped: the editor picks from a list and
  // never types an id, so "Image id" would just be noise.
  assert.equal(humanize('imageId'), 'Image');
  assert.equal(humanize('galleryIds'), 'Gallery');
  assert.equal(humanize('serviceId'), 'Service');
  assert.equal(humanize('seoTitle'), 'SEO title');
});
