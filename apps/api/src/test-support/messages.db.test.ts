import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { io, type Socket } from 'socket.io-client';

import { CacheService } from '../core/cache';
import { Mail, MailService } from '../core/mail.service';
import { ADMIN, startTestApp } from './app';

/** Messages over HTTP and Socket.IO: real AppModule, real database, every role. */

let app: Awaited<ReturnType<typeof startTestApp>>;
let prisma: PrismaClient;
const run = randomUUID().slice(0, 8);
const PASSWORD = 'messages-password-123';
const EDITOR = { id: `stf_med_${run}`, email: `m-editor-${run}@test.enzo.local`, role: 'Editor' };
const DESIGNER = { id: `stf_mdes_${run}`, email: `m-designer-${run}@test.enzo.local`, role: 'Designer' };
const MINE = { id: `cli_mmine_${run}`, email: `m-mine-${run}@test.enzo.local`, name: `Mine ${run}` };
const OTHER = { id: `cli_moth_${run}`, email: `m-other-${run}@test.enzo.local`, name: `Other ${run}` };
const P = { mine: `prj_mmine_${run}`, other: `prj_moth_${run}` };
const tokens = { admin: '', editor: '', designer: '', mine: '', other: '' };
const conv = { mine: '', other: '' };
const sent: Mail[] = [];
const sockets: Socket[] = [];
const bodies: string[] = [];
const PDF = Buffer.from('%PDF-1.4\n% test\n%%EOF\n');

before(async () => {
  app = await startTestApp();
  app.nest.get(MailService).send = async (mail: Mail) => {
    sent.push(mail);
    return true;
  };
  prisma = new PrismaClient();
  const password_hash = await bcrypt.hash(PASSWORD, 4);
  for (const staff of [EDITOR, DESIGNER]) {
    await prisma.staffUser.create({ data: { ...staff, name: `Test ${staff.role} ${run}`, password_hash } });
  }
  const client = { joined_date: new Date(), status: 'Active', password_hash };
  await prisma.client.create({ data: { ...client, ...MINE } });
  await prisma.client.create({ data: { ...client, ...OTHER } });
  const project = { type: 'Kitchen', status: 'Design', client_visible: true };
  await prisma.project.createMany({
    data: [
      { ...project, id: P.mine, client_id: MINE.id, name: 'Mine', assigned_designer_id: DESIGNER.id },
      { ...project, id: P.other, client_id: OTHER.id, name: 'Other' },
    ],
  });

  tokens.admin = await signIn('/auth/admin/login', ADMIN.email, ADMIN.password);
  tokens.editor = await signIn('/auth/admin/login', EDITOR.email, PASSWORD);
  tokens.designer = await signIn('/auth/admin/login', DESIGNER.email, PASSWORD);
  tokens.mine = await signIn('/auth/portal/login', MINE.email, PASSWORD);
  tokens.other = await signIn('/auth/portal/login', OTHER.email, PASSWORD);

  conv.mine = (await json<{ id: string }>(await call('POST', '/conversations', tokens.admin, { client_id: MINE.id }), 201)).id;
  conv.other = (await json<{ id: string }>(await call('POST', '/conversations', tokens.admin, { client_id: OTHER.id }), 201)).id;
});

after(async () => {
  for (const socket of sockets) socket.disconnect();
  for (const row of await prisma.documentRecord.findMany({ where: { client_id: { in: [MINE.id, OTHER.id] } } })) {
    await call('DELETE', `/documents/${row.id}`, tokens.admin);
  }
  const conversations = await prisma.conversation.findMany({ where: { client_id: { in: [MINE.id, OTHER.id] } } });
  await prisma.message.deleteMany({ where: { conversation_id: { in: conversations.map((c) => c.id) } } });
  await prisma.conversation.deleteMany({ where: { client_id: { in: [MINE.id, OTHER.id] } } });
  await prisma.project.deleteMany({ where: { client_id: { in: [MINE.id, OTHER.id] } } });
  await prisma.client.deleteMany({ where: { id: { in: [MINE.id, OTHER.id] } } });
  await prisma.notification.deleteMany({ where: { title: { contains: run } } });
  await prisma.notification.deleteMany({ where: { recipient_id: { in: [DESIGNER.id, EDITOR.id] } } });
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

async function upload(clientId: string, projectId: string, shared: boolean): Promise<string> {
  const form = new FormData();
  form.append('client_id', clientId);
  form.append('project_id', projectId);
  form.append('type', 'Plan');
  form.append('file', new Blob([new Uint8Array(PDF)], { type: 'application/pdf' }), 'Plan.pdf');
  const { id } = await json<{ id: string }>(await call('POST', '/documents/upload', tokens.admin, form), 201);
  if (shared) await json(await call('PATCH', `/documents/${id}/visibility`, tokens.admin, { client_visible: true }));
  return id;
}

interface Msg {
  id: string;
  body: string;
  sender_type: string;
  read_at: string | null;
  attachments: Array<{ document_id: string; name: string }> | null;
}

/** A connected socket, or the connect_error message. */
function connect(token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(app.url, { auth: { token }, transports: ['websocket'], reconnection: false, forceNew: true });
    sockets.push(socket);
    socket.once('connected', () => resolve(socket));
    socket.once('connect_error', (error) => reject(error));
  });
}

