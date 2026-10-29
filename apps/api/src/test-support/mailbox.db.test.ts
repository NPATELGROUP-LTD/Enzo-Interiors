import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { seal } from '../core/crypto';
import { GmailService } from '../modules/mailbox/gmail.service';
import { ADMIN, startTestApp } from './app';

/**
 * Mail: each person reaches only their own Gmail, Installers and Infra
 * managers reach none, a revoked token pauses Mail with one bell, and what is
 * sent is threaded and recorded without its subject or body. Google is faked
 * at the two hosts it lives on (token and Gmail); the app, guards, database,
 * token sealing and refresh all run for real.
 */

let app: Awaited<ReturnType<typeof startTestApp>>;
let prisma: PrismaClient;
const run = randomUUID().slice(0, 8);
const PASSWORD = 'mailbox-password-123';
const person = (key: string, role: string) => ({ id: `stf_${key}_${run}`, email: `m-${key}-${run}@test.enzo.local`, role, name: `Test ${key} ${run}` });
const DESIGNER = person('des', 'Designer');
const EDITOR = person('ed', 'Editor');
const INSTALLER = person('ins', 'Installer');
const INFRA = person('infra', 'Infra');
const FRESH = person('fresh', 'Designer'); // never linked
const ALL = [DESIGNER, EDITOR, INSTALLER, INFRA, FRESH];
const tokens: Record<string, string> = {};
let adminId = '';
const SECRET_SUBJECT = `Private-subject-${run}`;
const SECRET_BODY = `Private-body-${run}`;

/* ---- A fake Google ---- */

interface FakeMessage {
  id: string;
  labels: string[];
  from: string;
  to: string;
  subject: string;
  messageId: string;
  references?: string;
  html?: string;
  text?: string;
  files?: Array<{ partId: string; filename: string; mime: string; data: Buffer; size?: number }>;
}
interface FakeThread {
  id: string;
  messages: FakeMessage[];
}
const mailboxes = new Map<string, FakeThread[]>(); // by staff id
const revoked = new Set<string>(); // staff ids whose refresh token Google now refuses
const google: { calls: Array<{ staff: string; method: string; path: string; query: URLSearchParams; body?: Buffer }>; sent: Array<{ staff: string; body: string }>; revokes: number; tokenCalls: number } = {
  calls: [],
  sent: [],
  revokes: 0,
  tokenCalls: 0,
};
const realFetch = globalThis.fetch;
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const toBuffer = (body: unknown): Buffer | undefined => (Buffer.isBuffer(body) ? body : body instanceof Uint8Array ? Buffer.from(body) : typeof body === 'string' ? Buffer.from(body) : undefined);

const b64 = (data: string | Buffer) => Buffer.from(data).toString('base64url');
const payload = (m: FakeMessage) => {
  const headers = [
    { name: 'From', value: m.from },
    { name: 'To', value: m.to },
    { name: 'Subject', value: m.subject },
    { name: 'Message-ID', value: m.messageId },
    ...(m.references ? [{ name: 'References', value: m.references }] : []),
  ];
  const body = [
    ...(m.text ? [{ partId: '0.0', mimeType: 'text/plain', body: { data: b64(m.text) } }] : []),
    ...(m.html ? [{ partId: '0.1', mimeType: 'text/html', body: { data: b64(m.html) } }] : []),
  ];
  return {
    partId: '',
    mimeType: 'multipart/mixed',
    headers,
    parts: [
      { partId: '0', mimeType: 'multipart/alternative', parts: body },
      ...(m.files ?? []).map((f) => ({ partId: f.partId, mimeType: f.mime, filename: f.filename, body: { size: f.size ?? f.data.length, attachmentId: `att-${m.id}-${f.partId}` } })),
    ],
  };
};
const wire = (m: FakeMessage, threadId: string) => ({ id: m.id, threadId, labelIds: m.labels, internalDate: '1700000000000', snippet: 'snippet', payload: payload(m) });

