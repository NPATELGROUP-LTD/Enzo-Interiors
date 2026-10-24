import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import { Prisma, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { ADMIN, startTestApp } from './app';

/** Projects: roles, Designer/installer scope, and what a client sees, against the real AppModule. */

let app: Awaited<ReturnType<typeof startTestApp>>;
let prisma: PrismaClient;
const run = randomUUID().slice(0, 8);
const PASSWORD = 'project-password-123';
const EDITOR = { id: `stf_ed_${run}`, email: `p-editor-${run}@test.enzo.local`, role: 'Editor' };
const DESIGNER = { id: `stf_des_${run}`, email: `p-designer-${run}@test.enzo.local`, role: 'Designer' };
const INSTALLER = { id: `stf_inst_${run}`, email: `p-installer-${run}@test.enzo.local`, role: 'Installer' };
const MINE = { id: `cli_pmine_${run}`, email: `p-mine-${run}@test.enzo.local` };
const OTHER = { id: `cli_pother_${run}`, email: `p-other-${run}@test.enzo.local` };
const P = {
  designs: `prj_des_${run}`, // MINE's, DESIGNER is its designer, awaiting approval
  installs: `prj_inst_${run}`, // MINE's, DESIGNER is its installer
  hidden: `prj_hid_${run}`, // MINE's, not sent to the client, nobody assigned
  other: `prj_oth_${run}`, // OTHER's, nobody assigned
};
const DOCS = { shared: `doc_s_${run}`, internal: `doc_i_${run}`, foreign: `doc_f_${run}` };
const INVOICES = { draft: `inv_d_${run}`, sent: `inv_s_${run}` };

const tokens = { admin: '', editor: '', designer: '', mine: '', other: '' };

before(async () => {
  app = await startTestApp();
  prisma = new PrismaClient();

  const password_hash = await bcrypt.hash(PASSWORD, 4);
  for (const staff of [EDITOR, DESIGNER, INSTALLER]) {
    await prisma.staffUser.create({ data: { ...staff, name: `Test ${staff.role} ${run}`, password_hash } });
  }
  const client = { joined_date: new Date(), status: 'Active', password_hash };
  await prisma.client.create({ data: { ...client, ...MINE, name: 'Mine' } });
  await prisma.client.create({ data: { ...client, ...OTHER, name: 'Other' } });

  const project = { type: 'Kitchen', status: 'Design', client_visible: true };
  await prisma.project.createMany({
    data: [
      { ...project, id: P.designs, client_id: MINE.id, name: 'Designs', status: 'Approval', assigned_designer_id: DESIGNER.id },
      { ...project, id: P.installs, client_id: MINE.id, name: 'Installs', assigned_installer_id: DESIGNER.id },
      { ...project, id: P.hidden, client_id: MINE.id, name: 'Hidden', client_visible: false },
      { ...project, id: P.other, client_id: OTHER.id, name: 'Other' },
    ],
  });

  const document = { project_id: P.designs, type: 'Plan', size_bytes: 1, upload_date: new Date(), storage_url: 'secret/key.pdf' };
  await prisma.documentRecord.createMany({
    data: [
      { ...document, id: DOCS.shared, client_id: MINE.id, name: 'Shared plan', client_visible: true },
      { ...document, id: DOCS.internal, client_id: MINE.id, name: 'Internal plan', client_visible: false },
      // Points at MINE's project but belongs to OTHER: never shown on it.
      { ...document, id: DOCS.foreign, client_id: OTHER.id, name: 'Foreign plan', client_visible: true },
    ],
  });
  const invoice = { client_id: MINE.id, project_id: P.designs, amount: 100, vat_rate: 20, due_date: new Date() };
  await prisma.invoice.createMany({
    data: [
      { ...invoice, id: INVOICES.draft, number: `D-${run}`, status: 'Draft' },
      { ...invoice, id: INVOICES.sent, number: `S-${run}`, status: 'Sent' },
    ],
  });

  tokens.admin = await signIn('/auth/admin/login', ADMIN.email, ADMIN.password);
  tokens.editor = await signIn('/auth/admin/login', EDITOR.email, PASSWORD);
  tokens.designer = await signIn('/auth/admin/login', DESIGNER.email, PASSWORD);
  tokens.mine = await signIn('/auth/portal/login', MINE.email, PASSWORD);
  tokens.other = await signIn('/auth/portal/login', OTHER.email, PASSWORD);
});

after(async () => {
  await prisma.invoice.deleteMany({ where: { id: { in: Object.values(INVOICES) } } });
  await prisma.documentRecord.deleteMany({ where: { id: { in: Object.values(DOCS) } } });
  await prisma.project.deleteMany({ where: { client_id: { in: [MINE.id, OTHER.id] } } });
  await prisma.client.deleteMany({ where: { id: { in: [MINE.id, OTHER.id] } } });
  await prisma.changeRequest.deleteMany({ where: { requested_by: INSTALLER.id } });
  await prisma.notification.deleteMany({ where: { recipient_id: { in: [DESIGNER.id, INSTALLER.id] } } });
  await prisma.staffUser.deleteMany({ where: { id: { in: [EDITOR.id, DESIGNER.id, INSTALLER.id] } } });
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
  assert.equal(res.status, status, `${res.url} answered ${res.status}`);
  return (await res.json()) as T;
}

interface Detail {
  project: { id: string };
  documents: Array<Record<string, unknown>>;
  invoices: Array<{ id: string }>;
  activity: unknown[];
}

const ids = (rows: Array<{ id: string }>) => rows.map((row) => row.id).sort();

test('Settings › Users shows and assigns Admin, Editor, Designer and Installer distinctly', async () => {
  const list = await json<Array<{ id: string; role: string }>>(await call('GET', '/users', tokens.admin));
  const roleOf = (id: string) => list.find((row) => row.id === id)?.role;
  assert.equal(roleOf(DESIGNER.id), 'Designer');
  assert.equal(roleOf(EDITOR.id), 'Editor');
  assert.equal(roleOf(INSTALLER.id), 'Installer');

  const before = await prisma.staffUser.findUniqueOrThrow({ where: { id: INSTALLER.id } });
  assert.equal((await json<{ role: string }>(await call('PUT', `/users/${INSTALLER.id}`, tokens.admin, { role: 'Editor' }))).role, 'Editor');
  assert.equal((await json<{ role: string }>(await call('PUT', `/users/${INSTALLER.id}`, tokens.admin, { role: 'Installer' }))).role, 'Installer');
  const row = await prisma.staffUser.findUniqueOrThrow({ where: { id: INSTALLER.id } });
  assert.equal(row.role, 'Installer');
  assert.equal(row.token_version, before.token_version + 2, 'each role change signs them out');
  assert.equal((await call('PUT', `/users/${INSTALLER.id}`, tokens.admin, { role: 'Owner' })).status, 400);
});

test('an Admin creates, reads, updates, moves and deletes a project; assignees hear about it', async () => {
  const created = await json<Record<string, unknown>>(
    await call('POST', '/projects', tokens.admin, { client_id: MINE.id, name: `New ${run}`, type: 'Bedroom', assigned_designer_id: DESIGNER.id }),
    201,
  );
  const id = created.id as string;
  assert.equal(created.status, 'Consultation');
  assert.equal(created.client_visible, false, 'not sent to the client until the Admin says so');
  assert.equal(created.assigned_designer_name, `Test Designer ${run}`);
  assert.equal(await prisma.notification.count({ where: { recipient_id: DESIGNER.id, link: `/projects/${id}` } }), 1);

  assert.ok(ids(await json(await call('GET', '/projects', tokens.admin))).includes(id));
  const put = await json<{ client_visible: boolean; assigned_installer_name: string }>(
    await call('PUT', `/projects/${id}`, tokens.admin, { client_visible: true, assigned_installer_id: INSTALLER.id }),
  );
  assert.equal(put.client_visible, true);
  assert.equal(put.assigned_installer_name, `Test Installer ${run}`);
  assert.equal(await prisma.notification.count({ where: { recipient_id: INSTALLER.id, link: `/projects/${id}` } }), 1);

  // Only Designers are assigned; the client is fixed; stages are the five.
  assert.equal((await call('PUT', `/projects/${id}`, tokens.admin, { assigned_designer_id: EDITOR.id })).status, 400);
  assert.equal((await call('PUT', `/projects/${id}`, tokens.admin, { client_id: OTHER.id })).status, 400);
  assert.equal((await call('PATCH', `/projects/${id}/stage`, tokens.admin, { status: 'Bogus' })).status, 400);
  assert.equal((await call('POST', '/projects', tokens.admin, { client_id: MINE.id, name: 'Bad', type: 'Kitchen', status: 'Done' })).status, 400);
  const moved = await json<{ status: string }>(await call('PATCH', `/projects/${id}/stage`, tokens.admin, { status: 'Design' }));
  assert.equal(moved.status, 'Design');

  const detail = await json<Detail>(await call('GET', `/projects/${id}/detail`, tokens.admin));
  assert.ok(detail.activity.length > 0);

  // Deleting needs the Admin's password again; its invoices stay on the client, unlinked.
  const invoiceId = `inv_pdel_${run}`;
  await prisma.invoice.create({
    data: { id: invoiceId, number: `PD-${run}`, client_id: MINE.id, project_id: id, amount: 60, vat_rate: 20, status: 'Paid', due_date: new Date() },
  });
  assert.equal((await call('DELETE', `/projects/${id}`, tokens.admin)).status, 403, 'no password');
  assert.equal((await call('DELETE', `/projects/${id}`, tokens.admin, { password: 'not-it' })).status, 403, 'wrong password');
  assert.equal((await call('DELETE', `/projects/${id}`, tokens.admin, { password: ADMIN.password })).status, 200);
  assert.equal((await call('GET', `/projects/${id}`, tokens.admin)).status, 404);
  const kept = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
  assert.equal(kept.project_id, null);
  await prisma.invoice.delete({ where: { id: invoiceId } });
});

test('an Editor is refused on every /projects route', async () => {
  const routes: Array<[string, string, unknown?]> = [
    ['GET', '/projects'],
    ['GET', `/projects/${P.designs}`],
    ['GET', `/projects/${P.designs}/detail`],
    ['POST', '/projects', { client_id: MINE.id, name: 'Nope', type: 'Kitchen' }],
    ['PUT', `/projects/${P.designs}`, { current_stage: 'x' }],
    ['PATCH', `/projects/${P.designs}/stage`, { status: 'Design' }],
    ['DELETE', `/projects/${P.other}`],
  ];
  for (const [method, path, body] of routes) {
    assert.equal((await call(method, path, tokens.editor, body)).status, 403, `${method} ${path}`);
  }
});

test('a Designer sees only projects they design or install, and changes only the stage and its note', async () => {
  assert.deepEqual(ids(await json(await call('GET', '/projects', tokens.designer))), [P.designs, P.installs].sort());

  for (const id of [P.hidden, P.other]) {
    assert.equal((await call('GET', `/projects/${id}`, tokens.designer)).status, 404, id);
    assert.equal((await call('GET', `/projects/${id}/detail`, tokens.designer)).status, 404, id);
    assert.equal((await call('PUT', `/projects/${id}`, tokens.designer, { current_stage: 'x' })).status, 404, id);
    assert.equal((await call('PATCH', `/projects/${id}/stage`, tokens.designer, { status: 'Design' })).status, 404, id);
  }

  await json(await call('PUT', `/projects/${P.designs}`, tokens.designer, { current_stage: 'Drawings out' }));
  // Progress follows the stage; nobody types it.
  assert.equal((await call('PUT', `/projects/${P.designs}`, tokens.designer, { progress_pct: 55 })).status, 400);
  assert.equal((await json<{ status: string }>(await call('PATCH', `/projects/${P.installs}/stage`, tokens.designer, { status: 'Installation' }))).status, 'Installation');

  for (const body of [{ client_visible: true }, { assigned_designer_id: null }, { assigned_installer_id: DESIGNER.id }, { name: 'Renamed' }]) {
    assert.equal((await call('PUT', `/projects/${P.designs}`, tokens.designer, body)).status, 403, JSON.stringify(body));
  }
  assert.equal((await call('POST', '/projects', tokens.designer, { client_id: MINE.id, name: 'Nope', type: 'Kitchen' })).status, 403);
  assert.equal((await call('DELETE', `/projects/${P.designs}`, tokens.designer)).status, 403);
  const row = await prisma.project.findUniqueOrThrow({ where: { id: P.designs } });
  assert.equal(row.assigned_designer_id, DESIGNER.id);
  assert.equal(row.current_stage, 'Drawings out');

  // Staff see internal documents and drafts, but never another client's file or a storage key.
  const detail = await json<Detail>(await call('GET', `/projects/${P.designs}/detail`, tokens.designer));
  assert.deepEqual(ids(detail.documents as Array<{ id: string }>), [DOCS.internal, DOCS.shared].sort());
  assert.deepEqual(detail.invoices, [], 'a Designer gets no invoices');
  assert.ok(detail.documents.every((document) => !('storage_url' in document)));
});

test('a client sees only their own shared projects, without drafts, internal files or the activity log', async () => {
  assert.deepEqual(ids(await json(await call('GET', '/projects', tokens.mine))), [P.designs, P.installs].sort());

  const detail = await json<Detail>(await call('GET', `/projects/${P.designs}/detail`, tokens.mine));
  assert.deepEqual(detail.activity, []);
  assert.deepEqual(ids(detail.invoices), [INVOICES.sent]);
  assert.deepEqual(ids(detail.documents as Array<{ id: string }>), [DOCS.shared]);
  assert.ok(!('storage_url' in detail.documents[0]!));

  for (const id of [P.hidden, P.other]) {
    assert.equal((await call('GET', `/projects/${id}/detail`, tokens.mine)).status, 404, id);
  }
  // OTHER's foreign document points at MINE's project; OTHER still cannot reach it.
  assert.equal((await call('GET', `/projects/${P.designs}/detail`, tokens.other)).status, 404);
  assert.equal((await call('POST', `/projects/${P.designs}/approve`, tokens.other, {})).status, 404);
  assert.equal((await call('POST', `/projects/${P.designs}/request-changes`, tokens.other, { note: 'not mine' })).status, 404);
  assert.ok(!ids(await json(await call('GET', '/projects', tokens.other))).includes(P.designs));

  // Staff-only routes stay shut to a client.
  assert.equal((await call('GET', `/projects/${P.designs}`, tokens.mine)).status, 403);
  assert.equal((await call('PUT', `/projects/${P.designs}`, tokens.mine, { current_stage: 'x' })).status, 403);
  assert.equal((await call('PATCH', `/projects/${P.designs}/stage`, tokens.mine, { status: 'Completed' })).status, 403);

  const approved = await json<{ status: string }>(await call('POST', `/projects/${P.designs}/approve`, tokens.mine, {}));
  assert.equal(approved.status, 'Installation');
});

test('staff are refused on the client-only decision routes', async () => {
  for (const token of [tokens.admin, tokens.designer]) {
    for (const path of [`/projects/${P.installs}/approve`, `/projects/${P.installs}/request-changes`]) {
      assert.equal((await call('POST', path, token, { note: 'x' })).status, 403, path);
    }
  }
});

test('an Admin renames stages (projects follow) and cannot remove one still in use', async () => {
  const stages = await json<Array<{ name: string; progress: number; approval: boolean }>>(await call('GET', '/projects/stages', tokens.mine));
  assert.deepEqual(stages.map((stage) => stage.name), ['Consultation', 'Design', 'Approval', 'Installation', 'Completed']);
  for (const token of [tokens.designer, tokens.editor, tokens.mine]) {
    assert.equal((await call('PUT', '/projects/stages', token, { stages })).status, 403);
  }

  const renamed = stages.map((stage) => ({ ...stage, was: stage.name, name: stage.name === 'Design' ? 'Designing' : stage.name }));
  try {
    await json(await call('PUT', '/projects/stages', tokens.admin, { stages: renamed }));
    assert.equal((await prisma.project.findUniqueOrThrow({ where: { id: P.other } })).status, 'Designing');
    assert.equal((await call('PATCH', `/projects/${P.hidden}/stage`, tokens.admin, { status: 'Design' })).status, 400, 'the old name is gone');

    const without = renamed.filter((stage) => stage.name !== 'Designing').map((stage) => ({ ...stage, was: stage.name }));
    const refused = await call('PUT', '/projects/stages', tokens.admin, { stages: without });
    assert.equal(refused.status, 409);
    assert.ok(((await refused.json()) as { in_use: Record<string, number> }).in_use.Designing! >= 2);
    assert.equal((await prisma.project.findUniqueOrThrow({ where: { id: P.hidden } })).status, 'Designing', 'nothing written');
  } finally {
    await prisma.siteSettings.update({ where: { id: 'site' }, data: { project_stages: Prisma.DbNull } });
    await prisma.project.updateMany({ where: { status: 'Designing' }, data: { status: 'Design' } });
  }
});

test('an Installer reads their projects but only asks an Admin to move a stage; neither reaches the CMS', async () => {
  await prisma.project.update({ where: { id: P.other }, data: { assigned_installer_id: INSTALLER.id } });
  const token = await signIn('/auth/admin/login', INSTALLER.email, PASSWORD);
  assert.deepEqual(ids(await json(await call('GET', '/projects', token))), [P.other]);
  assert.equal((await call('PATCH', `/projects/${P.other}/stage`, token, { status: 'Installation' })).status, 403);
  assert.equal((await call('PUT', `/projects/${P.other}`, token, { current_stage: 'x' })).status, 403);
  for (const who of [token, tokens.designer]) assert.equal((await call('GET', '/cms/overview', who)).status, 403);

  const ask = (body: unknown) => call('POST', '/change-requests', token, body);
  assert.equal((await ask({ kind: 'project_stage', project_id: P.designs, status: 'Installation' })).status, 404, 'not their project');
  assert.equal((await ask({ kind: 'client_details', client_id: OTHER.id, notes: 'x' })).status, 403, 'Installers never edit clients');
  assert.equal((await ask({ kind: 'project_stage', project_id: P.other, status: 'Nope' })).status, 400);
  const asked = await json<{ id: string }>(await ask({ kind: 'project_stage', project_id: P.other, status: 'Installation', note: 'Fitted' }), 201);

  assert.ok(ids(await json(await call('GET', '/change-requests?status=Pending', tokens.admin))).includes(asked.id));
  assert.deepEqual(await json(await call('GET', '/change-requests', tokens.designer)), [], 'only your own');
  assert.equal((await call('POST', `/change-requests/${asked.id}/approve`, token)).status, 403);
  assert.equal((await prisma.project.findUniqueOrThrow({ where: { id: P.other } })).status, 'Design', 'nothing moves before approval');

  await json(await call('POST', `/change-requests/${asked.id}/approve`, tokens.admin), 200);
  assert.equal((await prisma.project.findUniqueOrThrow({ where: { id: P.other } })).status, 'Installation');
  assert.equal((await call('POST', `/change-requests/${asked.id}/decline`, tokens.admin)).status, 404, 'decided once');

  // Each bell is its own: the Installer hears the decision, never the Admins' "asks to" note.
  const bell = await json<{ items: Array<{ kind: string; title: string }> }>(await call('GET', '/notifications', token));
  assert.ok(bell.items.some((item) => item.kind === 'request' && item.title.includes('approved')));
  assert.ok(!bell.items.some((item) => item.title.includes('asks to')));
});
