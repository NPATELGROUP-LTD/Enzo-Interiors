import assert from 'node:assert/strict';
import { test } from 'node:test';

import { clientCountry } from './client-ip';
import { deviceOf } from './access-log.service';

const UA = {
  chromeWindows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  edgeWindows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  safariIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  firefoxLinux: 'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
  safariMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
};

test('deviceOf names a browser and a system, and nothing finer', () => {
  assert.equal(deviceOf(UA.chromeWindows), 'Chrome · Windows');
  assert.equal(deviceOf(UA.edgeWindows), 'Edge · Windows');
  assert.equal(deviceOf(UA.safariIphone), 'Safari · iOS');
  assert.equal(deviceOf(UA.chromeAndroid), 'Chrome · Android');
  assert.equal(deviceOf(UA.firefoxLinux), 'Firefox · Linux');
  assert.equal(deviceOf(UA.safariMac), 'Safari · macOS');
  assert.equal(deviceOf('curl/8.4.0'), 'Other · Other');
  assert.equal(deviceOf(undefined), null);
});

test('the country is believed only behind Cloudflare, and only when it is a country', () => {
  const was = process.env.TRUST_CLOUDFLARE;
  try {
    process.env.TRUST_CLOUDFLARE = 'false';
    assert.equal(clientCountry({ headers: { 'cf-ipcountry': 'GB' } }), null, 'anyone could send the header');
    process.env.TRUST_CLOUDFLARE = 'true';
    assert.equal(clientCountry({ headers: { 'cf-ipcountry': 'GB' } }), 'GB');
    assert.equal(clientCountry({ headers: { 'cf-ipcountry': 'T1' } }), 'T1', 'Tor is worth seeing');
    assert.equal(clientCountry({ headers: { 'cf-ipcountry': 'XX' } }), null, 'Cloudflare for unknown');
    assert.equal(clientCountry({ headers: { 'cf-ipcountry': 'gb' } }), null);
    assert.equal(clientCountry({ headers: {} }), null);
  } finally {
    if (was === undefined) delete process.env.TRUST_CLOUDFLARE;
    else process.env.TRUST_CLOUDFLARE = was;
  }
});
