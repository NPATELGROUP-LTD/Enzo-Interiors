import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { AlertService } from '../core/alert.service';
import { DatabaseService } from '../data/database.service';
import { InfraService, InfraWatch } from '../modules/infra/infra.module';
import { ADMIN, startTestApp } from './app';

/**
 * The Infra page's numbers (Infra only), the attack alerts and the daily
 * summary's once-a-day rule.
 */

let app: Awaited<ReturnType<typeof startTestApp>>;
let prisma: PrismaClient;
const run = randomUUID().slice(0, 8);
const PASSWORD = 'monitoring-password-123';
const staff = (key: string, role: string) => ({ id: `stf_${key}_${run}`, email: `m-${key}-${run}@test.enzo.local`, role, name: `Test ${key} ${run}` });
const INFRA = staff('infra', 'Infra');
const EDITOR = staff('ed', 'Editor');
const tokens = { admin: '', infra: '', editor: '' };
const octet = Number.parseInt(run.slice(0, 2), 16) % 200;
const BUSY = `198.51.100.${octet}`;
const QUIET = `198.51.100.${octet + 1}`;
const ROUTE = `/test-${run}/boom`;

const access = (ip: string, status: number, route: string) => ({
  id: randomUUID(),
  kind: 'request',
  actor_name: `masked-${run}`,
  method: 'POST',
  route,
  status,
  ip,
});

before(async () => {
  app = await startTestApp();
  prisma = new PrismaClient();
  const password_hash = await bcrypt.hash(PASSWORD, 4);
  for (const row of [INFRA, EDITOR]) await prisma.staffUser.create({ data: { ...row, password_hash } });
  tokens.admin = await signIn(ADMIN.email, ADMIN.password);
  tokens.infra = await signIn(INFRA.email, PASSWORD);
  tokens.editor = await signIn(EDITOR.email, PASSWORD);
  await prisma.accessEvent.createMany({
    data: [
      ...Array.from({ length: 3 }, () => access(QUIET, 500, ROUTE)),
      ...Array.from({ length: 10 }, () => access(BUSY, 401, '/auth/admin/login')),
      ...Array.from({ length: 9 }, () => access(QUIET, 401, '/auth/admin/login')),
    ],
  });
});

after(async () => {
  await prisma.accessEvent.deleteMany({ where: { actor_name: `masked-${run}` } });
  await prisma.alertEvent.deleteMany({ where: { OR: [{ title: { contains: BUSY } }, { title: { contains: QUIET } }] } });
  await prisma.alertSettings.deleteMany({});
  await prisma.staffUser.deleteMany({ where: { email: { endsWith: `-${run}@test.enzo.local` } } });
  await prisma.$disconnect();
  await app.close();
});

