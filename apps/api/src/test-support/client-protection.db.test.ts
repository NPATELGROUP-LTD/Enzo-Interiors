import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import { Prisma, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { ADMIN, startTestApp } from './app';

/**
 * What a client may do with a file or an invoice, per role: view-only unless an Admin allows
 * saving it (documents and invoices), plus the Settings › Document categories list.
 */

let app: Awaited<ReturnType<typeof startTestApp>>;
let prisma: PrismaClient;
const run = randomUUID().slice(0, 8);
const PASSWORD = 'protect-password-123';
const EDITOR = { id: `stf_pe_${run}`, email: `pr-editor-${run}@test.enzo.local`, role: 'Editor' };
const DESIGNER = { id: `stf_pd_${run}`, email: `pr-designer-${run}@test.enzo.local`, role: 'Designer' };
const MINE = { id: `cli_pmine_${run}`, email: `pr-mine-${run}@test.enzo.local` };
const OTHER = { id: `cli_poth_${run}`, email: `pr-other-${run}@test.enzo.local` };
const PROJECT = `prj_pr_${run}`; // MINE's, shared, DESIGNER designs it
const tokens = { admin: '', editor: '', designer: '', mine: '', other: '' };

const PDF = Buffer.from('%PDF-1.4\n% test document\n1 0 obj <<>> endobj\n%%EOF\n');
const SHEET = Buffer.from('504b0304' + '00'.repeat(30), 'hex');
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

before(async () => {
  app = await startTestApp();
  prisma = new PrismaClient();
  const password_hash = await bcrypt.hash(PASSWORD, 4);
  for (const staff of [EDITOR, DESIGNER]) {
    await prisma.staffUser.create({ data: { ...staff, name: `Test ${staff.role} ${run}`, password_hash } });
  }
  const client = { joined_date: new Date(), status: 'Active', password_hash };
  await prisma.client.create({ data: { ...client, ...MINE, name: 'Mine' } });
  await prisma.client.create({ data: { ...client, ...OTHER, name: 'Other' } });
  await prisma.project.create({
    data: { id: PROJECT, client_id: MINE.id, name: 'Shared', type: 'Kitchen', status: 'Design', client_visible: true, assigned_designer_id: DESIGNER.id },
  });
  tokens.admin = await signIn('/auth/admin/login', ADMIN.email, ADMIN.password);
  tokens.editor = await signIn('/auth/admin/login', EDITOR.email, PASSWORD);
  tokens.designer = await signIn('/auth/admin/login', DESIGNER.email, PASSWORD);
  tokens.mine = await signIn('/auth/portal/login', MINE.email, PASSWORD);
  tokens.other = await signIn('/auth/portal/login', OTHER.email, PASSWORD);
});

after(async () => {
  await prisma.siteSettings.update({ where: { id: 'site' }, data: { document_categories: Prisma.DbNull } });
  for (const row of await prisma.documentRecord.findMany({ where: { client_id: { in: [MINE.id, OTHER.id] } } })) {
    await call('DELETE', `/documents/${row.id}`, tokens.admin); // through the API, so the objects go too
  }
  await prisma.invoice.deleteMany({ where: { client_id: { in: [MINE.id, OTHER.id] } } });
  await prisma.project.deleteMany({ where: { client_id: { in: [MINE.id, OTHER.id] } } });
  await prisma.client.deleteMany({ where: { id: { in: [MINE.id, OTHER.id] } } });
  await prisma.notification.deleteMany({ where: { recipient_id: DESIGNER.id } });
  await prisma.staffUser.deleteMany({ where: { id: { in: [EDITOR.id, DESIGNER.id] } } });
  await prisma.$disconnect();
  await app.close();
});

async function call(method: string, path: string, token?: string, body?: unknown): Promise<Response> {
  const form = body instanceof FormData;
  return fetch(`${app.url}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined || form ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : form ? body : JSON.stringify(body),
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

interface Doc {
  id: string;
  type: string;
  category: string;
  client_visible: boolean;
  client_can_download: boolean;
}

function upload(
  token: string,
  fields: Record<string, string>,
  file: { bytes: Buffer; type: string; name: string } = { bytes: PDF, type: 'application/pdf', name: 'Plan.pdf' },
) {
  const form = new FormData();
  for (const [key, value] of Object.entries({ client_id: MINE.id, project_id: PROJECT, ...fields })) form.append(key, value);
  form.append('file', new Blob([new Uint8Array(file.bytes)], { type: file.type }), file.name);
  return call('POST', '/documents/upload', token, form);
}

/** A file the studio has shared with MINE, view-only. */
const shared = async (file?: { bytes: Buffer; type: string; name: string }) => {
  const doc = await json<Doc>(await upload(tokens.admin, { type: 'Plan' }, file), 201);
  return json<Doc>(await call('PATCH', `/documents/${doc.id}/visibility`, tokens.admin, { client_visible: true }));
};

test('categories: the types by default; only an Admin edits them; staff read them; filing needs a known one', async () => {
  const types = ['Contract', 'Invoice', 'Plan', 'MoodBoard', 'Other'];
  assert.deepEqual(await json(await call('GET', '/documents/categories', tokens.admin)), types);
  assert.deepEqual(await json(await call('GET', '/documents/categories', tokens.designer)), types);
  for (const token of [tokens.editor, tokens.mine, undefined]) {
    assert.equal((await call('GET', '/documents/categories', token)).status, token ? 403 : 401);
  }
  const next = ['Survey', 'Contract', 'Plan', 'Other'];
  for (const token of [tokens.designer, tokens.editor, tokens.mine]) {
    assert.equal((await call('PUT', '/documents/categories', token, { categories: next })).status, 403);
  }
  assert.equal((await call('PUT', '/documents/categories', tokens.admin, { categories: ['Plan', 'plan'] })).status, 400);
  assert.equal((await call('PUT', '/documents/categories', tokens.admin, { categories: [] })).status, 400);
  assert.deepEqual(await json(await call('PUT', '/documents/categories', tokens.admin, { categories: [' Survey ', 'Contract', 'Plan', 'Other'] })), next);
  assert.deepEqual(await json(await call('GET', '/documents/categories', tokens.designer)), next);

  // Filed under a configured category; its type stays one of the five (Other when it is not one).
  const survey = await json<Doc>(await upload(tokens.admin, { category: 'Survey' }), 201);
  assert.deepEqual([survey.category, survey.type], ['Survey', 'Other']);
  const contract = await json<Doc>(await upload(tokens.designer, { category: 'Contract' }), 201);
  assert.deepEqual([contract.category, contract.type], ['Contract', 'Contract']);
  assert.equal((await upload(tokens.admin, { category: 'MoodBoard' })).status, 400, 'removed from the list');
  assert.equal((await upload(tokens.admin, {})).status, 400, 'a category (or a type) is needed');
  // Old callers still send a type alone: its category is the type.
  const legacy = await json<Doc>(await upload(tokens.admin, { type: 'Invoice' }), 201);
  assert.deepEqual([legacy.category, legacy.type], ['Invoice', 'Invoice']);

  // Re-filing; and a file keeps its label when the list later drops it.
  const moved = await json<Doc>(await call('PUT', `/documents/${survey.id}`, tokens.admin, { category: 'Plan' }));
  assert.equal(moved.category, 'Plan');
  assert.equal((await call('PUT', `/documents/${survey.id}`, tokens.admin, { category: 'Nope' })).status, 400);
  await json(await call('PUT', '/documents/categories', tokens.admin, { categories: ['Other'] }));
  assert.equal((await json<Doc>(await call('GET', `/documents/${contract.id}`, tokens.admin))).category, 'Contract');

  // A file from before categories (no category column value) shows its type.
  const old = await prisma.documentRecord.create({
    data: { id: `doc_old_${run}`, client_id: MINE.id, project_id: PROJECT, name: 'Old', type: 'MoodBoard', size_bytes: 1, upload_date: new Date(), storage_url: 'x/old.pdf' },
  });
  assert.equal((await json<Doc>(await call('GET', `/documents/${old.id}`, tokens.admin))).category, 'MoodBoard');
  await prisma.siteSettings.update({ where: { id: 'site' }, data: { document_categories: Prisma.DbNull } });
});

test('a client may view a shared file but not download it, unless an Admin allows it for that file', async () => {
  const doc = await shared();
  assert.equal(doc.client_can_download, false, 'view-only by default');

  const download = (token: string, inline = false) => call('GET', `/documents/${doc.id}/download${inline ? '?inline=1' : ''}`, token);
  assert.equal((await download(tokens.mine)).status, 403, 'no saving');
  const view = await json<{ url: string }>(await download(tokens.mine, true));
  assert.match(view.url, /X-Amz-Expires=300/);
  assert.match((await fetch(view.url)).headers.get('content-disposition') ?? '', /^inline;/);
  assert.equal((await download(tokens.other, true)).status, 404, 'not theirs');
  assert.equal((await call('GET', `/documents/${doc.id}/download`)).status, 401);

  // A type the browser cannot show has no view, so nothing is offered until it is allowed.
  const sheet = await shared({ bytes: SHEET, type: XLSX, name: 'Costs.xlsx' });
  assert.equal((await call('GET', `/documents/${sheet.id}/download?inline=1`, tokens.mine)).status, 403);

  // Staff are unaffected.
  for (const token of [tokens.admin, tokens.designer]) {
    const saved = await json<{ url: string }>(await download(token));
    assert.match((await fetch(saved.url)).headers.get('content-disposition') ?? '', /^attachment;/);
  }
  assert.equal((await download(tokens.editor)).status, 403);

  // Only an Admin allows it.
  const allow = (token: string | undefined, value = true) =>
    call('PATCH', `/documents/${doc.id}/client-download`, token, { client_can_download: value });
  for (const token of [tokens.designer, tokens.editor, tokens.mine, tokens.other]) assert.equal((await allow(token)).status, 403);
  assert.equal((await allow(undefined)).status, 401);
  assert.equal((await call('PATCH', `/documents/${doc.id}/client-download`, tokens.admin, { client_can_download: 'yes' })).status, 400);
  assert.equal((await json<Doc>(await allow(tokens.admin))).client_can_download, true);

  const saved = await json<{ url: string }>(await download(tokens.mine));
  assert.match((await fetch(saved.url)).headers.get('content-disposition') ?? '', /^attachment;/);
  assert.equal((await download(tokens.other)).status, 404);
  const logged = await prisma.activityLog.findMany({ where: { target_id: doc.id, action: 'document_download_permission' } });
  assert.equal(logged.length, 1);

  assert.equal((await json<Doc>(await allow(tokens.admin, false))).client_can_download, false);
  assert.equal((await download(tokens.mine)).status, 403, 'and back');
});

test('chat files: staff attachments are view-only for the client; what the client sends is theirs to keep', async () => {
  // The paperclip in a chat: staff share=true, a client always shares.
  const fromStaff = await json<Doc>(await upload(tokens.designer, { type: 'Other', share: 'true' }), 201);
  assert.deepEqual([fromStaff.client_visible, fromStaff.client_can_download], [true, false]);
  assert.equal((await call('GET', `/documents/${fromStaff.id}/download`, tokens.mine)).status, 403);
  assert.equal((await call('GET', `/documents/${fromStaff.id}/download?inline=1`, tokens.mine)).status, 200);

  const fromClient = await json<Doc>(await upload(tokens.mine, { type: 'Other' }), 201);
  assert.deepEqual([fromClient.client_visible, fromClient.client_can_download], [true, true]);
  assert.equal((await call('GET', `/documents/${fromClient.id}/download`, tokens.mine)).status, 200);
  assert.equal(fromClient.category, 'Other');
});

test('a client sees an invoice view-only unless an Admin allows download and print; only an Admin allows it', async () => {
  const sent = await prisma.invoice.create({
    data: { id: `inv_pr_${run}`, number: `PR-${run}`, client_id: MINE.id, project_id: PROJECT, amount: 120, vat_rate: 20, status: 'Sent', due_date: new Date() },
  });
  const draft = await prisma.invoice.create({
    data: { id: `inv_prd_${run}`, number: `PD-${run}`, client_id: MINE.id, amount: 60, vat_rate: 20, status: 'Draft', due_date: new Date() },
  });
  const read = (token: string) => call('GET', `/invoices/${sent.id}`, token);
  assert.equal((await json<{ client_can_download: boolean }>(await read(tokens.mine))).client_can_download, false);

  const allow = (token: string | undefined, id = sent.id, value = true) =>
    call('PATCH', `/invoices/${id}/client-download`, token, { client_can_download: value });
  for (const token of [tokens.designer, tokens.editor, tokens.mine, tokens.other]) assert.equal((await allow(token)).status, 403);
  assert.equal((await allow(undefined)).status, 401);
  assert.equal((await allow(tokens.admin, 'inv_missing')).status, 404);
  assert.equal((await call('PATCH', `/invoices/${sent.id}/client-download`, tokens.admin, {})).status, 400);

  assert.equal((await json<{ client_can_download: boolean }>(await allow(tokens.admin))).client_can_download, true);
  assert.equal((await json<{ client_can_download: boolean }>(await read(tokens.mine))).client_can_download, true);
  assert.equal((await read(tokens.other)).status, 404);
  const list = await json<Array<{ id: string; client_can_download: boolean }>>(await call('GET', '/invoices', tokens.mine));
  assert.deepEqual(list.filter((row) => row.id === sent.id).map((row) => row.client_can_download), [true]);

  // Allowing a Draft changes nothing for the client: they still cannot see it.
  assert.equal((await allow(tokens.admin, draft.id)).status, 200);
  assert.equal((await call('GET', `/invoices/${draft.id}`, tokens.mine)).status, 404);

  assert.equal((await json<{ client_can_download: boolean }>(await allow(tokens.admin, sent.id, false))).client_can_download, false);
  assert.equal((await prisma.invoice.findUniqueOrThrow({ where: { id: sent.id } })).client_can_download, false);
});
