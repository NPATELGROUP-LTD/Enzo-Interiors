import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';

import { base32Decode, base32Encode, totp, totpStep } from './totp';

test('totp matches the RFC 6238 Appendix B SHA1 vectors', () => {
  const secret = Buffer.from('12345678901234567890', 'ascii');
  const vectors: Array<[number, string]> = [
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
  ];
  for (const [seconds, code] of vectors) {
    const step = totpStep(seconds * 1000);
    assert.equal(totp(secret, step, 8), code, `8 digits at ${seconds}`);
    assert.equal(totp(secret, step), code.slice(-6), `6 digits at ${seconds}`);
  }
});

test('base32 round-trips and reads what people paste', () => {
  // RFC 4648 section 10.
  assert.equal(base32Encode(Buffer.from('foobar')), 'MZXW6YTBOI');
  assert.equal(base32Decode('mzxw 6ytb-oi======').toString(), 'foobar');
  for (const length of [1, 5, 10, 20, 33]) {
    const bytes = randomBytes(length);
    assert.deepEqual(base32Decode(base32Encode(bytes)), bytes);
  }
  assert.throws(() => base32Decode('MZXW1'), /base32/);
});
