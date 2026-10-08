import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { Mail, MailService } from '../core/mail.service';
import { ADMIN, startTestApp } from './app';

/** The client book's roles and scope, and portal access by invitation, against the real AppModule. */

let app: Awaited<ReturnType<typeof startTestApp>>;
let prisma: PrismaClient;
const run = randomUUID().slice(0, 8);
const PASSWORD = 'client-password-123';
const NEW_PASSWORD = 'a-brand-new-password-456';
const EDITOR = { id: `stf_ed_${run}`, email: `editor-${run}@test.enzo.local`, role: 'Editor' };
const DESIGNER = { id: `stf_des_${run}`, email: `designer-${run}@test.enzo.local`, role: 'Designer' };
const MINE = { id: `cli_mine_${run}`, email: `mine-${run}@test.enzo.local` }; // has a project for DESIGNER
const OTHER = { id: `cli_other_${run}`, email: `other-${run}@test.enzo.local` };
const NEWBIE = { id: `cli_new_${run}`, email: `newbie-${run}@test.enzo.local` }; // no portal password yet
const PROJECTS = { assigned: `prj_a_${run}`, unassigned: `prj_u_${run}` };

const mails: Mail[] = [];
const tokens: Record<'admin' | 'editor' | 'designer', string> = { admin: '', editor: '', designer: '' };

before(async () => {
  app = await startTestApp();
  prisma = new PrismaClient();
  // Keep what would have been emailed, so a test can follow the link.
  app.nest.get(MailService).send = async (mail: Mail) => {
    mails.push(mail);
    return true;
  };

  const password_hash = await bcrypt.hash(PASSWORD, 4);
  for (const staff of [EDITOR, DESIGNER]) {
    await prisma.staffUser.create({ data: { ...staff, name: `Test ${staff.role}`, password_hash } });
  }
  const client = { joined_date: new Date(), status: 'Active' };
  await prisma.client.create({ data: { ...client, ...MINE, name: 'Mine', password_hash } });
  await prisma.client.create({ data: { ...client, ...OTHER, name: 'Other', password_hash } });
  await prisma.client.create({ data: { ...client, ...NEWBIE, name: 'Newbie', password_hash: '' } });
  const project = { client_id: MINE.id, type: 'Kitchen', status: 'Design' };
  await prisma.project.create({ data: { ...project, id: PROJECTS.assigned, name: 'Theirs', assigned_designer_id: DESIGNER.id } });
  await prisma.project.create({ data: { ...project, id: PROJECTS.unassigned, name: 'Not theirs' } });

  tokens.admin = await signIn('/auth/admin/login', ADMIN.email, ADMIN.password);
  tokens.editor = await signIn('/auth/admin/login', EDITOR.email, PASSWORD);
  tokens.designer = await signIn('/auth/admin/login', DESIGNER.email, PASSWORD);
});