async function fakeGoogle(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  if (url.hostname === 'oauth2.googleapis.com') {
    const form = new URLSearchParams(init?.body as URLSearchParams);
    if (url.pathname === '/revoke') {
      google.revokes++;
      return reply({});
    }
    google.tokenCalls++;
    if (form.get('grant_type') === 'authorization_code') {
      const code = form.get('code') ?? '';
      if (code.startsWith('noscope-')) return reply({ refresh_token: 'rt-x', id_token: 'a.e30.c', scope: 'openid email' });
      const staff = code.replace(/^code-/, '');
      const claims = { aud: process.env.GOOGLE_CLIENT_ID, iss: 'https://accounts.google.com', exp: Math.floor(Date.now() / 1000) + 600, email: `${staff}@workspace.test`, email_verified: true };
      return reply({ refresh_token: `rt-${staff}`, id_token: `h.${b64(JSON.stringify(claims))}.s`, scope: 'https://www.googleapis.com/auth/gmail.modify openid email' });
    }
    const staff = (form.get('refresh_token') ?? '').replace(/^rt-/, '');
    return revoked.has(staff) ? reply({ error: 'invalid_grant' }, 400) : reply({ access_token: `at-${staff}`, expires_in: 3600 });
  }
  if (url.hostname !== 'gmail.googleapis.com') return realFetch(input as never, init);

  const staff = ((init?.headers as Record<string, string>)?.authorization ?? '').replace(/^Bearer at-/, '');
  const box = mailboxes.get(staff) ?? [];
  const method = init?.method ?? 'GET';
  const path = url.pathname.replace('/gmail/v1/users/me', '').replace('/upload/gmail/v1/users/me', '/upload');
  const body = toBuffer(init?.body);
  google.calls.push({ staff, method, path, query: url.searchParams, body });
  const find = (id: string) => box.flatMap((t) => t.messages.map((m) => ({ t, m }))).find(({ m }) => m.id === id);

  if (path === '/threads') {
    const label = url.searchParams.get('labelIds');
    const rows = box.filter((t) => !label || t.messages.some((m) => m.labels.includes(label)));
    return reply({ threads: rows.map((t) => ({ id: t.id, snippet: 'snippet' })), ...(rows.length && !url.searchParams.get('pageToken') ? { nextPageToken: 'PAGE2' } : {}) });
  }
  const thread = /^\/threads\/([^/]+)$/.exec(path);
  if (thread) {
    const t = box.find((x) => x.id === thread[1]);
    return t ? reply({ id: t.id, messages: t.messages.map((m) => wire(m, t.id)) }) : reply({ error: {} }, 404);
  }
  const modify = /^\/threads\/([^/]+)\/modify$/.exec(path);
  if (modify) return box.some((x) => x.id === modify[1]) ? reply({}) : reply({ error: {} }, 404);
  const att = /^\/messages\/([^/]+)\/attachments\/(.+)$/.exec(path);
  if (att) {
    const hit = find(att[1]!);
    const file = hit?.m.files?.find((f) => `att-${hit.m.id}-${f.partId}` === att[2]);
    return file ? reply({ size: file.data.length, data: b64(file.data) }) : reply({ error: {} }, 404);
  }
  const message = /^\/messages\/([^/]+)$/.exec(path);
  if (message) {
    const hit = find(message[1]!);
    return hit ? reply(wire(hit.m, hit.t.id)) : reply({ error: {} }, 404);
  }
  if (path === '/upload/messages/send') {
    const text = body?.toString('utf8') ?? '';
    google.sent.push({ staff, body: text });
    return reply({ id: `sent-${google.sent.length}`, threadId: /"threadId":"([^"]+)"/.exec(text)?.[1] ?? 'new-thread' });
  }
  return reply({ error: {} }, 404);
}

/* ---- Helpers ---- */

async function call(method: string, path: string, token?: string, body?: unknown): Promise<Response> {
  return realFetch(`${app.url}${path}`, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body === undefined || body instanceof FormData ? {} : { 'content-type': 'application/json' }) },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    redirect: 'manual',
  });
}
const json = async <T>(res: Response, status = 200): Promise<T> => {
  assert.equal(res.status, status, `${res.url} answered ${res.status}`);
  return (await res.json()) as T;
};
async function signIn(email: string, password: string): Promise<string> {
  const res = await call('POST', '/auth/admin/login', undefined, { email, password });
  return ((await json<{ access_token: string }>(res)).access_token);
}
const link = (staffId: string) =>
  prisma.gmailAccount.create({ data: { id: randomUUID(), staff_id: staffId, google_email: `${staffId}@workspace.test`, refresh_token_enc: seal(`rt-${staffId}`), scopes: 'https://www.googleapis.com/auth/gmail.modify' } });
