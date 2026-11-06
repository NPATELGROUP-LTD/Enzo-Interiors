import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { ADMIN, startTestApp } from './app';

/** Inventory: Admin only, counts follow the ledger, never below 0 (even racing), weighted cost, one low-stock bell. */

let app: Awaited<ReturnType<typeof startTestApp>>;
let prisma: PrismaClient;
const run = randomUUID().slice(0, 8);
const PASSWORD = 'inventory-password-123';
const DESIGNER = { id: `stf_inv_${run}`, email: `inv-designer-${run}@test.enzo.local` };
const SKU = `INV-${run}`;
const INSTALLER = { id: `stf_inv_i_${run}`, email: `inv-installer-${run}@test.enzo.local` };
const OUTSIDER = { id: `stf_inv_o_${run}`, email: `inv-outsider-${run}@test.enzo.local` };
const CLIENT = `cli_inv_${run}`;
const PROJECT = `prj_inv_${run}`;
const tokens = { admin: '', designer: '', installer: '', outsider: '' };
let itemId = '';

before(async () => {
  app = await startTestApp();
  prisma = new PrismaClient();
  const password_hash = await bcrypt.hash(PASSWORD, 4);
  await prisma.staffUser.create({ data: { ...DESIGNER, name: 'Inv Designer', role: 'Designer', password_hash } });
  await prisma.staffUser.create({ data: { ...INSTALLER, name: 'Inv Installer', role: 'Installer', password_hash } });
  await prisma.staffUser.create({ data: { ...OUTSIDER, name: 'Inv Outsider', role: 'Installer', password_hash } });
  await prisma.client.create({ data: { id: CLIENT, name: 'Inv Client', email: `inv-client-${run}@test.enzo.local`, joined_date: new Date(), status: 'Active', password_hash: '' } });
  tokens.admin = await signIn(ADMIN.email, ADMIN.password);
  tokens.designer = await signIn(DESIGNER.email, PASSWORD);
  tokens.installer = await signIn(INSTALLER.email, PASSWORD);
  tokens.outsider = await signIn(OUTSIDER.email, PASSWORD);
});

after(async () => {
  await prisma.purchaseOrder.deleteMany({ where: { supplier: { name: `Supplier ${run}` } } });
  await prisma.inventorySetting.deleteMany({ where: { id: 'inventory' } });
  await prisma.projectMaterial.deleteMany({ where: { project_id: PROJECT } });
  await prisma.stockMovement.deleteMany({ where: { item: { sku: { startsWith: SKU } } } });
  await prisma.project.deleteMany({ where: { id: PROJECT } });
  await prisma.client.deleteMany({ where: { id: CLIENT } });
  await prisma.staffUser.deleteMany({ where: { id: { in: [INSTALLER.id, OUTSIDER.id] } } });
  await prisma.inventoryItem.deleteMany({ where: { sku: { startsWith: SKU } } });
  await prisma.inventorySupplier.deleteMany({ where: { name: `Supplier ${run}` } });
  await prisma.notification.deleteMany({ where: { kind: 'stock', title: { contains: run } } });
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

async function signIn(email: string, password: string): Promise<string> {
  const res = await call('POST', '/auth/admin/login', undefined, { email, password });
  assert.equal(res.status, 200, email);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function json<T>(res: Response, status = 200): Promise<T> {
  assert.equal(res.status, status, `${res.url} answered ${res.status}`);
  return (await res.json()) as T;
}

type Item = { id: string; on_hand: number; avg_cost: number; low: boolean };
const book = (body: unknown) => call('POST', `/inventory/items/${itemId}/movements`, tokens.admin, body);

test('only an Admin reaches inventory', async () => {
  assert.equal((await call('GET', '/inventory/items')).status, 401);
  assert.equal((await call('GET', '/inventory/items', tokens.designer)).status, 403);
  assert.equal((await call('POST', '/inventory/suppliers', tokens.designer, { name: 'x' })).status, 403);
});

test('an item is created with a supplier; counts are not writable directly', async () => {
  const supplier = await json<{ id: string }>(await call('POST', '/inventory/suppliers', tokens.admin, { name: `Supplier ${run}` }), 201);
  const body = { sku: SKU, name: `Oak board ${run}`, type: 'Sheet', unit: 'sheet', supplier_id: supplier.id, reorder_level: 2 };
  assert.equal((await call('POST', '/inventory/items', tokens.admin, { ...body, on_hand: 99 })).status, 400);
  const item = await json<Item>(await call('POST', '/inventory/items', tokens.admin, body), 201);
  itemId = item.id;
  assert.equal(item.on_hand, 0);
  assert.equal((await call('POST', '/inventory/items', tokens.admin, body)).status, 409, 'SKU is unique');
});

test('receipts re-average the cost; issue and adjust need a reason and never go below 0', async () => {
  assert.equal((await book({ kind: 'receive', quantity: 4 })).status, 400, 'a receipt needs a cost');
  await json(await book({ kind: 'receive', quantity: 4, unit_cost: 10 }), 201);
  const item = await json<Item>(await book({ kind: 'receive', quantity: 6, unit_cost: 15.5 }), 201);
  assert.equal(item.on_hand, 10);
  assert.equal(item.avg_cost, 13.3); // (4*10 + 6*15.5) / 10

  assert.equal((await book({ kind: 'issue', quantity: 1 })).status, 400, 'issue needs a reason');
  assert.equal((await book({ kind: 'issue', quantity: 11, reason: 'workshop' })).status, 409);
  const after = await json<Item>(await book({ kind: 'adjust', quantity: -2, reason: 'damaged' }), 201);
  assert.equal(after.on_hand, 8);
  assert.equal(after.avg_cost, 13.3, 'stock going out does not change the average');
});

test('two people issuing the last units at once: one wins, the count stays at 0', async () => {
  await json(await book({ kind: 'issue', quantity: 7, reason: 'workshop' }), 201);
  const answers = await Promise.all([1, 2, 3].map(() => book({ kind: 'issue', quantity: 1, reason: 'workshop' })));
  assert.deepEqual(answers.map((r) => r.status).sort(), [201, 409, 409]);
  const row = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: itemId } });
  assert.equal(row.on_hand, 0);
  const sum = await prisma.stockMovement.aggregate({ where: { item_id: itemId }, _sum: { quantity: true } });
  assert.equal(sum._sum.quantity, 0, 'the ledger adds up to the count');
});

