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

import {
  blankLike,
  buttonPairs,
  compactColumns,
  describe,
  humanize,
  isSentenceList,
  orderKeys,
  removeAt,
  setIn,
  splitSections,
  summarize,
} from './paths.ts';

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

test('splitSections separates page sections from loose scalars', () => {
  // A page: a couple of scalars, then the named sections.
  assert.deepEqual(
    splitSections({
      id: 'home',
      title: 'Home',
      hero: { heading: 'x' },
      process: [{ step: 'a' }],
    }),
    { scalars: ['id', 'title'], sections: ['hero', 'process'] },
  );
});

test('splitSections follows the page order it is given, unknown sections last', () => {
  // jsonb hands these back by key length then alphabetically, which is the
  // order written here. The editor steps through a page the way a visitor
  // scrolls it, so the guide's order wins, and a section it does not know
  // about still appears rather than vanishing.
  const { sections } = splitSections(
    { hero: {}, work: {}, zeta: {}, process: {}, heroStatic: {}, alpha: {} },
    ['hero', 'heroStatic', 'process', 'work'],
  );
  assert.deepEqual(sections, ['hero', 'heroStatic', 'process', 'work', 'alpha', 'zeta']);
});

test('orderKeys puts the question before the answer and words before structure', () => {
  // Storage order for a FAQ is a, q, id, serviceId: the answer on top.
  const faq = { a: 'Yes.', q: 'Do you?', id: 'x', serviceId: null };
  assert.deepEqual(orderKeys(faq), ['q', 'a', 'id', 'serviceId']);

  const section = {
    items: [{ x: 1 }],
    lede: 'Intro',
    photo: 'img',
    lines: ['A'],
    heading: 'H',
    show: true,
  };
  assert.deepEqual(orderKeys(section, ['photo']), [
    'heading',
    'lines',
    'lede',
    'photo',
    'show',
    'items',
  ]);
});

test('summarize names a list item by its most telling words', () => {
  assert.equal(summarize({ desc: 'We measure', step: 'Consultation' }), 'Consultation');
  assert.equal(summarize({ lead: 'Stop', accent: 'Dreaming' }), 'Stop');
  assert.equal(summarize({ open: '10:00', close: '17:00' }), '10:00');
  assert.equal(summarize({ n: 1 }), '');
  // The heading, not the "01 → 02" eyebrow above it.
  assert.equal(
    summarize({ id: 'a-to-b', eyebrow: '01 → 02', heading: 'From the Anchor' }),
    'From the Anchor',
  );
  // A hero room is named by its caption, never by its id.
  assert.equal(
    summarize({ id: 'mediawall', framesDir: 'mediawall', hold: { heading: 'Every cable' } }),
    'Every cable',
  );
  assert.equal(describe({ heading: 'Every cable', body: 'Screen and storage' }, 'Every cable'), 'Screen and storage');
});

test('buttonPairs finds text-and-link pairs and nothing else', () => {
  assert.deepEqual(buttonPairs(['sub', 'ctaLabel', 'ctaHref', 'label', 'href', 'noteLabel']), [
    ['ctaLabel', 'ctaHref'],
    ['label', 'href'],
  ]);
});

test('isSentenceList only matches lead/accent/tail lines', () => {
  assert.equal(isSentenceList([{ lead: 'Stop', accent: 'Dreaming', tail: '.' }]), true);
  assert.equal(isSentenceList([{ text: 'Stop', accent: true }]), false);
  assert.equal(isSentenceList([]), false);
});

test('compactColumns keeps short flat lists as a table and refuses the rest', () => {
  const all = () => true;
  assert.deepEqual(
    compactColumns([{ label: 'Years', value: '12' }, { label: 'Rooms', value: 340 }], all, all),
    ['label', 'value'],
  );
  // Hidden keys do not count as columns.
  assert.deepEqual(
    compactColumns([{ id: 'x', day: 'Mon', time: '9-5' }], (key) => key !== 'id', all),
    ['day', 'time'],
  );
  // Long words, pictures and nested things each need room of their own.
  assert.equal(compactColumns([{ title: 'x', body: 'y'.repeat(80) }], all, all), null);
  assert.equal(compactColumns([{ title: 'x', imageId: 'p' }], all, (key) => key !== 'imageId'), null);
  assert.equal(compactColumns([{ title: 'x', hold: {} }], all, all), null);
});

test('splitSections treats null as a scalar, not an empty section', () => {
  // null renders as an empty text box. Filing it under sections would put an
  // un-openable pane in the rail for a field that is simply blank.
  assert.deepEqual(splitSections({ serviceId: null, q: 'Why?' }), {
    scalars: ['serviceId', 'q'],
    sections: [],
  });
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
