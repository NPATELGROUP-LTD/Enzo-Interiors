// npm test — node's own runner through tsx, no framework.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parsePages, resolvePages } from './pages';

test('page switches: saved values over the defaults, junk dropped', () => {
  assert.deepEqual(resolvePages(null), {
    about: false, services: false, portfolio: false, booking: false,
    contact: true, privacy: true, terms: true, cookies: true, quote: false,
  });
  const pages = resolvePages({ about: true, contact: false, booking: 'yes', home: false });
  assert.equal(pages.about, true);
  assert.equal(pages.contact, false);
  assert.equal(pages.booking, false);
  assert.equal('home' in pages, false);
});

test('bad page switches are refused with a reason', () => {
  assert.deepEqual(parsePages({ about: true, terms: false }), { about: true, terms: false });
  assert.deepEqual(parsePages({}), {});
  assert.throws(() => parsePages({ home: false }), /no "home" page/);
  assert.throws(() => parsePages({ about: 'true' }), /on or off/);
  assert.throws(() => parsePages([true]), /list of switches/);
  assert.throws(() => parsePages(null), /list of switches/);
});