const thread = (id: string, m: Partial<FakeMessage> = {}): FakeThread => ({
  id,
  messages: [{ id: `${id}-m1`, labels: ['INBOX', 'UNREAD'], from: 'Jo Client <jo@client.example>', to: 'me@workspace.test', subject: 'Kitchen quote', messageId: `<${id}@client.example>`, text: 'Hello there', ...m }],
});
const form = (fields: Record<string, string>, files: Array<{ name: string; data: Buffer }> = []) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  for (const file of files) data.append('files', new Blob([new Uint8Array(file.data)]), file.name);
  return data;
};
const sentBy = (staffId: string) => google.sent.filter((s) => s.staff === staffId);
const decoded = (mime: string) => [...mime.matchAll(/Content-Transfer-Encoding: base64\r\n(?:[A-Za-z-]+: [^\r\n]*\r\n)*\r\n([A-Za-z0-9+/=\r\n]+?)\r\n--/g)].map((m) => Buffer.from(m[1]!.replace(/\r\n/g, ''), 'base64').toString('utf8'));

before(async () => {
  Object.assign(process.env, {
    GOOGLE_CLIENT_ID: 'test-client',
    GOOGLE_CLIENT_SECRET: 'test-secret',
    GOOGLE_GMAIL_REDIRECT_URI: 'http://localhost:4000/mailbox/callback',
    APP_ENCRYPTION_KEY: process.env.APP_ENCRYPTION_KEY?.trim() || randomBytes(32).toString('base64'),
  });
  app = await startTestApp();
  prisma = new PrismaClient();
  globalThis.fetch = fakeGoogle as typeof fetch;
  const password_hash = await bcrypt.hash(PASSWORD, 4);
  for (const staff of ALL) await prisma.staffUser.create({ data: { ...staff, password_hash } });
  adminId = (await prisma.staffUser.findFirstOrThrow({ where: { email: ADMIN.email } })).id;
  tokens.admin = await signIn(ADMIN.email, ADMIN.password);
  for (const staff of ALL) tokens[staff.id] = await signIn(staff.email, PASSWORD);

  for (const id of [adminId, DESIGNER.id, EDITOR.id]) await link(id);
  mailboxes.set(adminId, [thread('admin-t1', { subject: 'Admin only' })]);
  mailboxes.set(EDITOR.id, [thread('editor-t1')]);
  mailboxes.set(DESIGNER.id, [
    thread('des-t1', { labels: ['INBOX'], subject: SECRET_SUBJECT, html: '<p onclick="x()">Hi <b>there</b></p><script>alert(1)</script><a href="javascript:alert(1)">x</a>', text: 'Hi there' }),
    thread('des-t2', {
      id: 'des-t2-m1',
      files: [
        { partId: '1', filename: 'plan.pdf', mime: 'application/pdf', data: Buffer.from('%PDF-original') },
        { partId: '2', filename: 'huge.zip', mime: 'application/zip', data: Buffer.from('z'), size: 26 * 1024 * 1024 },
      ],
      messageId: '<des-t2@client.example>',
      references: 'legacy-bare-id <root@client.example>', // a bare id as old mail clients write it
    }),
  ]);
});

after(async () => {
  globalThis.fetch = realFetch;
  const ids = [...ALL.map((s) => s.id), adminId];
  await prisma.notification.deleteMany({ where: { recipient_id: { in: ids } } });
  await prisma.gmailAccount.deleteMany({ where: { staff_id: { in: ids } } });
  await prisma.activityLog.deleteMany({ where: { staff_id: { in: ids } } });
  await prisma.staffUser.deleteMany({ where: { id: { in: ALL.map((s) => s.id) } } });
  await prisma.$disconnect();
  await app.close();
});

/* ---- Tests ---- */

