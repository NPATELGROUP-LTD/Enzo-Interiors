import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import { PATH_METADATA } from '@nestjs/common/constants';
import { ModulesContainer, Reflector } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { IS_PUBLIC_KEY, ROLES_KEY } from '../common/decorators';
import { ADMIN, startTestApp } from './app';

/**
 * The Infra manager role and the limits on Admins: who may invite, change,
 * reset or remove an Admin or an Infra manager, the removal-request flow, what
 * Infra can never reach, and a guard that no route is left without @Roles.
 */

let app: Awaited<ReturnType<typeof startTestApp>>;
let prisma: PrismaClient;
const run = randomUUID().slice(0, 8);
const PASSWORD = 'infra-password-123';
const person = (key: string, role: string) => ({ id: `stf_${key}_${run}`, email: `i-${key}-${run}@test.enzo.local`, role, name: `Test ${key} ${run}` });
const INFRA = person('infra', 'Infra');
const ADMIN2 = person('adm2', 'Admin');
const ADMIN3 = person('adm3', 'Admin');
const EDITOR = person('ed', 'Editor');
const EDITOR2 = person('ed2', 'Editor');
const ALL = [INFRA, ADMIN2, ADMIN3, EDITOR, EDITOR2];

const tokens = { admin: '', admin2: '', infra: '', editor: '' };

before(async () => {
  app = await startTestApp();
  prisma = new PrismaClient();
  const password_hash = await bcrypt.hash(PASSWORD, 4);
  for (const staff of ALL) await prisma.staffUser.create({ data: { ...staff, password_hash } });
  tokens.admin = await signIn(ADMIN.email, ADMIN.password);
  tokens.admin2 = await signIn(ADMIN2.email, PASSWORD);
  tokens.infra = await signIn(INFRA.email, PASSWORD);
  tokens.editor = await signIn(EDITOR.email, PASSWORD);
});

after(async () => {
  const ids = ALL.map((row) => row.id);
  await prisma.staffRemovalRequest.deleteMany({ where: { OR: [{ target_id: { in: ids } }, { requested_by: { in: ids } }] } });
  await prisma.notification.deleteMany({ where: { recipient_id: { in: [...ids] } } });
  await prisma.staffUser.deleteMany({ where: { OR: [{ id: { in: ids } }, { email: { endsWith: `-${run}@test.enzo.local` } }] } });
  await prisma.$disconnect();
  await app.close();
});

