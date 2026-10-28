import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { MailService, type Mail } from '../core/mail.service';
import { ADMIN, startTestApp } from './app';

/** The enquiries inbox: Admin only, status only, against the real AppModule and database. */

let app: Awaited<ReturnType<typeof startTestApp>>;
let prisma: PrismaClient;
const run = randomUUID().slice(0, 8);
const PASSWORD = 'enquiry-password-123';
const EDITOR = { id: `stf_enqed_${run}`, email: `enq-editor-${run}@test.enzo.local`, role: 'Editor' };
const DESIGNER = { id: `stf_enqds_${run}`, email: `enq-designer-${run}@test.enzo.local`, role: 'Designer' };
const CLIENT = { id: `cli_enq_${run}`, email: `enq-client-${run}@test.enzo.local` };
const ROW = { id: `enq_${run}`, name: `Enquirer ${run}`, email: `enq-${run}@test.enzo.local` };
const REPLY_ROW = { id: `enq2_${run}`, name: `Replied ${run}`, email: `enq2-${run}@test.enzo.local` };
const VISITOR = { name: `Visitor ${run}`, email: `visitor-${run}@test.enzo.local` };
const PADDED_EMAIL = `padded-${run}@test.enzo.local`;
/** Every email the API tried to send, and whether the pretend mail server takes the next one. */
const sent: Mail[] = [];
let accepted = true;
const tokens = { admin: '', editor: '', designer: '', client: '' };

