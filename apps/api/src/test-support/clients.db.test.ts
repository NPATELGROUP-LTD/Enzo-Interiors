import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import { JwtService } from '@nestjs/jwt';
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
  await prisma.changeRequest.deleteMany({ where: { requested_by: DESIGNER.id } });
  await prisma.notification.deleteMany({ where: { recipient_id: DESIGNER.id } });
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

  // Deleting needs the Admin's password again, and takes the client's projects and invoices with it.
  await prisma.project.create({ data: { id: `prj_cdel_${run}`, client_id: id, name: 'Gone', type: 'Kitchen', status: 'Design' } });
  await prisma.invoice.create({
    data: { id: `inv_cdel_${run}`, number: `CD-${run}`, client_id: id, amount: 60, vat_rate: 20, status: 'Paid', due_date: new Date() },
  });
  assert.equal((await call('DELETE', `/clients/${id}`, tokens.admin)).status, 403, 'no password');
  assert.equal((await call('DELETE', `/clients/${id}`, tokens.admin, { password: 'not-it' })).status, 403, 'wrong password');
  assert.equal((await call('DELETE', `/clients/${id}`, tokens.admin, { password: ADMIN.password })).status, 200);
  assert.equal((await call('GET', `/clients/${id}`, tokens.admin)).status, 404);
  assert.equal(await prisma.project.count({ where: { client_id: id } }), 0);
  assert.equal(await prisma.invoice.count({ where: { client_id: id } }), 0);
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