/** Resolves with the event's payload, or 'timeout'. */
function next<T>(socket: Socket, event: string, ms = 600): Promise<T | 'timeout'> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve('timeout'), ms);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

const resetQuiet = async () => {
  const cache = app.nest.get(CacheService);
  for (const id of [conv.mine, conv.other]) {
    await cache.del(`message-email:${id}:staff`);
    await cache.del(`message-email:${id}:client`);
  }
};

test('one conversation per client; each role sees its own scope', async () => {
  // Opening again returns the same thread, for staff and for the client.
  assert.equal((await json<{ id: string }>(await call('POST', '/conversations', tokens.admin, { client_id: MINE.id }), 201)).id, conv.mine);
  assert.equal((await json<{ id: string }>(await call('POST', '/conversations', tokens.mine, {}), 201)).id, conv.mine);

  const admin = await json<Array<{ id: string }>>(await call('GET', '/conversations', tokens.admin));
  assert.ok(admin.some((c) => c.id === conv.mine) && admin.some((c) => c.id === conv.other));

  const designer = await json<Array<{ id: string; client_id: string }>>(await call('GET', '/conversations', tokens.designer));
  assert.ok(designer.some((c) => c.id === conv.mine));
  assert.ok(designer.every((c) => c.client_id !== OTHER.id));
  await json(await call('GET', `/conversations/${conv.other}`, tokens.designer), 403);
  await json(await call('GET', `/conversations/${conv.other}/messages`, tokens.designer), 403);
  await json(await call('POST', `/conversations/${conv.other}/messages`, tokens.designer, { body: 'hi' }), 403);
  await json(await call('POST', '/conversations', tokens.designer, { client_id: OTHER.id }), 403);

  const mine = await json<Array<{ id: string }>>(await call('GET', '/conversations', tokens.mine));
  assert.deepEqual(mine.map((c) => c.id), [conv.mine]);
  // Another client's thread does not exist, as far as a client can tell.
  await json(await call('GET', `/conversations/${conv.other}`, tokens.mine), 404);
  await json(await call('GET', `/conversations/${conv.other}/messages`, tokens.mine), 404);
  await json(await call('POST', `/conversations/${conv.other}/messages`, tokens.mine, { body: 'hi' }), 404);
  await json(await call('PUT', `/conversations/${conv.other}/read`, tokens.mine), 404);

  for (const [method, path] of [
    ['GET', '/conversations'],
    ['GET', '/conversations/unread-count'],
    ['GET', `/conversations/${conv.mine}`],
    ['GET', `/conversations/${conv.mine}/messages`],
    ['POST', '/conversations'],
    ['GET', '/saved-replies'],
  ] as const) {
    await json(await call(method, path, tokens.editor, method === 'POST' ? { client_id: MINE.id } : undefined), 403);
  }
  await json(await call('GET', '/saved-replies', tokens.mine), 403);
  await json(await call('GET', '/saved-replies', tokens.designer));
});

