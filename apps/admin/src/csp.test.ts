/**
 * The Content-Security-Policy nginx serves with the admin and the portal.
 *
 *     npm test
 *
 * Both SPAs keep their bearer token in localStorage, so the policy is what
 * stops an injected script from reading it. The cases below fail if someone
 * allows inline script, drops the websocket origin (Socket.IO would silently
 * lose its transport), adds a location that skips the headers, or puts an
 * inline <script> back in index.html.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (app: string, file: string) =>
  readFileSync(new URL(`../../${app}/${file}`, import.meta.url), 'utf8');

for (const app of ['admin', 'portal']) {
  test(`${app}: script-src is 'self' only, so inline script cannot run`, () => {
    const policy = read(app, 'nginx/security.inc.template');
    assert.equal(/script-src ([^;]*);/.exec(policy)?.[1], "'self'");
    assert.doesNotMatch(policy, /unsafe-eval/);
    assert.doesNotMatch(policy, /default-src[^;]*unsafe-inline/);
  });

  test(`${app}: connect-src carries the API's wss:// origin, derived in default.conf`, () => {
    assert.match(/connect-src ([^;]*);/.exec(read(app, 'nginx/security.inc.template'))?.[1] ?? '', /\$api_ws_origin/);
    assert.match(read(app, 'nginx/default.conf.template'), /map "\$\{API_PUBLIC_URL\}" \$api_ws_origin/);
  });

  test(`${app}: every location includes the security headers`, () => {
    const conf = read(app, 'nginx/default.conf.template');
    const locations = conf.match(/^\s*location /gm)?.length ?? 0;
    assert.ok(locations > 0);
    assert.equal(conf.match(/include \/etc\/nginx\/conf\.d\/security\.inc;/g)?.length, locations);
  });

  test(`${app}: index.html has no inline script`, () => {
    assert.doesNotMatch(read(app, 'index.html'), /<script(?![^>]*\bsrc=)/);
  });
}
