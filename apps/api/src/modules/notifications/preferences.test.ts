import assert from 'node:assert/strict';
import { test } from 'node:test';

import { NotificationPreference } from '../../common/types/domain';
import { allowed, choicesOf } from './preferences';

const row = (patch: Partial<NotificationPreference>) => ({ email_enabled: true, sms_enabled: false, in_app_enabled: true, ...patch }) as NotificationPreference;

test('no row, or a row from before per-type choices: everything is on', () => {
  assert.equal(allowed(null, 'invoice', 'email'), true);
  assert.deepEqual(choicesOf(row({})).project, { in_app: true, email: true, push: true });
});

test('the old switches are the default for a type nobody chose for', () => {
  assert.equal(allowed(row({ email_enabled: false }), 'project', 'email'), false);
  assert.equal(allowed(row({ in_app_enabled: false }), 'document', 'in_app'), false);
});

test('an explicit choice for a type beats the old switch, and only that type', () => {
  const prefs = row({ email_enabled: false, categories: { invoice: { email: true }, project: { push: false } } });
  assert.equal(allowed(prefs, 'invoice', 'email'), true);
  assert.equal(allowed(prefs, 'project', 'email'), false);
  assert.equal(allowed(prefs, 'project', 'push'), false);
  assert.equal(allowed(prefs, 'message', 'push'), true);
});