test('unread counts, read receipts and validation', async () => {
  await resetQuiet();
  const before = (await json<{ unread: number }>(await call('GET', '/conversations/unread-count', tokens.admin))).unread;
  const msg = await json<Msg>(await call('POST', `/conversations/${conv.mine}/messages`, tokens.mine, { body: '  Hello team  ' }), 201);
  assert.equal(msg.body, 'Hello team');
  assert.equal(msg.sender_type, 'Client');
  assert.equal((await json<{ unread: number }>(await call('GET', '/conversations/unread-count', tokens.admin))).unread, before + 1);
  assert.equal((await json<{ unread: number }>(await call('GET', '/conversations/unread-count', tokens.mine))).unread, 0);

  await json(await call('PUT', `/conversations/${conv.mine}/read`, tokens.designer));
  const thread = await json<Msg[]>(await call('GET', `/conversations/${conv.mine}/messages`, tokens.mine));
  assert.ok(thread.find((m) => m.id === msg.id)?.read_at, 'the client sees it was read');
  assert.equal((await json<{ unread: number }>(await call('GET', '/conversations/unread-count', tokens.admin))).unread, before);

  await json(await call('POST', `/conversations/${conv.mine}/messages`, tokens.mine, { body: 'x'.repeat(5001) }), 400);
  await json(await call('POST', `/conversations/${conv.mine}/messages`, tokens.mine, { body: '   ' }), 400);
  await json(await call('POST', `/conversations/${conv.mine}/messages`, tokens.mine, { body: 'hi', sender_type: 'Staff' }), 400);
});

test('attachments are documents shared with the conversation\'s client', async () => {
  const shared = await upload(MINE.id, P.mine, true);
  const internal = await upload(MINE.id, P.mine, false);
  const othersShared = await upload(OTHER.id, P.other, true);

  const offered = await json<Array<{ id: string }>>(await call('GET', `/conversations/${conv.mine}/documents`, tokens.mine));
  assert.deepEqual(offered.map((d) => d.id), [shared]);
  assert.deepEqual(
    (await json<Array<{ id: string }>>(await call('GET', `/conversations/${conv.mine}/documents`, tokens.admin))).map((d) => d.id),
    [shared],
  );

  const ok = await json<Msg>(await call('POST', `/conversations/${conv.mine}/messages`, tokens.admin, { body: 'Plans', document_ids: [shared] }), 201);
  assert.equal(ok.attachments?.[0]?.document_id, shared);
  await json(await call('POST', `/conversations/${conv.mine}/messages`, tokens.mine, { document_ids: [shared] }), 201);

  // Not shared with the client, another client's file, a made-up id.
  await json(await call('POST', `/conversations/${conv.mine}/messages`, tokens.admin, { body: 'x', document_ids: [internal] }), 400);
  await json(await call('POST', `/conversations/${conv.mine}/messages`, tokens.admin, { body: 'x', document_ids: [othersShared] }), 400);
  await json(await call('POST', `/conversations/${conv.mine}/messages`, tokens.mine, { body: 'x', document_ids: [othersShared] }), 400);
  await json(await call('POST', `/conversations/${conv.mine}/messages`, tokens.designer, { body: 'x', document_ids: ['doc_nope'] }), 400);
  await json(await call('POST', `/conversations/${conv.mine}/messages`, tokens.admin, { body: 'x', attachments: [{ storage_url: 'k' }] }), 400);

  // Opening an attachment goes through Documents' own check: a client views it, saving needs an Admin's say.
  await json(await call('GET', `/documents/${shared}/download`, tokens.mine), 403);
  await json(await call('GET', `/documents/${shared}/download?inline=1`, tokens.mine));
  // A signed download URL legitimately contains its key; anywhere else is a leak.
  for (const body of bodies) {
    const unsigned = body.replace(/"url":"[^"]*"/g, '');
    assert.ok(!unsigned.includes('storage_url') && !unsigned.includes(`clients/${MINE.id}/projects/`));
  }
});

test('offline: one email per conversation per side, no message text, and the bell', async () => {
  await resetQuiet();
  sent.length = 0;
  await json(await call('POST', `/conversations/${conv.mine}/messages`, tokens.mine, { body: 'Secret kitchen detail' }), 201);
  await json(await call('POST', `/conversations/${conv.mine}/messages`, tokens.mine, { body: 'And another' }), 201);
  assert.equal(sent.length, 1, 'debounced');
  assert.deepEqual(sent[0]!.to, [ADMIN.email]);
  assert.match(sent[0]!.text, /\/messages/);
  assert.ok(!sent[0]!.html.includes('Secret') && !sent[0]!.text.includes('Secret'));
  assert.ok(await prisma.notification.count({ where: { recipient_id: DESIGNER.id, kind: 'message' } }) >= 1);

  await json(await call('POST', `/conversations/${conv.mine}/messages`, tokens.admin, { body: 'Reply' }), 201);
  assert.equal(sent.length, 2);
  assert.equal(sent[1]!.to, MINE.email);
  assert.match(sent[1]!.text, /\/messages/);
});

