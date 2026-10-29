import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { ADMIN, startTestApp } from './app';

/**
 * Staff chat: a project thread for the people on that project and the Admins, direct chats between
 * two staff, files on a private bucket. Never a client, never Infra, never a Designer off the project.
 */

let app: Awaited<ReturnType<typeof startTestApp>>;
let prisma: PrismaClient;
const run = randomUUID().slice(0, 8);
const PASSWORD = 'chat-password-123';
const person = (key: string, role: string) => ({ id: `stf_c${key}_${run}`, email: `c-${key}-${run}@test.enzo.local`, role });
const DES_A = person('da', 'Designer'); // on the project
const DES_B = person('db', 'Designer'); // not on the project
const INST = person('in', 'Installer'); // on the project
const EDITOR = person('ed', 'Editor');
const INFRA = person('if', 'Infra');
const CLIENT = { id: `cli_chat_${run}`, email: `c-client-${run}@test.enzo.local` };
const PROJECT = `prj_chat_${run}`;
const tokens = { admin: '', desA: '', desB: '', inst: '', editor: '', infra: '', client: '' };
let adminId = '';
let threadId = '';

before(async () => {
  app = await startTestApp();
  prisma = new PrismaClient();
  const password_hash = await bcrypt.hash(PASSWORD, 4);
  for (const staff of [DES_A, DES_B, INST, EDITOR, INFRA]) {
    await prisma.staffUser.create({ data: { ...staff, name: `C ${staff.role} ${run}`, password_hash } });
  }
  await prisma.client.create({ data: { ...CLIENT, name: 'Chat client', joined_date: new Date(), status: 'Active', password_hash } });
  await prisma.project.create({ data: { id: PROJECT, client_id: CLIENT.id, name: 'Chat job', type: 'Kitchen', status: 'Design', client_visible: true } });
  await prisma.projectMember.createMany({
    data: [
      { id: `pm_a_${run}`, project_id: PROJECT, staff_id: DES_A.id, role: 'Designer' },
      { id: `pm_i_${run}`, project_id: PROJECT, staff_id: INST.id, role: 'Installer' },
    ],
  });
  adminId = (await prisma.staffUser.findFirstOrThrow({ where: { email: ADMIN.email } })).id;
  tokens.admin = await signIn('/auth/admin/login', ADMIN.email, ADMIN.password);
  for (const [key, staff] of Object.entries({ desA: DES_A, desB: DES_B, inst: INST, editor: EDITOR, infra: INFRA })) {
    tokens[key as keyof typeof tokens] = await signIn('/auth/admin/login', staff.email, PASSWORD);
  }
  tokens.client = await signIn('/auth/portal/login', CLIENT.email, PASSWORD);
});

after(async () => {
  const staffIds = [DES_A, DES_B, INST, EDITOR, INFRA].map((staff) => staff.id);
  await prisma.staffThread.deleteMany({ where: { OR: [{ project_id: PROJECT }, { pair_key: { contains: run } }] } });
  await prisma.project.deleteMany({ where: { client_id: CLIENT.id } });
  await prisma.client.deleteMany({ where: { id: CLIENT.id } });
  await prisma.notification.deleteMany({ where: { recipient_id: { in: [...staffIds, adminId] }, link: { startsWith: '/team?thread=' } } });
  await prisma.staffThreadRead.deleteMany({ where: { staff_id: { in: [...staffIds, adminId] } } });
  await prisma.staffUser.deleteMany({ where: { id: { in: staffIds } } });
  await prisma.$disconnect();
  await app.close();
});

function call(method: string, path: string, token?: string, body?: unknown): Promise<Response> {
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
  assert.equal(res.status, status, `${res.url} answered ${res.status}`);
  return (await res.json()) as T;
}

