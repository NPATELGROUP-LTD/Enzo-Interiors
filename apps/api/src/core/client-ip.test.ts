import assert from 'node:assert/strict';
import { test } from 'node:test';

import { clientIp } from './client-ip';

test('CF-Connecting-IP only when TRUST_CLOUDFLARE=true and it is an IP', () => {
  const saved = process.env.TRUST_CLOUDFLARE;
  const req = (cf?: string) => ({ ip: '172.18.0.5', headers: { 'cf-connecting-ip': cf } });
  try {
    delete process.env.TRUST_CLOUDFLARE;
    assert.equal(clientIp(req('203.0.113.7')), '172.18.0.5');
    process.env.TRUST_CLOUDFLARE = 'true';
    assert.equal(clientIp(req('203.0.113.7')), '203.0.113.7');
    assert.equal(clientIp(req('2001:db8::1')), '2001:db8::1');
    assert.equal(clientIp(req('not-an-ip')), '172.18.0.5');
    assert.equal(clientIp(req()), '172.18.0.5');
  } finally {
    if (saved === undefined) delete process.env.TRUST_CLOUDFLARE;
    else process.env.TRUST_CLOUDFLARE = saved;
  }
});