async function call(method: string, path: string, token?: string, body?: unknown): Promise<Response> {
  return fetch(`${app.url}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function signIn(email: string, password: string): Promise<string> {
  const res = await call('POST', '/auth/admin/login', undefined, { email, password });
  assert.equal(res.status, 200, `sign in as ${email}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function json<T>(res: Response, status = 200): Promise<T> {
  assert.equal(res.status, status, `${res.url} answered ${res.status}`);
  return (await res.json()) as T;
}

const roleOf = async (id: string) => (await prisma.staffUser.findUnique({ where: { id } }))?.role ?? null;

test('an Admin cannot invite, promote, demote, reset or remove an Admin or an Infra manager', async () => {
  const invite = (role: string, key: string) =>
    call('POST', '/users', tokens.admin, { name: `Invited ${key}`, email: `i-inv-${key}-${run}@test.enzo.local`, role });
  assert.equal((await invite('Admin', 'a')).status, 403);
  assert.equal((await invite('Infra', 'b')).status, 403);
  const ok = await json<{ id: string }>(await invite('Designer', 'c'), 201);

  assert.equal((await call('PUT', `/users/${EDITOR.id}`, tokens.admin, { role: 'Admin' })).status, 403, 'no promoting to Admin');
  assert.equal((await call('PUT', `/users/${EDITOR.id}`, tokens.admin, { role: 'Infra' })).status, 403, 'no promoting to Infra');
  assert.equal((await call('PUT', `/users/${ADMIN2.id}`, tokens.admin, { role: 'Editor' })).status, 403, 'no demoting an Admin');
  assert.equal((await call('PUT', `/users/${INFRA.id}`, tokens.admin, { role: 'Editor' })).status, 403, 'no demoting Infra');
  assert.equal((await call('POST', `/users/${ADMIN2.id}/reset-2fa`, tokens.admin)).status, 403);
  assert.equal((await call('POST', `/users/${INFRA.id}/reset-2fa`, tokens.admin)).status, 403);
  assert.equal((await call('POST', `/users/${ADMIN2.id}/invite`, tokens.admin)).status, 403);
  assert.equal((await call('DELETE', `/users/${ADMIN2.id}`, tokens.admin, { password: ADMIN.password })).status, 403, 'no removing an Admin');
  assert.equal((await call('DELETE', `/users/${INFRA.id}`, tokens.admin, { password: ADMIN.password })).status, 403);
  assert.equal(await roleOf(ADMIN2.id), 'Admin');
  assert.equal(await roleOf(INFRA.id), 'Infra');

  // Everyone below Admin is still theirs to manage.
  assert.equal((await json<{ role: string }>(await call('PUT', `/users/${ok.id}`, tokens.admin, { role: 'Installer' }))).role, 'Installer');
  assert.equal((await call('DELETE', `/users/${ok.id}`, tokens.admin)).status, 204, 'no password needed for a non-Admin');
});

test('an Infra manager manages every role, but removing an Admin needs their password', async () => {
  const invited = await json<{ id: string }>(
    await call('POST', '/users', tokens.infra, { name: 'Invited Admin', email: `i-inv-admin-${run}@test.enzo.local`, role: 'Admin' }),
    201,
  );
  assert.equal(await roleOf(invited.id), 'Admin');

  assert.equal((await call('DELETE', `/users/${invited.id}`, tokens.infra)).status, 403, 'no password');
  assert.equal((await call('DELETE', `/users/${invited.id}`, tokens.infra, { password: 'not-my-password' })).status, 403, 'wrong password');
  assert.equal(await roleOf(invited.id), 'Admin');
  assert.equal((await call('DELETE', `/users/${invited.id}`, tokens.infra, { password: PASSWORD })).status, 204);
  assert.equal(await roleOf(invited.id), null);

  assert.equal((await call('POST', `/users/${ADMIN3.id}/reset-2fa`, tokens.infra)).status, 204, 'Infra resets an Admin');
  assert.equal((await call('PUT', `/users/${INFRA.id}`, tokens.infra, { role: 'Editor' })).status, 400, 'not your own role');
  assert.equal((await call('DELETE', `/users/${INFRA.id}`, tokens.infra, { password: PASSWORD })).status, 400, 'not yourself');
});

test('the only Admin cannot be removed or demoted', async () => {
  // Leave exactly one Admin: the seeded one (ADMIN2 and ADMIN3 go first).
  const others = await prisma.staffUser.findMany({ where: { role: 'Admin', id: { notIn: [ADMIN2.id, ADMIN3.id] } } });
  if (others.length === 1) {
    for (const extra of [ADMIN2, ADMIN3]) {
      assert.equal((await call('DELETE', `/users/${extra.id}`, tokens.infra, { password: PASSWORD })).status, 204);
    }
    const last = others[0]!;
    assert.equal((await call('DELETE', `/users/${last.id}`, tokens.infra, { password: PASSWORD })).status, 400);
    assert.equal((await call('PUT', `/users/${last.id}`, tokens.infra, { role: 'Editor' })).status, 400);
    assert.equal(await roleOf(last.id), 'Admin');
  }
  // Put the two back for the next tests.
  const password_hash = await bcrypt.hash(PASSWORD, 4);
  for (const staff of [ADMIN2, ADMIN3]) {
    await prisma.staffUser.upsert({ where: { id: staff.id }, update: {}, create: { ...staff, password_hash } });
  }
  tokens.admin2 = await signIn(ADMIN2.email, PASSWORD);
});

test('an Admin asks for another Admin to go; the Infra manager approves with their password', async () => {
  const ask = (token: string, id: string, reason: unknown) => call('POST', `/users/${id}/removal-request`, token, { reason });

  assert.equal((await ask(tokens.admin, ADMIN2.id, 'no')).status, 400, 'a reason of a few words');
  assert.equal((await ask(tokens.admin, EDITOR.id, 'left the company')).status, 400, 'only Admins need a request');
  assert.equal((await ask(tokens.admin2, ADMIN2.id, 'asking about myself')).status, 400, 'not yourself');
  assert.equal((await ask(tokens.infra, ADMIN2.id, 'infra removes directly')).status, 403, 'Infra does not need to ask');
  assert.equal((await ask(tokens.editor, ADMIN2.id, 'an Editor cannot ask')).status, 403);

  const request = await json<{ id: string; status: string; target_name: string }>(await ask(tokens.admin, ADMIN2.id, 'Left the business in October'), 201);
  assert.equal(request.status, 'Pending');
  assert.equal((await ask(tokens.admin, ADMIN2.id, 'Left the business in October')).status, 400, 'one at a time');

  const told = await prisma.notification.findFirst({ where: { recipient_id: INFRA.id, title: { contains: ADMIN2.name } } });
  assert.ok(told, 'the Infra manager hears about it');

  const mine = await json<Array<{ id: string }>>(await call('GET', '/users/removal-requests', tokens.admin));
  assert.ok(mine.some((row) => row.id === request.id));
  assert.deepEqual(await json<unknown[]>(await call('GET', '/users/removal-requests', tokens.admin2)), [], 'an Admin sees only their own');
  assert.ok((await json<Array<{ id: string }>>(await call('GET', '/users/removal-requests', tokens.infra))).some((row) => row.id === request.id));

  const approve = (token: string, password?: string) =>
    call('POST', `/users/removal-requests/${request.id}/approve`, token, password === undefined ? {} : { password });
  assert.equal((await approve(tokens.admin)).status, 403, 'an Admin cannot approve');
  assert.equal((await approve(tokens.infra)).status, 403, 'no password');
  assert.equal((await approve(tokens.infra, 'wrong-password')).status, 403);
  assert.equal(await roleOf(ADMIN2.id), 'Admin', 'still here after refused approvals');
  assert.equal((await prisma.staffRemovalRequest.findUniqueOrThrow({ where: { id: request.id } })).status, 'Pending');

  assert.equal((await approve(tokens.infra, PASSWORD)).status, 200);
  assert.equal(await roleOf(ADMIN2.id), null, 'removed');
  const row = await prisma.staffRemovalRequest.findUniqueOrThrow({ where: { id: request.id } });
  assert.equal(row.status, 'Approved');
  assert.equal(row.decided_name, INFRA.name);
  assert.equal((await approve(tokens.infra, PASSWORD)).status, 404, 'answered once');
  const log = await prisma.activityLog.findFirst({ where: { action: 'staff_delete', target_id: ADMIN2.id } });
  assert.ok(log, 'the removal is in the activity log');
  assert.equal((await call('GET', '/users', tokens.admin2)).status, 401, 'their session is gone with them');
});

test('an Infra manager can decline a removal request with a note', async () => {
  const request = await json<{ id: string }>(
    await call('POST', `/users/${ADMIN3.id}/removal-request`, tokens.admin, { reason: 'Not needed any more' }),
    201,
  );
  const declined = await json<{ status: string; decision_note: string }>(
    await call('POST', `/users/removal-requests/${request.id}/decline`, tokens.infra, { note: 'Still needed for invoices' }),
  );
  assert.equal(declined.status, 'Declined');
  assert.equal(declined.decision_note, 'Still needed for invoices');
  assert.equal(await roleOf(ADMIN3.id), 'Admin');
  assert.equal((await call('POST', `/users/removal-requests/${request.id}/decline`, tokens.admin, {})).status, 403);
  assert.equal((await call('POST', `/users/removal-requests/${request.id}/decline`, tokens.infra, {})).status, 404, 'answered once');
  // Declined, so it can be asked again.
  assert.equal((await call('POST', `/users/${ADMIN3.id}/removal-request`, tokens.admin, { reason: 'Asking once more' })).status, 201);
});

test('an Infra manager reaches Users, settings and their own account, and no client or business data', async () => {
  for (const path of ['/users', '/settings', '/notifications', '/auth/me']) {
    assert.equal((await call('GET', path, tokens.infra)).status, 200, path);
  }
  for (const path of [
    '/clients', '/projects', '/invoices', '/documents', '/enquiries', '/appointments', '/conversations',
    '/dashboard/admin', '/dashboard/designer', '/change-requests',
    '/settings/opening-hours', '/cms/overview',
  ]) {
    assert.equal((await call('GET', path, tokens.infra)).status, 403, `${path} is not Infra's`);
  }
  // And an Admin or Editor still cannot get at the Infra-only routes.
  assert.equal((await call('POST', '/users/removal-requests/none/approve', tokens.admin, { password: ADMIN.password })).status, 403);
  assert.equal((await call('GET', '/users', tokens.editor)).status, 403);
});

test('every route names its roles or is public: nothing is open to Infra by accident', async () => {
  const reflector = app.nest.get(Reflector);
  const open: string[] = [];
  for (const module of app.nest.get(ModulesContainer).values()) {
    for (const wrapper of module.controllers.values()) {
      const { instance, metatype } = wrapper;
      if (!instance || !metatype) continue;
      const proto = Object.getPrototypeOf(instance) as Record<string, unknown>;
      for (const name of Object.getOwnPropertyNames(proto)) {
        const handler = proto[name];
        if (name === 'constructor' || typeof handler !== 'function' || Reflect.getMetadata(PATH_METADATA, handler) === undefined) continue;
        const isPublic = reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [handler, metatype]);
        const roles = reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [handler, metatype]);
        if (!isPublic && !roles?.length) open.push(`${metatype.name}.${name}`);
      }
    }
  }
  // Open to any signed-in staff member, Infra included. All four act on the
  // caller's own account only (their trusted devices, their Google link).
  // Add to this list only on purpose.
  assert.deepEqual(open.sort(), [
    'AuthController.devices',
    'AuthController.forgetDevice',
    'GoogleAuthController.link',
    'GoogleAuthController.unlink',
  ]);
});