const bodies: string[] = [];
type Thread = { id: string; kind: string; title: string; unread_count: number };
type Message = { id: string; body: string; sender_name: string; attachments: { name: string; type: string }[] | null };
const say = (token: string, id: string, body: string) => call('POST', `/team/threads/${id}/messages`, token, { body });
const upload = (token: string, id: string, bytes: Uint8Array, name: string, body = '') => {
  const form = new FormData();
  form.append('file', new Blob([bytes]), name);
  if (body) form.append('body', body);
  return call('POST', `/team/threads/${id}/messages`, token, form);
};
const notes = (recipient: string) => prisma.notification.count({ where: { recipient_id: recipient, link: `/team?thread=${threadId}` } });

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const ftyp = (brand: string) => Uint8Array.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, ...Buffer.from(brand), 0, 0, 0, 0]);

test('the project thread is for the people on the project and the Admins, nobody else', async () => {
  for (const token of [tokens.admin, tokens.desA, tokens.inst]) {
    const thread = await json<Thread>(await call('GET', `/team/projects/${PROJECT}/thread`, token));
    assert.equal(thread.kind, 'project');
    assert.equal(thread.title, 'Chat job');
    threadId = thread.id; // the same one for all three
  }
  assert.equal(await prisma.staffThread.count({ where: { project_id: PROJECT } }), 1);

  // A Designer off the project: the project is not theirs to confirm. Editor, Infra and clients have no route at all.
  assert.equal((await call('GET', `/team/projects/${PROJECT}/thread`, tokens.desB)).status, 404);
  assert.equal((await call('GET', `/team/threads/${threadId}/messages`, tokens.desB)).status, 404);
  assert.equal((await say(tokens.desB, threadId, 'let me in')).status, 404);
  for (const token of [tokens.editor, tokens.infra, tokens.client]) {
    assert.equal((await call('GET', `/team/projects/${PROJECT}/thread`, token)).status, 403);
  }
  for (const token of [tokens.infra, tokens.client]) assert.equal((await call('GET', '/team/threads', token)).status, 403);
  assert.equal((await call('GET', `/team/threads/${threadId}/messages`, tokens.client)).status, 403);
  assert.equal((await call('GET', `/team/threads/${threadId}/messages`)).status, 401);
});

test('a message tells everyone else on the project, tracks unread, and carries the sender from the token', async () => {
  const before = { admin: await notes(adminId), inst: await notes(INST.id), self: await notes(DES_A.id) };
  const sent = await json<Message>(await say(tokens.desA, threadId, '  The worktop is chipped  '), 201);
  assert.equal(sent.body, 'The worktop is chipped');
  assert.equal(sent.sender_name, `C Designer ${run}`);
  assert.equal(await notes(adminId), before.admin + 1);
  assert.equal(await notes(INST.id), before.inst + 1);
  assert.equal(await notes(DES_A.id), before.self, 'the sender is not told about their own message');

  const seen = (token: string) => call('GET', '/team/threads', token).then((res) => json<Thread[]>(res)).then((list) => list.find((t) => t.id === threadId)!);
  assert.equal((await seen(tokens.inst)).unread_count, 1);
  assert.equal((await seen(tokens.desA)).unread_count, 0);
  assert.equal((await json<{ unread: number }>(await call('GET', '/team/unread-count', tokens.inst))).unread >= 1, true);
  await json(await call('PUT', `/team/threads/${threadId}/read`, tokens.inst));
  assert.equal((await seen(tokens.inst)).unread_count, 0);

  const empty = await say(tokens.inst, threadId, '   ');
  assert.equal(empty.status, 400);
  assert.equal((await say(tokens.inst, threadId, 'x'.repeat(5001))).status, 400);
  const list = await json<Message[]>(await call('GET', `/team/threads/${threadId}/messages`, tokens.admin));
  assert.deepEqual(list.map((message) => message.body), ['The worktop is chipped']);
});

