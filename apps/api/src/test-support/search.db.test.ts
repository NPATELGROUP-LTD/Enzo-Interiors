import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { ADMIN, startTestApp } from './app';

/**
 * The top search bar's records: a reference or a small detail finds the record and where it opens.
 * An Admin searches everything, a Designer only their own clients and projects, nobody else anything.
 */

let app: Awaited<ReturnType<typeof startTestApp>>;
let prisma: PrismaClient;
const run = randomUUID().slice(0, 8);
const PASSWORD = 'search-password-123';
const person = (key: string, role: string) => ({ id: `stf_s${key}_${run}`, email: `s-${key}-${run}@test.enzo.local`, role });
const DES_A = person('da', 'Designer');
const DES_B = person('db', 'Designer');
const EDITOR = person('ed', 'Editor');
const CLIENT_A = { id: `cli_sa_${run}`, email: `s-client-a-${run}@test.enzo.local`, name: `Zelda Quillfeather ${run}` };
const CLIENT_B = { id: `cli_sb_${run}`, email: `s-client-b-${run}@test.enzo.local`, name: `Boris Hollowmere ${run}` };
const P = { a: `prj_sa_${run}`, b: `prj_sb_${run}` };
const INVOICE = `INV-S${run}`;
const BOOKING = `EZ-S${run.slice(0, 5).toUpperCase()}`;
const tokens = { admin: '', desA: '', desB: '', editor: '', client: '' };
let projectA = 0;
let enquiryNo = 0;
let enquiryId = '';

before(async () => {
  app = await startTestApp();
  prisma = new PrismaClient();
  const password_hash = await bcrypt.hash(PASSWORD, 4);
  for (const staff of [DES_A, DES_B, EDITOR]) await prisma.staffUser.create({ data: { ...staff, name: `S ${staff.role} ${run}`, password_hash } });
  for (const client of [CLIENT_A, CLIENT_B]) await prisma.client.create({ data: { ...client, phone: '07700900555', joined_date: new Date(), status: 'Active', password_hash } });
  const project = { type: 'Kitchen', status: 'Design', client_visible: true };
  projectA = (await prisma.project.create({ data: { ...project, id: P.a, client_id: CLIENT_A.id, name: `Walnut galley ${run}` } })).ref_no;
  await prisma.project.create({ data: { ...project, id: P.b, client_id: CLIENT_B.id, name: `Walnut loft ${run}` } });
  await prisma.projectMember.createMany({
    data: [
      { id: `pm_sa_${run}`, project_id: P.a, staff_id: DES_A.id, role: 'Designer' },
      { id: `pm_sb_${run}`, project_id: P.b, staff_id: DES_B.id, role: 'Designer' },
    ],
  });
  await prisma.invoice.create({ data: { id: `inv_s_${run}`, number: INVOICE, client_id: CLIENT_A.id, amount: 120, vat_rate: 20, status: 'Sent', due_date: new Date() } });
  const enquiry = await prisma.contactSubmission.create({ data: { id: `enq_s_${run}`, name: `Mabel Fernsby ${run}`, email: `mabel-${run}@test.enzo.local`, message: 'Hello', status: 'New' } });
  enquiryNo = enquiry.ref_no;
  enquiryId = enquiry.id;
  await prisma.appointment.create({
    data: { id: `apt_s_${run}`, reference: BOOKING, service: 'kitchens', service_label: 'Kitchens', starts_at: new Date(Date.now() + 864e5), ends_at: new Date(Date.now() + 864e5 + 36e5), name: `Gus Pemberton ${run}`, email: `gus-${run}@test.enzo.local`, source: 'Website', status: 'Confirmed' },
  });

  tokens.admin = await signIn('/auth/admin/login', ADMIN.email, ADMIN.password);
  for (const [key, staff] of Object.entries({ desA: DES_A, desB: DES_B, editor: EDITOR })) tokens[key as keyof typeof tokens] = await signIn('/auth/admin/login', staff.email, PASSWORD);
  tokens.client = await signIn('/auth/portal/login', CLIENT_A.email, PASSWORD);
});