test('a Designer asks an Admin to change contact details and notes; only an Admin writes', async () => {
  for (const body of [{ notes: 'x' }, { email: `stolen-${run}@test.enzo.local` }, { status: 'Inactive' }, { total_spent: 1 }]) {
    assert.equal((await call('PUT', `/clients/${MINE.id}`, tokens.designer, body)).status, 403, JSON.stringify(body));
  }
  const ask = (body: object) => call('POST', '/change-requests', tokens.designer, { kind: 'client_details', ...body });
  assert.equal((await ask({ client_id: OTHER.id, notes: 'x' })).status, 403, 'outside their clients');
  // Only phone, address and notes can be asked for.
  assert.equal((await ask({ client_id: MINE.id, email: `stolen-${run}@test.enzo.local` })).status, 400);

  const first = (await (await ask({ client_id: MINE.id, phone: `0116 ${run}`, notes: 'Prefers mornings' })).json()) as { id: string };
  const asked = await ask({ client_id: MINE.id, phone: `0116 ${run}`, notes: 'Prefers afternoons' });
  assert.equal(asked.status, 201);
  const request = (await asked.json()) as { id: string; payload: Record<string, string> };
  assert.equal(request.id, first.id, 'asking again replaces the pending one');
  assert.deepEqual(request.payload, { phone: `0116 ${run}`, notes: 'Prefers afternoons' });
  assert.notEqual((await prisma.client.findUniqueOrThrow({ where: { id: MINE.id } })).notes, 'Prefers afternoons');

  assert.equal((await call('POST', `/change-requests/${request.id}/approve`, tokens.designer)).status, 403);
  assert.equal((await call('POST', `/change-requests/${request.id}/approve`, tokens.admin)).status, 200);
  const changed = await prisma.client.findUniqueOrThrow({ where: { id: MINE.id } });
  assert.equal(changed.phone, `0116 ${run}`);
  assert.equal(changed.notes, 'Prefers afternoons');
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

test('an invitation emails a generated password; resending replaces it; keeping it ends the prompt', async () => {
  const sentTo = () => mails.at(-1)!;
  const passwordIn = (mail: Mail) => /password:\s+(\S+)/.exec(mail.text ?? '')?.[1];

  const res = await call('POST', `/clients/${NEWBIE.id}/invite`, tokens.admin);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { emailed: true });
  assert.equal(sentTo().to, NEWBIE.email);
  const first = passwordIn(sentTo());
  assert.match(first ?? '', /^[A-Za-z2-9]{14}$/, 'a 14-character generated password');
  assert.match(sentTo().text ?? '', /\/login/, 'with the sign-in address');
  assert.ok(!(sentTo().text ?? '').includes('#token='), 'no set-password link any more');

  // Only a hash is stored, the flag is on, and the old session-killing counter moved.
  const row = await prisma.client.findUniqueOrThrow({ where: { id: NEWBIE.id } });
  assert.ok(row.password_hash.startsWith('$2') && !row.password_hash.includes(first!));
  assert.equal(row.password_is_default, true);
  assert.equal(row.token_version, 1);

  // They sign in with it and are told it is still the emailed one.
  const login = await call('POST', '/auth/portal/login', undefined, { email: NEWBIE.email, password: first });
  assert.equal(login.status, 200);
  const session = (await login.json()) as { access_token: string; user: { passwordIsDefault: boolean } };
  assert.equal(session.user.passwordIsDefault, true);
  assert.equal(((await (await call('GET', '/auth/me', session.access_token)).json()) as { passwordIsDefault: boolean }).passwordIsDefault, true);
  const view = (await (await call('GET', `/clients/${NEWBIE.id}`, tokens.admin)).json()) as { has_portal_access: boolean; password_is_default: boolean };
  assert.deepEqual([view.has_portal_access, view.password_is_default], [true, true]);

  // The emailed password lapses after 7 days (a week, give or take the test's own seconds) while it is still the default.
  const week = (await prisma.client.findUniqueOrThrow({ where: { id: NEWBIE.id } })).default_password_expires_at!.getTime() - Date.now();
  assert.ok(week > 6.9 * 24 * 3600_000 && week <= 7 * 24 * 3600_000);
  await prisma.client.update({ where: { id: NEWBIE.id }, data: { default_password_expires_at: new Date(Date.now() - 1000) } });
  const lapsed = await call('POST', '/auth/portal/login', undefined, { email: NEWBIE.email, password: first });
  assert.equal(lapsed.status, 401);
  assert.match(((await lapsed.json()) as { message: string }).message, /expired/);

  // Resend issues a new password: the first and the old session stop working.
  assert.equal((await call('POST', `/clients/${NEWBIE.id}/invite`, tokens.admin)).status, 200);
  const second = passwordIn(sentTo());
  assert.notEqual(second, first);
  assert.equal((await call('GET', '/auth/me', session.access_token)).status, 401);
  assert.equal((await call('POST', '/auth/portal/login', undefined, { email: NEWBIE.email, password: first })).status, 401);
  const next = await signIn('/auth/portal/login', NEWBIE.email, second!);

  // Keep: staff and signed-out callers cannot; the client can, once, and then they are on their own password.
  assert.equal((await call('POST', '/account/password/keep', tokens.admin)).status, 403);
  assert.equal((await call('POST', '/account/password/keep', tokens.designer)).status, 403);
  assert.equal((await call('POST', '/account/password/keep')).status, 401);
  assert.equal((await call('POST', '/account/password/keep', next)).status, 204);
  assert.equal(((await (await call('GET', '/auth/me', next)).json()) as { passwordIsDefault: boolean }).passwordIsDefault, false);
  assert.equal((await call('POST', `/clients/${NEWBIE.id}/invite`, tokens.admin)).status, 400, 'already has their own password');
  assert.equal(mails.filter((mail) => mail.to === NEWBIE.email).length, 2);
});

test('changing the password in the portal ends the prompt too; the forgot/reset link still works', async () => {
  const them = { id: `cli_dflt_${run}`, email: `dflt-${run}@test.enzo.local` };
  await prisma.client.create({
    data: { ...them, name: 'Default', status: 'Active', joined_date: new Date(), password_hash: await bcrypt.hash(PASSWORD, 4), password_is_default: true },
  });
  const token = await app.nest.get(JwtService).signAsync({ sub: them.id, kind: 'Client', role: 'Client', name: 'Default', email: them.email, tv: 0 });
  const put = await fetch(`${app.url}/account/password`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ current_password: PASSWORD, new_password: NEW_PASSWORD }),
  });
  assert.equal(put.status, 200);
  assert.equal(((await put.json()) as { user: { passwordIsDefault: boolean } }).user.passwordIsDefault, false);
  assert.equal((await prisma.client.findUniqueOrThrow({ where: { id: them.id } })).password_is_default, false);

  // A forgotten-password reset also clears it.
  await prisma.client.update({ where: { id: them.id }, data: { password_is_default: true } });
  assert.equal((await call('POST', '/auth/portal/forgot', undefined, { email: them.email })).status, 204);
  assert.equal((await call('POST', '/auth/portal/reset', undefined, { token: linkToken(), new_password: PASSWORD })).status, 204);
  assert.equal((await prisma.client.findUniqueOrThrow({ where: { id: them.id } })).password_is_default, false);

  // Correcting the address of someone still on the emailed password drops it: it went to the old mailbox.
  await prisma.client.update({ where: { id: them.id }, data: { password_is_default: true } });
  const moved = await call('PUT', `/clients/${them.id}`, tokens.admin, { email: `moved-${run}@test.enzo.local` });
  assert.equal(((await moved.json()) as { has_portal_access: boolean }).has_portal_access, false);
  assert.equal((await prisma.client.findUniqueOrThrow({ where: { id: them.id } })).password_is_default, false);
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

test('a staff reset link works once, even when two requests race, and /check says so', async () => {
  const staff = { id: `stf_rst_${run}`, email: `reset-${run}@test.enzo.local` };
  await prisma.staffUser.create({ data: { ...staff, name: 'Reset Me', role: 'Editor', password_hash: await bcrypt.hash(PASSWORD, 4) } });
  try {
    assert.equal((await call('POST', '/auth/admin/forgot-password', undefined, { email: staff.email })).status, 204);
    const token = linkToken();
    const valid = async () =>
      ((await (await call('POST', '/auth/admin/reset-password/check', undefined, { token })).json()) as { valid: boolean }).valid;
    const reset = () => call('POST', '/auth/admin/reset-password', undefined, { token, new_password: NEW_PASSWORD });

    assert.equal(await valid(), true);
    const statuses = (await Promise.all([reset(), reset()])).map((res) => res.status).sort();
    assert.deepEqual(statuses, [204, 400], 'exactly one of two racing requests wins');
    assert.equal(await valid(), false);
    assert.equal((await reset()).status, 400, 'works once');
    await signIn('/auth/admin/login', staff.email, NEW_PASSWORD);
  } finally {
    await prisma.staffUser.deleteMany({ where: { id: staff.id } });
  }
});