test('low stock rings the Admin once, and again only after a restock', async () => {
  const bells = () => prisma.notification.count({ where: { kind: 'stock', title: { contains: run } } });
  const first = await bells();
  assert.ok(first >= 1, 'falling to the reorder level told the Admins');
  await json(await book({ kind: 'adjust', quantity: 1, reason: 'found one' }), 201);
  assert.equal(await bells(), first, 'still low: no second bell');
  await json(await book({ kind: 'receive', quantity: 5, unit_cost: 12 }), 201);
  await json(await book({ kind: 'issue', quantity: 5, reason: 'workshop' }), 201);
  assert.ok((await bells()) > first, 'low again after a restock: told again');
});

test('an item with history is switched off, not deleted; a switched-off item takes no bookings', async () => {
  assert.equal((await call('DELETE', `/inventory/items/${itemId}`, tokens.admin)).status, 409);
  const off = { sku: SKU, name: `Oak board ${run}`, type: 'Sheet', active: false };
  await json(await call('PUT', `/inventory/items/${itemId}`, tokens.admin, off));
  assert.equal((await book({ kind: 'receive', quantity: 1, unit_cost: 1 })).status, 404);
  const fresh = await json<Item>(await call('POST', '/inventory/items', tokens.admin, { sku: `${SKU}-2`, name: 'Spare', type: 'Hardware' }), 201);
  assert.equal((await call('DELETE', `/inventory/items/${fresh.id}`, tokens.admin)).status, 204);
});

/* ---- Project stock ---- */

type Line = { item_id: string; needed: number; reserved: number; issued: number; available: number; cost?: number };
const lines = (token: string) => call('GET', `/inventory/projects/${PROJECT}/materials`, token);
const on = (path: string, token: string, body?: unknown) => call('POST', `/inventory/projects/${PROJECT}/materials/${itemId}/${path}`, token, body);
let stages: string[] = [];
const first = async (res: Response) => (await json<Line[]>(res))[0]!;