test('files: video, images and PDFs by their own bytes, size limits, and the key never leaves the API', async () => {
  assert.equal((await upload(tokens.inst, threadId, Buffer.from('MZ not a video'), 'clip.mp4')).status, 400, 'a name and type are only the sender\'s word');
  assert.equal((await upload(tokens.inst, threadId, new Uint8Array(26 * 1024 * 1024).fill(1), 'huge.png')).status, 400);

  const png = await json<Message>(await upload(tokens.inst, threadId, PNG, 'Damaged panel.png', 'see this'), 201);
  assert.deepEqual(png.attachments, [{ name: 'Damaged panel.png', size_bytes: PNG.length, type: 'image/png' }]);
  const mp4 = await json<Message>(await upload(tokens.desA, threadId, ftyp('isom'), 'walkthrough.mp4'), 201);
  assert.equal(mp4.attachments?.[0]?.type, 'video/mp4');
  const mov = await json<Message>(await upload(tokens.desA, threadId, ftyp('qt  '), 'walkthrough.mov'), 201);
  assert.equal(mov.attachments?.[0]?.type, 'video/quicktime');
  const webm = await json<Message>(await upload(tokens.desA, threadId, Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0]), 'x.webm'), 201);
  assert.equal(webm.attachments?.[0]?.type, 'video/webm');

  // A file alone is a message; its bytes come back through a signed link, only to people in the thread.
  const link = await json<{ url: string }>(await call('GET', `/team/threads/${threadId}/messages/${png.id}/files/0`, tokens.admin));
  const file = await fetch(link.url);
  assert.equal(file.status, 200);
  assert.deepEqual(new Uint8Array(await file.arrayBuffer()), PNG);
  assert.equal((await call('GET', `/team/threads/${threadId}/messages/${png.id}/files/0`, tokens.desB)).status, 404);
  assert.equal((await call('GET', `/team/threads/${threadId}/messages/${png.id}/files/9`, tokens.admin)).status, 404);

  for (const message of await json<Message[]>(await call('GET', `/team/threads/${threadId}/messages`, tokens.admin))) bodies.push(JSON.stringify(message));
  assert.ok(bodies.every((body) => !body.includes('team/') && !body.includes('"key"')), 'a storage key left the API');
});

test('direct chats: one per pair, only the two of them, any studio role but never a client or Infra', async () => {
  const opened = await json<Thread>(await call('POST', '/team/direct', tokens.desA, { staff_id: EDITOR.id }), 201);
  assert.equal(opened.kind, 'direct');
  assert.equal(opened.title, `C Editor ${run}`);
  const again = await json<Thread>(await call('POST', '/team/direct', tokens.editor, { staff_id: DES_A.id }), 201);
  assert.equal(again.id, opened.id, 'the same pair, whoever starts it');
  assert.equal(again.title, `C Designer ${run}`);

  await json(await say(tokens.editor, opened.id, 'is the brief final?'), 201);
  assert.equal((await json<Message[]>(await call('GET', `/team/threads/${opened.id}/messages`, tokens.desA))).length, 1);
  // Nobody else reads it, not even an Admin: it is between the two.
  for (const token of [tokens.admin, tokens.desB, tokens.inst]) {
    assert.equal((await call('GET', `/team/threads/${opened.id}/messages`, token)).status, 404);
  }
  assert.equal((await call('POST', '/team/direct', tokens.desA, { staff_id: DES_A.id })).status, 400);
  assert.equal((await call('POST', '/team/direct', tokens.desA, { staff_id: INFRA.id })).status, 404);
  assert.equal((await call('POST', '/team/direct', tokens.client, { staff_id: DES_A.id })).status, 403);
  assert.equal((await call('POST', '/team/direct', tokens.infra, { staff_id: DES_A.id })).status, 403);

  const people = await json<{ id: string; role: string }[]>(await call('GET', '/team/people', tokens.desA));
  assert.ok(people.some((p) => p.id === EDITOR.id));
  assert.ok(!people.some((p) => p.id === DES_A.id || p.id === INFRA.id), 'neither yourself nor Infra');
});
