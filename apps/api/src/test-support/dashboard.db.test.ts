import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { ADMIN, startTestApp } from './app';

/** The dashboards: what each role is told, against the real AppModule and database. */

let app: Awaited<ReturnType<typeof startTestApp>>;
let prisma: PrismaClient;
const run = randomUUID().slice(0, 8);
const PASSWORD = 'dashboard-password-123';
const EDITOR = { id: `stf_xed_${run}`, email: `x-editor-${run}@test.enzo.local`, role: 'Editor' };
const DESIGNER = { id: `stf_xdes_${run}`, email: `x-designer-${run}@test.enzo.local`, role: 'Designer' };
const OTHER_DESIGNER = { id: `stf_xod_${run}`, email: `x-odesigner-${run}@test.enzo.local`, role: 'Designer' };
const MINE = { id: `cli_xmine_${run}`, email: `x-mine-${run}@test.enzo.local` };
const OTHER = { id: `cli_xoth_${run}`, email: `x-other-${run}@test.enzo.local` };
const P = { shared: `prj_xsh_${run}`, hidden: `prj_xhid_${run}`, other: `prj_xoth_${run}` };
const tokens = { admin: '', editor: '', designer: '', mine: '', other: '' };

interface Admin {
  appointments: { upcoming: number };
  projects: { by_stage: Record<string, number> };
  enquiries: { new: number };
  invoices: { outstanding_total: number; paid_total: number; overdue_count: number };
  clients: { total: number };
  appointments_chart: unknown[];
  revenue_chart: unknown[];
}
let baseline: Admin;