test('Installers and Infra managers get 403 on every mailbox route; the others are let in', async () => {
  const routes: Array<[string, string, unknown?]> = [
    ['GET', '/mailbox/status'],
    ['GET', '/mailbox/connect'],
    ['POST', '/mailbox/connect/complete', { code: 'A'.repeat(43) }],
    ['DELETE', '/mailbox'],
    ['GET', '/mailbox/threads'],
    ['GET', '/mailbox/threads/abc'],
    ['POST', '/mailbox/threads/abc/read', { read: true }],
    ['GET', '/mailbox/messages/abc/attachments/1'],
    ['POST', '/mailbox/send', form({ to: 'a@x.com', subject: 's', body: 'b' })],
  ];
  for (const who of [INSTALLER, INFRA]) {
    for (const [method, path, body] of routes) assert.equal((await call(method, path, tokens[who.id], body)).status, 403, `${who.role} ${method} ${path}`);
  }
  for (const [method, path] of routes) assert.equal((await call(method, path)).status, 401, `signed out ${method} ${path}`);
  for (const id of [adminId, DESIGNER.id, EDITOR.id]) {
    const status = await json<{ configured: boolean; connected: boolean }>(await call('GET', '/mailbox/status', id === adminId ? tokens.admin : tokens[id]));
    assert.deepEqual([status.configured, status.connected], [true, true]);
  }
  assert.equal(google.calls.length, 0, 'a refused request never reaches Google');
});

test('someone who has not linked Gmail is told to connect, and Google is not asked', async () => {
  const status = await json<{ connected: boolean }>(await call('GET', '/mailbox/status', tokens[FRESH.id]));
  assert.equal(status.connected, false);
  assert.equal((await call('GET', '/mailbox/threads', tokens[FRESH.id])).status, 409);
  assert.equal((await call('POST', '/mailbox/send', tokens[FRESH.id], form({ to: 'a@x.com', subject: 's', body: 'b' }))).status, 409);
  assert.equal(google.calls.length, 0);
});

test('everyone reaches only their own mailbox, even an Admin', async () => {
  const mine = await json<{ items: Array<{ id: string }> }>(await call('GET', '/mailbox/threads', tokens[DESIGNER.id]));
  assert.deepEqual(mine.items.map((t) => t.id).sort(), ['des-t1', 'des-t2']);
  const admins = await json<{ items: Array<{ id: string }> }>(await call('GET', '/mailbox/threads', tokens.admin));
  assert.deepEqual(admins.items.map((t) => t.id), ['admin-t1']);

  // An Admin naming the designer's thread or message gets nothing: Gmail answers for the Admin's own mailbox only.
  assert.equal((await call('GET', '/mailbox/threads/des-t1', tokens.admin)).status, 404);
  assert.equal((await call('GET', '/mailbox/messages/des-t2-m1/attachments/1', tokens.admin)).status, 404);
  assert.equal((await call('POST', '/mailbox/threads/des-t1/read', tokens.admin, { read: true })).status, 404);
  assert.ok(google.calls.filter((c) => c.staff === adminId).length > 0 && google.calls.every((c) => [adminId, DESIGNER.id].includes(c.staff)));
  // No route takes a person: asking for someone else's mailbox is a validation error, not a lookup.
  for (const extra of [`staff=${DESIGNER.id}`, `user=${DESIGNER.id}`, `staff_id=${DESIGNER.id}`]) assert.equal((await call('GET', `/mailbox/threads?${extra}`, tokens.admin)).status, 400);
  const send = form({ to: 'a@x.com', subject: 's', body: 'b' });
  send.set('staff_id', DESIGNER.id);
  assert.equal((await call('POST', '/mailbox/send', tokens.admin, send)).status, 400);
});

