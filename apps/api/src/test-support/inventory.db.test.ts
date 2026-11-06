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
const tokens = { admin: '', designer: '' };
let itemId = '';

before(async () => {
  app = await startTestApp();
  prisma = new PrismaClient();
  await prisma.staffUser.create({ data: { ...DESIGNER, name: 'Inv Designer', role: 'Designer', password_hash: await bcrypt.hash(PASSWORD, 4) } });
  tokens.admin = await signIn(ADMIN.email, ADMIN.password);
  tokens.designer = await signIn(DESIGNER.email, PASSWORD);
});

after(async () => {
  await prisma.stockMovement.deleteMany({ where: { item: { sku: { startsWith: SKU } } } });
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
