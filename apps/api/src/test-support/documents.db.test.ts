import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { ADMIN, startTestApp } from './app';

/** Documents on the private bucket: real MinIO, real AppModule, every role. */

let app: Awaited<ReturnType<typeof startTestApp>>;
let prisma: PrismaClient;
const run = randomUUID().slice(0, 8);
const PASSWORD = 'document-password-123';
const EDITOR = { id: `stf_ded_${run}`, email: `d-editor-${run}@test.enzo.local`, role: 'Editor' };
const DESIGNER = { id: `stf_ddes_${run}`, email: `d-designer-${run}@test.enzo.local`, role: 'Designer' };
const MINE = { id: `cli_dmine_${run}`, email: `d-mine-${run}@test.enzo.local` };
const OTHER = { id: `cli_doth_${run}`, email: `d-other-${run}@test.enzo.local` };
const P = {
  assigned: `prj_dass_${run}`, // MINE's, DESIGNER assigned
  unassigned: `prj_dun_${run}`, // MINE's, nobody assigned
  other: `prj_doth_${run}`, // OTHER's
};
const tokens = { admin: '', editor: '', designer: '', mine: '', other: '' };
/** Every response body this suite saw, to prove no storage key ever left the API. */
const bodies: string[] = [];

const PDF = Buffer.from('%PDF-1.4\n% test document\n1 0 obj <<>> endobj\n%%EOF\n');

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
  const project = { type: 'Kitchen', status: 'Design', client_visible: true };
  await prisma.project.createMany({
    data: [
      { ...project, id: P.assigned, client_id: MINE.id, name: 'Assigned', assigned_designer_id: DESIGNER.id },
      { ...project, id: P.unassigned, client_id: MINE.id, name: 'Unassigned' },
      { ...project, id: P.other, client_id: OTHER.id, name: 'Other' },
    ],
  });

  tokens.admin = await signIn('/auth/admin/login', ADMIN.email, ADMIN.password);
  tokens.editor = await signIn('/auth/admin/login', EDITOR.email, PASSWORD);
  tokens.designer = await signIn('/auth/admin/login', DESIGNER.email, PASSWORD);
  tokens.mine = await signIn('/auth/portal/login', MINE.email, PASSWORD);
  tokens.other = await signIn('/auth/portal/login', OTHER.email, PASSWORD);
});

after(async () => {
  // Through the API, so the objects go too.
  for (const row of await prisma.documentRecord.findMany({ where: { client_id: { in: [MINE.id, OTHER.id] } } })) {
    await call('DELETE', `/documents/${row.id}`, tokens.admin);
  }
  await prisma.project.deleteMany({ where: { client_id: { in: [MINE.id, OTHER.id] } } });
  await prisma.client.deleteMany({ where: { id: { in: [MINE.id, OTHER.id] } } });
  await prisma.notification.deleteMany({ where: { recipient_id: DESIGNER.id } });
  await prisma.staffUser.deleteMany({ where: { id: { in: [EDITOR.id, DESIGNER.id] } } });
  await prisma.$disconnect();
  await app.close();
});

