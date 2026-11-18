import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { ADMIN, startTestApp } from './app';

/**
 * A hand-written quote for a project: only the Admin writes and sends it, only the client it is for can see
 * it (never as a Draft) and answer it, once; an accepted one becomes a Draft invoice with the payment stages.
 */

let app: Awaited<ReturnType<typeof startTestApp>>;
let prisma: PrismaClient;
const run = randomUUID().slice(0, 8);
const PASSWORD = 'quote-password-123';
const DESIGNER = { id: `stf_qd_${run}`, email: `q-designer-${run}@test.enzo.local` };
const CLIENT = { id: `cli_q_${run}`, email: `q-client-${run}@test.enzo.local` };
const OTHER = { id: `cli_q2_${run}`, email: `q-other-${run}@test.enzo.local` };
const PROJECT = `prj_q_${run}`;
const tokens = { admin: '', designer: '', client: '', other: '' };
let quoteId = '';

before(async () => {
  app = await startTestApp();
  prisma = new PrismaClient();
  const password_hash = await bcrypt.hash(PASSWORD, 4);
  await prisma.staffUser.create({ data: { ...DESIGNER, name: `Q Designer ${run}`, role: 'Designer', password_hash } });
  for (const client of [CLIENT, OTHER]) {
    await prisma.client.create({ data: { ...client, name: `Quote client ${client.id}`, joined_date: new Date(), status: 'Active', password_hash } });
  }
  await prisma.project.create({ data: { id: PROJECT, client_id: CLIENT.id, name: 'Quote job', type: 'Kitchen', status: 'Design', client_visible: true } });
  tokens.admin = await signIn('/auth/admin/login', ADMIN.email, ADMIN.password);
  tokens.designer = await signIn('/auth/admin/login', DESIGNER.email, PASSWORD);
  tokens.client = await signIn('/auth/portal/login', CLIENT.email, PASSWORD);
  tokens.other = await signIn('/auth/portal/login', OTHER.email, PASSWORD);
});

after(async () => {
  const quotes = await prisma.projectQuote.findMany({ where: { client_id: CLIENT.id }, select: { id: true, invoice_id: true } });
  await prisma.invoice.deleteMany({ where: { client_id: CLIENT.id } });
  await prisma.projectQuote.deleteMany({ where: { client_id: CLIENT.id } });
  await prisma.notification.deleteMany({ where: { link: { in: quotes.map((q) => `/quotes/${q.id}`) } } });
  await prisma.project.deleteMany({ where: { client_id: CLIENT.id } });
  await prisma.client.deleteMany({ where: { id: { in: [CLIENT.id, OTHER.id] } } });
  await prisma.staffUser.deleteMany({ where: { id: DESIGNER.id } });
  await prisma.$disconnect();
  await app.close();
});

