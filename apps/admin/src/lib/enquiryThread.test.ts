/**
 * Replies in the enquiry thread.
 *
 *     npm test
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { appendIfOpen } from './enquiryThread.ts';

const reply = (id: string, enquiry_id: string) => ({
  id,
  enquiry_id,
  direction: 'out' as const,
  body: 'Hello',
  to_address: 'a@example.com',
  sent_by: null,
  sent_at: '2026-10-28T10:00:00Z',
});

test('adds a reply to the thread of the enquiry it was sent from', () => {
  const before = [reply('m1', 'enq_a')];
  assert.deepEqual(appendIfOpen(before, reply('m2', 'enq_a'), 'enq_a'), [reply('m1', 'enq_a'), reply('m2', 'enq_a')]);
});

test('leaves another enquiry’s thread alone when the reply lands after switching', () => {
  const before = [reply('m1', 'enq_b')];
  assert.equal(appendIfOpen(before, reply('m2', 'enq_a'), 'enq_b'), before);
  assert.equal(appendIfOpen(before, reply('m2', 'enq_a'), null), before);
});
