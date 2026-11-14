import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import { Prisma, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { ADMIN, startTestApp } from './app';

/**
 * Nothing the client profile already says is typed again (a project's site and an invoice's job
 * address start from it), and a project can pass through several client-approval stages.
 */

let app: Awaited<ReturnType<typeof startTestApp>>;
let prisma: PrismaClient;
const run = randomUUID().slice(0, 8);
const PASSWORD = 'prefill-password-123';
const EDITOR = { id: `stf_fe_${run}`, email: `pf-editor-${run}@test.enzo.local`, role: 'Editor' };
const DESIGNER = { id: `stf_fd_${run}`, email: `pf-designer-${run}@test.enzo.local`, role: 'Designer' };
const MINE = { id: `cli_fmine_${run}`, email: `pf-mine-${run}@test.enzo.local`, address: '1 Client Road, Leicester LE1 1AA' };
const BARE = { id: `cli_fbare_${run}`, email: `pf-bare-${run}@test.enzo.local` }; // no address on file
const tokens = { admin: '', editor: '', designer: '', mine: '' };

before(async () => {
  app = await startTestApp();
  prisma = new PrismaClient();
  const password_hash = await bcrypt.hash(PASSWORD, 4);
  for (const staff of [EDITOR, DESIGNER]) {
    await prisma.staffUser.create({ data: { ...staff, name: `Test ${staff.role} ${run}`, password_hash } });
  }
  const client = { joined_date: new Date(), status: 'Active', password_hash };
  await prisma.client.create({ data: { ...client, ...MINE, name: 'Mine' } });
  await prisma.client.create({ data: { ...client, ...BARE, name: 'Bare' } });
  tokens.admin = await signIn('/auth/admin/login', ADMIN.email, ADMIN.password);
  tokens.editor = await signIn('/auth/admin/login', EDITOR.email, PASSWORD);
  tokens.designer = await signIn('/auth/admin/login', DESIGNER.email, PASSWORD);
  tokens.mine = await signIn('/auth/portal/login', MINE.email, PASSWORD);
});

after(async () => {
  await prisma.siteSettings.update({ where: { id: 'site' }, data: { project_stages: Prisma.DbNull } });
  const clients = [MINE.id, BARE.id];
  await prisma.invoice.deleteMany({ where: { client_id: { in: clients } } });
  await prisma.project.deleteMany({ where: { client_id: { in: clients } } });
  await prisma.client.deleteMany({ where: { id: { in: clients } } });
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

async function json<T>(res: Response, status = 200): Promise<T> {
  const text = await res.text();
  assert.equal(res.status, status, `answered ${res.status}: ${text}`);
  return JSON.parse(text) as T;
}

interface Project {
  id: string;
  status: string;
  site_address: string | null;
}
interface Invoice {
  id: string;
  job_address: string | null;
}

const newProject = (body: Record<string, unknown>, token = tokens.admin, status = 201) =>
  call('POST', '/projects', token, { client_id: MINE.id, name: `Prefill ${run}`, type: 'Kitchen', ...body }).then((res) => json<Project>(res, status));
const newInvoice = (body: Record<string, unknown>) =>
  call('POST', '/invoices', tokens.admin, {
    client_id: MINE.id,
    due_date: '2030-01-31',
    items: [{ description: 'Fitting', quantity: 1, unit_price: 100 }],
    ...body,
  }).then((res) => json<Invoice>(res, 201));

test('a new project starts from the client address; the Admin can put it elsewhere; staff below Admin cannot', async () => {
  const home = await newProject({});
  assert.equal(home.site_address, MINE.address);
  assert.equal((await newProject({ client_id: BARE.id })).site_address, null, 'no address on file, none invented');

  const elsewhere = await newProject({ site_address: ' 9 Site Lane, Derby ' });
  assert.equal(elsewhere.site_address, '9 Site Lane, Derby');

  const edited = await json<Project>(await call('PUT', `/projects/${home.id}`, tokens.admin, { site_address: '4 New Street, Leicester' }));
  assert.equal(edited.site_address, '4 New Street, Leicester');
  assert.equal((await json<Project>(await call('PUT', `/projects/${home.id}`, tokens.admin, { site_address: '' }))).site_address, null, 'cleared');

  // Only an Admin writes it (a Designer may change the current stage only), and a client reads their own.
  await prisma.project.update({ where: { id: home.id }, data: { assigned_designer_id: DESIGNER.id, client_visible: true } });
  assert.equal((await call('PUT', `/projects/${home.id}`, tokens.designer, { site_address: 'x' })).status, 403);
  assert.equal((await call('PUT', `/projects/${home.id}`, tokens.editor, { site_address: 'x' })).status, 403);
  assert.equal((await call('PUT', `/projects/${home.id}`, tokens.mine, { site_address: 'x' })).status, 403);
  assert.equal((await json<{ project: Project }>(await call('GET', `/projects/${elsewhere.id}/detail`, tokens.admin))).project.site_address, '9 Site Lane, Derby');
});

test('an invoice job address defaults to the project site, else the client address, and can be overridden', async () => {
  const site = await newProject({ site_address: '9 Site Lane, Derby' });
  assert.equal((await newInvoice({ project_id: site.id })).job_address, '9 Site Lane, Derby');

  const noSite = await prisma.project.create({
    data: { id: `prj_fns_${run}`, client_id: MINE.id, name: 'No site', type: 'Kitchen', status: 'Design', client_visible: false },
  });
  assert.equal((await newInvoice({ project_id: noSite.id })).job_address, MINE.address, 'falls back to the client');
  assert.equal((await newInvoice({})).job_address, MINE.address, 'no project: the client');
  assert.equal((await newInvoice({ project_id: site.id, job_address: 'Unit 5, Trade Park' })).job_address, 'Unit 5, Trade Park', 'per-invoice override');

  const bare = await call('POST', '/invoices', tokens.admin, {
    client_id: BARE.id,
    due_date: '2030-01-31',
    items: [{ description: 'Fitting', quantity: 1, unit_price: 100 }],
  });
  assert.equal((await json<Invoice>(bare, 201)).job_address, null);
});

const STAGES = [
  { name: 'Consultation', progress: 10 },
  { name: 'Design', progress: 30 },
  { name: 'Design sign-off', progress: 45, approval: true },
  { name: 'Build', progress: 60 },
  { name: 'Final sign-off', progress: 90, approval: true },
  { name: 'Completed', progress: 100 },
];

test('several stages can ask for the client approval: each approves forward and sends changes back', async () => {
  for (const token of [tokens.designer, tokens.editor, tokens.mine]) {
    assert.equal((await call('PUT', '/projects/stages', token, { stages: STAGES })).status, 403);
  }
  const twoInARow = STAGES.map((stage) => ({ ...stage, approval: stage.name === 'Build' || stage.name === 'Final sign-off' }));
  assert.equal((await call('PUT', '/projects/stages', tokens.admin, { stages: twoInARow })).status, 400);
  assert.equal((await call('PUT', '/projects/stages', tokens.admin, { stages: STAGES.map((s) => ({ ...s, approval: s.name === 'Completed' })) })).status, 400);

  const saved = await json<Array<{ name: string; approval: boolean }>>(await call('PUT', '/projects/stages', tokens.admin, { stages: STAGES }));
  assert.deepEqual(saved.filter((stage) => stage.approval).map((stage) => stage.name), ['Design sign-off', 'Final sign-off']);

  const project = await newProject({ client_visible: true, status: 'Design sign-off' });
  const detail = async () => json<{ awaiting_client_decision: boolean; project: Project }>(await call('GET', `/projects/${project.id}/detail`, tokens.mine));
  assert.equal((await detail()).awaiting_client_decision, true);

  const dashboard = async () =>
    json<{ projects: { awaiting_your_approval: Array<{ id: string }> } }>(await call('GET', '/dashboard/portal', tokens.mine));
  assert.ok((await dashboard()).projects.awaiting_your_approval.some((row) => row.id === project.id));

  // Approving the first moves on to the working stage after it, where nothing waits on the client.
  assert.equal((await json<Project>(await call('POST', `/projects/${project.id}/approve`, tokens.mine, {}))).status, 'Build');
  const building = await detail();
  assert.equal(building.awaiting_client_decision, false);
  assert.equal((await call('POST', `/projects/${project.id}/approve`, tokens.mine, {})).status, 400, 'nothing to approve at Build');

  // The second approval stage: asking for changes goes back to the stage before it, not to the first sign-off.
  await call('PATCH', `/projects/${project.id}/stage`, tokens.admin, { status: 'Final sign-off' });
  assert.equal((await detail()).awaiting_client_decision, true);
  assert.equal((await call('POST', `/projects/${project.id}/request-changes`, tokens.mine, {})).status, 400, 'a note is needed');
  assert.equal((await json<Project>(await call('POST', `/projects/${project.id}/request-changes`, tokens.mine, { note: 'Handles too low' }))).status, 'Build');

  await call('PATCH', `/projects/${project.id}/stage`, tokens.admin, { status: 'Final sign-off' });
  assert.equal((await json<Project>(await call('POST', `/projects/${project.id}/approve`, tokens.mine, {}))).status, 'Completed');

  // Stored lists from before (one approval stage) and the default five keep working.
  await prisma.siteSettings.update({ where: { id: 'site' }, data: { project_stages: Prisma.DbNull } });
  const defaults = await json<Array<{ name: string; approval: boolean }>>(await call('GET', '/projects/stages', tokens.mine));
  assert.deepEqual(defaults.filter((stage) => stage.approval).map((stage) => stage.name), ['Approval']);
});
