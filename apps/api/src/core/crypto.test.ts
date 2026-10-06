import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';

import { open, seal } from './crypto';

test('seal/open round-trips, and a tampered or keyless value throws', () => {
  const saved = process.env.APP_ENCRYPTION_KEY;
  process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  try {
    const sealed = seal('JBSWY3DPEHPK3PXP');
    assert.match(sealed, /^v1\./);
    assert.equal(open(sealed), 'JBSWY3DPEHPK3PXP');
    assert.notEqual(seal('x'), seal('x'), 'a fresh IV each time');

    const parts = sealed.split('.');
    parts[3] = Buffer.from('JBSWY3DPEHPK3PXQ').toString('base64url');
    assert.throws(() => open(parts.join('.')));

    const short = sealed.split('.');
    short[2] = Buffer.from(short[2]!, 'base64url').subarray(0, 4).toString('base64url');
    assert.throws(() => open(short.join('.')), /Not a sealed value/, 'a truncated tag is refused');

    process.env.APP_ENCRYPTION_KEY = randomBytes(16).toString('base64');
    assert.throws(() => seal('x'), /32 bytes/);
  } finally {
    if (saved === undefined) delete process.env.APP_ENCRYPTION_KEY;
    else process.env.APP_ENCRYPTION_KEY = saved;
  }
});
