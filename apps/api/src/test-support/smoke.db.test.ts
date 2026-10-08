import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { ADMIN, startTestApp } from './app';

let app: Awaited<ReturnType<typeof startTestApp>>;
before(async () => {
  app = await startTestApp();
});
after(() => app.close());

const post = (path: string, body: unknown) =>
  fetch(`${app.url}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

test('GET /health is 200 and reaches the database', async () => {
  const res = await fetch(`${app.url}/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok' });
});

test('guarded routes without a token are 401', async () => {
  assert.equal((await fetch(`${app.url}/users`)).status, 401);
  assert.equal((await fetch(`${app.url}/appointments`)).status, 401);
});

test('admin signs in and the token opens a guarded route', async () => {
  const login = await post('/auth/admin/login', ADMIN);
  assert.equal(login.status, 200);
  const body = (await login.json()) as { access_token?: string };
  assert.ok(body.access_token, 'a token is issued when 2FA is disabled');

  const users = await fetch(`${app.url}/users`, { headers: { authorization: `Bearer ${body.access_token}` } });
  assert.equal(users.status, 200);
});

test('a wrong password is 401', async () => {
  assert.equal((await post('/auth/admin/login', { email: ADMIN.email, password: 'definitely-not-it' })).status, 401);
});
