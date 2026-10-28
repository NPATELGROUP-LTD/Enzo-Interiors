import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import { Prisma, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { MailService, type Mail } from '../core/mail.service';
import { ADMIN, startTestApp } from './app';

/**
 * Booking against the real AppModule and database: a visitor's booking is also an enquiry
 * (and makes no account or sign-in email), the form's contact-field rules hold in the API
 * for visitors and staff, and only an Admin changes them. POST /booking allows 5 per 15
 * minutes per address, so this file makes exactly five public bookings.
 */

let app: Awaited<ReturnType<typeof startTestApp>>;
let prisma: PrismaClient;
const run = randomUUID().slice(0, 8);
const PASSWORD = 'booking-password-123';
const EDITOR = { id: `stf_bked_${run}`, email: `bk-editor-${run}@test.enzo.local`, role: 'Editor' };
const DESIGNER = { id: `stf_bkds_${run}`, email: `bk-designer-${run}@test.enzo.local`, role: 'Designer' };
const CLIENT = { id: `cli_bk_${run}`, email: `bk-client-${run}@test.enzo.local` };
const SERVICE = `bk-svc-${run}`;
const TAGS = ['ok', 'nopost', 'nophone', 'noaddr', 'hidden', 'staff', 'staff2'];
const emailOf = (tag: string) => `bk-${tag}-${run}@test.enzo.local`;
const tokens = { admin: '', editor: '', designer: '', client: '' };
const sent: Mail[] = [];
let slots: Array<{ date: string; time: string }> = [];
let saved: { pages: Prisma.JsonValue | null; had: boolean; config: Prisma.JsonValue | null };

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

const reason = async (res: Response) => ((await res.json()) as { message: string | string[] }).message;

/** The next free time, on its own day so one booking never clashes with the next. */
const nextSlot = () => {
  const slot = slots.shift();
  assert.ok(slot, 'the test database has a free time to book');
  return slot;
};
const visitor = (tag: string, extra: Record<string, string> = {}) =>
  call('POST', '/booking', undefined, { service: SERVICE, ...nextSlot(), name: `Booker ${tag} ${run}`, email: emailOf(tag), ...extra });
const staff = (tag: string, extra: Record<string, string> = {}) =>
  call('POST', '/appointments', tokens.admin, { service: SERVICE, ...nextSlot(), name: `Booker ${tag} ${run}`, email: emailOf(tag), ...extra });

/** Settings › Booking schedule › "What the form asks", as the admin saves it. */
async function setFields(fields: Record<string, string>) {
  const { config } = (await (await call('GET', '/booking/settings', tokens.admin)).json()) as { config: { fields: object } };
  const res = await call('PUT', '/booking/settings', tokens.admin, { config: { ...config, fields: { ...config.fields, ...fields } } });
  assert.equal(res.status, 200);
}

before(async () => {
  app = await startTestApp();
  app.nest.get(MailService).send = async (mail) => {
    sent.push(mail);
    return true;
  };
  prisma = new PrismaClient();
  const password_hash = await bcrypt.hash(PASSWORD, 4);
  for (const person of [EDITOR, DESIGNER]) {
    await prisma.staffUser.create({ data: { ...person, name: `Test ${person.role} ${run}`, password_hash } });
  }
  await prisma.client.create({ data: { ...CLIENT, name: 'Client', password_hash, joined_date: new Date(), status: 'Active' } });
  await prisma.cmsEntry.create({
    data: { id: `cms_${SERVICE}`, collection: 'services', slug: SERVICE, draft: { title: 'Test kitchens' }, published: { title: 'Test kitchens', shortName: 'Test kitchens' }, published_at: new Date() },
  });

  // What the suite changes, put back afterwards: the booking page is off until Settings › Pages turns it on.
  const site = await prisma.siteSettings.findUnique({ where: { id: 'site' } });
  const row = await prisma.bookingSettings.findUnique({ where: { id: 'booking' } });
  saved = { had: site !== null, pages: site?.pages ?? null, config: row?.config ?? null };
  const pages = { ...((site?.pages as object | null) ?? {}), booking: true };
  await prisma.siteSettings.upsert({ where: { id: 'site' }, update: { pages }, create: { id: 'site', pages } });
  await prisma.bookingSettings.deleteMany({ where: { id: 'booking' } }); // the defaults, as a fresh install has them

  tokens.admin = await signIn('/auth/admin/login', ADMIN.email, ADMIN.password);
  tokens.editor = await signIn('/auth/admin/login', EDITOR.email, PASSWORD);
  tokens.designer = await signIn('/auth/admin/login', DESIGNER.email, PASSWORD);
  tokens.client = await signIn('/auth/portal/login', CLIENT.email, PASSWORD);

  const day = (ahead: number) => new Date(Date.now() + ahead * 86_400_000).toISOString().slice(0, 10);
  const free = (await (await call('GET', `/booking/availability?from=${day(2)}&to=${day(20)}`)).json()) as { days: Record<string, string[]> };
  slots = Object.entries(free.days).flatMap(([date, times]) => (times[0] ? [{ date, time: times[0] }] : []));
  assert.ok(slots.length >= TAGS.length, 'enough open days in the next three weeks');
});

after(async () => {
  const emails = TAGS.map(emailOf);
  await prisma.appointment.deleteMany({ where: { email: { in: emails } } });
  await prisma.contactSubmission.deleteMany({ where: { email: { in: emails } } });
  await prisma.notification.deleteMany({ where: { title: { contains: run } } });
  await prisma.cmsEntry.deleteMany({ where: { slug: SERVICE } });
  await prisma.bookingSettings.deleteMany({ where: { id: 'booking' } });
  if (saved.config) await prisma.bookingSettings.create({ data: { id: 'booking', config: saved.config } });
  if (saved.had) await prisma.siteSettings.update({ where: { id: 'site' }, data: { pages: saved.pages ?? Prisma.JsonNull } });
  else await prisma.siteSettings.deleteMany({ where: { id: 'site' } });
  await prisma.client.deleteMany({ where: { id: CLIENT.id } });
  await prisma.staffUser.deleteMany({ where: { id: { in: [EDITOR.id, DESIGNER.id] } } });
  await prisma.$disconnect();
  await app.close();
});

test('a visitor books: confirmation and studio alert go out, an enquiry tagged Booking appears, no account or sign-in email', async () => {
  sent.length = 0;
  const res = await visitor('ok', { phone: '07700900123', postcode: 'le2 3ab', notes: 'Hello', address: '1 High St' });
  assert.equal(res.status, 201);
  const { reference } = (await res.json()) as { reference: string };

  const enquiry = await prisma.contactSubmission.findFirstOrThrow({ where: { email: emailOf('ok') } });
  assert.equal(enquiry.kind, 'booking');
  assert.equal(enquiry.source, 'Booking');
  assert.equal(enquiry.status, 'New');
  assert.equal(enquiry.phone, '07700900123');
  assert.equal(enquiry.message, 'Hello');
  const details = enquiry.details as Record<string, string>;
  assert.equal(details.Reference, reference);
  assert.equal(details.Postcode, 'LE2 3AB');

  const toVisitor = sent.filter((mail) => mail.to === emailOf('ok'));
  assert.equal(toVisitor.length, 1, 'the visitor gets one email: the booking confirmation');
  assert.match(toVisitor[0]!.subject, /^Your consultation is booked/);
  assert.ok(!/password|invit|account|sign.?in|portal/i.test(`${toVisitor[0]!.subject} ${toVisitor[0]!.text}`), 'no account-setup wording');
  assert.ok(sent.some((mail) => ([] as string[]).concat(mail.to).includes(ADMIN.email) && mail.subject.startsWith('New consultation')), 'the studio is told');
  assert.equal(sent.length, 2, 'the confirmation and the studio alert only; the enquiry sends nothing of its own');

  assert.equal(await prisma.client.count({ where: { email: emailOf('ok') } }), 0, 'no client account is made');
  assert.ok((await prisma.notification.count({ where: { kind: 'booking', title: `New booking: Booker ok ${run}` } })) >= 1, 'the bell rings for the booking');
  assert.equal(await prisma.notification.count({ where: { kind: 'enquiry', title: { contains: run } } }), 0, 'and not a second time for the enquiry');
});

test('by default a visitor must give phone and postcode; address and notes are optional', async () => {
  const noPostcode = await visitor('nopost', { phone: '07700900123' });
  assert.equal(noPostcode.status, 400);
  assert.equal(await reason(noPostcode), 'Enter your postcode.');
  const noPhone = await visitor('nophone', { postcode: 'LE1 1AA' });
  assert.equal(noPhone.status, 400);
  assert.equal(await reason(noPhone), 'Enter your phone number.');
  assert.equal(await prisma.appointment.count({ where: { email: { in: [emailOf('nopost'), emailOf('nophone')] } } }), 0);
  assert.equal(await prisma.contactSubmission.count({ where: { email: { in: [emailOf('nopost'), emailOf('nophone')] } } }), 0, 'a refused booking leaves no enquiry');
});

test('the availability the form reads carries the rules', async () => {
  const day = slots[0]!.date;
  const body = (await (await call('GET', `/booking/availability?from=${day}&to=${day}`)).json()) as { fields: Record<string, string> };
  assert.deepEqual(body.fields, { phone: 'required', address: 'optional', postcode: 'required', notes: 'optional' });
});

test('the Admin changes a rule and the API follows: Required refuses, Hidden is ignored', async () => {
  await setFields({ address: 'required', postcode: 'off' });
  const noAddress = await visitor('noaddr', { phone: '07700900123' });
  assert.equal(noAddress.status, 400);
  assert.equal(await reason(noAddress), 'Enter your address.');

  // Postcode is hidden now: not needed, and a value posted anyway is dropped, not stored.
  const hidden = await visitor('hidden', { phone: '07700900123', address: '2 High St', postcode: 'LE9 9ZZ' });
  assert.equal(hidden.status, 201);
  const row = await prisma.appointment.findFirstOrThrow({ where: { email: emailOf('hidden') } });
  assert.equal(row.postcode, null);
  assert.equal(row.address, '2 High St');
  const enquiry = await prisma.contactSubmission.findFirstOrThrow({ where: { email: emailOf('hidden') } });
  assert.ok(!('Postcode' in ((enquiry.details as object | null) ?? {})), 'the enquiry does not carry it either');
});

test('staff bookings follow the same rules and make no enquiry', async () => {
  const refused = await staff('staff', { phone: '07700900123' });
  assert.equal(refused.status, 400);
  assert.equal(await reason(refused), 'Enter your address.');
  assert.equal((await staff('staff2', { phone: '07700900123', address: '3 High St' })).status, 201);
  assert.equal(await prisma.contactSubmission.count({ where: { email: emailOf('staff2') } }), 0, 'an enquiry is only for what visitors send');
});

test('an unknown rule is refused', async () => {
  const { config } = (await (await call('GET', '/booking/settings', tokens.admin)).json()) as { config: { fields: object } };
  assert.equal((await call('PUT', '/booking/settings', tokens.admin, { config: { ...config, fields: { ...config.fields, phone: 'maybe' } } })).status, 400);
});

test('only an Admin reads or changes the form rules or books for someone', async () => {
  for (const token of [tokens.editor, tokens.designer, tokens.client, undefined]) {
    const expected = token ? 403 : 401;
    assert.equal((await call('GET', '/booking/settings', token)).status, expected);
    assert.equal((await call('PUT', '/booking/settings', token, { config: {} })).status, expected);
    assert.equal((await call('POST', '/appointments', token, {})).status, expected);
  }
});