after(async () => {
  await prisma.project.deleteMany({ where: { id: { in: Object.values(PROJECTS) } } });
  await prisma.client.deleteMany({ where: { email: { contains: run } } });
  await prisma.staffUser.deleteMany({ where: { id: { in: [EDITOR.id, DESIGNER.id] } } });
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

async function signIn(path: string, email: string, password: string): Promise<string> {
  const res = await call('POST', path, undefined, { email, password });
  assert.equal(res.status, 200, `${path} for ${email}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

/** The token in the last email's set-password link (it rides in the fragment). */
function linkToken(): string {
  const match = /#token=([\w.-]+)/.exec(mails.at(-1)?.text ?? '');
  assert.ok(match, 'a set-password link was emailed');
  return match[1]!;
}

test('an Admin creates, reads, updates and deletes a client; no password goes in or comes out', async () => {
  const email = `crud-${run}@test.enzo.local`;
  assert.equal((await call('POST', '/clients', tokens.admin, { name: 'Crud', email, password: 'nope-nope' })).status, 400);

  const res = await call('POST', '/clients', tokens.admin, { name: 'Crud', email });
  assert.equal(res.status, 201);
  const created = (await res.json()) as Record<string, unknown>;
  assert.equal(created.has_portal_access, false);
  assert.ok(!('password_hash' in created) && !('token_version' in created));

  const id = created.id as string;
  const put = await call('PUT', `/clients/${id}`, tokens.admin, { name: 'Crud Two', status: 'Inactive', total_spent: 12.5 });
  assert.equal(put.status, 200);
  assert.equal(((await put.json()) as { name: string }).name, 'Crud Two');

  const list = (await (await call('GET', '/clients', tokens.admin)).json()) as Array<{ id: string }>;
  assert.ok(list.some((row) => row.id === id) && list.some((row) => row.id === OTHER.id));
  assert.equal((await call('GET', `/clients/${id}/detail`, tokens.admin)).status, 200);

  assert.equal((await call('DELETE', `/clients/${id}`, tokens.admin)).status, 200);
  assert.equal((await call('GET', `/clients/${id}`, tokens.admin)).status, 404);
});

test('an Editor is refused on every /clients route', async () => {
  const routes: Array<[string, string, unknown?]> = [
    ['GET', '/clients'],
    ['GET', `/clients/${MINE.id}`],
    ['GET', `/clients/${MINE.id}/detail`],
    ['POST', '/clients', { name: 'Nope', email: `nope-${run}@test.enzo.local` }],
    ['PUT', `/clients/${MINE.id}`, { notes: 'nope' }],
    ['POST', `/clients/${NEWBIE.id}/invite`],
    ['DELETE', `/clients/${OTHER.id}`],
  ];
  for (const [method, path, body] of routes) {
    assert.equal((await call(method, path, tokens.editor, body)).status, 403, `${method} ${path}`);
  }
});

test('a Designer sees only the clients of their projects, and only their projects', async () => {
  const list = (await (await call('GET', '/clients', tokens.designer)).json()) as Array<{ id: string }>;
  assert.deepEqual(list.map((row) => row.id), [MINE.id]);

  assert.equal((await call('GET', `/clients/${MINE.id}`, tokens.designer)).status, 200);
  for (const path of [`/clients/${OTHER.id}`, `/clients/${OTHER.id}/detail`]) {
    assert.equal((await call('GET', path, tokens.designer)).status, 403, path);
  }

  const detail = (await (await call('GET', `/clients/${MINE.id}/detail`, tokens.designer)).json()) as {
    projects: Array<{ id: string }>;
  };
  assert.deepEqual(detail.projects.map((row) => row.id), [PROJECTS.assigned]);
});

test('a Designer edits only contact details and notes, and nothing Admin-only', async () => {
  const ok = await call('PUT', `/clients/${MINE.id}`, tokens.designer, { phone: '0116 000 0000', notes: 'Prefers mornings' });
  assert.equal(ok.status, 200);

  for (const body of [{ email: `stolen-${run}@test.enzo.local` }, { assigned_staff_id: DESIGNER.id }, { status: 'Inactive' }, { total_spent: 1 }]) {
    assert.equal((await call('PUT', `/clients/${MINE.id}`, tokens.designer, body)).status, 403, JSON.stringify(body));
  }
  // Not a field at all any more: refused by validation before anyone looks.
  assert.equal((await call('PUT', `/clients/${MINE.id}`, tokens.designer, { password: 'hunter2hunter2' })).status, 400);
  assert.equal((await call('PUT', `/clients/${OTHER.id}`, tokens.designer, { notes: 'x' })).status, 403);
  assert.equal((await call('POST', '/clients', tokens.designer, { name: 'Nope', email: `nope2-${run}@test.enzo.local` })).status, 403);
  assert.equal((await call('POST', `/clients/${NEWBIE.id}/invite`, tokens.designer)).status, 403);
  assert.equal((await call('DELETE', `/clients/${MINE.id}`, tokens.designer)).status, 403);

  const row = await prisma.client.findUniqueOrThrow({ where: { id: MINE.id } });
  assert.equal(row.email, MINE.email);
  assert.equal(row.status, 'Active');
});

test('a client token is refused on /clients', async () => {
  const client = await signIn('/auth/portal/login', OTHER.email, PASSWORD);
  for (const path of ['/clients', `/clients/${OTHER.id}`, `/clients/${OTHER.id}/detail`]) {
    assert.equal((await call('GET', path, client)).status, 403, path);
  }
});

test('an invitation sets the first password once, and the client can sign in', async () => {
  const res = await call('POST', `/clients/${NEWBIE.id}/invite`, tokens.admin);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { emailed: true });
  assert.equal(mails.at(-1)?.to, NEWBIE.email);
  const token = linkToken();

  // A set-password link is not a session.
  assert.equal((await call('GET', '/auth/me', token)).status, 401);

  assert.equal((await call('POST', '/auth/portal/reset', undefined, { token, new_password: NEW_PASSWORD })).status, 204);
  assert.equal((await call('POST', '/auth/portal/reset', undefined, { token, new_password: NEW_PASSWORD })).status, 400, 'works once');
  await signIn('/auth/portal/login', NEWBIE.email, NEW_PASSWORD);

  const view = (await (await call('GET', `/clients/${NEWBIE.id}`, tokens.admin)).json()) as { has_portal_access: boolean };
  assert.equal(view.has_portal_access, true);
  assert.equal((await call('POST', `/clients/${NEWBIE.id}/invite`, tokens.admin)).status, 400, 'already has access');
});

test('a forgotten-password reset signs every old portal session out', async () => {
  const old = await signIn('/auth/portal/login', MINE.email, PASSWORD);
  assert.equal((await call('POST', '/auth/portal/forgot', undefined, { email: MINE.email.toUpperCase() })).status, 204);
  assert.equal(mails.at(-1)?.to, MINE.email);

  assert.equal((await call('POST', '/auth/portal/reset', undefined, { token: linkToken(), new_password: NEW_PASSWORD })).status, 204);
  assert.equal((await call('GET', '/auth/me', old)).status, 401);
  await signIn('/auth/portal/login', MINE.email, NEW_PASSWORD);
});

test('forgot answers the same for an unknown address, and sends nothing', async () => {
  const before = mails.length;
  const res = await call('POST', '/auth/portal/forgot', undefined, { email: `nobody-${run}@test.enzo.local` });
  assert.equal(res.status, 204);
  assert.equal(await res.text(), '');
  assert.equal(mails.length, before);
  // Nor is a forged or foreign token a way in.
  assert.equal((await call('POST', '/auth/portal/reset', undefined, { token: tokens.admin, new_password: NEW_PASSWORD })).status, 400);
});
