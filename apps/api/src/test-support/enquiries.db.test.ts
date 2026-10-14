import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { ADMIN, startTestApp } from './app';

/** The enquiries inbox: Admin only, status only, against the real AppModule and database. */

let app: Awaited<ReturnType<typeof startTestApp>>;
let prisma: PrismaClient;
const run = randomUUID().slice(0, 8);
const PASSWORD = 'enquiry-password-123';
const EDITOR = { id: `stf_enqed_${run}`, email: `enq-editor-${run}@test.enzo.local`, role: 'Editor' };
const DESIGNER = { id: `stf_enqds_${run}`, email: `enq-designer-${run}@test.enzo.local`, role: 'Designer' };
const CLIENT = { id: `cli_enq_${run}`, email: `enq-client-${run}@test.enzo.local` };
const ROW = { id: `enq_${run}`, name: `Enquirer ${run}`, email: `enq-${run}@test.enzo.local` };
const tokens = { admin: '', editor: '', designer: '', client: '' };

const call = (method: string, path: string, token?: string, body?: unknown) =>
  fetch(`${app.url}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

async function signIn(path: string, email: string, password: string): Promise<string> {
  const res = await call('POST', path, undefined, { email, password });
  assert.equal(res.status, 200, `${path} for ${email}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

before(async () => {
  app = await startTestApp();
  prisma = new PrismaClient();
  const password_hash = await bcrypt.hash(PASSWORD, 4);
  for (const staff of [EDITOR, DESIGNER]) {
    await prisma.staffUser.create({ data: { ...staff, name: `Test ${staff.role}`, password_hash } });
  }
  await prisma.client.create({
    data: { ...CLIENT, name: 'Client', password_hash, joined_date: new Date(), status: 'Active' },
  });
  await prisma.contactSubmission.create({
    data: { ...ROW, message: 'Hello', status: 'New', kind: 'contact', created_at: new Date() },
  });
  tokens.admin = await signIn('/auth/admin/login', ADMIN.email, ADMIN.password);
  tokens.editor = await signIn('/auth/admin/login', EDITOR.email, PASSWORD);
  tokens.designer = await signIn('/auth/admin/login', DESIGNER.email, PASSWORD);
  tokens.client = await signIn('/auth/portal/login', CLIENT.email, PASSWORD);
});

after(async () => {
  await prisma.contactSubmission.deleteMany({ where: { id: ROW.id } });
  await prisma.client.deleteMany({ where: { id: CLIENT.id } });
  await prisma.staffUser.deleteMany({ where: { id: { in: [EDITOR.id, DESIGNER.id] } } });
  await prisma.$disconnect();
  await app.close();
});

test('an Admin lists, filters, reads and updates', async () => {
  const list = await call('GET', '/enquiries?status=New&limit=100', tokens.admin);
  assert.equal(list.status, 200);
  const body = (await list.json()) as { items: Array<{ id: string }>; new_count: number };
  assert.ok(body.items.some((row) => row.id === ROW.id));
  assert.ok(body.new_count >= 1);

  assert.equal((await call('GET', `/enquiries/${ROW.id}`, tokens.admin)).status, 200);
  assert.equal((await call('GET', '/enquiries/nope', tokens.admin)).status, 404);

  const patch = await call('PATCH', `/enquiries/${ROW.id}`, tokens.admin, { status: 'Contacted' });
  assert.equal(patch.status, 200);
  const again = (await (await call('GET', '/enquiries?status=New&limit=100', tokens.admin)).json()) as {
    items: Array<{ id: string }>;
  };
  assert.ok(!again.items.some((row) => row.id === ROW.id));
});

test('an unknown status or extra field is refused', async () => {
  assert.equal((await call('PATCH', `/enquiries/${ROW.id}`, tokens.admin, { status: 'Done' })).status, 400);
  assert.equal((await call('PATCH', `/enquiries/${ROW.id}`, tokens.admin, { status: 'New', name: 'x' })).status, 400);
  assert.equal((await call('GET', '/enquiries?status=Bogus', tokens.admin)).status, 400);
});

test('everyone else is refused', async () => {
  for (const token of [tokens.editor, tokens.designer, tokens.client, undefined]) {
    const expected = token ? 403 : 401;
    assert.equal((await call('GET', '/enquiries', token)).status, expected);
    assert.equal((await call('GET', `/enquiries/${ROW.id}`, token)).status, expected);
    assert.equal((await call('PATCH', `/enquiries/${ROW.id}`, token, { status: 'Archived' })).status, expected);
  }
});