test('lists page by Gmail page tokens, search passes through, and bad input is refused before Google', async () => {
  google.calls.length = 0;
  const page = await json<{ items: Array<{ id: string; subject: string; unread: boolean; from: { email: string } }>; next_page: string | null }>(
    await call('GET', '/mailbox/threads?folder=inbox&limit=2', tokens[DESIGNER.id]),
  );
  assert.equal(page.next_page, 'PAGE2');
  assert.equal(page.items.find((t) => t.id === 'des-t1')?.from.email, 'jo@client.example');
  const first = google.calls.find((c) => c.path === '/threads')!;
  assert.deepEqual([first.query.get('labelIds'), first.query.get('maxResults')], ['INBOX', '2']);

  // A thread holding both sides: Sent shows the message that was sent, Inbox the one that came in.
  const both = thread('des-t3', { subject: 'Both ways' });
  both.messages.push({ ...both.messages[0]!, id: 'des-t3-m2', labels: ['SENT'], from: 'Me <me@workspace.test>', to: 'Kim <kim@other.test>' });
  mailboxes.get(DESIGNER.id)!.push(both);
  const sentRows = await json<{ items: Array<{ id: string; to: Array<{ email: string }>; from: { email: string } }> }>(await call('GET', '/mailbox/threads?folder=sent', tokens[DESIGNER.id]));
  assert.equal(sentRows.items.find((t) => t.id === 'des-t3')?.to[0]?.email, 'kim@other.test');
  const inboxRows = await json<{ items: Array<{ id: string; from: { email: string } }> }>(await call('GET', '/mailbox/threads?folder=inbox', tokens[DESIGNER.id]));
  assert.equal(inboxRows.items.find((t) => t.id === 'des-t3')?.from.email, 'jo@client.example');
  mailboxes.get(DESIGNER.id)!.pop();

  await json(await call('GET', `/mailbox/threads?q=${encodeURIComponent('has:attachment after:2026/01/01')}&page=PAGE2`, tokens[DESIGNER.id]));
  const search = google.calls.filter((c) => c.path === '/threads').at(-1)!;
  assert.deepEqual([search.query.get('q'), search.query.get('pageToken'), search.query.get('labelIds')], ['has:attachment after:2026/01/01', 'PAGE2', null]);

  await json(await call('GET', '/mailbox/threads?with=jo@client.example', tokens[DESIGNER.id]));
  const lookup = google.calls.filter((c) => c.path === '/threads').at(-1)!;
  assert.equal(lookup.query.get('q'), '(from:jo@client.example OR to:jo@client.example OR cc:jo@client.example OR bcc:jo@client.example)');

  const before = google.calls.length;
  for (const bad of ['limit=51', 'limit=0', 'folder=trash', 'with=not-an-address', `q=${'x'.repeat(501)}`, 'page=a%20b', 'with=a@b.co%20OR%20label:spam']) {
    assert.equal((await call('GET', `/mailbox/threads?${bad}`, tokens[DESIGNER.id])).status, 400, bad);
  }
  for (const id of ['..%2F..%2Fx', 'a'.repeat(65), 'a.b']) assert.equal((await call('GET', `/mailbox/threads/${id}`, tokens[DESIGNER.id])).status, 400, id);
  assert.equal((await call('GET', '/mailbox/messages/abc/attachments/1..2', tokens[DESIGNER.id])).status, 400);
  assert.equal(google.calls.length, before, 'none of that reached Google');
});

test('a thread is returned with safe HTML, plain text, and its files described', async () => {
  const t = await json<{ subject: string; messages: Array<{ html: string | null; text: string; attachments: Array<{ part_id: string; filename: string }> }> }>(
    await call('GET', '/mailbox/threads/des-t1', tokens[DESIGNER.id]),
  );
  assert.equal(t.subject, SECRET_SUBJECT);
  assert.doesNotMatch(t.messages[0]!.html ?? '', /script|onclick|javascript:/i);
  assert.match(t.messages[0]!.html ?? '', /<b>there<\/b>/);
  assert.equal(t.messages[0]!.text, 'Hi there');
  const files = await json<{ messages: Array<{ attachments: Array<{ part_id: string; filename: string }> }> }>(await call('GET', '/mailbox/threads/des-t2', tokens[DESIGNER.id]));
  assert.deepEqual(files.messages[0]!.attachments.map((a) => a.filename), ['plan.pdf', 'huge.zip']);
  assert.equal((await call('GET', '/mailbox/threads/nope', tokens[DESIGNER.id])).status, 404);
});

test('mark read or unread changes only the UNREAD label', async () => {
  google.calls.length = 0;
  assert.equal((await call('POST', '/mailbox/threads/des-t1/read', tokens[DESIGNER.id], { read: true })).status, 204);
  assert.equal((await call('POST', '/mailbox/threads/des-t1/read', tokens[DESIGNER.id], { read: false })).status, 204);
  const bodies = google.calls.filter((c) => c.path.endsWith('/modify')).map((c) => c.body?.toString());
  assert.deepEqual(bodies, ['{"removeLabelIds":["UNREAD"]}', '{"addLabelIds":["UNREAD"]}']);
  assert.equal((await call('POST', '/mailbox/threads/des-t1/read', tokens[DESIGNER.id], { read: 'yes' })).status, 400);
});