test('project stock: a project lists what it needs; only its team sees it, and only the Admin sees cost', async () => {
  stages = (await json<{ stages: string[] }>(await call('GET', '/inventory/settings', tokens.admin))).stages;
  await prisma.project.create({
    data: { id: PROJECT, client_id: CLIENT, name: `Kitchen ${run}`, type: 'Kitchen', status: stages[0]!, assigned_designer_id: DESIGNER.id, assigned_installer_id: INSTALLER.id },
  });
  const item = await json<Item>(await call('POST', '/inventory/items', tokens.admin, { sku: `${SKU}-P`, name: `Hinge ${run}`, type: 'Hardware' }), 201);
  itemId = item.id;
  await json(await book({ kind: 'receive', quantity: 6, unit_cost: 10 }), 201);

  assert.equal((await call('PUT', `/inventory/projects/${PROJECT}/materials/${itemId}`, tokens.designer, { needed: 5 })).status, 403);
  const line = await first(await call('PUT', `/inventory/projects/${PROJECT}/materials/${itemId}`, tokens.admin, { needed: 5 }));
  assert.deepEqual([line.needed, line.reserved, line.available, line.cost], [5, 0, 6, 0]);

  const seen = await first(await lines(tokens.designer));
  assert.equal(seen.cost, undefined, 'no money for a Designer');
  assert.equal((await lines(tokens.outsider)).status, 404, 'not on the project');
});

test('project stock: a hold is never more than is free or still needed, and workshop use cannot take it', async () => {
  assert.equal((await on('reserve', tokens.installer, { quantity: 1 })).status, 403, 'holding stock is the Admin’s');
  const held = await first(await on('reserve', tokens.admin, { quantity: 4 }));
  assert.deepEqual([held.reserved, held.available], [4, 2]);
  assert.equal((await on('reserve', tokens.admin, { quantity: 2 })).status, 409, 'only 1 more is needed');
  assert.equal((await book({ kind: 'issue', quantity: 3, reason: 'workshop' })).status, 409, '2 are free, 4 are held');
  const listed = (await json<(Item & { reserved: number; available: number })[]>(await call('GET', '/inventory/items', tokens.admin))).find((i) => i.id === itemId)!;
  assert.deepEqual([listed.on_hand, listed.reserved, listed.available], [6, 4, 2]);
});

test('project stock: the installer uses the hold first, returns at most what was used; cost follows', async () => {
  assert.equal((await on('issue', tokens.outsider, { quantity: 1 })).status, 404);
  const used = await first(await on('issue', tokens.installer, { quantity: 5 }));
  assert.deepEqual([used.reserved, used.issued, used.available], [0, 5, 1], '4 from the hold, 1 free');
  assert.equal((await on('return', tokens.installer, { quantity: 6 })).status, 409);
  await json(await on('return', tokens.installer, { quantity: 2 }));
  const line = await first(await lines(tokens.admin));
  assert.deepEqual([line.issued, line.available, line.cost], [3, 3, 30]);
  assert.equal((await call('DELETE', `/inventory/projects/${PROJECT}/materials/${itemId}`, tokens.admin)).status, 409, 'used stock keeps the line');
  const ledger = await prisma.stockMovement.aggregate({ where: { item_id: itemId }, _sum: { quantity: true } });
  assert.equal(ledger._sum.quantity, 3, 'the ledger adds up to the count');
});

test('project stock: the chosen stage holds what is still needed; the last stage lets it go', async () => {
  assert.equal((await call('PUT', '/inventory/settings', tokens.admin, { reserve_on_stage: 'Nowhere' })).status, 400);
  await json(await call('PUT', '/inventory/settings', tokens.admin, { reserve_on_stage: stages[1] }));
  await json(await call('PUT', `/inventory/projects/${PROJECT}/materials/${itemId}`, tokens.admin, { needed: 10 }));
  await json(await call('PATCH', `/projects/${PROJECT}/stage`, tokens.admin, { status: stages[1] }));
  const held = await first(await lines(tokens.admin));
  assert.deepEqual([held.reserved, held.available], [3, 0], 'wanted 7, 3 were free: the rest is a shortfall');
  await json(await call('PATCH', `/projects/${PROJECT}/stage`, tokens.admin, { status: stages.at(-1)! }));
  const done = await first(await lines(tokens.admin));
  assert.equal(done.reserved, 0);
});

type Order = { id: string; ref: string; status: string; items: { id: string; received: number }[]; totals: { net: number; vat: number; gross: number } };

