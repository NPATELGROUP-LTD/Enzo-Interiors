import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { ADMIN, startTestApp } from './app';

/**
 * What an upload is judged on: its own first bytes, not the type the browser declares.
 * A .png picked on Windows is often declared image/x-png, application/octet-stream or
 * nothing, and was refused as "not a PNG" with no explanation.
 */

let app: Awaited<ReturnType<typeof startTestApp>>;
let prisma: PrismaClient;
const run = randomUUID().slice(0, 8);
const CLIENT = { id: `cli_upt_${run}`, email: `upt-${run}@test.enzo.local` };
const PROJECT = `prj_upt_${run}`;
let token = '';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj <<>> endobj\n%%EOF\n');
const ZIP = Buffer.concat([Buffer.from('504b0304', 'hex'), Buffer.from('xl/workbook.xml')]);
const HTML = Buffer.from('<script>alert(1)</script>');

const upload = (file: { bytes: Buffer; type: string; name: string }) => {
  const form = new FormData();
  for (const [key, value] of Object.entries({ client_id: CLIENT.id, project_id: PROJECT, type: 'Plan' })) form.append(key, value);
  form.append('file', new Blob([new Uint8Array(file.bytes)], { type: file.type }), file.name);
  return fetch(`${app.url}/documents/upload`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form });
};

before(async () => {
  app = await startTestApp();
  prisma = new PrismaClient();
  const password_hash = await bcrypt.hash('upload-types-123', 4);
  await prisma.client.create({ data: { ...CLIENT, name: 'Upload types', password_hash, joined_date: new Date(), status: 'Active' } });
  await prisma.project.create({ data: { id: PROJECT, client_id: CLIENT.id, name: 'Upload types', type: 'Kitchen', status: 'Design', client_visible: true } });
  const res = await fetch(`${app.url}/auth/admin/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(ADMIN) });
  token = ((await res.json()) as { access_token: string }).access_token;
});

after(async () => {
  for (const row of await prisma.documentRecord.findMany({ where: { client_id: CLIENT.id } })) {
    await fetch(`${app.url}/documents/${row.id}`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } });
  }
  await prisma.project.deleteMany({ where: { id: PROJECT } });
  await prisma.client.deleteMany({ where: { id: CLIENT.id } });
  await prisma.$disconnect();
  await app.close();
});

test('a real PNG is accepted whatever type the browser declared', async () => {
  for (const type of ['image/png', 'image/x-png', 'application/octet-stream', '']) {
    const res = await upload({ bytes: PNG, type, name: 'screenshot.png' });
    assert.equal(res.status, 201, `declared "${type}"`);
    const doc = (await res.json()) as { id: string; preview: string | null };
    assert.equal(doc.preview, 'image', 'stored and shown as an image');
    const row = await prisma.documentRecord.findUniqueOrThrow({ where: { id: doc.id } });
    assert.match(row.storage_url, /\.png$/);
  }
});

test('Office files declared as octet-stream are told apart by their name', async () => {
  assert.equal((await upload({ bytes: ZIP, type: 'application/octet-stream', name: 'costs.xlsx' })).status, 201);
});

test('what is not one of the allowed types is refused with a message that names the file', async () => {
  for (const file of [
    { bytes: HTML, type: 'image/png', name: 'evil.png' },
    { bytes: HTML, type: 'application/pdf', name: 'evil.pdf' },
    { bytes: HTML, type: '', name: 'notes.txt' },
    { bytes: ZIP, type: 'image/png', name: 'archive.png' }, // a zip is only ever an Office file, never a picture
  ]) {
    const res = await upload(file);
    assert.equal(res.status, 400, file.name);
    const { message } = (await res.json()) as { message: string };
    assert.match(message, /^Upload a PDF, JPG, PNG/);
    assert.ok(message.includes(file.name), 'the message says which file');
  }
});

test('the type is stored from the bytes: a PDF carrying a .png name is a PDF', async () => {
  const res = await upload({ bytes: PDF, type: 'image/png', name: 'plan.png' });
  assert.equal(res.status, 201);
  const doc = (await res.json()) as { id: string; preview: string | null };
  assert.equal(doc.preview, 'pdf');
  assert.match((await prisma.documentRecord.findUniqueOrThrow({ where: { id: doc.id } })).storage_url, /\.pdf$/);
});
