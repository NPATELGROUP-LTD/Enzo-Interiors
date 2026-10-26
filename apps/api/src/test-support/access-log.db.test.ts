import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { ADMIN, startTestApp } from './app';

/**
 * The access log (Infra only): who signed in and what changed or was refused,
 * from where; the redacted activity log; and the security alerts that come out
 * of both.
 */

let app: Awaited<ReturnType<typeof startTestApp>>;
let prisma: PrismaClient;
const run = randomUUID().slice(0, 8);
const PASSWORD = 'access-log-password-123';
const staff = (key: string, role: string) => ({ id: `stf_${key}_${run}`, email: `a-${key}-${run}@test.enzo.local`, role, name: `Test ${key} ${run}` });
const INFRA = staff('infra', 'Infra');
const EDITOR = staff('ed', 'Editor');
const TRAVELLER = staff('trav', 'Editor');
const tokens = { admin: '', infra: '', editor: '' };
const CHROME_WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const SAFARI_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

before(async () => {
  process.env.TRUST_CLOUDFLARE = 'true'; // so cf-ipcountry is believed
  app = await startTestApp();
  prisma = new PrismaClient();
  const password_hash = await bcrypt.hash(PASSWORD, 4);
  for (const row of [INFRA, EDITOR, TRAVELLER]) await prisma.staffUser.create({ data: { ...row, password_hash } });
  tokens.admin = await signIn(ADMIN.email, ADMIN.password);
  tokens.infra = await signIn(INFRA.email, PASSWORD);
  tokens.editor = await signIn(EDITOR.email, PASSWORD);
});