test('an attachment downloads as a file, never inline, and an oversize one is refused unread', async () => {
  const res = await call('GET', '/mailbox/messages/des-t2-m1/attachments/1', tokens[DESIGNER.id]);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/octet-stream');
  assert.match(res.headers.get('content-disposition') ?? '', /^attachment; filename="plan\.pdf"/);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal(Buffer.from(await res.arrayBuffer()).toString(), '%PDF-original');
  google.calls.length = 0;
  assert.equal((await call('GET', '/mailbox/messages/des-t2-m1/attachments/2', tokens[DESIGNER.id])).status, 413);
  assert.ok(!google.calls.some((c) => c.path.includes('/attachments/')), 'the big file was not even fetched');
  assert.equal((await call('GET', '/mailbox/messages/des-t2-m1/attachments/9', tokens[DESIGNER.id])).status, 404);
});

test('send, reply and forward: threaded, with attachments, and logged without subject or body', async () => {
  const mine = tokens[DESIGNER.id];
  // New message with a file.
  const fresh = await json<{ id: string; threadId: string }>(
    await call('POST', '/mailbox/send', mine, form({ to: 'Jo@Client.example, kim@other.test', cc: 'lee@third.test', subject: SECRET_SUBJECT, body: SECRET_BODY }, [{ name: 'notes é.txt', data: Buffer.from('file-bytes') }])),
  );
  assert.ok(fresh.id);
  const first = sentBy(DESIGNER.id)[0]!.body;
  assert.match(first, /^--enzo_[\w-]+\r\nContent-Type: application\/json; charset=UTF-8\r\n\r\n\{\}/);
  assert.match(first, /\r\nTo: Jo@Client\.example, kim@other\.test\r\nCc: lee@third\.test\r\nSubject: Private-subject-/);
  assert.doesNotMatch(first, /\r\nFrom:/i);
  assert.deepEqual(decoded(first), [SECRET_BODY, 'file-bytes']);
  assert.match(first, /filename\*=UTF-8''notes%20%C3%A9\.txt/);

  // Reply: the thread and the headers come from Gmail's own copy of the message, not from the browser.
  await json(await call('POST', '/mailbox/send', mine, form({ to: 'jo@client.example', subject: 'Re: Plans', body: 'Thanks', reply_to_id: 'des-t2-m1' })));
  const reply = sentBy(DESIGNER.id)[1]!.body;
  assert.match(reply, /\{"threadId":"des-t2"\}/);
  assert.match(reply, /\r\nIn-Reply-To: <des-t2@client\.example>\r\nReferences: <root@client\.example> <des-t2@client\.example>\r\n/);

  // Forward: the chosen original attachment is added; the other is not.
  await json(await call('POST', '/mailbox/send', mine, form({ to: 'kim@other.test', subject: 'Fwd: Plans', body: 'FYI', forward_id: 'des-t2-m1', forward_parts: '1' })));
  const fwd = sentBy(DESIGNER.id)[2]!.body;
  assert.deepEqual(decoded(fwd), ['FYI', '%PDF-original']);
  assert.doesNotMatch(fwd, /huge\.zip/);

  // Bad input never reaches Google.
  const count = google.sent.length;
  for (const bad of [
    form({ to: 'not-an-address', subject: 's', body: 'b' }),
    form({ to: 'a@x.com\r\nBcc: evil@x.test', subject: 's', body: 'b' }),
    form({ to: 'a@x.com', subject: 'hi\r\nBcc: evil@x.test', body: 'b' }),
    form({ to: Array.from({ length: 51 }, (_, i) => `p${i}@x.com`).join(','), subject: 's', body: 'b' }),
    form({ to: 'a@x.com', subject: 's', body: 'b', reply_to_id: '../x' }),
    form({ to: 'a@x.com', subject: 's', body: 'b', forward_id: 'des-t2-m1', forward_parts: '1..2' }),
  ]) assert.equal((await call('POST', '/mailbox/send', mine, bad)).status, 400);
  assert.equal(google.sent.length, count);
  assert.equal((await call('POST', '/mailbox/send', mine, form({ to: 'a@x.com', subject: 's', body: 'b' }, [{ name: 'big.bin', data: Buffer.alloc(26 * 1024 * 1024) }]))).status, 413);
  assert.equal(google.sent.length, count);

  // Logged: that it went, to which domains. Nothing of the message anywhere in the audit or access logs.
  await new Promise((r) => setTimeout(r, 300));
  const logs = await prisma.activityLog.findMany({ where: { staff_id: DESIGNER.id, action: 'mail_send' } });
  assert.equal(logs.length, 3);
  assert.deepEqual((logs.find((l) => (l.details as { recipients: number }).recipients === 3)?.details as { to_domains: string[] }).to_domains, ['client.example', 'other.test', 'third.test']);
  for (const table of ['activity_logs', 'access_events', 'notifications']) {
    const rows = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(`SELECT count(*) AS n FROM ${table} t WHERE t::text LIKE $1 OR t::text LIKE $2`, `%${SECRET_SUBJECT}%`, `%${SECRET_BODY}%`);
    assert.equal(Number(rows[0]!.n), 0, `${table} holds no message content`);
  }
});

