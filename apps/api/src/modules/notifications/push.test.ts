import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isPushEndpoint } from './push';

test('only https endpoints on the browsers\' push services are accepted', () => {
  assert.ok(isPushEndpoint('https://fcm.googleapis.com/fcm/send/abc:def'));
  assert.ok(isPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/gAAA'));
  assert.ok(isPushEndpoint('https://web.push.apple.com/QOk5'));
  assert.ok(isPushEndpoint('https://wns2-par02p.notify.windows.com/w/?token=x'));
  assert.ok(!isPushEndpoint('http://fcm.googleapis.com/fcm/send/abc'));
  assert.ok(!isPushEndpoint('https://localhost/fcm'));
  assert.ok(!isPushEndpoint('https://169.254.169.254/latest/meta-data'));
  assert.ok(!isPushEndpoint('https://evilgoogleapis.com/x'));
  assert.ok(!isPushEndpoint('https://fcm.googleapis.com.evil.test/x'));
  assert.ok(!isPushEndpoint('https://fcm.googleapis.com:8443/x'));
  assert.ok(!isPushEndpoint('https://user:pw@fcm.googleapis.com/x'));
  assert.ok(!isPushEndpoint('not a url'));
});
