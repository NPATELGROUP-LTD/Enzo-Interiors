// npm test — node's own runner through tsx, no framework.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fromCompany, parseOpeningHours } from './opening-hours';

test('opening hours are rebuilt: sorted, trimmed, empty notes dropped, missing days closed', () => {
  const hours = parseOpeningHours({
    weekly: { friday: [{ open: '14:30', close: '17:00' }, { open: '10:00', close: '12:30' }], junk: [1] },
    notes: { friday: '  Lunch 12:30–14:30 ', monday: '   ' },
    note: ' Calls by appointment. ',
    extra: 'ignored',
  });
  assert.deepEqual(hours.weekly.friday, [
    { open: '10:00', close: '12:30' },
    { open: '14:30', close: '17:00' },
  ]);
  assert.deepEqual(hours.weekly.monday, []);
  assert.equal(Object.keys(hours.weekly).length, 7);
  assert.deepEqual(hours.notes, { friday: 'Lunch 12:30–14:30' });
  assert.equal(hours.note, 'Calls by appointment.');
});

test('bad opening hours are refused with a reason', () => {
  const bad = (weekly: unknown, extra: Record<string, unknown> = {}) => () => parseOpeningHours({ weekly, ...extra });
  assert.throws(bad({ monday: [{ open: '17:00', close: '09:00' }] }), /closes before it opens/);
  assert.throws(bad({ monday: [{ open: '9:00', close: '17:00' }] }), /look like 09:30/);
  assert.throws(bad({ monday: [{ open: '09:00', close: '13:00' }, { open: '12:00', close: '17:00' }] }), /overlap/);
  assert.throws(bad({ monday: Array(4).fill({ open: '09:00', close: '10:00' }) }), /up to 3/);
  assert.throws(bad({}, { notes: { monday: 'x'.repeat(121) } }), /too long/);
  assert.throws(() => parseOpeningHours(null), /missing/);
});

test('settings start from the company record, and survive a malformed one', () => {
  const company = { hours: { weekly: { tuesday: [{ open: '10:00', close: '17:00' }] }, note: 'By appointment.' } };
  const hours = fromCompany(company);
  assert.deepEqual(hours.weekly.tuesday, [{ open: '10:00', close: '17:00' }]);
  assert.equal(hours.note, 'By appointment.');
  assert.deepEqual(fromCompany({ hours: { weekly: { monday: 'nonsense' } } }).weekly.monday, []);
  assert.deepEqual(fromCompany(null).weekly.sunday, []);
});
