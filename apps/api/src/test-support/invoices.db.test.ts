import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { ADMIN, startTestApp } from './app';

/** Invoices: Admin-only for staff, exact decimal totals, client scope, numbering, against the real AppModule. */

let app: Awaited<ReturnType<typeof startTestApp>>;
let prisma: PrismaClient;
const run = randomUUID().slice(0, 8);
const PASSWORD = 'invoice-password-123';
const EDITOR = { id: `stf_ied_${run}`, email: `i-editor-${run}@test.enzo.local`, role: 'Editor' };
const DESIGNER = { id: `stf_ides_${run}`, email: `i-designer-${run}@test.enzo.local`, role: 'Designer' };
const MINE = { id: `cli_imine_${run}`, email: `i-mine-${run}@test.enzo.local` };
const OTHER = { id: `cli_iother_${run}`, email: `i-other-${run}@test.enzo.local` };
const P = { mine: `prj_imine_${run}`, other: `prj_iother_${run}` };
const LEGACY = `inv_legacy_${run}`; // stored before lines existed: gross 120 at 20% VAT, no items
const OTHERS_SENT = `inv_osent_${run}`;

const tokens = { admin: '', editor: '', designer: '', mine: '', other: '' };

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
      { ...project, id: P.mine, client_id: MINE.id, name: 'Mine kitchen', assigned_designer_id: DESIGNER.id },
      { ...project, id: P.other, client_id: OTHER.id, name: 'Other kitchen' },
    ],
  });
  await prisma.invoice.createMany({
    data: [
      { id: LEGACY, number: `L-${run}`, client_id: MINE.id, amount: 120, vat_rate: 20, status: 'Draft', due_date: new Date() },
      { id: OTHERS_SENT, number: `O-${run}`, client_id: OTHER.id, amount: 50, vat_rate: 0, status: 'Sent', due_date: new Date() },
    ],
  });

  tokens.admin = await signIn('/auth/admin/login', ADMIN.email, ADMIN.password);
  tokens.editor = await signIn('/auth/admin/login', EDITOR.email, PASSWORD);
  tokens.designer = await signIn('/auth/admin/login', DESIGNER.email, PASSWORD);
  tokens.mine = await signIn('/auth/portal/login', MINE.email, PASSWORD);
  tokens.other = await signIn('/auth/portal/login', OTHER.email, PASSWORD);
});

