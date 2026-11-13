// npm test — node's own runner through tsx, no framework.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DEFAULT_CONFIG, availability, daySlots, studioInstant, studioParts, withDefaults } from './slots';

test('a config saved before a field rule existed gets that rule by default, and keeps the ones it chose', () => {
  const { fields } = withDefaults({ fields: { phone: 'off' } } as never);
  assert.deepEqual(fields, { phone: 'off', address: 'required', postcode: 'required', notes: 'optional' });
  assert.deepEqual(withDefaults({}).fields, DEFAULT_CONFIG.fields);
});

test('a day runs from first to last, one every slot + gap, and jumps breaks', () => {
  const day = { open: true, first: '10:00', last: '15:30', breaks: [{ start: '12:30', end: '14:30' }] };
  assert.deepEqual(daySlots(day, 60, 30), ['10:00', '11:30', '14:30']);
  assert.deepEqual(daySlots({ ...day, breaks: [] }, 60, 0), ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00']);
  assert.deepEqual(daySlots({ ...day, open: false }, 60, 0), []);
});

test('studio time survives the clocks changing', () => {
  // Winter (GMT) and summer (BST) both mean 10:00 in Leicester.
  assert.equal(studioInstant('2026-01-15', '10:00').toISOString(), '2026-01-15T10:00:00.000Z');
  assert.equal(studioInstant('2026-07-15', '10:00').toISOString(), '2026-07-15T09:00:00.000Z');
  // The Sunday the clocks go back (25 Oct 2026) and forward (29 Mar 2026).
  assert.equal(studioInstant('2026-10-25', '10:00').toISOString(), '2026-10-25T10:00:00.000Z');
  assert.equal(studioInstant('2026-03-29', '10:00').toISOString(), '2026-03-29T09:00:00.000Z');
  assert.deepEqual(studioParts(new Date('2026-07-15T09:00:00Z')), { date: '2026-07-15', time: '10:00' });
});

test('taken, too-soon, too-far and full days are not offered', () => {
  const config = { ...DEFAULT_CONFIG, maxPerDay: 2, noticeHours: 24, horizonDays: 14 };
  const now = new Date('2026-10-05T09:00:00Z'); // Monday 10:00 BST
  const taken = [{ starts_at: '2026-10-07T09:00:00.000Z', ends_at: '2026-10-07T10:00:00.000Z' }]; // Wed 10:00

  const days = availability(config, '2026-10-01', '2026-10-31', taken, now);
  assert.equal(days['2026-10-05'], undefined, 'today is inside the notice period');
  assert.equal(days['2026-10-06']?.[0], '10:00', 'tomorrow 10:00 is exactly 24h away');
  assert.deepEqual(days['2026-10-07'], ['11:30', '13:00', '14:30'], 'the taken 10:00 is gone');
  assert.equal(days['2026-10-12'], undefined, 'Mondays are closed');
  assert.equal(days['2026-10-20'], undefined, 'past the 14-day horizon');

  const full = [...taken, { starts_at: '2026-10-07T13:00:00.000Z', ends_at: '2026-10-07T14:00:00.000Z' }];
  assert.equal(availability(config, '2026-10-07', '2026-10-07', full, now)['2026-10-07'], undefined, 'day limit reached');

  // Staff skip the notice period and the horizon, never a taken time.
  const staff = availability(config, '2026-10-05', '2026-10-31', taken, now, true);
  assert.deepEqual(staff['2026-10-05'], undefined, 'Monday is still closed');
  assert.ok(staff['2026-10-06']?.includes('10:00'));
  assert.ok(staff['2026-10-27']);
  assert.ok(!staff['2026-10-07']?.includes('10:00'));
});

test('calendar busy time blocks a slot but does not count toward the day limit', () => {
  const config = { ...DEFAULT_CONFIG, maxPerDay: 1, noticeHours: 0 };
  const now = new Date('2026-10-05T09:00:00Z');
  // Wed 7 Oct: busy 10:30-11:30 BST overlaps the 10:00 slot (to 11:00) and the 11:30 one does not start until 11:30.
  const busy = [{ starts_at: '2026-10-07T09:30:00.000Z', ends_at: '2026-10-07T10:30:00.000Z' }];
  const days = availability(config, '2026-10-07', '2026-10-07', [], now, false, busy);
  assert.ok(days['2026-10-07'], 'busy time alone does not use up maxPerDay');
  assert.ok(!days['2026-10-07']?.includes('10:00'), 'overlapping slot is gone');
  assert.ok(days['2026-10-07']?.includes('11:30'), 'a slot after the busy time is still offered');
  assert.deepEqual(availability(config, '2026-10-07', '2026-10-07', [], now)['2026-10-07']?.[0], '10:00', 'no busy, no change');
});
