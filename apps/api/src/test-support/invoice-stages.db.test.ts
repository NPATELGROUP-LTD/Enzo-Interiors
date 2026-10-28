import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import { Prisma, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { ADMIN, startTestApp } from './app';

/**
 * Invoice payment stages and the bank-details block, against the real AppModule:
 * exact amounts, paid transitions (the invoice is Paid only when every stage is),
 * overdue, per-role access, and bank details never reaching the public bundle.
 */

let app: Awaited<ReturnType<typeof startTestApp>>;
let prisma: PrismaClient;
const run = randomUUID().slice(0, 8);
const PASSWORD = 'stages-password-123';
const person = (id: string, role: string) => ({ id: `stf_${id}_${run}`, email: `s-${id}-${run}@test.enzo.local`, role });
const EDITOR = person('ed', 'Editor');
const DESIGNER = person('des', 'Designer');
const INFRA = person('inf', 'Infra');
const MINE = { id: `cli_smine_${run}`, email: `s-mine-${run}@test.enzo.local` };
const OTHER = { id: `cli_sother_${run}`, email: `s-other-${run}@test.enzo.local` };

const tokens = { admin: '', editor: '', designer: '', infra: '', mine: '', other: '' };

before(async () => {
  app = await startTestApp();
  prisma = new PrismaClient();

  const password_hash = await bcrypt.hash(PASSWORD, 4);
  for (const staff of [EDITOR, DESIGNER, INFRA]) {
    await prisma.staffUser.create({ data: { ...staff, name: `Test ${staff.role} ${run}`, password_hash } });
  }
  const client = { joined_date: new Date(), status: 'Active', password_hash };
  await prisma.client.create({ data: { ...client, ...MINE, name: 'Mine' } });
  await prisma.client.create({ data: { ...client, ...OTHER, name: 'Other' } });

  tokens.admin = await signIn('/auth/admin/login', ADMIN.email, ADMIN.password);
  tokens.editor = await signIn('/auth/admin/login', EDITOR.email, PASSWORD);
  tokens.designer = await signIn('/auth/admin/login', DESIGNER.email, PASSWORD);
  tokens.infra = await signIn('/auth/admin/login', INFRA.email, PASSWORD);
  tokens.mine = await signIn('/auth/portal/login', MINE.email, PASSWORD);
  tokens.other = await signIn('/auth/portal/login', OTHER.email, PASSWORD);
});

after(async () => {
  await prisma.invoice.deleteMany({ where: { client_id: { in: [MINE.id, OTHER.id] } } }); // lines and stages cascade
  await prisma.client.deleteMany({ where: { id: { in: [MINE.id, OTHER.id] } } });
  await prisma.staffUser.deleteMany({ where: { id: { in: [EDITOR.id, DESIGNER.id, INFRA.id] } } });
  await prisma.siteSettings.updateMany({ data: { bank_details: Prisma.DbNull } });
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
  assert.equal(res.status, status, `${res.url} answered ${res.status}: ${status === res.status ? '' : await res.clone().text()}`);
  return (await res.json()) as T;
}

interface Stage {
  id: string;
  position: number;
  label: string;
  mode: string;
  value: number;
  amount: number;
  due_note: string | null;
  paid_at: string | null;
  paid_by?: string | null;
}
interface Inv {
  id: string;
  status: string;
  amount: number;
  paid_at: string | null;
  is_overdue: boolean;
  days_overdue: number;
  paid_amount: number;
  balance_amount: number;
  stages: Stage[];
  bank_details: Record<string, unknown> | null;
}

const DEFAULT = [
  { label: 'On start', mode: 'percent', value: 50 },
  { label: 'On installation', mode: 'percent', value: 40 },
  { label: 'On completion', mode: 'percent', value: 10 },
];
const sum = (values: number[]) => Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;
const create = (body: Record<string, unknown> = {}, token = tokens.admin) =>
  call('POST', '/invoices', token, {
    client_id: MINE.id,
    due_date: '2099-01-31',
    vat_rate: 20,
    items: [{ description: 'Fitting', quantity: 3, unit_price: 33.33 }], // 99.99 + 20.00 VAT = 119.99
    stages: DEFAULT,
    ...body,
  });
const spent = async () => Number((await prisma.client.findUniqueOrThrow({ where: { id: MINE.id } })).total_spent);
/** YYYY-MM-DD, n days back: payment dates must not be in the future. */
const ago = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
const payUrl = (inv: Inv, n: number) => `/invoices/${inv.id}/stages/${inv.stages[n]!.id}/paid`;

test('stages are worked out in the API: rounded to the penny, the last takes the remainder, invalid mixes refused', async () => {
  const made = await json<Inv>(await create(), 201);
  assert.equal(made.amount, 119.99);
  assert.deepEqual(made.stages.map((s) => [s.label, s.mode, s.value, s.amount]), [
    ['On start', 'percent', 50, 60], // 59.995 rounds half up
    ['On installation', 'percent', 40, 48], // 47.996
    ['On completion', 'percent', 10, 11.99], // the remainder, not 12.00
  ]);
  assert.equal(sum(made.stages.map((s) => s.amount)), made.amount, 'always sums exactly to the gross payable');
  assert.deepEqual([made.paid_amount, made.balance_amount], [0, 119.99]);
  const row = await prisma.invoiceStage.findFirstOrThrow({ where: { invoice_id: made.id, position: 2 } });
  assert.equal(row.amount.toString(), '11.99');

  // Fixed and percent can be mixed when they add up to the whole.
  const mixed = await json<Inv>(
    await create({ items: [{ description: 'x', quantity: 1, unit_price: 1000 }], vat_rate: 0, stages: [
      { label: 'Deposit', mode: 'fixed', value: 300.5 },
      { label: 'Balance', mode: 'percent', value: 69.95 },
    ] }),
    201,
  );
  assert.deepEqual(mixed.stages.map((s) => s.amount), [300.5, 699.5]);

  // No stages (omitted or empty) is today's behaviour.
  assert.deepEqual((await json<Inv>(await create({ stages: undefined }), 201)).stages, []);
  assert.deepEqual((await json<Inv>(await create({ stages: [] }), 201)).stages, []);

  const bad: unknown[] = [
    [DEFAULT[0], DEFAULT[1]], // 90%
    [{ label: 'x', mode: 'percent', value: 101 }],
    [{ label: 'x', mode: 'fixed', value: 5000 }],
    [{ label: 'x', mode: 'fixed', value: 119.99 }, { label: 'y', mode: 'percent', value: 50 }],
    [{ label: '', mode: 'percent', value: 100 }],
    [{ label: 'x', mode: 'percent', value: 0 }],
    [{ label: 'x', mode: 'percent', value: 33.333 }],
    [{ label: 'x', mode: 'nope', value: 100 }],
    Array.from({ length: 7 }, (_, n) => ({ label: `s${n}`, mode: 'fixed', value: 1 })),
  ];
  for (const stages of bad) assert.equal((await create({ stages })).status, 400, JSON.stringify(stages));
  assert.equal((await create({ items: [{ description: 'free', quantity: 1, unit_price: 0 }] })).status, 400, 'nothing to split on a £0 invoice');
});

test('stages follow a changed total on a Draft, and can be replaced until one is paid', async () => {
  const made = await json<Inv>(await create(), 201);
  const url = `/invoices/${made.id}`;

  const repriced = await json<Inv>(await call('PUT', url, tokens.admin, { items: [{ description: 'Fitting', quantity: 1, unit_price: 1000 }] }));
  assert.equal(repriced.amount, 1200);
  assert.deepEqual(repriced.stages.map((s) => s.amount), [600, 480, 120], 'percentages re-worked against the new total');

  // A fixed stage that no longer matches the new total is refused in the same save.
  const fixed = await json<Inv>(await call('PUT', url, tokens.admin, { stages: [{ label: 'All', mode: 'fixed', value: 1200 }] }));
  assert.deepEqual(fixed.stages.map((s) => s.amount), [1200]);
  assert.equal((await call('PUT', url, tokens.admin, { items: [{ description: 'Fitting', quantity: 1, unit_price: 500 }] })).status, 400);
  assert.equal((await json<Inv>(await call('GET', url, tokens.admin))).amount, 1200, 'the refused save changed nothing');

  const replaced = await json<Inv>(await call('PUT', url, tokens.admin, { stages: DEFAULT }));
  assert.equal(replaced.stages.length, 3);
  assert.equal(await prisma.invoiceStage.count({ where: { invoice_id: made.id } }), 3, 'replaced, not added to');
  assert.equal((await json<Inv>(await call('PUT', url, tokens.admin, { stages: [] }))).stages.length, 0);

  // Once Sent (none paid) the stages still edit; the lines do not.
  await json(await call('PUT', url, tokens.admin, { status: 'Sent', stages: DEFAULT }));
  const resplit = await json<Inv>(await call('PUT', url, tokens.admin, { stages: [
    { label: 'Deposit', mode: 'percent', value: 25, due_note: 'Before we start' },
    { label: 'Rest', mode: 'percent', value: 75 },
  ] }));
  assert.deepEqual(resplit.stages.map((s) => [s.amount, s.due_note]), [[300, 'Before we start'], [900, null]]);

  // After a payment they are locked, and the invoice cannot go back to Draft.
  await json(await call('PUT', payUrl(resplit, 0), tokens.admin, {}));
  assert.equal((await call('PUT', url, tokens.admin, { stages: DEFAULT })).status, 400);
  assert.equal((await call('PUT', url, tokens.admin, { stages: [] })).status, 400);
  assert.equal((await call('PUT', url, tokens.admin, { status: 'Draft' })).status, 400);
  // Undoing the payment opens them again.
  await json(await call('DELETE', payUrl(resplit, 0), tokens.admin));
  assert.equal((await call('PUT', url, tokens.admin, { stages: DEFAULT })).status, 200);
});

test('the invoice is Paid only when every stage is, once, through the mark-paid transaction', async () => {
  const before = await spent();
  const draft = await json<Inv>(await create(), 201);
  assert.equal((await call('PUT', payUrl(draft, 0), tokens.admin, {})).status, 400, 'a Draft takes no payment');
  assert.equal((await call('PUT', `/invoices/${draft.id}/mark-paid`, tokens.admin)).status, 400);

  const sent = await json<Inv>(await call('PUT', `/invoices/${draft.id}`, tokens.admin, { status: 'Sent' }));
  assert.equal((await call('PUT', `/invoices/${draft.id}/mark-paid`, tokens.admin)).status, 400, 'whole-invoice mark-paid is refused while stages are unpaid');

  const one = await json<Inv>(await call('PUT', payUrl(sent, 0), tokens.admin, { paid_at: ago(9) }));
  assert.equal(one.status, 'Sent');
  assert.ok(one.stages[0]!.paid_at!.startsWith(ago(9)));
  assert.ok(one.stages[0]!.paid_by, 'who recorded it');
  assert.deepEqual([one.paid_amount, one.balance_amount], [60, 59.99]);
  assert.equal(await spent(), before, 'lifetime value waits for the whole invoice');
  assert.equal((await call('PUT', payUrl(sent, 0), tokens.admin, {})).status, 400, 'the same stage twice is refused');

  assert.equal((await call('PUT', payUrl(sent, 1), tokens.admin, { paid_at: '2999-01-01' })).status, 400, 'no future dates');
  assert.equal((await call('PUT', payUrl(sent, 1), tokens.admin, { paid_at: 'yesterday' })).status, 400);
  assert.equal((await call('PUT', payUrl(sent, 1), tokens.admin, { paid_at: '2026-02-31' })).status, 400, 'a day that does not exist');

  // Undo one, pay it again, then finish.
  const undone = await json<Inv>(await call('DELETE', payUrl(sent, 0), tokens.admin));
  assert.deepEqual([undone.stages[0]!.paid_at, undone.stages[0]!.paid_by, undone.paid_amount], [null, null, 0]);
  assert.equal((await call('DELETE', payUrl(sent, 0), tokens.admin)).status, 400, 'nothing to undo');
  await json(await call('PUT', payUrl(sent, 0), tokens.admin, {}));
  const two = await json<Inv>(await call('PUT', payUrl(sent, 1), tokens.admin, { paid_at: ago(5) }));
  assert.equal(two.status, 'Sent');
  assert.deepEqual([two.paid_amount, two.balance_amount], [108, 11.99]);
  assert.equal(await spent(), before);

  const done = await json<Inv>(await call('PUT', payUrl(sent, 2), tokens.admin, { paid_at: ago(1) }));
  assert.equal(done.status, 'Paid');
  assert.ok(done.paid_at!.startsWith(ago(1)), 'paid on the date of the last stage');
  assert.deepEqual([done.paid_amount, done.balance_amount], [119.99, 0]);
  assert.equal(await spent(), sum([before, 119.99]), 'total_spent updated once, by the gross');

  assert.equal((await call('PUT', `/invoices/${draft.id}/mark-paid`, tokens.admin)).status, 400, 'repeat refused');
  assert.equal((await call('DELETE', payUrl(sent, 2), tokens.admin)).status, 400, 'a fully paid invoice is final');
  assert.equal((await call('PUT', `/invoices/${draft.id}`, tokens.admin, { stages: [] })).status, 400);
  assert.equal(await spent(), sum([before, 119.99]));

  // Money has been recorded, so deleting needs the Admin's password (as for any Paid invoice).
  assert.equal((await call('DELETE', `/invoices/${draft.id}`, tokens.admin)).status, 403);
  assert.equal((await call('DELETE', `/invoices/${draft.id}`, tokens.admin, { password: ADMIN.password })).status, 200);
  assert.equal(await spent(), before, 'and the money leaves the lifetime value with it');
});

test('a part-paid invoice also needs the password to delete; an unpaid staged one does not', async () => {
  const sent = await json<Inv>(await create({ status: 'Sent' }), 201);
  await json(await call('PUT', payUrl(sent, 0), tokens.admin, {}));
  assert.equal((await call('DELETE', `/invoices/${sent.id}`, tokens.admin)).status, 403);
  assert.equal((await call('DELETE', `/invoices/${sent.id}`, tokens.admin, { password: ADMIN.password })).status, 200);

  const unpaid = await json<Inv>(await create(), 201);
  assert.equal((await call('DELETE', `/invoices/${unpaid.id}`, tokens.admin)).status, 200);
  assert.equal(await prisma.invoiceStage.count({ where: { invoice_id: { in: [sent.id, unpaid.id] } } }), 0, 'stages cascade');
});

test('the last two stages paid at the same moment still settle the invoice exactly once', async () => {
  const before = await spent();
  const sent = await json<Inv>(await create({ status: 'Sent' }), 201);
  await json(await call('PUT', payUrl(sent, 0), tokens.admin, {}));
  const both = await Promise.all([call('PUT', payUrl(sent, 1), tokens.admin, {}), call('PUT', payUrl(sent, 2), tokens.admin, {})]);
  assert.deepEqual(both.map((res) => res.status), [200, 200]);
  const after = await json<Inv>(await call('GET', `/invoices/${sent.id}`, tokens.admin));
  assert.equal(after.status, 'Paid', 'the row lock means one of them saw the other');
  assert.equal(await spent(), sum([before, 119.99]));
});

test('overdue keeps working while stages are part paid', async () => {
  const late = await json<Inv>(await create({ status: 'Sent', due_date: '2020-01-31' }), 201);
  assert.equal(late.is_overdue, true);
  const part = await json<Inv>(await call('PUT', payUrl(late, 0), tokens.admin, {}));
  assert.equal(part.status, 'Sent');
  assert.equal(part.is_overdue, true, 'still late until fully paid');
  assert.ok(part.days_overdue > 0);

  const owedOnDashboards = async () => ({
    admin: (await json<{ invoices: { outstanding_total: number } }>(await call('GET', '/dashboard/admin', tokens.admin))).invoices.outstanding_total,
    client: (await json<{ invoices: { outstanding_total: number } }>(await call('GET', '/dashboard/portal', tokens.mine))).invoices.outstanding_total,
  });
  const summary = await json<{ overdue_total: number; outstanding_total: number }>(await call('GET', '/invoices/summary', tokens.mine));
  const mine = await json<Inv[]>(await call('GET', '/invoices', tokens.mine));
  const owed = sum(mine.filter((i) => i.status !== 'Paid' && i.status !== 'Draft').map((i) => i.balance_amount));
  assert.equal(summary.outstanding_total, owed, 'the tiles count what is still owed');
  assert.ok(owed < sum(mine.filter((i) => i.status !== 'Paid' && i.status !== 'Draft').map((i) => i.amount)), 'a part-paid invoice counts for its balance');
  assert.ok(summary.overdue_total > 0);

  // The dashboards show what is still owed too: paying a stage lowers them by exactly its amount.
  const owed1 = await owedOnDashboards();
  await json(await call('PUT', payUrl(late, 1), tokens.admin, {}));
  const owed2 = await owedOnDashboards();
  assert.equal(sum([owed1.admin, -owed2.admin]), 48);
  assert.equal(sum([owed1.client, -owed2.client]), 48);

  await json(await call('PUT', payUrl(late, 2), tokens.admin, {}));
  const done = await json<Inv>(await call('GET', `/invoices/${late.id}`, tokens.admin));
  assert.deepEqual([done.status, done.is_overdue], ['Paid', false]);
});

test('an invoice from before lines existed can be split into stages on its stored total', async () => {
  const id = `inv_sleg_${run}`;
  await prisma.invoice.create({ data: { id, number: `SL-${run}`, client_id: MINE.id, amount: 120, vat_rate: 20, status: 'Sent', due_date: new Date('2099-01-31') } });
  const split = await json<Inv>(await call('PUT', `/invoices/${id}`, tokens.admin, { stages: DEFAULT }));
  assert.deepEqual(split.stages.map((s) => s.amount), [60, 48, 12]);
  for (const n of [0, 1]) await json(await call('PUT', payUrl(split, n), tokens.admin, {}));
  assert.equal((await json<Inv>(await call('PUT', payUrl(split, 2), tokens.admin, {}))).status, 'Paid');
});

test('role access: Admin only for staff; a client sees their own non-Draft stages, never who recorded them', async () => {
  const draft = await json<Inv>(await create(), 201);
  const sent = await json<Inv>(await create({ status: 'Sent' }), 201);
  await json(await call('PUT', payUrl(sent, 0), tokens.admin, {}));

  const routes: Array<[string, string, unknown?]> = [
    ['PUT', payUrl(sent, 1), {}],
    ['DELETE', payUrl(sent, 0)],
    ['PUT', `/invoices/${sent.id}`, { stages: DEFAULT }],
    ['POST', '/invoices', { client_id: MINE.id, due_date: '2099-01-01', items: [{ description: 'x', quantity: 1, unit_price: 1 }], stages: DEFAULT }],
    ['GET', `/invoices/${sent.id}`],
    ['GET', `/invoices/export?ids=${sent.id}`],
    ['GET', '/settings/bank-details'],
    ['PUT', '/settings/bank-details', { account_name: 'x', bank_name: 'x', sort_code: '123456', account_number: '12345678' }],
  ];
  for (const token of [tokens.designer, tokens.editor, tokens.infra]) {
    for (const [method, path, body] of routes) {
      assert.equal((await call(method, path, token, body)).status, 403, `${method} ${path}`);
    }
  }
  // A client may read their invoice but never write a stage or the bank details.
  for (const [method, path, body] of routes.filter(([m, p]) => m !== 'GET' || p.includes('bank') || p.includes('export'))) {
    assert.equal((await call(method, path, tokens.mine, body)).status, 403, `client ${method} ${path}`);
  }
  assert.equal(await prisma.invoiceStage.count({ where: { id: sent.stages[1]!.id, paid_at: { not: null } } }), 0, 'refused calls recorded nothing');

  const asClient = await json<Inv>(await call('GET', `/invoices/${sent.id}`, tokens.mine));
  assert.equal(asClient.stages.length, 3);
  assert.equal(asClient.stages[0]!.paid_at !== null, true);
  assert.ok(asClient.stages.every((stage) => !('paid_by' in stage)), 'staff names stay with staff');
  const asAdmin = await json<Inv>(await call('GET', `/invoices/${sent.id}`, tokens.admin));
  assert.ok(asAdmin.stages[0]!.paid_by);

  assert.equal((await call('GET', `/invoices/${draft.id}`, tokens.mine)).status, 404, 'a Draft, and so its stages, is not visible');
  assert.ok(!(await json<Inv[]>(await call('GET', '/invoices', tokens.mine))).some((invoice) => invoice.id === draft.id));
  assert.equal((await call('GET', `/invoices/${sent.id}`, tokens.other)).status, 404);
  assert.deepEqual((await json<Inv[]>(await call('GET', `/invoices/export?ids=${sent.id}`, tokens.admin)))[0]!.stages.map((s) => s.label), DEFAULT.map((s) => s.label), 'export carries the stages');
});

test('bank details: Admin only, validated, on authenticated invoices, never public', async () => {
  const put = (body: unknown, token = tokens.admin) => call('PUT', '/settings/bank-details', token, body);
  const ok = { account_name: 'Enzo Interiors LTD', bank_name: 'Test Bank plc', sort_code: '12 34 56', account_number: '12345678', reference_note: ' Quote the invoice number ' };
  for (const bad of [
    { ...ok, sort_code: '12345' },
    { ...ok, sort_code: '12-34-5x' },
    { ...ok, account_number: '1234567' },
    { ...ok, account_number: '1234567a' },
    { ...ok, account_name: '' },
    { ...ok, bank_name: ' ' },
    { ...ok, extra: 1 },
  ]) {
    assert.equal((await put(bad)).status, 400, JSON.stringify(bad));
  }

  const saved = await json<{ bank_details: Record<string, string | null> }>(await put(ok));
  assert.deepEqual(saved.bank_details, { account_name: 'Enzo Interiors LTD', bank_name: 'Test Bank plc', sort_code: '12-34-56', account_number: '12345678', reference_note: 'Quote the invoice number' });
  assert.equal((await json<{ bank_details: Record<string, string> }>(await put({ ...ok, sort_code: '654321', reference_note: '' }))).bank_details.sort_code, '65-43-21');
  assert.equal((await json<{ bank_details: { reference_note: null } }>(await call('GET', '/settings/bank-details', tokens.admin))).bank_details.reference_note, null);

  // On every authenticated invoice payload (staff and the invoice's own client)...
  const sent = await json<Inv>(await create({ status: 'Sent' }), 201);
  assert.equal(sent.bank_details?.account_number, '12345678');
  assert.equal((await json<Inv>(await call('GET', `/invoices/${sent.id}`, tokens.mine))).bank_details?.sort_code, '65-43-21');
  assert.equal((await json<Inv[]>(await call('GET', '/invoices', tokens.mine)))[0]!.bank_details?.bank_name, 'Test Bank plc');

  // ...and nowhere else: not the public bundle, not the Settings payload an Infra manager reads.
  const bundle = await (await call('GET', '/content/site')).text();
  assert.ok(!bundle.includes('12345678') && !bundle.includes('65-43-21') && !bundle.includes('Test Bank') && !bundle.includes('bank_details'));
  for (const token of [tokens.admin, tokens.infra]) {
    const settings = await (await call('GET', '/settings', token)).text();
    assert.ok(!settings.includes('bank_details') && !settings.includes('12345678'), 'GET /settings never carries it');
  }
  assert.equal((await call('GET', '/settings/bank-details')).status, 401, 'signed-out callers get nothing');
  assert.equal((await call('GET', '/invoices/' + sent.id)).status, 401);
});