function call(method: string, path: string, token?: string, body?: unknown): Promise<Response> {
  return fetch(`${app.url}${path}`, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
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

type Quote = { id: string; number: string; status: string; amount: number; invoice_id: string | null; expired: boolean; items: unknown[]; issuer: { name: string; address: string[] }; client_email: string | null };
const NEW = {
  client_id: CLIENT.id,
  project_id: PROJECT,
  title: 'Kitchen',
  vat_rate: 20,
  discount: 100,
  items: [
    { description: 'Units', quantity: 2, unit_price: 500 },
    { description: 'Fitting', quantity: 1, unit_price: 200 },
  ],
};

test('only an Admin can write a quote, and it must be for a project of that client', async () => {
  assert.equal((await call('POST', '/quotes', tokens.designer, NEW)).status, 403);
  assert.equal((await call('POST', '/quotes', tokens.client, NEW)).status, 403);
  assert.equal((await call('POST', '/quotes', tokens.admin, { ...NEW, client_id: OTHER.id })).status, 400, "someone else's project");
  const quote = await json<Quote>(await call('POST', '/quotes', tokens.admin, NEW), 201);
  quoteId = quote.id;
  assert.equal(quote.status, 'Draft');
  assert.match(quote.number, /^Q-\d{4}-\d{4}$/);
  assert.equal(quote.amount, 1320, '(1200 - 100) + 20% VAT');
  assert.equal(quote.items.length, 2);
  // The letterhead sheet: the company, and the client's contact for the "Submitted to" block.
  assert.ok(quote.issuer.name && quote.issuer.address.length > 0);
  assert.equal(quote.client_email, CLIENT.email);
});

test('a line with a cost and a margin is priced by the API, not the browser', async () => {
  const quote = await json<Quote & { items: { unit_price: number; cost_price: number; margin_pct: number }[] }>(
    await call('POST', '/quotes', tokens.admin, { ...NEW, discount: 0, items: [{ description: 'Worktop', quantity: 2, unit_price: 1, cost_price: 80, margin_pct: 25 }] }),
    201,
  );
  assert.deepEqual([quote.items[0]!.cost_price, quote.items[0]!.margin_pct, quote.items[0]!.unit_price], [80, 25, 100], 'cost 80 + 25% = 100 each, whatever unit_price was sent');
  assert.equal(quote.amount, 240, '2 x 100 + 20% VAT');
  assert.equal((await call('DELETE', `/quotes/${quote.id}`, tokens.admin)).status, 200);
});

test('a client never sees a Draft, and never someone else’s quote', async () => {
  assert.equal((await call('GET', `/quotes/${quoteId}`, tokens.client)).status, 404);
  assert.deepEqual(await json<Quote[]>(await call('GET', '/quotes', tokens.client)), []);
  assert.equal((await call('GET', '/quotes', tokens.designer)).status, 403);
});

test('sending shows it to its client only; an edit is refused until it is withdrawn', async () => {
  await json<Quote>(await call('POST', `/quotes/${quoteId}/send`, tokens.admin));
  assert.equal((await call('POST', `/quotes/${quoteId}/send`, tokens.admin)).status, 400, 'sent twice');
  assert.equal((await call('PUT', `/quotes/${quoteId}`, tokens.admin, { title: 'Changed' })).status, 400);
  assert.equal((await call('GET', `/quotes/${quoteId}`, tokens.other)).status, 404);
  const seen = await json<Quote>(await call('GET', `/quotes/${quoteId}`, tokens.client));
  assert.equal(seen.status, 'Sent');
  const lines = seen.items as { description: string; unit_price: number; cost_price: unknown; margin_pct: unknown }[];
  assert.equal(lines.length, 2, 'a client sees the lines');
  assert.ok(lines.every((l) => l.cost_price === null && l.margin_pct === null && l.unit_price > 0), 'never their cost or margin');
  assert.equal((await json<Quote>(await call('GET', `/quotes/${quoteId}`, tokens.admin))).items.length, 2);
  assert.equal((await call('POST', `/quotes/${quoteId}/respond`, tokens.admin, { decision: 'accept' })).status, 403, 'staff do not answer for the client');
  assert.equal((await call('POST', `/quotes/${quoteId}/respond`, tokens.other, { decision: 'accept' })).status, 404);
});

test('the client declines, the Admin revises and sends again, the client accepts: once', async () => {
  const declined = await json<Quote>(await call('POST', `/quotes/${quoteId}/respond`, tokens.client, { decision: 'decline', comment: 'Too much' }));
  assert.equal(declined.status, 'Declined');
  assert.equal((await call('POST', `/quotes/${quoteId}/respond`, tokens.client, { decision: 'accept' })).status, 400, 'already answered');

  const revised = await json<Quote>(await call('PUT', `/quotes/${quoteId}`, tokens.admin, { discount: 200 }));
  assert.equal(revised.status, 'Draft');
  assert.equal(revised.amount, 1200, '(1200 - 200) + 20% VAT');
  await json<Quote>(await call('POST', `/quotes/${quoteId}/send`, tokens.admin));

  const answers = await Promise.all([1, 2].map(() => call('POST', `/quotes/${quoteId}/respond`, tokens.client, { decision: 'accept' })));
  assert.equal(answers.filter((r) => r.status === 200).length, 1, 'one of two answers wins');
  assert.ok(answers.every((r) => [200, 400, 409].includes(r.status)));
  assert.equal((await json<Quote>(await call('GET', `/quotes/${quoteId}`, tokens.client))).status, 'Accepted');
});

test('an accepted quote becomes one Draft invoice with the payment stages', async () => {
  assert.equal((await call('POST', `/quotes/${quoteId}/invoice`, tokens.client)).status, 403);
  const quote = await json<Quote>(await call('POST', `/quotes/${quoteId}/invoice`, tokens.admin));
  assert.ok(quote.invoice_id);
  assert.equal((await call('POST', `/quotes/${quoteId}/invoice`, tokens.admin)).status, 400, 'once');
  const invoice = await json<{ status: string; amount: number; project_id: string; stages: { label: string; amount: number }[] }>(
    await call('GET', `/invoices/${quote.invoice_id}`, tokens.admin),
  );
  assert.equal(invoice.status, 'Draft');
  assert.equal(invoice.amount, 1200);
  assert.equal(invoice.project_id, PROJECT);
  assert.deepEqual(invoice.stages.map((s) => s.amount), [600, 480, 120], '50 / 40 / 10');
  assert.equal((await call('DELETE', `/quotes/${quoteId}`, tokens.admin)).status, 400, 'an accepted quote stays');
});
