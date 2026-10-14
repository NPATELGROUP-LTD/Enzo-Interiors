// npm test — node's own runner through tsx, no framework.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SAFE_LINK } from './cms.module';

test('links the site may render', () => {
  for (const ok of ['https://example.com', 'mailto:a@b.co', 'tel:+441234', '/about', '/', '#top']) {
    assert.ok(SAFE_LINK.test(ok), ok);
  }
});

test('protocol-relative and backslash hosts are refused', () => {
  // Browsers treat "/\host" like "//host", so both would leave the site.
  for (const bad of ['//evil.example', '/\\evil.example', 'javascript:alert(1)', 'data:text/html,x', 'http://example.com']) {
    assert.ok(!SAFE_LINK.test(bad), bad);
  }
});
