import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { ADMIN, startTestApp } from './app';

/**
 * Settings › Alerts (Infra only) and the two public doors errors come in
 * through: the browsers' (known origins, throttled) and the website's (a shared secret).
 */

let app: Awaited<ReturnType<typeof startTestApp>>;
let prisma: PrismaClient;
const run = randomUUID().slice(0, 8);
const PASSWORD = 'alerts-password-123';
const ORIGIN = 'http://admin.alerts.test';
const SECRET = `secret-${run}-0123456789`;
const staff = (key: string, role: string) => ({ id: `stf_${key}_${run}`, email: `a-${key}-${run}@test.enzo.local`, role, name: `Test ${key} ${run}` });
const INFRA = staff('infra', 'Infra');
const EDITOR = staff('ed', 'Editor');
const tokens = { admin: '', infra: '', editor: '' };

before(async () => {
  process.env.CORS_ORIGINS = `${ORIGIN},http://portal.alerts.test`;
  process.env.ALERT_SHARED_SECRET = SECRET;
  app = await startTestApp();
  prisma = new PrismaClient();
  const password_hash = await bcrypt.hash(PASSWORD, 4);
  for (const row of [INFRA, EDITOR]) await prisma.staffUser.create({ data: { ...row, password_hash } });
  tokens.admin = await signIn(ADMIN.email, ADMIN.password);
  tokens.infra = await signIn(INFRA.email, PASSWORD);
  tokens.editor = await signIn(EDITOR.email, PASSWORD);
});

after(async () => {
  await prisma.alertEvent.deleteMany({ where: { title: { contains: run } } });
  await prisma.alertSettings.deleteMany({});
  await prisma.staffUser.deleteMany({ where: { email: { endsWith: `-${run}@test.enzo.local` } } });
  await prisma.$disconnect();
  await app.close();
});

function call(method: string, path: string, token?: string, body?: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(`${app.url}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function signIn(email: string, password: string): Promise<string> {
  const res = await call('POST', '/auth/admin/login', undefined, { email, password });
  assert.equal(res.status, 200, `sign in as ${email}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

const eventsFor = (needle: string) => prisma.alertEvent.findMany({ where: { title: { contains: needle } } });
const settle = () => new Promise((resolve) => setTimeout(resolve, 300));

test('only an Infra manager reads or changes Settings › Alerts', async () => {
  for (const token of [tokens.admin, tokens.editor, undefined]) {
    assert.ok([401, 403].includes((await call('GET', '/alerts', token)).status));
    assert.ok([401, 403].includes((await call('PUT', '/alerts', token, { recipients: [], errors_on: true })).status));
    assert.ok([401, 403].includes((await call('POST', '/alerts/test', token, { kind: 'error' })).status));
  }
  const before = (await (await call('GET', '/alerts', tokens.infra)).json()) as { recipients: string[]; errors_on: boolean; mail_enabled: boolean };
  assert.deepEqual([before.recipients, before.errors_on, before.mail_enabled], [[], true, false]);

  assert.equal((await call('PUT', '/alerts', tokens.infra, { recipients: ['not-an-address'], errors_on: true })).status, 400);
  const saved = await call('PUT', '/alerts', tokens.infra, { recipients: ['Ops@Example.com', 'ops@example.com', 'two@example.com'], errors_on: false });
  assert.equal(saved.status, 200);
  const body = (await saved.json()) as { recipients: string[]; errors_on: boolean; updated_by: string };
  assert.deepEqual([body.recipients, body.errors_on, body.updated_by], [['ops@example.com', 'two@example.com'], false, INFRA.name]);
  assert.ok(await prisma.activityLog.findFirst({ where: { action: 'alert_settings_update', actor_name: INFRA.name } }), 'and it is in the activity log');
});

test('a test email says plainly that email is not set up here', async () => {
  const res = await call('POST', '/alerts/test', tokens.infra, { kind: 'urgent' });
  assert.equal(res.status, 503);
  assert.equal((await call('POST', '/alerts/test', tokens.infra, { kind: 'nonsense' })).status, 400);
});

test('browser reports: known origins only, small, scrubbed, counted', async () => {
  const report = (origin: string | undefined, body: unknown) => call('POST', '/alerts/browser', undefined, body, origin ? { origin } : {});
  const message = `Cannot read properties of undefined (reading 'name') for jo@example.com ${run}`;

  assert.equal((await report(undefined, { app: 'admin', message })).status, 403, 'no origin');
  assert.equal((await report('http://evil.test', { app: 'admin', message })).status, 403, 'someone else’s page');
  assert.equal((await report(ORIGIN, { app: 'billing', message })).status, 400, 'not one of our apps');
  assert.equal((await report(ORIGIN, { app: 'admin', message: 'x'.repeat(301) })).status, 400, 'too long');
  assert.equal((await report(ORIGIN, { app: 'admin', message, extra: 1 })).status, 400, 'nothing extra');

  assert.equal((await report(ORIGIN, { app: 'admin', message, location: 'index-abc.js:12' })).status, 204);
  assert.equal((await report(ORIGIN, { app: 'admin', message, location: 'index-abc.js:12' })).status, 204);
  await settle();
  const rows = await eventsFor(run);
  assert.equal(rows.length, 1, 'the same fault is one row');
  assert.equal(rows[0]!.count, 2);
  assert.equal(rows[0]!.source, 'admin');
  assert.equal(rows[0]!.location, 'index-abc.js:12');
  assert.ok(!rows[0]!.title.includes('jo@example.com'), 'an address in the message is gone');

  const overview = (await (await call('GET', '/alerts', tokens.infra)).json()) as { recent: Array<{ title: string; count: number }> };
  assert.ok(overview.recent.some((row) => row.title.includes(run) && row.count === 2), 'Settings › Alerts lists it');
});

test('website reports need the shared secret, and are off without one', async () => {
  const send = (secret?: string) =>
    call('POST', '/alerts/web', undefined, { message: `Page render failed ${run}`, route: '/booking' }, secret ? { 'x-alert-secret': secret } : {});
  assert.equal((await send()).status, 403);
  assert.equal((await send('wrong')).status, 403);
  assert.equal((await send(`${SECRET}x`)).status, 403);
  assert.equal((await send(SECRET)).status, 204);
  await settle();
  const [row] = await prisma.alertEvent.findMany({ where: { title: { contains: 'Page render failed' }, source: 'web' } });
  assert.equal(row?.route, '/booking');

  delete process.env.ALERT_SHARED_SECRET;
  assert.equal((await send(SECRET)).status, 404, 'unset = the door does not exist');
  process.env.ALERT_SHARED_SECRET = SECRET;
  await prisma.alertEvent.deleteMany({ where: { title: { contains: 'Page render failed' } } });
});