const call = (method: string, path: string, token?: string, body?: unknown) =>
  fetch(`${app.url}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

async function signIn(path: string, email: string, password: string): Promise<string> {
  const res = await call('POST', path, undefined, { email, password });
  assert.equal(res.status, 200, `${path} for ${email}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

before(async () => {
  app = await startTestApp();
  app.nest.get(MailService).send = async (mail) => {
    sent.push(mail);
    return accepted;
  };
  prisma = new PrismaClient();
  const password_hash = await bcrypt.hash(PASSWORD, 4);
  for (const staff of [EDITOR, DESIGNER]) {
    await prisma.staffUser.create({ data: { ...staff, name: `Test ${staff.role}`, password_hash } });
  }
  await prisma.client.create({
    data: { ...CLIENT, name: 'Client', password_hash, joined_date: new Date(), status: 'Active' },
  });
  await prisma.contactSubmission.create({
    data: { ...ROW, message: 'Hello', status: 'New', kind: 'contact', created_at: new Date() },
  });
  await prisma.contactSubmission.create({
    data: { ...REPLY_ROW, message: 'Hello', status: 'New', kind: 'contact', created_at: new Date() },
  });
  tokens.admin = await signIn('/auth/admin/login', ADMIN.email, ADMIN.password);
  tokens.editor = await signIn('/auth/admin/login', EDITOR.email, PASSWORD);
  tokens.designer = await signIn('/auth/admin/login', DESIGNER.email, PASSWORD);
  tokens.client = await signIn('/auth/portal/login', CLIENT.email, PASSWORD);
});

after(async () => {
  await prisma.contactSubmission.deleteMany({ where: { OR: [{ id: { in: [ROW.id, REPLY_ROW.id] } }, { email: { in: [VISITOR.email, PADDED_EMAIL] } }] } });
  await prisma.notification.deleteMany({ where: { title: { contains: run } } });
  await prisma.client.deleteMany({ where: { id: CLIENT.id } });
  await prisma.staffUser.deleteMany({ where: { id: { in: [EDITOR.id, DESIGNER.id] } } });
  await prisma.$disconnect();
  await app.close();
});

test('an Admin lists, filters, reads and updates', async () => {
  const list = await call('GET', '/enquiries?status=New&limit=100', tokens.admin);
  assert.equal(list.status, 200);
  const body = (await list.json()) as { items: Array<{ id: string }>; new_count: number };
  assert.ok(body.items.some((row) => row.id === ROW.id));
  assert.ok(body.new_count >= 1);

  assert.equal((await call('GET', `/enquiries/${ROW.id}`, tokens.admin)).status, 200);
  assert.equal((await call('GET', '/enquiries/nope', tokens.admin)).status, 404);

  const patch = await call('PATCH', `/enquiries/${ROW.id}`, tokens.admin, { status: 'Contacted' });
  assert.equal(patch.status, 200);
  const again = (await (await call('GET', '/enquiries?status=New&limit=100', tokens.admin)).json()) as {
    items: Array<{ id: string }>;
  };
  assert.ok(!again.items.some((row) => row.id === ROW.id));
});

test('an unknown status or extra field is refused', async () => {
  assert.equal((await call('PATCH', `/enquiries/${ROW.id}`, tokens.admin, { status: 'Done' })).status, 400);
  assert.equal((await call('PATCH', `/enquiries/${ROW.id}`, tokens.admin, { status: 'New', name: 'x' })).status, 400);
  assert.equal((await call('GET', '/enquiries?status=Bogus', tokens.admin)).status, 400);
});

test('everyone else is refused', async () => {
  for (const token of [tokens.editor, tokens.designer, tokens.client, undefined]) {
    const expected = token ? 403 : 401;
    assert.equal((await call('GET', '/enquiries', token)).status, expected);
    assert.equal((await call('GET', `/enquiries/${ROW.id}`, token)).status, expected);
    assert.equal((await call('PATCH', `/enquiries/${ROW.id}`, token, { status: 'Archived' })).status, expected);
  }
});

test('the contact form stores the enquiry, thanks the visitor, emails the studio and rings the bell', async () => {
  sent.length = 0;
  const res = await call('POST', '/enquiries', undefined, {
    kind: 'contact',
    ...VISITOR,
    message: 'A private message the confirmation must not repeat',
    details: { service: 'Kitchens' },
  });
  assert.equal(res.status, 201);

  const row = await prisma.contactSubmission.findFirstOrThrow({ where: { email: VISITOR.email } });
  assert.equal(row.source, 'Contact');
  assert.equal(row.status, 'New');

  const studio = sent.find((mail) => mail.subject === `Enquiry from ${VISITOR.name}`);
  assert.ok(studio && ([] as string[]).concat(studio.to).includes(ADMIN.email), 'the studio is emailed');
  assert.equal(studio.replyTo, VISITOR.email);

  const thanks = sent.find((mail) => mail.to === VISITOR.email);
  assert.ok(thanks, 'the visitor is emailed');
  assert.equal(thanks.subject, 'We have your enquiry');
  assert.equal(thanks.replyTo, ADMIN.email, 'a reply reaches the studio');
  assert.ok(!thanks.text.includes('private message') && !thanks.html.includes('private message'), 'it never repeats what was typed');

  const bell = await prisma.notification.findMany({ where: { kind: 'enquiry', title: `New enquiry from ${VISITOR.name}` } });
  assert.ok(bell.length >= 1, 'an Admin is told in the bell');
});

test('a name of only spaces is refused, and a padded name is kept trimmed', async () => {
  const blank = await call('POST', '/enquiries', undefined, { kind: 'contact', name: '   ', email: PADDED_EMAIL });
  assert.equal(blank.status, 400);
  assert.equal(await prisma.contactSubmission.count({ where: { email: PADDED_EMAIL } }), 0);

  const padded = await call('POST', '/enquiries', undefined, { kind: 'contact', name: `  Padded ${run}  `, email: PADDED_EMAIL });
  assert.equal(padded.status, 201);
  assert.equal((await prisma.contactSubmission.findFirstOrThrow({ where: { email: PADDED_EMAIL } })).name, `Padded ${run}`);
});

test('a bot that fills the honeypot is told nothing and nothing happens', async () => {
  sent.length = 0;
  const res = await call('POST', '/enquiries', undefined, { kind: 'contact', name: 'Bot', email: `bot-${run}@test.enzo.local`, website: 'http://spam' });
  assert.equal(res.status, 204);
  assert.equal(sent.length, 0);
  assert.equal(await prisma.contactSubmission.count({ where: { email: `bot-${run}@test.enzo.local` } }), 0);
});

test('an Admin replies from the inbox: emailed as plain text, kept on the enquiry, New becomes Contacted', async () => {
  sent.length = 0;
  const res = await call('POST', `/enquiries/${REPLY_ROW.id}/reply`, tokens.admin, { body: 'Hello <b>there</b>\r\n\r\n\r\n\r\nSecond paragraph\u0007' });
  assert.equal(res.status, 201);
  const body = (await res.json()) as { message: { direction: string; body: string; to_address: string; sent_by: string }; enquiry: { status: string } };
  assert.equal(body.enquiry.status, 'Contacted');
  assert.equal(body.message.direction, 'out');
  assert.equal(body.message.to_address, REPLY_ROW.email);
  assert.equal(body.message.body, 'Hello <b>there</b>\n\nSecond paragraph', 'line breaks kept, runs collapsed, control characters gone');

  const mail = sent.find((m) => m.to === REPLY_ROW.email);
  assert.ok(mail, 'the enquirer is emailed');
  assert.equal(mail.replyTo, ADMIN.email, 'Reply-To is the studio address');
  assert.ok(mail.html.includes('&lt;b&gt;there&lt;/b&gt;') && !mail.html.includes('<b>there'), 'tags are text, never markup');
  assert.ok(mail.text.includes('Hello <b>there</b>'));

  const detail = (await (await call('GET', `/enquiries/${REPLY_ROW.id}`, tokens.admin)).json()) as { messages: Array<{ body: string }> };
  assert.equal(detail.messages.length, 1);

  // A status an Admin chose afterwards is not undone by the next reply.
  await call('PATCH', `/enquiries/${REPLY_ROW.id}`, tokens.admin, { status: 'Converted' });
  assert.equal((await call('POST', `/enquiries/${REPLY_ROW.id}/reply`, tokens.admin, { body: 'Another' })).status, 201);
  const row = await prisma.contactSubmission.findUniqueOrThrow({ where: { id: REPLY_ROW.id } });
  assert.equal(row.status, 'Converted');
  assert.equal(await prisma.enquiryMessage.count({ where: { enquiry_id: REPLY_ROW.id } }), 2);
});

test('a reply the mail server did not accept is an error and is not kept', async () => {
  const before = await prisma.enquiryMessage.count({ where: { enquiry_id: REPLY_ROW.id } });
  accepted = false;
  try {
    assert.equal((await call('POST', `/enquiries/${REPLY_ROW.id}/reply`, tokens.admin, { body: 'Lost' })).status, 503);
  } finally {
    accepted = true;
  }
  assert.equal(await prisma.enquiryMessage.count({ where: { enquiry_id: REPLY_ROW.id } }), before);
});

test('a reply must be some text, short enough, and for an enquiry that exists', async () => {
  const reply = (id: string, body: unknown) => call('POST', `/enquiries/${id}/reply`, tokens.admin, body);
  assert.equal((await reply(REPLY_ROW.id, { body: '   ' })).status, 400);
  assert.equal((await reply(REPLY_ROW.id, { body: 'x'.repeat(5001) })).status, 400);
  assert.equal((await reply(REPLY_ROW.id, { body: 'hi', to: 'someone@else.test' })).status, 400, 'no choosing another address');
  assert.equal((await reply('nope', { body: 'hi' })).status, 404);
});

test('only an Admin replies', async () => {
  const before = await prisma.enquiryMessage.count({ where: { enquiry_id: REPLY_ROW.id } });
  for (const token of [tokens.editor, tokens.designer, tokens.client, undefined]) {
    assert.equal((await call('POST', `/enquiries/${REPLY_ROW.id}/reply`, token, { body: 'hi' })).status, token ? 403 : 401);
  }
  assert.equal(await prisma.enquiryMessage.count({ where: { enquiry_id: REPLY_ROW.id } }), before);
});