after(async () => {
  await prisma.invoice.deleteMany({ where: { client_id: { in: [MINE.id, OTHER.id] } } }); // lines cascade
  await prisma.project.deleteMany({ where: { client_id: { in: [MINE.id, OTHER.id] } } });
  await prisma.client.deleteMany({ where: { id: { in: [MINE.id, OTHER.id] } } });
  await prisma.staffUser.deleteMany({ where: { id: { in: [EDITOR.id, DESIGNER.id] } } });
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

interface Inv {
  id: string;
  number: string;
  status: string;
  amount: number;
  net_amount: number;
  vat_amount: number;
  vat_rate: number;
  project_id: string | null;
  items: Array<{ description: string; quantity: number; unit_price: number; position: number }>;
}

const due = '2099-01-31';
const create = (body: Record<string, unknown>, token = tokens.admin) =>
  call('POST', '/invoices', token, { client_id: MINE.id, due_date: due, ...body });

test('an Admin creates an invoice from lines; totals are exact decimals', async () => {
  const made = await json<Inv>(await create({ items: [{ description: 'Fitting', quantity: 3, unit_price: 33.33 }], vat_rate: 20 }), 201);
  assert.match(made.number, /^INV-\d{4}-\d{4,}$/);
  assert.equal(made.status, 'Draft');
  assert.equal(made.net_amount, 99.99); // 3 x 33.33, not 99.99000000000001
  assert.equal(made.vat_amount, 20); // 19.998 to the penny
  assert.equal(made.amount, 119.99);
  assert.equal(made.items.length, 1);
  const row = await prisma.invoice.findUniqueOrThrow({ where: { id: made.id } });
  assert.equal(row.amount.toString(), '119.99', 'persisted to invoices.amount for the other readers');

  // Floats say 0.1 + 0.2 = 0.30000000000000004.
  const sums = await json<Inv>(
    await create({ vat_rate: 0, items: [{ description: 'a', quantity: 1, unit_price: 0.1 }, { description: 'b', quantity: 1, unit_price: 0.2 }] }),
    201,
  );
  assert.equal(sums.amount, 0.3);
  assert.deepEqual(sums.items.map((i) => i.position), [0, 1]);

  // Bad input is refused, and the amount can never be sent.
  for (const body of [
    { items: [] },
    { items: [{ description: 'x', quantity: 0, unit_price: 1 }] },
    { items: [{ description: 'x', quantity: 1, unit_price: 1.005 }] },
    { items: [{ description: '', quantity: 1, unit_price: 1 }] },
    { items: [{ description: 'x', quantity: 1, unit_price: 1 }], amount: 5 },
    { items: [{ description: 'x', quantity: 1, unit_price: 1 }], status: 'Paid' },
    { items: [{ description: 'x', quantity: 1, unit_price: 1 }], client_id: 'nobody' },
  ]) {
    assert.equal((await create(body)).status, 400, JSON.stringify(body));
  }
});

test('status rules: lines and VAT only change on a Draft; Paid is only reached by mark-paid', async () => {
  const lines = (unit_price: number) => [{ description: 'Worktop', quantity: 2, unit_price }];
  const made = await json<Inv>(await create({ items: lines(10), vat_rate: 20 }), 201);
  const url = `/invoices/${made.id}`;

  const edited = await json<Inv>(await call('PUT', url, tokens.admin, { items: lines(12.5), vat_rate: 5 }));
  assert.equal(edited.amount, 26.25); // 25 + 1.25
  assert.equal(edited.items.length, 1);
  assert.equal(await prisma.invoiceItem.count({ where: { invoice_id: made.id } }), 1, 'lines are replaced, not added to');

  assert.equal((await call('PUT', url, tokens.admin, { status: 'Overdue' })).status, 400, 'Draft cannot jump to Overdue');
  assert.equal((await call('PUT', url, tokens.admin, { status: 'Paid' })).status, 400);
  assert.equal((await call('PUT', url, tokens.admin, { status: 'Sent' }).then((r) => r.status)), 200);
  assert.equal((await call('PUT', url, tokens.admin, { items: lines(1) })).status, 400, 'no editing lines once Sent');
  assert.equal((await call('PUT', url, tokens.admin, { vat_rate: 0 })).status, 400);
  const moved = await json<{ due_date: string }>(await call('PUT', url, tokens.admin, { due_date: '2099-02-28' }));
  assert.ok(moved.due_date.startsWith('2099-02-28'), 'the due date can still move');

  const back = await json<Inv>(await call('PUT', url, tokens.admin, { status: 'Draft', items: lines(20) }));
  assert.equal(back.status, 'Draft');
  assert.equal(back.amount, 42); // 40 + 5% VAT

  assert.equal((await call('PUT', `${url}/mark-paid`, tokens.admin)).status, 400, 'a Draft cannot be paid');
  await json(await call('PUT', url, tokens.admin, { status: 'Sent' }));
  const paid = await json<Inv & { paid_at: string }>(await call('PUT', `${url}/mark-paid`, tokens.admin));
  assert.equal(paid.status, 'Paid');
  assert.ok(paid.paid_at);
  assert.equal((await call('PUT', `${url}/mark-paid`, tokens.admin)).status, 400, 'paid twice is refused');
  assert.equal((await call('PUT', url, tokens.admin, { due_date: '2099-03-01' })).status, 400, 'a Paid invoice is frozen');
  assert.equal((await call('DELETE', url, tokens.admin)).status, 400);

  // The client's lifetime value follows the paid invoices, to the penny.
  const sumPaid = await prisma.invoice.aggregate({ where: { client_id: MINE.id, status: 'Paid' }, _sum: { amount: true } });
  const client = await prisma.client.findUniqueOrThrow({ where: { id: MINE.id } });
  assert.equal(client.total_spent.toString(), sumPaid._sum.amount!.toString());
});

test('a Draft can be deleted and takes its lines with it', async () => {
  const made = await json<Inv>(await create({ items: [{ description: 'Gone', quantity: 1, unit_price: 5 }] }), 201);
  assert.equal((await call('DELETE', `/invoices/${made.id}`, tokens.admin)).status, 200);
  assert.equal((await call('GET', `/invoices/${made.id}`, tokens.admin)).status, 404);
  assert.equal(await prisma.invoiceItem.count({ where: { invoice_id: made.id } }), 0);
});

test('an invoice from before lines existed keeps its stored amount', async () => {
  const legacy = await json<Inv>(await call('GET', `/invoices/${LEGACY}`, tokens.admin));
  assert.deepEqual([legacy.amount, legacy.net_amount, legacy.vat_amount, legacy.items.length], [120, 100, 20, 0]);

  const vatOnly = await json<Inv>(await call('PUT', `/invoices/${LEGACY}`, tokens.admin, { vat_rate: 0 }));
  assert.equal(vatOnly.amount, 120, 'no lines to re-total, so the stored amount stands');
  assert.equal(vatOnly.net_amount, 120);

  await json(await call('PUT', `/invoices/${LEGACY}`, tokens.admin, { status: 'Sent' }));
  assert.equal((await json<Inv>(await call('PUT', `/invoices/${LEGACY}/mark-paid`, tokens.admin))).status, 'Paid');
});

test('an invoice can only be tied to a project of its own client', async () => {
  const items = [{ description: 'x', quantity: 1, unit_price: 1 }];
  assert.equal((await create({ items, project_id: P.other })).status, 400);
  assert.equal((await create({ items, project_id: 'missing' })).status, 400);

  const made = await json<Inv>(await create({ items, project_id: P.mine }), 201);
  assert.equal(made.project_id, P.mine);
  assert.equal((await call('PUT', `/invoices/${made.id}`, tokens.admin, { project_id: P.other })).status, 400);
  assert.equal((await json<Inv>(await call('PUT', `/invoices/${made.id}`, tokens.admin, { project_id: null }))).project_id, null);
});

test('simultaneous creates all get their own number', async () => {
  const items = [{ description: 'Race', quantity: 1, unit_price: 1 }];
  const made = await Promise.all(Array.from({ length: 6 }, () => create({ items })));
  assert.deepEqual(made.map((res) => res.status), Array(6).fill(201));
  const numbers = (await Promise.all(made.map((res) => res.json() as Promise<Inv>))).map((invoice) => invoice.number);
  assert.equal(new Set(numbers).size, 6, numbers.join(', '));
});

test('a Designer and an Editor are refused on every /invoices route', async () => {
  const routes: Array<[string, string, unknown?]> = [
    ['GET', '/invoices'],
    ['GET', '/invoices/summary'],
    ['GET', `/invoices/${LEGACY}`],
    ['POST', '/invoices', { client_id: MINE.id, due_date: due, items: [{ description: 'x', quantity: 1, unit_price: 1 }] }],
    ['PUT', `/invoices/${LEGACY}`, { due_date: due }],
    ['PUT', `/invoices/${LEGACY}/mark-paid`],
    ['DELETE', `/invoices/${LEGACY}`],
  ];
  for (const token of [tokens.designer, tokens.editor]) {
    for (const [method, path, body] of routes) {
      assert.equal((await call(method, path, token, body)).status, 403, `${method} ${path}`);
    }
  }
});

test('a Designer gets no money from the client or project they can otherwise see', async () => {
  const asDesigner = await json<Record<string, unknown>>(await call('GET', `/clients/${MINE.id}`, tokens.designer));
  assert.equal('total_spent' in asDesigner, false);
  assert.equal(typeof ((await json<Record<string, unknown>>(await call('GET', `/clients/${MINE.id}`, tokens.admin))).total_spent), 'number');

  const list = await json<Array<Record<string, unknown>>>(await call('GET', '/clients', tokens.designer));
  assert.ok(list.length > 0 && list.every((row) => !('total_spent' in row)));

  const detail = await json<{ client: Record<string, unknown>; invoices: unknown[]; stats: Record<string, unknown> }>(
    await call('GET', `/clients/${MINE.id}/detail`, tokens.designer),
  );
  assert.deepEqual(detail.invoices, []);
  assert.equal('total_spent' in detail.client, false);
  assert.equal('lifetime_value' in detail.stats || 'outstanding' in detail.stats, false);

  const project = await json<{ invoices: unknown[] }>(await call('GET', `/projects/${P.mine}/detail`, tokens.designer));
  assert.deepEqual(project.invoices, []);

  const admin = await json<{ invoices: unknown[]; stats: { lifetime_value: number } }>(
    await call('GET', `/clients/${MINE.id}/detail`, tokens.admin),
  );
  assert.ok(admin.invoices.length > 0);
  assert.equal(typeof admin.stats.lifetime_value, 'number');
});

test('a client sees their own invoices, never a Draft, and 404 for anyone else\'s', async () => {
  const items = [{ description: 'Mine', quantity: 1, unit_price: 100 }];
  const draft = await json<Inv>(await create({ items }), 201);
  const sent = await json<Inv>(await create({ items, status: 'Sent' }), 201);

  const list = await json<Inv[]>(await call('GET', '/invoices', tokens.mine));
  const ids = list.map((invoice) => invoice.id);
  assert.ok(ids.includes(sent.id));
  assert.ok(!ids.includes(draft.id), 'no Draft');
  assert.ok(!ids.includes(OTHERS_SENT), 'no one else\'s');
  assert.ok(list.every((invoice) => invoice.status !== 'Draft'));

  const one = await json<Inv>(await call('GET', `/invoices/${sent.id}`, tokens.mine));
  assert.equal(one.items.length, 1);
  assert.equal((await call('GET', `/invoices/${draft.id}`, tokens.mine)).status, 404);
  assert.equal((await call('GET', `/invoices/${OTHERS_SENT}`, tokens.mine)).status, 404);
  assert.equal((await call('GET', `/invoices/${sent.id}`, tokens.other)).status, 404);

  const total = (rows: Inv[]) => rows.reduce((t, row) => t + Math.round(row.amount * 100), 0) / 100;
  const summary = await json<{ outstanding_total: number; counts: { draft: number; total: number } }>(
    await call('GET', '/invoices/summary', tokens.mine),
  );
  assert.equal(summary.counts.draft, 0, 'drafts do not count for a client');
  assert.equal(summary.counts.total, list.length);
  assert.equal(summary.outstanding_total, total(list.filter((row) => row.status !== 'Paid')));
  assert.ok((await json<{ counts: { draft: number } }>(await call('GET', '/invoices/summary', tokens.admin))).counts.draft > 0);

  // Read-only: a client cannot write, and the project detail hides Drafts too.
  for (const [method, path, body] of [
    ['POST', '/invoices', { client_id: MINE.id, due_date: due, items }],
    ['PUT', `/invoices/${sent.id}`, { due_date: due }],
    ['PUT', `/invoices/${sent.id}/mark-paid`, undefined],
    ['DELETE', `/invoices/${sent.id}`, undefined],
  ] as Array<[string, string, unknown]>) {
    assert.equal((await call(method, path, tokens.mine, body)).status, 403, `${method} ${path}`);
  }
});