test('sockets: bad tokens refused, rooms scoped, typing contained, live delivery', async () => {
  await assert.rejects(connect('not-a-token'));
  await assert.rejects(connect(''));

  const admin = await connect(tokens.admin);
  const mine = await connect(tokens.mine);
  const other = await connect(tokens.other);

  assert.deepEqual(await mine.emitWithAck('conversation:join', { conversationId: conv.other }), { ok: false, error: 'Conversation not available' });
  assert.equal((await mine.emitWithAck('conversation:join', { conversationId: conv.mine })).ok, true);

  // Typing into a room this socket is not in goes nowhere.
  const leaked = next(other, 'conversation:typing');
  mine.emit('conversation:typing', { conversationId: conv.other });
  assert.equal(await leaked, 'timeout');
  const typed = next(admin, 'conversation:typing');
  mine.emit('conversation:typing', { conversationId: conv.mine });
  assert.notEqual(await typed, 'timeout');

  // A message reaches the staff live, not the other client, and nobody is emailed.
  await resetQuiet();
  sent.length = 0;
  const arrives = next<Msg>(admin, 'message:new');
  const elsewhere = next(other, 'message:new');
  const ack = await mine.emitWithAck('message:send', { conversationId: conv.mine, body: 'Live hello' });
  assert.equal(ack.ok, true);
  assert.equal(((await arrives) as Msg).body, 'Live hello');
  assert.equal(await elsewhere, 'timeout');
  assert.equal(sent.length, 0, 'staff were online');

  // Validated like HTTP: too long, unknown fields.
  const refused = next(mine, 'exception');
  mine.emit('message:send', { conversationId: conv.mine, body: 'x'.repeat(5001) });
  assert.notEqual(await refused, 'timeout');
  const extra = next(mine, 'exception');
  mine.emit('message:send', { conversationId: conv.mine, body: 'hi', sender_type: 'Staff' });
  assert.notEqual(await extra, 'timeout');
  assert.equal((await other.emitWithAck('message:send', { conversationId: conv.mine, body: 'sneak' })).ok, false);
});

test('two simultaneous first messages make one conversation', async () => {
  const fresh = { id: `cli_mnew_${run}`, email: `m-new-${run}@test.enzo.local`, name: `New ${run}` };
  const password_hash = await bcrypt.hash(PASSWORD, 4);
  await prisma.client.create({ data: { ...fresh, joined_date: new Date(), status: 'Active', password_hash } });
  try {
    const token = await signIn('/auth/portal/login', fresh.email, PASSWORD);
    const opened = await Promise.all(
      Array.from({ length: 4 }, async () => json<{ id: string }>(await call('POST', '/conversations', token, {}), 201)),
    );
    assert.equal(new Set(opened.map((c) => c.id)).size, 1);
    assert.equal(await prisma.conversation.count({ where: { client_id: fresh.id } }), 1);
  } finally {
    await prisma.conversation.deleteMany({ where: { client_id: fresh.id } });
    await prisma.client.delete({ where: { id: fresh.id } });
  }
});

test('sockets die with the session: demoted staff and signed-out clients', async () => {
  const designer = await connect(tokens.designer);
  const mine = await connect(tokens.mine);

  await json(await call('PUT', `/users/${DESIGNER.id}`, tokens.admin, { role: 'Editor' }));
  const gone = next(designer, 'disconnect');
  designer.emit('conversation:join', { conversationId: conv.mine });
  assert.equal(await gone, 'io server disconnect');

  // A token_version bump (sign out everywhere, password change) ends a listening socket too.
  await prisma.client.update({ where: { id: MINE.id }, data: { token_version: { increment: 1 } } });
  const ended = next(mine, 'disconnect');
  await json(await call('POST', `/conversations/${conv.mine}/messages`, tokens.admin, { body: 'Are you there?' }), 201);
  assert.equal(await ended, 'io server disconnect');
  await assert.rejects(connect(tokens.mine));
});