function call(method: string, path: string, token?: string, body?: unknown): Promise<Response> {
  return fetch(`${app.url}${path}`, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function signIn(email: string, password: string): Promise<string> {
  const res = await call('POST', '/auth/admin/login', undefined, { email, password });
  assert.equal(res.status, 200, `sign in as ${email}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 300));

test('only an Infra manager reads the platform numbers or sends the summary', async () => {
  for (const token of [tokens.admin, tokens.editor, undefined]) {
    assert.ok([401, 403].includes((await call('GET', '/infra/stats', token)).status));
    assert.ok([401, 403].includes((await call('POST', '/infra/digest', token)).status));
    assert.ok([401, 403].includes((await call('GET', '/infra/cluster', token)).status));
  }
});

test('the cluster pane says it is off on a single node', async () => {
  const res = await call('GET', '/infra/cluster', tokens.infra);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { enabled: false });
});

test('the stats are counts and sizes: the database, the last day of failures and which switches are set', async () => {
  const res = await call('GET', '/infra/stats', tokens.infra);
  assert.equal(res.status, 200);
  const stats = (await res.json()) as {
    checks: Array<{ id: string; ok: boolean }>;
    database: { bytes: number; connections: number; tables: unknown[] };
    traffic: { hours: unknown[]; errors: number; failed_signins: number; failed_signin_addresses: number; top_error_routes: Array<{ route: string; count: number }> };
    totals: { clients: number; projects: number; staff: number };
    cache: { backend: string };
  };
  assert.equal(stats.checks.find((check) => check.id === 'database')?.ok, true);
  assert.ok(stats.database.bytes > 0 && stats.database.connections > 0 && stats.database.tables.length > 0);
  assert.equal(stats.traffic.hours.length, 24);
  assert.ok(stats.traffic.errors >= 3);
  assert.deepEqual(stats.traffic.top_error_routes.find((row) => row.route === ROUTE), { route: ROUTE, count: 3 });
  assert.ok(stats.traffic.failed_signins >= 19 && stats.traffic.failed_signin_addresses >= 2);
  assert.ok(stats.totals.staff >= 3);
  assert.ok(['redis', 'memory'].includes(stats.cache.backend));
  const raw = JSON.stringify(stats);
  assert.ok(!raw.includes('@test.enzo.local'), 'no address of a person is in the numbers');
});

test('ten failed sign-ins from one address raise a security alert; nine do not', async () => {
  await app.nest.get(InfraWatch).attacks();
  await settle();
  const alerts = await prisma.alertEvent.findMany({ where: { OR: [{ title: { contains: BUSY } }, { title: { contains: QUIET } }] } });
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]!.kind, 'security');
  assert.ok(alerts[0]!.title.includes(BUSY));
});

test('the summary goes out once per London day, only from 08:00, and only to someone', async () => {
  const watch = app.nest.get(InfraWatch);
  const day = '2026-07-01';
  const claimed = () => prisma.alertSettings.findUnique({ where: { id: 'alerts' } }).then((row) => row?.digest_day ?? null);

  assert.equal(await watch.digest(new Date('2026-07-01T06:30:00Z')), false, '07:30 in London is too early');
  assert.equal(await watch.digest(new Date('2026-07-01T07:30:00Z')), false);
  assert.notEqual(await claimed(), day, 'nobody to send to, so the day is not used up');

  await prisma.alertSettings.upsert({ where: { id: 'alerts' }, create: { id: 'alerts', recipients: [`out-${run}@test.enzo.local`] }, update: { recipients: [`out-${run}@test.enzo.local`] } });
  app.nest.get(AlertService).forgetSettings();
  await watch.digest(new Date('2026-07-01T07:30:00Z'));
  assert.equal(await claimed(), day, 'the first tick after 08:00 takes the day');
  assert.equal(await watch.digest(new Date('2026-07-01T11:00:00Z')), false, 'and nothing sends it again that day');

  const store = app.nest.get(DatabaseService).infraStore;
  assert.equal(await store.claimDigest('2026-07-02'), true);
  assert.equal(await store.claimDigest('2026-07-02'), false);
});

test('the summary has one line per number and says what needs attention', async () => {
  const rows = await app.nest.get(InfraService).digestRows();
  const labels = rows.map(([label]) => label);
  for (const label of ['Server errors, last 24 hours', 'Failed sign-ins', 'Database', 'Cache', 'Needs attention']) assert.ok(labels.includes(label), label);
  assert.match(rows.find(([label]) => label === 'Needs attention')![1], /Email sending/, 'a test server has no SMTP, and the summary says so');
});

test('the Infra manager can switch the summary off, and leaving it out keeps it as it was', async () => {
  const put = (body: object) => call('PUT', '/alerts', tokens.infra, { recipients: [], errors_on: true, ...body });
  assert.equal(((await (await put({ digest_on: false })).json()) as { digest_on: boolean }).digest_on, false);
  assert.equal(((await (await put({})).json()) as { digest_on: boolean }).digest_on, false);
  assert.equal(await app.nest.get(InfraWatch).digest(new Date('2026-07-05T09:00:00Z')), false);
  assert.equal(((await (await put({ digest_on: true })).json()) as { digest_on: boolean }).digest_on, true);
});

test('several API instances: a job runs once at a time, a watch slot once', async () => {
  const db = app.nest.get(DatabaseService);
  let release!: () => void;
  const holding = new Promise<void>((resolve) => (release = resolve));
  const first = db.once(`job-${run}`, () => holding);
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.equal(await db.once(`job-${run}`, async () => assert.fail('ran while held')), false);
  release();
  assert.equal(await first, true);
  assert.equal(await db.once(`job-${run}`, async () => undefined), true, 'free again after commit');

  const watch = app.nest.get(InfraWatch);
  let calls = 0;
  watch.attacks = async () => void calls++;
  const at = new Date(Date.UTC(2030, 0, 1, 3, Number.parseInt(run.slice(0, 2), 16) % 50));
  await watch.tick(at);
  await watch.tick(at);
  assert.equal(calls, 1, 'second instance skips the claimed slot');
});
