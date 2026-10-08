import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { ADMIN, startTestApp } from './app';

/** Portal sign-in and default-deny for client tokens, against the real AppModule. */

let app: Awaited<ReturnType<typeof startTestApp>>;
let prisma: PrismaClient;
const run = randomUUID().slice(0, 8);
const PASSWORD = 'client-password-123';
const ACTIVE = { id: `cli_active_${run}`, email: `active-${run}@test.enzo.local` };
const INACTIVE = { id: `cli_inactive_${run}`, email: `inactive-${run}@test.enzo.local` };
const STAFF = { id: `stf_${run}`, email: `staff-${run}@test.enzo.local` };

before(async () => {
  app = await startTestApp(); // points DATABASE_URL at the test database
  prisma = new PrismaClient();
  const password_hash = await bcrypt.hash(PASSWORD, 4);
  const client = { name: 'Test Client', joined_date: new Date(), password_hash };
  await prisma.client.create({ data: { ...client, ...ACTIVE, status: 'Active' } });
  await prisma.client.create({ data: { ...client, ...INACTIVE, status: 'Inactive' } });
  await prisma.staffUser.create({ data: { ...STAFF, name: 'Test Staff', role: 'Admin', password_hash } });
});

after(async () => {
  await prisma.client.deleteMany({ where: { id: { in: [ACTIVE.id, INACTIVE.id] } } });
  await prisma.staffUser.deleteMany({ where: { id: STAFF.id } });
  await prisma.$disconnect();
  await app.close();
});

const post = (path: string, body: unknown) =>
  fetch(`${app.url}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const get = (path: string, token: string) => fetch(`${app.url}${path}`, { headers: { authorization: `Bearer ${token}` } });

async function token(path: string, email: string, password: string): Promise<string> {
  const res = await post(path, { email, password });
  assert.equal(res.status, 200, `${path} for ${email}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

test('a client signs in and /auth/me answers as that client', async () => {
  const res = await post('/auth/portal/login', { email: ACTIVE.email.toUpperCase(), password: PASSWORD });
  assert.equal(res.status, 200);
  const body = (await res.json()) as { access_token: string; user: Record<string, unknown> };
  assert.deepEqual(body.user, { id: ACTIVE.id, kind: 'Client', role: 'Client', name: 'Test Client', email: ACTIVE.email });

  const me = await get('/auth/me', body.access_token);
  assert.equal(me.status, 200);
  assert.deepEqual(
    { ...((await me.json()) as object) },
    { ...body.user, twoFactorMethod: null, googleLinked: false, googleEmail: null },
  );
});

test('wrong password, unknown address and inactive client get the same 401', async () => {
  const attempts = [
    { email: ACTIVE.email, password: 'not-the-password' },
    { email: `nobody-${run}@test.enzo.local`, password: PASSWORD },
    { email: INACTIVE.email, password: PASSWORD },
  ];
  for (const attempt of attempts) {
    const res = await post('/auth/portal/login', attempt);
    assert.equal(res.status, 401, attempt.email);
    assert.equal(((await res.json()) as { message: string }).message, 'Incorrect email or password');
  }
});

test('a client token is refused on every staff route', async () => {
  const client = await token('/auth/portal/login', ACTIVE.email, PASSWORD);
  for (const path of ['/users', '/notifications', '/appointments', '/auth/devices']) {
    assert.equal((await get(path, client)).status, 403, path);
  }
  // A client token is also not a staff session for the staff-only writes.
  const put = await fetch(`${app.url}/auth/profile`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${client}`, 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Mallory' }),
  });
  assert.equal(put.status, 403);
});

test('bumping clients.token_version signs the client out', async () => {
  const client = await token('/auth/portal/login', ACTIVE.email, PASSWORD);
  assert.equal((await get('/auth/me', client)).status, 200);
  await prisma.client.update({ where: { id: ACTIVE.id }, data: { token_version: { increment: 1 } } });
  assert.equal((await get('/auth/me', client)).status, 401);
});

test('a client deactivated mid-session is signed out', async () => {
  const client = await token('/auth/portal/login', ACTIVE.email, PASSWORD);
  await prisma.client.update({ where: { id: ACTIVE.id }, data: { status: 'Inactive' } });
  try {
    assert.equal((await get('/auth/me', client)).status, 401);
  } finally {
    await prisma.client.update({ where: { id: ACTIVE.id }, data: { status: 'Active' } });
  }
});

test('a staff token still opens what it did, and is not a portal session', async () => {
  const admin = await token('/auth/admin/login', ADMIN.email, ADMIN.password);
  for (const path of ['/auth/me', '/users', '/notifications', '/appointments', '/auth/devices']) {
    assert.equal((await get(path, admin)).status, 200, path);
  }
  const me = (await (await get('/auth/me', admin)).json()) as { kind: string };
  assert.equal(me.kind, 'Staff');
});

test('changing a staff member\'s role signs them out', async () => {
  const admin = await token('/auth/admin/login', ADMIN.email, ADMIN.password);
  const staff = await token('/auth/admin/login', STAFF.email, PASSWORD);
  assert.equal((await get('/users', staff)).status, 200);

  const demote = await fetch(`${app.url}/users/${STAFF.id}`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${admin}`, 'content-type': 'application/json' },
    body: JSON.stringify({ role: 'Editor' }),
  });
  assert.equal(demote.status, 200);
  assert.equal((await get('/auth/me', staff)).status, 401);
  assert.equal((await get('/auth/me', admin)).status, 200, 'the admin who did it is untouched');
});

test('a client changes their password: the old token and old password die, a new session is issued', async () => {
  const me = { id: `cli_pw_${run}`, email: `pw-${run}@test.enzo.local` };
  await prisma.client.create({
    data: { ...me, name: 'Password Client', status: 'Active', joined_date: new Date(), password_hash: await bcrypt.hash(PASSWORD, 4) },
  });
  const put = (path: string, bearer: string, body: unknown) =>
    fetch(`${app.url}${path}`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  try {
    const old = await token('/auth/portal/login', me.email, PASSWORD);
    const next = 'a-brand-new-password-456';

    assert.equal((await put('/account/password', old, { current_password: 'wrong-password-123', new_password: next })).status, 400);
    assert.equal((await get('/auth/me', old)).status, 200, 'a wrong current password changes nothing');

    const changed = await put('/account/password', old, { current_password: PASSWORD, new_password: next });
    assert.equal(changed.status, 200);
    const fresh = ((await changed.json()) as { access_token: string }).access_token;

    assert.equal((await get('/auth/me', old)).status, 401, 'the token that asked is void');
    assert.equal((await get('/auth/me', fresh)).status, 200, 'the session it returns works');
    assert.equal((await post('/auth/portal/login', { email: me.email, password: PASSWORD })).status, 401);
    assert.equal((await post('/auth/portal/login', { email: me.email, password: next })).status, 200);

    // The portal's other account route: preferences are the client's own, and staff have none.
    assert.equal((await put('/notification-preferences', fresh, { sms_enabled: true })).status, 200);
    const stored = (await (await get('/notification-preferences', fresh)).json()) as { sms_enabled: boolean };
    assert.equal(stored.sms_enabled, true);
    const admin = await token('/auth/admin/login', ADMIN.email, ADMIN.password);
    assert.equal((await get('/notification-preferences', admin)).status, 403);
    assert.equal((await put('/account/password', admin, { current_password: ADMIN.password, new_password: next })).status, 403);
  } finally {
    await prisma.notificationPreference.deleteMany({ where: { owner_id: me.id } });
    await prisma.client.delete({ where: { id: me.id } });
  }
});