test('purchase orders: Admin only; a Draft edits, Sent books in at the line cost, never past what was ordered', async () => {
  const supplier = await prisma.inventorySupplier.findFirstOrThrow({ where: { name: `Supplier ${run}` } });
  const item = await json<Item>(await call('POST', '/inventory/items', tokens.admin, { sku: `${SKU}-PO`, name: `Hinge ${run}`, type: 'Hardware', supplier_id: supplier.id }), 201);
  const body = { supplier_id: supplier.id, items: [{ item_id: item.id, quantity: 10, unit_cost: 2.5 }] };
  assert.equal((await call('POST', '/inventory/orders', tokens.designer, body)).status, 403);
  assert.equal((await call('GET', '/inventory/shortfall', tokens.installer)).status, 403);

  const draft = await json<Order>(await call('POST', '/inventory/orders', tokens.admin, body), 201);
  assert.match(draft.ref, /^PO-\d{4,}$/);
  assert.deepEqual(draft.totals, { subtotal: 25, discount: 0, net: 25, vat: 5, gross: 30 });
  const lineId = draft.items[0]!.id;
  assert.equal((await call('POST', `/inventory/orders/${draft.id}/receive`, tokens.admin, { lines: [{ line_id: lineId, quantity: 1 }] })).status, 409, 'a Draft is not booked in');

  await json(await call('POST', `/inventory/orders/${draft.id}/send`, tokens.admin), 200);
  assert.equal((await call('PUT', `/inventory/orders/${draft.id}`, tokens.admin, body)).status, 409, 'Sent is not edited');
  const items = await json<(Item & { on_order: number })[]>(await call('GET', '/inventory/items', tokens.admin));
  assert.equal(items.find((i) => i.id === item.id)!.on_order, 10);

  const receive = (quantity: number) => call('POST', `/inventory/orders/${draft.id}/receive`, tokens.admin, { lines: [{ line_id: lineId, quantity }] });
  assert.equal((await json<Order>(await receive(4))).status, 'Part-received');
  assert.equal((await receive(7)).status, 409, 'more than is still to come');
  const racing = await Promise.all([receive(6), receive(6)]);
  assert.deepEqual(racing.map((r) => r.status).sort(), [200, 409], 'two people booking in the rest: once');
  const done = await json<Order>(await call('GET', `/inventory/orders/${draft.id}`, tokens.admin));
  assert.equal(done.status, 'Received');
  assert.equal(done.items[0]!.received, 10);

  const row = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
  assert.equal(row.on_hand, 10);
  assert.equal(row.avg_cost.toNumber(), 2.5);
  const prices = await json<{ unit_cost: number; supplier_name: string }[]>(await call('GET', `/inventory/items/${item.id}/prices`, tokens.admin));
  assert.equal(prices.length, 2);
  assert.equal(prices[0]!.supplier_name, `Supplier ${run}`);

  assert.equal((await call('POST', `/inventory/orders/${draft.id}/cancel`, tokens.admin)).status, 409, 'what arrived is not cancelled');
  assert.equal((await call('DELETE', `/inventory/suppliers/${supplier.id}`, tokens.admin)).status, 409, 'a supplier with orders stays');
});

test('shortfall: unheld project needs plus the reorder floor, less free stock and what is on order', async () => {
  const supplier = await prisma.inventorySupplier.findFirstOrThrow({ where: { name: `Supplier ${run}` } });
  const item = await json<Item>(await call('POST', '/inventory/items', tokens.admin, { sku: `${SKU}-SF`, name: `Panel ${run}`, type: 'Sheet', supplier_id: supplier.id, reorder_level: 2 }), 201);
  await json(await call('PUT', `/inventory/projects/${PROJECT}/materials/${item.id}`, tokens.admin, { needed: 5 }), 200);
  const suggest = async () => (await json<{ id: string; suggest: number }[]>(await call('GET', '/inventory/shortfall', tokens.admin))).find((r) => r.id === item.id)?.suggest ?? 0;
  assert.equal(await suggest(), 8, '5 needed + 3 to sit above a reorder level of 2');
  const order = await json<Order>(await call('POST', '/inventory/orders', tokens.admin, { supplier_id: supplier.id, items: [{ item_id: item.id, quantity: 8, unit_cost: 30 }] }), 201);
  assert.equal(await suggest(), 8, 'a Draft is not on order yet');
  await json(await call('POST', `/inventory/orders/${order.id}/send`, tokens.admin), 200);
  assert.equal(await suggest(), 0);
  await json(await call('POST', `/inventory/orders/${order.id}/cancel`, tokens.admin), 200);
  assert.equal(await suggest(), 8, 'a cancelled order is not on order');
  const cost = await json<{ used: number; quoted: number | null }>(await call('GET', `/inventory/projects/${PROJECT}/cost`, tokens.admin));
  assert.equal(cost.quoted, null, 'no accepted quote');
  assert.equal((await call('GET', `/inventory/projects/${PROJECT}/cost`, tokens.installer)).status, 403);
});
