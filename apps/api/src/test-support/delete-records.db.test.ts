import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { ADMIN, startTestApp } from './app';

/**
 * An Admin can delete an enquiry (with its replies) and a booking outright, but only with their
 * password, and nobody else can. Rows are made directly, so no mail, slot or Google is involved.
 */

let app: Awaited<ReturnType<typeof startTestApp>>;
let prisma: PrismaClient;
const run = randomUUID().slice(0, 8);
const PASSWORD = 'delete-password-123';
const DESIGNER = { id: `stf_del_${run}`, email: `del-designer-${run}@test.enzo.local`, role: 'Designer' };
const tokens = { admin: '', designer: '' };

const call = (method: string, path: string, token: string, body?: unknown) =>
  fetch(`${app.url}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

async function signIn(email: string, password: string): Promise<string> {
  const res = await fetch(`${app.url}/auth/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(res.status, 200);
  return ((await res.json()) as { access_token: string }).access_token;
}

const makeEnquiry = async (tag: string) => {
  const id = `enq_del_${tag}_${run}`;
  await prisma.contactSubmission.create({
    data: { id, name: `Del ${tag} ${run}`, email: `del-${tag}-${run}@test.enzo.local`, message: 'hi', status: 'New', kind: 'contact' },
  });
  await prisma.enquiryMessage.create({ data: { id: `${id}_m`, enquiry_id: id, direction: 'out', body: 'reply', to_address: 'x@test.enzo.local' } });
  return id;
};

const makeBooking = async (tag: string) => {
  const id = `apt_del_${tag}_${run}`;
  const starts_at = new Date(Date.now() + 40 * 86_400_000);
  await prisma.appointment.create({
    data: {
      id,
      reference: `EZ-D${tag}${run}`.toUpperCase().slice(0, 12),
      service: 'x',
      service_label: 'X',
      starts_at,
      ends_at: new Date(starts_at.getTime() + 3_600_000),
      slot: `${starts_at.toISOString()}-${run}-${tag}`,
      name: `Del ${tag} ${run}`,
      email: `del-${tag}-${run}@test.enzo.local`,
      source: 'admin',
    },
  });
  return id;
};

before(async () => {
  app = await startTestApp();
  prisma = new PrismaClient();
  await prisma.staffUser.create({
    data: { ...DESIGNER, name: `Test Designer ${run}`, password_hash: await bcrypt.hash(PASSWORD, 4) },
  });
  tokens.admin = await signIn(ADMIN.email, ADMIN.password);
  tokens.designer = await signIn(DESIGNER.email, PASSWORD);
});

after(async () => {
  await prisma.contactSubmission.deleteMany({ where: { email: { contains: `-${run}@` } } });
  await prisma.appointment.deleteMany({ where: { email: { contains: `-${run}@` } } });
  await prisma.activityLog.deleteMany({ where: { target_id: { contains: `_${run}` } } });
  await prisma.staffUser.deleteMany({ where: { id: DESIGNER.id } });
  await prisma.$disconnect();
  await app.close();
});

for (const [name, path, make, count] of [
  ['enquiry', '/enquiries', makeEnquiry, () => prisma.enquiryMessage.count({ where: { enquiry_id: { contains: `_${run}` } } })],
  ['booking', '/appointments', makeBooking, async () => 0],
] as const) {
  test(`a ${name} is deleted only by an Admin who retypes their password`, async () => {
    const id = await make('a');
    const exists = () =>
      (name === 'enquiry' ? prisma.contactSubmission.count({ where: { id } }) : prisma.appointment.count({ where: { id } }));

    assert.equal((await call('DELETE', `${path}/${id}`, tokens.designer, { password: PASSWORD })).status, 403, 'a Designer');
    assert.equal((await call('DELETE', `${path}/${id}`, tokens.admin, {})).status, 403, 'no password');
    assert.equal((await call('DELETE', `${path}/${id}`, tokens.admin, { password: 'wrong' })).status, 403, 'wrong password');
    assert.equal(await exists(), 1, 'refused deletes keep the row');

    assert.equal((await call('DELETE', `${path}/${id}`, tokens.admin, { password: ADMIN.password })).status, 200);
    assert.equal(await exists(), 0);
    assert.equal(await count(), 0, 'its replies went with it');
    assert.equal((await call('DELETE', `${path}/${id}`, tokens.admin, { password: ADMIN.password })).status, 404, 'a second delete');
    assert.equal(await prisma.activityLog.count({ where: { target_id: id } }), 1, 'one log line');
  });
}