after(async () => {
  await prisma.invoice.deleteMany({ where: { number: INVOICE } });
  await prisma.contactSubmission.deleteMany({ where: { id: `enq_s_${run}` } });
  await prisma.appointment.deleteMany({ where: { reference: BOOKING } });
  await prisma.project.deleteMany({ where: { client_id: { in: [CLIENT_A.id, CLIENT_B.id] } } });
  await prisma.client.deleteMany({ where: { id: { in: [CLIENT_A.id, CLIENT_B.id] } } });
  await prisma.staffUser.deleteMany({ where: { id: { in: [DES_A.id, DES_B.id, EDITOR.id] } } });
  await prisma.$disconnect();
  await app.close();
});

const call = (path: string, token?: string) => fetch(`${app.url}${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });

async function signIn(path: string, email: string, password: string): Promise<string> {
  const res = await fetch(`${app.url}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
  assert.equal(res.status, 200, `${path} for ${email}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

type Result = { type: string; id: string; title: string; link: string };
const find = async (token: string, q: string): Promise<Result[]> => {
  const res = await call(`/search?q=${encodeURIComponent(q)}`, token);
  assert.equal(res.status, 200, `search ${q}`);
  return ((await res.json()) as { results: Result[] }).results;
};

test('an Admin finds a record by its reference or a small detail, with the address that opens it', async () => {
  const byRef = await find(tokens.admin, `prj-${String(projectA).padStart(4, '0')}`);
  assert.deepEqual(byRef.map((r) => [r.type, r.id, r.link]), [['project', P.a, `/projects/${P.a}`]]);
  assert.match(byRef[0]!.title, new RegExp(`^PRJ-0*${projectA} · Walnut galley`));
  assert.equal((await find(tokens.admin, `PRJ ${projectA}`))[0]?.id, P.a, 'any spelling of the number');

  const [inv] = await find(tokens.admin, INVOICE.toLowerCase());
  assert.deepEqual([inv?.type, inv?.link], ['invoice', `/invoices?open=inv_s_${run}`]);
  const [enq] = await find(tokens.admin, `ENQ-${enquiryNo}`);
  assert.deepEqual([enq?.type, enq?.link], ['enquiry', `/enquiries?id=${enquiryId}`]);
  assert.equal((await find(tokens.admin, `mabel-${run}`))[0]?.id, enquiryId, 'by email');
  const [booking] = await find(tokens.admin, BOOKING);
  assert.deepEqual([booking?.type, booking?.link], ['booking', `/bookings?open=apt_s_${run}`]);
  const [client] = await find(tokens.admin, `quillfeather ${run}`);
  assert.deepEqual([client?.type, client?.link], ['client', `/clients/${CLIENT_A.id}`]);
  const walnut = await find(tokens.admin, `Walnut`);
  assert.ok([P.a, P.b].every((id) => walnut.some((r) => r.id === id)), 'both projects, whoever they belong to');
  assert.deepEqual(await find(tokens.admin, 'x'), [], 'too short to search');
});

test('a Designer finds only their own clients and projects, never invoices, enquiries or bookings', async () => {
  const walnut = await find(tokens.desA, 'Walnut');
  assert.deepEqual(walnut.map((r) => r.id), [P.a], 'their project, not the other Designer\'s');
  assert.deepEqual(await find(tokens.desA, `Hollowmere ${run}`), [], 'a client of someone else\'s project');
  assert.equal((await find(tokens.desA, `Quillfeather ${run}`))[0]?.id, CLIENT_A.id);
  for (const q of [INVOICE, BOOKING, `mabel-${run}`, `ENQ-${enquiryNo}`]) assert.deepEqual(await find(tokens.desA, q), [], `a Designer never sees ${q}`);
  assert.deepEqual((await find(tokens.desB, 'Walnut')).map((r) => r.id), [P.b]);
});

test('no search for a client, an Editor or nobody signed in', async () => {
  for (const token of [tokens.client, tokens.editor]) assert.equal((await call('/search?q=Walnut', token)).status, 403);
  assert.equal((await call('/search?q=Walnut')).status, 401);
});