const get = (path: string, token?: string) =>
  fetch(`${app.url}${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });

async function signIn(path: string, email: string, password: string): Promise<string> {
  const res = await fetch(`${app.url}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(res.status, 200, `${path} for ${email}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function body<T>(path: string, token: string): Promise<T> {
  const res = await get(path, token);
  assert.equal(res.status, 200, `${path} answered ${res.status}`);
  return (await res.json()) as T;
}

before(async () => {
  app = await startTestApp();
  prisma = new PrismaClient();
  tokens.admin = await signIn('/auth/admin/login', ADMIN.email, ADMIN.password);
  baseline = await body<Admin>('/dashboard/admin', tokens.admin);

  const password_hash = await bcrypt.hash(PASSWORD, 4);
  for (const staff of [EDITOR, DESIGNER, OTHER_DESIGNER]) {
    await prisma.staffUser.create({ data: { ...staff, name: `Test ${staff.role} ${staff.id}`, password_hash } });
  }
  const client = { joined_date: new Date(), status: 'Active', password_hash };
  await prisma.client.create({ data: { ...client, ...MINE, name: 'Mine' } });
  await prisma.client.create({ data: { ...client, ...OTHER, name: 'Other' } });
  const project = { type: 'Kitchen', status: 'Design' };
  await prisma.project.createMany({
    data: [
      { ...project, id: P.shared, client_id: MINE.id, name: 'Shared', assigned_designer_id: DESIGNER.id, client_visible: true },
      { ...project, id: P.hidden, client_id: MINE.id, name: 'Hidden', client_visible: false },
      { ...project, id: P.other, client_id: OTHER.id, name: 'Other', status: 'Approval', assigned_designer_id: OTHER_DESIGNER.id, client_visible: true },
    ],
  });

  const day = 86_400_000;
  const invoice = { vat_rate: 20 };
  await prisma.invoice.createMany({
    data: [
      { ...invoice, id: `inv_xd_${run}`, number: `X-D-${run}`, client_id: MINE.id, project_id: P.shared, amount: 50.1, status: 'Draft', due_date: new Date(Date.now() + 9 * day) },
      { ...invoice, id: `inv_xs_${run}`, number: `X-S-${run}`, client_id: MINE.id, project_id: P.hidden, amount: 120.2, status: 'Sent', due_date: new Date(Date.now() - 5 * day) },
      { ...invoice, id: `inv_xp_${run}`, number: `X-P-${run}`, client_id: MINE.id, project_id: P.shared, amount: 300.3, status: 'Paid', due_date: new Date(Date.now() - 20 * day), paid_at: new Date() },
      { ...invoice, id: `inv_xo_${run}`, number: `X-O-${run}`, client_id: OTHER.id, project_id: P.other, amount: 200.4, status: 'Sent', due_date: new Date(Date.now() + 30 * day) },
    ],
  });
  const files = { type: 'Plan', size_bytes: 10, upload_date: new Date(), storage_url: 'k' };
  await prisma.documentRecord.createMany({
    data: [
      { ...files, id: `doc_xa_${run}`, client_id: MINE.id, project_id: P.shared, name: 'shared on shared', client_visible: true },
      { ...files, id: `doc_xb_${run}`, client_id: MINE.id, project_id: P.shared, name: 'internal', client_visible: false },
      { ...files, id: `doc_xc_${run}`, client_id: MINE.id, project_id: P.hidden, name: 'shared on hidden', client_visible: true },
    ],
  });
  const slot = { service: 'consultation', service_label: 'Consultation', source: 'admin', status: 'Confirmed' };
  await prisma.appointment.createMany({
    data: [
      { ...slot, id: `apt_xm_${run}`, reference: `X-M-${run}`, name: 'Mine', email: MINE.email.toUpperCase(), starts_at: new Date(Date.now() + 3 * day), ends_at: new Date(Date.now() + 3 * day + 36e5), slot: `x-m-${run}` },
      { ...slot, id: `apt_xo_${run}`, reference: `X-O-${run}`, name: 'Other', email: OTHER.email, starts_at: new Date(Date.now() + 2 * day), ends_at: new Date(Date.now() + 2 * day + 36e5), slot: `x-o-${run}` },
    ],
  });
  await prisma.contactSubmission.create({ data: { id: `sub_x_${run}`, name: 'Lead', email: 'lead@test.enzo.local', message: 'hello', status: 'New' } });

  tokens.editor = await signIn('/auth/admin/login', EDITOR.email, PASSWORD);
  tokens.designer = await signIn('/auth/admin/login', DESIGNER.email, PASSWORD);
  tokens.mine = await signIn('/auth/portal/login', MINE.email, PASSWORD);
  tokens.other = await signIn('/auth/portal/login', OTHER.email, PASSWORD);
});

after(async () => {
  const clients = { in: [MINE.id, OTHER.id] };
  await prisma.documentRecord.deleteMany({ where: { client_id: clients } });
  await prisma.invoice.deleteMany({ where: { client_id: clients } });
  await prisma.project.deleteMany({ where: { client_id: clients } });
  await prisma.client.deleteMany({ where: { id: clients } });
  await prisma.appointment.deleteMany({ where: { id: { in: [`apt_xm_${run}`, `apt_xo_${run}`] } } });
  await prisma.contactSubmission.deleteMany({ where: { id: `sub_x_${run}` } });
  await prisma.staffUser.deleteMany({ where: { id: { in: [EDITOR.id, DESIGNER.id, OTHER_DESIGNER.id] } } });
  await prisma.$disconnect();
  await app.close();
});

const cents = (n: number) => Math.round(n * 100);

test('an Admin sees the money, the leads, the consultations and every project', async () => {
  const now = await body<Admin>('/dashboard/admin', tokens.admin);
  // Exact to the penny: Sent 120.20 + 200.40 count as owed; the Draft never does.
  assert.equal(cents(now.invoices.outstanding_total - baseline.invoices.outstanding_total), cents(320.6));
  assert.equal(cents(now.invoices.paid_total - baseline.invoices.paid_total), cents(300.3));
  assert.equal(now.invoices.overdue_count - baseline.invoices.overdue_count, 1);
  assert.equal(now.enquiries.new - baseline.enquiries.new, 1);
  assert.equal(now.appointments.upcoming - baseline.appointments.upcoming, 2);
  assert.equal(now.projects.by_stage.Design! - baseline.projects.by_stage.Design!, 2);
  assert.equal(now.projects.by_stage.Approval! - baseline.projects.by_stage.Approval!, 1);
  assert.equal(now.clients.total - baseline.clients.total, 2);
  assert.equal(now.appointments_chart.length, 12);
  assert.equal(now.revenue_chart.length, 12);
});

test('a Designer sees only the projects they are on: no money, no enquiries, no consultations', async () => {
  const text = await (await get('/dashboard/designer', tokens.designer)).text();
  const mine = JSON.parse(text) as {
    projects: { active: number; by_stage: Record<string, number> };
    tasks: Array<{ id: string; roles: string[]; client_name: string }>;
  };
  assert.deepEqual(mine.tasks.map((t) => t.id), [P.shared]);
  assert.deepEqual(mine.tasks[0]!.roles, ['Designer']);
  assert.equal(mine.projects.active, 1);
  assert.equal(mine.projects.by_stage.Design, 1);
  assert.equal(mine.projects.by_stage.Approval, 0, "another designer's project is not counted");
  for (const word of ['invoice', 'amount', 'total', 'enquir', 'appointment', 'revenue']) {
    assert.ok(!text.toLowerCase().includes(word), `a Designer's dashboard mentions "${word}"`);
  }
  // Their view is theirs alone: the Admin's and the portal's are closed to them.
  assert.equal((await get('/dashboard/admin', tokens.designer)).status, 403);
  assert.equal((await get('/dashboard/portal', tokens.designer)).status, 403);
});