async function call(method: string, path: string, token?: string, body?: unknown): Promise<Response> {
  const form = body instanceof FormData;
  const res = await fetch(`${app.url}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined || form ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : form ? body : JSON.stringify(body),
  });
  const text = await res.text();
  bodies.push(text);
  return new Response(text, { status: res.status, headers: res.headers });
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

function upload(
  token: string,
  fields: { client_id: string; project_id: string; type?: string; name?: string },
  file: { bytes: Buffer; type: string; name: string } = { bytes: PDF, type: 'application/pdf', name: 'Plan.pdf' },
) {
  const form = new FormData();
  for (const [key, value] of Object.entries({ type: 'Plan', ...fields })) form.append(key, value);
  form.append('file', new Blob([new Uint8Array(file.bytes)], { type: file.type }), file.name);
  return call('POST', '/documents/upload', token, form);
}

interface Doc {
  id: string;
  client_id: string;
  project_id: string;
  name: string;
  size_bytes: number;
  client_visible: boolean;
}

const mineFields = (project_id = P.assigned) => ({ client_id: MINE.id, project_id });

test('an upload lands in the private bucket and downloads through a short-lived link', async () => {
  const doc = await json<Doc>(await upload(tokens.admin, { ...mineFields(), name: 'Kitchen plan v1.pdf' }), 201);
  assert.equal(doc.client_visible, false, 'new files are internal');
  assert.equal(doc.size_bytes, PDF.length);
  assert.ok(!('storage_url' in doc) && !('download_url' in doc));

  const row = await prisma.documentRecord.findUniqueOrThrow({ where: { id: doc.id } });
  assert.match(row.storage_url, new RegExp(`^clients/${MINE.id}/projects/${P.assigned}/[0-9a-f-]{36}-kitchen-plan-v1\\.pdf$`));

  const res = await call('GET', `/documents/${doc.id}/download`, tokens.admin);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const { url, expires_in } = await json<{ url: string; expires_in: number }>(res);
  assert.ok(expires_in <= 300);
  assert.match(url, /X-Amz-Expires=300/);
  const file = await fetch(url);
  assert.equal(file.status, 200);
  assert.ok(Buffer.from(await file.arrayBuffer()).equals(PDF), 'the bytes that went up come back');
  assert.match(file.headers.get('content-disposition') ?? '', /^attachment; filename="Kitchen plan v1.pdf"/);

  // ?inline=1 is the portal's viewer: shown in the page, as the type sniffed at upload.
  assert.equal((doc as Doc & { preview: string }).preview, 'pdf');
  const shown = await json<{ url: string }>(await call('GET', `/documents/${doc.id}/download?inline=1`, tokens.admin));
  const inline = await fetch(shown.url);
  assert.match(inline.headers.get('content-disposition') ?? '', /^inline; filename="Kitchen plan v1.pdf"/);
  assert.equal(inline.headers.get('content-type'), 'application/pdf');

  // A type the browser cannot show still downloads, whatever is asked.
  const sheet = await json<Doc & { preview: string | null }>(
    await upload(tokens.admin, mineFields(), {
      bytes: Buffer.from('504b0304' + '00'.repeat(30), 'hex'),
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      name: 'Costs.xlsx',
    }),
    201,
  );
  assert.equal(sheet.preview, null);
  const asked = await json<{ url: string }>(await call('GET', `/documents/${sheet.id}/download?inline=1`, tokens.admin));
  assert.match((await fetch(asked.url)).headers.get('content-disposition') ?? '', /^attachment;/);

  // The bucket itself is not readable without a signature.
  const bare = new URL(url);
  bare.search = '';
  assert.equal((await fetch(bare)).status, 403);
});

test('uploads refuse other clients\' projects, disallowed types and oversize files', async () => {
  await json(await upload(tokens.admin, { client_id: MINE.id, project_id: P.other }), 400);
  await json(await upload(tokens.admin, mineFields(), { bytes: Buffer.from('<html></html>'), type: 'text/html', name: 'x.html' }), 400);
  // Declared a PDF, but is not one.
  await json(await upload(tokens.admin, mineFields(), { bytes: Buffer.from('<script>1</script>'), type: 'application/pdf', name: 'x.pdf' }), 400);
  const big = Buffer.alloc(25 * 1024 * 1024 + 1);
  PDF.copy(big);
  await json(await upload(tokens.admin, mineFields(), { bytes: big, type: 'application/pdf', name: 'big.pdf' }), 413);
  // project_id is required.
  await json(await upload(tokens.admin, { client_id: MINE.id } as never), 400);
});

test('a chat upload: clients add files to their own shared projects only, always shared and typed Other', async () => {
  const hidden = `prj_dhid_${run}`;
  await prisma.project.create({
    data: { id: hidden, client_id: MINE.id, name: 'Hidden', type: 'Kitchen', status: 'Design', client_visible: false },
  });

  const mine = await json<Doc>(await upload(tokens.mine, { ...mineFields(), type: 'Contract' }), 201);
  assert.equal(mine.client_visible, true, 'what a client uploads is theirs to see');
  assert.equal((await prisma.documentRecord.findUniqueOrThrow({ where: { id: mine.id } })).type, 'Other');

  // Not theirs, or not shared with them yet: out of scope.
  await json(await upload(tokens.mine, { client_id: OTHER.id, project_id: P.other }), 404);
  await json(await upload(tokens.mine, mineFields(hidden)), 404);
  await json(await upload(tokens.mine, { client_id: OTHER.id, project_id: P.assigned }), 400);

  // Staff share a file from a chat only on a project the client can see.
  const form = { ...mineFields(hidden), share: 'true' };
  await json(await upload(tokens.admin, form), 400);
  const shared = await json<Doc>(await upload(tokens.designer, { ...mineFields(), share: 'true' } as never), 201);
  assert.equal(shared.client_visible, true);
});

test('Designers reach documents through their assigned projects only; Editors not at all', async () => {
  const own = await json<Doc>(await upload(tokens.designer, mineFields()), 201);
  const hidden = await json<Doc>(await upload(tokens.admin, mineFields(P.unassigned)), 201);

  await json(await upload(tokens.designer, mineFields(P.unassigned)), 404);
  await json(await call('GET', `/documents/${hidden.id}`, tokens.designer), 404);
  await json(await call('GET', `/documents/${hidden.id}/download`, tokens.designer), 404);
  await json(await call('DELETE', `/documents/${hidden.id}`, tokens.designer), 404);
  const list = await json<Doc[]>(await call('GET', '/documents', tokens.designer));
  assert.ok(list.some((doc) => doc.id === own.id));
  assert.ok(list.every((doc) => doc.project_id === P.assigned));
  // The client's page shows the Designer only their project's files.
  const detail = await json<{ documents: Doc[] }>(await call('GET', `/clients/${MINE.id}/detail`, tokens.designer));
  assert.ok(detail.documents.every((doc) => doc.project_id === P.assigned));

  // Moving: never to another client, never out of the Designer's scope.
  await json(await call('PUT', `/documents/${own.id}`, tokens.designer, { project_id: P.unassigned }), 404);
  await json(await call('PUT', `/documents/${own.id}`, tokens.admin, { project_id: P.other }), 400);
  assert.equal((await json<Doc>(await call('PUT', `/documents/${own.id}`, tokens.admin, { project_id: P.unassigned }))).project_id, P.unassigned);
  // Sending to the client is the Admin's.
  await json(await call('PATCH', `/documents/${hidden.id}/visibility`, tokens.admin, { client_visible: false }), 200);
  await json(await call('PATCH', `/documents/${own.id}/visibility`, tokens.designer, { client_visible: true }), 403);

  for (const [method, path] of [
    ['GET', '/documents'],
    ['GET', `/documents/${own.id}`],
    ['GET', `/documents/${own.id}/download`],
    ['DELETE', `/documents/${own.id}`],
  ] as const) {
    await json(await call(method, path, tokens.editor), 403);
  }
  await json(await upload(tokens.editor, mineFields()), 403);
});

test('a client sees and downloads only their own shared documents', async () => {
  const shared = await json<Doc>(await upload(tokens.admin, mineFields()), 201);
  const internal = await json<Doc>(await upload(tokens.admin, mineFields()), 201);
  assert.equal(
    (await json<Doc>(await call('PATCH', `/documents/${shared.id}/visibility`, tokens.admin, { client_visible: true }))).client_visible,
    true,
  );

  const list = await json<Doc[]>(await call('GET', '/documents', tokens.mine));
  assert.ok(list.some((doc) => doc.id === shared.id));
  assert.ok(list.every((doc) => doc.client_id === MINE.id && doc.client_visible));
  const { url } = await json<{ url: string }>(await call('GET', `/documents/${shared.id}/download`, tokens.mine));
  assert.equal((await fetch(url)).status, 200);

  await json(await call('GET', `/documents/${internal.id}/download`, tokens.mine), 404);
  await json(await call('GET', `/documents/${shared.id}/download`, tokens.other), 404);
  assert.deepEqual(await json<Doc[]>(await call('GET', '/documents', tokens.other)), []);
  // The portal reads, downloads and adds a file in a chat (above); it never edits or deletes.
  await json(await call('GET', `/documents/${shared.id}`, tokens.mine), 403);
  await json(await call('DELETE', `/documents/${shared.id}`, tokens.mine), 403);
  await json(await call('PATCH', `/documents/${shared.id}/visibility`, tokens.mine, { client_visible: false }), 403);
});

test('a shared file is hidden with its project, and a hidden project does not hide an invoice', async () => {
  const doc = await json<Doc>(await upload(tokens.admin, mineFields(P.unassigned)), 201);
  await json(await call('PATCH', `/documents/${doc.id}/visibility`, tokens.admin, { client_visible: true }));
  const invoice = await prisma.invoice.create({
    data: {
      id: `inv_dh_${run}`, number: `T-DH-${run}`, client_id: MINE.id, project_id: P.unassigned,
      amount: 120, vat_rate: 20, status: 'Sent', due_date: new Date(Date.now() + 864e5),
    },
  });
  const sees = async () => (await json<Doc[]>(await call('GET', '/documents', tokens.mine))).some((d) => d.id === doc.id);

  assert.equal(await sees(), true, 'shared file on a shared project');
  await prisma.project.update({ where: { id: P.unassigned }, data: { client_visible: false } });
  try {
    assert.equal(await sees(), false, 'project hidden -> its shared file is gone from the list');
    await json(await call('GET', `/documents/${doc.id}/download`, tokens.mine), 404);
    const invoices = await json<Array<{ id: string }>>(await call('GET', '/invoices', tokens.mine));
    assert.ok(invoices.some((i) => i.id === invoice.id), 'billing still reaches the client');
  } finally {
    await prisma.project.update({ where: { id: P.unassigned }, data: { client_visible: true } });
    await prisma.invoice.delete({ where: { id: invoice.id } });
  }
  assert.equal(await sees(), true, 'project shared again -> the file is back');
});

test('deleting a document deletes its object', async () => {
  const doc = await json<Doc>(await upload(tokens.admin, mineFields()), 201);
  const { url } = await json<{ url: string }>(await call('GET', `/documents/${doc.id}/download`, tokens.admin));
  await json(await call('DELETE', `/documents/${doc.id}`, tokens.admin));
  assert.equal((await fetch(url)).status, 404);
  await json(await call('GET', `/documents/${doc.id}/download`, tokens.admin), 404);
});

test('no response anywhere carried a storage key', async () => {
  // The screens that embed documents, read as Admin and as the client.
  await json(await call('GET', `/clients/${MINE.id}/detail`, tokens.admin));
  await json(await call('GET', `/projects/${P.assigned}/detail`, tokens.admin));
  await json(await call('GET', `/projects/${P.assigned}/detail`, tokens.mine));

  const keys = (await prisma.documentRecord.findMany({ where: { client_id: MINE.id } })).map((row) => row.storage_url);
  assert.ok(keys.length > 0);
  for (const body of bodies) {
    assert.ok(!body.includes('storage_url'), 'storage_url field in a response');
    // A signed URL legitimately contains its key; a key anywhere else is a leak.
    const unsigned = body.replace(/"url":"[^"]*"/g, '');
    for (const key of keys) assert.ok(!unsigned.includes(key), `storage key in a response: ${key}`);
    assert.ok(!unsigned.includes(`clients/${MINE.id}/projects/`), 'storage key prefix in a response');
  }
});
