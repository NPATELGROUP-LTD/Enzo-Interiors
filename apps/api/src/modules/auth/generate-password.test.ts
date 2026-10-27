// npm test — node's own runner through tsx, no framework.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { generatePassword } from './auth.service';

test('generated passwords: 14 readable characters, one of each kind, never repeated', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const password = generatePassword();
    assert.match(password, /^[A-Za-z2-9]{14}$/);
    assert.doesNotMatch(password, /[0O1lI]/, 'no look-alikes');
    assert.match(password, /[a-z]/);
    assert.match(password, /[A-Z]/);
    assert.match(password, /[2-9]/);
    seen.add(password);
  }
  assert.equal(seen.size, 200);
});