test('GmailService.sendAs is the one send other modules use', async () => {
  const gmail = app.nest.get(GmailService);
  const out = await gmail.sendAs(EDITOR.id, { to: 'client@example.test', subject: 'Your enquiry', body: 'We will be in touch', inReplyTo: '<abc@x>', threadId: 'editor-t1' });
  assert.ok(out.id);
  const body = sentBy(EDITOR.id).at(-1)!.body;
  assert.match(body, /\{"threadId":"editor-t1"\}/);
  assert.match(body, /In-Reply-To: <abc@x>/);
  await assert.rejects(gmail.sendAs(INSTALLER.id, { to: 'a@x.com', subject: 's', body: 'b' }), /does not have access/); // role is checked here too, not just on the route
  await assert.rejects(gmail.sendAs(FRESH.id, { to: 'a@x.com', subject: 's', body: 'b' }), /Connect your Gmail/);
});

test('linking: Google sends the person back, the token is sealed, scope is required, and the link works once', async () => {
  const start = await json<{ url: string }>(await call('GET', '/mailbox/connect', tokens[FRESH.id]));
  const url = new URL(start.url);
  assert.equal(url.origin + url.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.equal(url.searchParams.get('scope'), 'https://www.googleapis.com/auth/gmail.modify openid email');
  assert.equal(url.searchParams.get('access_type'), 'offline');
  const state = url.searchParams.get('state')!;

  const back = await call('GET', `/mailbox/callback?code=code-${FRESH.id}&state=${encodeURIComponent(state)}`);
  assert.equal(back.status, 302);
  const handoff = new URL(back.headers.get('location') ?? '').searchParams.get('mail_code');
  assert.ok(handoff, 'Google\'s return only hands the admin a one-time code');
  assert.equal(await prisma.gmailAccount.count({ where: { staff_id: FRESH.id } }), 0, 'the callback itself links nothing');
  assert.equal((await call('POST', '/mailbox/connect/complete', tokens[FRESH.id], { code: handoff })).status, 200);
  assert.equal((await call('POST', '/mailbox/connect/complete', tokens[FRESH.id], { code: handoff })).status, 400); // single use
  const row = await prisma.gmailAccount.findUniqueOrThrow({ where: { staff_id: FRESH.id } });
  assert.equal(row.google_email, `${FRESH.id}@workspace.test`);
  assert.match(row.refresh_token_enc, /^v1\./);
  assert.ok(!row.refresh_token_enc.includes(FRESH.id), 'the refresh token is not stored in the clear');
  mailboxes.set(FRESH.id, [thread('fresh-t1')]);
  assert.equal((await json<{ items: unknown[] }>(await call('GET', '/mailbox/threads', tokens[FRESH.id]))).items.length, 1);

  const again = await call('GET', `/mailbox/callback?code=code-${FRESH.id}&state=${encodeURIComponent(state)}`);
  assert.match(again.headers.get('location') ?? '', /mail=error$/); // the state was spent
  const next = new URL((await json<{ url: string }>(await call('GET', '/mailbox/connect', tokens[FRESH.id]))).url).searchParams.get('state')!;
  assert.match((await call('GET', `/mailbox/callback?code=noscope-1&state=${encodeURIComponent(next)}`)).headers.get('location') ?? '', /mail=error$/); // Gmail access unticked
  assert.match((await call('GET', '/mailbox/callback?code=x&state=forged')).headers.get('location') ?? '', /mail=error$/);
  assert.match((await call('GET', '/mailbox/callback')).headers.get('location') ?? '', /mail=error$/);
});

async function startFlow(staffId: string): Promise<string> {
  return new URL((await json<{ url: string }>(await call('GET', '/mailbox/connect', tokens[staffId]))).url).searchParams.get('state')!;
}
const handoffOf = (back: Response) => new URL(back.headers.get('location') ?? '').searchParams.get('mail_code');

test('a link one person started cannot be finished by anyone else (the colleague-consent trick)', async () => {
  // The Designer starts "Connect" and sends the Google URL to the Editor, who consents with their own Google account.
  const state = await startFlow(DESIGNER.id);
  const before = await prisma.gmailAccount.findUniqueOrThrow({ where: { staff_id: DESIGNER.id } });
  const code = handoffOf(await call('GET', `/mailbox/callback?code=code-${EDITOR.id}&state=${encodeURIComponent(state)}`));
  assert.ok(code);
  // The Editor's browser lands on the admin signed in as the Editor and hands the code back: refused, and the code is burned.
  assert.equal((await call('POST', '/mailbox/connect/complete', tokens[EDITOR.id], { code })).status, 403);
  assert.equal((await call('POST', '/mailbox/connect/complete', tokens[DESIGNER.id], { code })).status, 400);
  const after = await prisma.gmailAccount.findUniqueOrThrow({ where: { staff_id: DESIGNER.id } });
  assert.equal(after.google_email, before.google_email);
  assert.equal(after.refresh_token_enc, before.refresh_token_enc);
  // Nobody signed in, a malformed code, and a made-up one are all refused too.
  assert.equal((await call('POST', '/mailbox/connect/complete', undefined, { code })).status, 401);
  assert.equal((await call('POST', '/mailbox/connect/complete', tokens[DESIGNER.id], { code: 'short' })).status, 400);
  assert.equal((await call('POST', '/mailbox/connect/complete', tokens[DESIGNER.id], { code: 'A'.repeat(43) })).status, 400);
  assert.equal((await call('POST', '/mailbox/connect/complete', tokens[INSTALLER.id], { code: 'A'.repeat(43) })).status, 403);
});

test('a token Google revokes pauses Mail, rings the bell once, and a reconnect lifts it', async () => {
  revoked.add(EDITOR.id);
  tokensForget();
  assert.equal((await call('GET', '/mailbox/threads', tokens[EDITOR.id])).status, 409);
  assert.equal((await call('GET', '/mailbox/threads', tokens[EDITOR.id])).status, 409);
  const status = await json<{ connected: boolean; needs_reconnect: boolean }>(await call('GET', '/mailbox/status', tokens[EDITOR.id]));
  assert.deepEqual([status.connected, status.needs_reconnect], [true, true]);
  const bells = await prisma.notification.findMany({ where: { recipient_id: EDITOR.id } });
  assert.equal(bells.length, 1);
  assert.equal(bells[0]!.link, '/mail');
  const before = google.tokenCalls;
  await call('GET', '/mailbox/threads', tokens[EDITOR.id]);
  assert.equal(google.tokenCalls, before, 'no more asking Google while it needs a reconnect');

  revoked.delete(EDITOR.id);
  const state = await startFlow(EDITOR.id);
  const code = handoffOf(await call('GET', `/mailbox/callback?code=code-${EDITOR.id}&state=${encodeURIComponent(state)}`));
  assert.equal((await call('POST', '/mailbox/connect/complete', tokens[EDITOR.id], { code })).status, 200);
  assert.equal((await call('GET', '/mailbox/threads', tokens[EDITOR.id])).status, 200);
});

test('disconnecting revokes at Google and forgets the token; removing the person does too', async () => {
  const revokes = google.revokes;
  assert.equal((await call('DELETE', '/mailbox', tokens[FRESH.id])).status, 204);
  assert.equal(google.revokes, revokes + 1);
  assert.equal(await prisma.gmailAccount.count({ where: { staff_id: FRESH.id } }), 0);
  assert.equal((await call('GET', '/mailbox/threads', tokens[FRESH.id])).status, 409);
  assert.equal((await call('DELETE', '/mailbox', tokens[FRESH.id])).status, 204); // nothing to disconnect is fine
});

/** The fake keeps no state between tokens, but the service caches access tokens; a revoked one is only noticed on refresh. */
function tokensForget(): void {
  (app.nest.get(GmailService) as unknown as { tokens: Map<string, unknown> }).tokens.clear();
}