test('an Editor gets 403 on every dashboard; no token is 401', async () => {
  for (const path of ['/dashboard/admin', '/dashboard/designer', '/dashboard/portal']) {
    assert.equal((await get(path, tokens.editor)).status, 403, path);
    assert.equal((await get(path)).status, 401, path);
  }
});

test('a client sees their own shared work, never a Draft, a hidden project or its files', async () => {
  const text = await (await get('/dashboard/portal', tokens.mine)).text();
  const mine = JSON.parse(text) as {
    next_appointment: { id: string } | null;
    documents_count: number;
    invoices: { paid_total: number; outstanding_total: number; next_due: { id: string; is_overdue: boolean } | null };
    projects: { total: number; awaiting_your_approval: unknown[] };
    timeline: Array<{ id: string }>;
  };
  assert.deepEqual(mine.timeline.map((t) => t.id), [P.shared], 'the hidden project is not there');
  assert.equal(mine.projects.total, 1);
  // One shared file on the shared project; the internal one and the one on the hidden project are not counted.
  assert.equal(mine.documents_count, 1);
  // Billing reaches them regardless of project visibility; the Draft is not in the sums.
  assert.equal(cents(mine.invoices.outstanding_total), cents(120.2));
  assert.equal(cents(mine.invoices.paid_total), cents(300.3));
  assert.equal(mine.invoices.next_due?.id, `inv_xs_${run}`);
  assert.equal(mine.invoices.next_due?.is_overdue, true);
  assert.equal(mine.next_appointment?.id, `apt_xm_${run}`, 'matched by their email, whatever its case');
  // (An invoice may still name its project's id; the project itself, its name and its files are not sent.)
  assert.ok(!text.includes(`inv_xd_${run}`) && !text.includes(`inv_xo_${run}`) && !text.includes('"Hidden"') && !text.includes(P.other));
  assert.ok(!text.includes(`doc_xc_${run}`) && !text.includes('shared on hidden'));
  assert.ok(!text.includes('storage_url'));
});

test("a client never sees another client's numbers, and staff dashboards are closed to them", async () => {
  const text = await (await get('/dashboard/portal', tokens.other)).text();
  const theirs = JSON.parse(text) as { timeline: Array<{ id: string }>; projects: { awaiting_your_approval: Array<{ id: string }> }; next_appointment: { id: string } };
  assert.deepEqual(theirs.timeline.map((t) => t.id), [P.other]);
  assert.deepEqual(theirs.projects.awaiting_your_approval.map((p) => p.id), [P.other]);
  assert.equal(theirs.next_appointment.id, `apt_xo_${run}`);
  for (const id of [P.shared, P.hidden, `inv_xs_${run}`, `inv_xp_${run}`, `apt_xm_${run}`]) assert.ok(!text.includes(id), id);

  for (const path of ['/dashboard/admin', '/dashboard/designer']) {
    assert.equal((await get(path, tokens.mine)).status, 403, path);
  }
  assert.equal((await get('/dashboard/portal', tokens.admin)).status, 403, 'the portal view is for clients');
});