after(async () => {
  await prisma.accessEvent.deleteMany({ where: { OR: [{ actor_name: { contains: run } }, { actor_id: { endsWith: run } }] } });
  await prisma.alertEvent.deleteMany({ where: { title: { contains: run } } });
  await prisma.alertSettings.deleteMany({}); // the change test saved recipients
  await prisma.activityLog.deleteMany({ where: { id: { endsWith: run } } });
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

async function signIn(email: string, password: string, headers: Record<string, string> = {}): Promise<string> {
  const res = await call('POST', '/auth/admin/login', undefined, { email, password }, headers);
  assert.equal(res.status, 200, `sign in as ${email}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

/** Rows are written after the response is sent. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 400));
const log = async (filter = 'all', q = '') => {
  const res = await call('GET', `/access-log?filter=${filter}${q ? `&q=${encodeURIComponent(q)}` : ''}`, tokens.infra);
  assert.equal(res.status, 200);
  return ((await res.json()) as { events: Array<Record<string, unknown>>; next: string | null }).events;
};
const alertsAbout = (needle: string) => prisma.alertEvent.findMany({ where: { kind: 'security', title: { contains: needle } } });

test('only an Infra manager reads the access log', async () => {
  for (const token of [tokens.admin, tokens.editor, undefined]) {
    assert.ok([401, 403].includes((await call('GET', '/access-log', token)).status));
  }
  assert.equal((await call('GET', '/access-log', tokens.infra)).status, 200);
  assert.equal((await call('GET', '/access-log?filter=nope', tokens.infra)).status, 400);
});

test('a sign-in is logged with who, where and on what; a failed one keeps only the masked address', async () => {
  await signIn(TRAVELLER.email, PASSWORD, { 'user-agent': CHROME_WINDOWS, 'cf-ipcountry': 'GB' });
  const bad = await call('POST', '/auth/admin/login', undefined, { email: TRAVELLER.email, password: 'not-the-password' });
  assert.equal(bad.status, 401);
  await settle();

  const [ok] = (await log('signins', TRAVELLER.name)) as Array<Record<string, string>>;
  assert.equal(ok?.actor_id, TRAVELLER.id);
  assert.equal(ok?.actor_role, 'Editor');
  assert.equal(ok?.device, 'Chrome · Windows');
  assert.equal(ok?.country, 'GB');
  assert.equal(ok?.status, 200);

  const failed = (await log('failures')).find((row) => row.route === '/auth/admin/login' && row.status === 401);
  assert.ok(failed, 'the failed sign-in is there');
  assert.match(String(failed.actor_name), /^a\*\*\*@test\.enzo\.local$/);
  assert.ok(!JSON.stringify(await log('failures')).includes('not-the-password'), 'no password is kept');
  assert.ok(!JSON.stringify(await log('failures')).includes(TRAVELLER.email), 'the full address is not kept');
});

test('a sign-in from a new country or device raises a security alert; the first one does not', async () => {
  assert.equal((await alertsAbout(TRAVELLER.name)).length, 0, 'their first sign-in had nothing to compare with');

  await signIn(TRAVELLER.email, PASSWORD, { 'user-agent': CHROME_WINDOWS, 'cf-ipcountry': 'GB' });
  await settle();
  assert.equal((await alertsAbout(TRAVELLER.name)).length, 0, 'the same country and device is not news');

  await signIn(TRAVELLER.email, PASSWORD, { 'user-agent': CHROME_WINDOWS, 'cf-ipcountry': 'DE' });
  await signIn(TRAVELLER.email, PASSWORD, { 'user-agent': SAFARI_IPHONE, 'cf-ipcountry': 'GB' });
  await settle();
  const titles = (await alertsAbout(TRAVELLER.name)).map((row) => row.title);
  assert.ok(titles.some((title) => title.includes('a new country (DE)')), titles.join(' | '));
  assert.ok(titles.some((title) => title.includes('a new device')), titles.join(' | '));
});

test('changes, refusals and downloads are logged; a plain read and the heartbeat are not', async () => {
  const put = await call('PUT', '/alerts', tokens.infra, { recipients: [`keep-${run}@test.enzo.local`], errors_on: true });
  assert.equal(put.status, 200);
  assert.equal((await call('GET', '/alerts', tokens.editor)).status, 403);
  await call('GET', '/auth/me', tokens.admin);
  await call('GET', '/notifications', tokens.admin);
  await settle();

  const events = await log('all', INFRA.name);
  const change = events.find((row) => row.method === 'PUT' && row.route === '/alerts');
  assert.ok(change, 'the change is there');
  assert.equal(change.actor_id, INFRA.id);
  assert.equal(change.status, 200);

  const refused = (await log('failures', EDITOR.name)).find((row) => row.route === '/alerts');
  assert.equal(refused?.status, 403);

  const all = await log();
  assert.ok(!all.some((row) => row.route === '/auth/me' || String(row.route).startsWith('/notifications')), 'reads and heartbeats stay out');
  assert.ok(all.some((row) => row.method === 'GET' && row.route === '/access-log'), 'looking at the log is logged');
});

test('an account change emails a security alert that names who did it, not who it was done to', async () => {
  const invitee = `invitee-${run}@test.enzo.local`;
  const res = await call('POST', '/users', tokens.infra, { name: `Invitee ${run}`, email: invitee, role: 'Editor' });
  assert.equal(res.status, 201);
  await settle();
  const [alert] = await alertsAbout(`invited by ${INFRA.name}`);
  assert.ok(alert, 'an alert was raised');
  assert.ok(alert?.title.includes(INFRA.name));
  assert.ok(!alert?.title.includes(invitee) && !alert?.title.includes('Invitee'));
  await prisma.staffUser.deleteMany({ where: { email: invitee } });
});

test('the Infra manager reads the activity log without the business details', async () => {
  const at = new Date().toISOString();
  const base = { actor_type: 'Staff', staff_id: `stf_x_${run}`, actor_name: 'Someone', action: 'seed', target_id: 'x', created_at: at };
  await prisma.activityLog.createMany({
    data: [
      { ...base, id: `act_client_${run}`, target_table: 'clients', details: { name: 'Secret Client', email: 'secret@client.test' } },
      { ...base, id: `act_staff_${run}`, target_table: 'staff_users', details: { name: 'Staff Member' } },
    ],
  });
  const rows = async (token: string) =>
    ((await (await call('GET', '/activity-logs?limit=500', token)).json()) as Array<{ id: string; details: Record<string, unknown> | null }>);

  const asInfra = await rows(tokens.infra);
  assert.equal(asInfra.find((row) => row.id === `act_client_${run}`)?.details, null, 'no client details');
  assert.deepEqual(asInfra.find((row) => row.id === `act_staff_${run}`)?.details, { name: 'Staff Member' }, 'the platform’s own rows keep theirs');

  const asAdmin = await rows(tokens.admin);
  assert.equal(asAdmin.find((row) => row.id === `act_client_${run}`)?.details?.name, 'Secret Client');
  assert.equal((await call('GET', '/activity-logs', tokens.editor)).status, 403);
});

// Last: it spends this address's sign-in allowance.
test('being stopped at sign-in is logged and raises a security alert', async () => {
  const email = `locked-${run}@test.enzo.local`;
  let stopped = false;
  for (let attempt = 0; attempt < 14 && !stopped; attempt++) {
    stopped = (await call('POST', '/auth/admin/login', undefined, { email, password: 'wrong-password-1' })).status === 429;
  }
  assert.ok(stopped, 'the lockout or the rate limit stops it');
  await settle();
  assert.ok((await log('failures')).some((row) => row.status === 429 && row.route === '/auth/admin/login'));
  assert.ok((await prisma.alertEvent.findMany({ where: { kind: 'security', title: { contains: 'Too many sign-in attempts' } } })).length >= 1);
  await prisma.alertEvent.deleteMany({ where: { title: { contains: 'Too many sign-in attempts' } } });
  await prisma.accessEvent.deleteMany({ where: { actor_name: { endsWith: '@test.enzo.local' }, status: { in: [401, 429] } } });
});
