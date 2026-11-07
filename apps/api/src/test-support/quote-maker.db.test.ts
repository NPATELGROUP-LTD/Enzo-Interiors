import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import { Prisma, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { DatabaseService } from '../data/database.service';
import { STARTER_BY, importStarterLibrary } from '../modules/quote-maker/starter';
import { ADMIN, startTestApp } from './app';

/**
 * Quote maker: the public catalogue and range carry no costs, panels or hidden finishes and are shut
 * until Settings › Pages turns `quote` on; pricing follows live inventory (quote_cost, else avg_cost);
 * the unit library, pricing settings and breakdown are Admin only; the import never overwrites an edit.
 */

let app: Awaited<ReturnType<typeof startTestApp>>;
let prisma: PrismaClient;
let db: DatabaseService;
const run = randomUUID().slice(0, 8);
const PASSWORD = 'quote-maker-password-123';
const EDITOR = { id: `stf_qm_e_${run}`, email: `qm-editor-${run}@test.enzo.local` };
const DESIGNER = { id: `stf_qm_d_${run}`, email: `qm-designer-${run}@test.enzo.local` };
const SKU = `QM-${run}`;
const IMAGE = `med_qm_${run}`;
const tokens = { admin: '', editor: '', designer: '' };
const ids = { white: '', green: '', hidden: '', quartz: '', hinge: '' };
let saved: { had: boolean; pages: Prisma.JsonValue | null; vat: number | null };

const board = (key: string, name: string, board_role: string, extra: Record<string, unknown> = {}) =>
  prisma.inventoryItem.create({
    data: { id: `inv_${key}_${run}`, sku: `${SKU}-${key}`, name, type: 'Sheet', board_role, length_mm: 2800, width_mm: 2070, thickness_mm: 18, ...extra },
  });

before(async () => {
  app = await startTestApp();
  prisma = new PrismaClient();
  db = app.nest.get(DatabaseService);
  const password_hash = await bcrypt.hash(PASSWORD, 4);
  await prisma.staffUser.create({ data: { ...EDITOR, name: 'QM Editor', role: 'Editor', password_hash } });
  await prisma.staffUser.create({ data: { ...DESIGNER, name: 'QM Designer', role: 'Designer', password_hash } });
  await prisma.mediaAsset.create({ data: { id: IMAGE, storage_key: `test/${run}.jpg`, alt: 'Green', source: 'upload' } });
  ids.white = (await board('white', `Internal white MFC ${run}`, 'carcass', { quote_cost: 48 })).id;
  ids.green = (await board('green', `Green MDF ${run}`, 'front', { avg_cost: 300, quote_cost: 320, show_on_site: true, public_name: 'Forest green', swatch: '#1b4335', image_id: IMAGE })).id;
  ids.hidden = (await board('hidden', `Trade-only front ${run}`, 'front', { quote_cost: 100 })).id;
  ids.quartz = (await board('quartz', `Quartz laminate ${run}`, 'worktop', { avg_cost: 145, length_mm: 3000, width_mm: 600, grain: true })).id;
  ids.hinge = (await prisma.inventoryItem.create({ data: { id: `inv_hinge_${run}`, sku: `${SKU}-hinge`, name: `Hinge ${run}`, type: 'Hardware' } })).id;

  const site = await prisma.siteSettings.findUnique({ where: { id: 'site' } });
  const vat = await prisma.businessSettings.findFirst();
  saved = { had: site !== null, pages: site?.pages ?? null, vat: vat ? Number(vat.vat_rate) : null };
  await prisma.quoteMakerSetting.deleteMany({});

  tokens.admin = await signIn(ADMIN.email, ADMIN.password);
  tokens.editor = await signIn(EDITOR.email, PASSWORD);
  tokens.designer = await signIn(DESIGNER.email, PASSWORD);
});

after(async () => {
  await prisma.unitTemplate.deleteMany({ where: { slug: { startsWith: `qm-${run}` } } });
  await prisma.quoteMakerSetting.deleteMany({});
  await prisma.inventoryItem.deleteMany({ where: { sku: { startsWith: SKU } } });
  await prisma.mediaAsset.deleteMany({ where: { id: IMAGE } });
  await prisma.staffUser.deleteMany({ where: { id: { in: [EDITOR.id, DESIGNER.id] } } });
  if (saved.had) await prisma.siteSettings.update({ where: { id: 'site' }, data: { pages: saved.pages ?? Prisma.JsonNull } });
  else await prisma.siteSettings.deleteMany({ where: { id: 'site' } });
  if (saved.vat === null) await prisma.businessSettings.deleteMany({});
  else await prisma.businessSettings.updateMany({ data: { vat_rate: saved.vat } });
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
  const text = await res.text();
  assert.equal(res.status, status, `${res.url} answered ${res.status}: ${text}`);
  return JSON.parse(text) as T;
}

async function setPage(on: boolean) {
  const site = await prisma.siteSettings.findUnique({ where: { id: 'site' } });
  const pages = { ...((site?.pages as object | null) ?? {}), quote: on };
  await prisma.siteSettings.upsert({ where: { id: 'site' }, update: { pages }, create: { id: 'site', pages } });
}

const PRICING = { margin_pct: 70, range_low_pct: 5, range_high_pct: 15, kerf_mm: 4, edge_trim_mm: 10, round_to: 50, hourly_rate: 30 };
const base600 = (finishes?: Record<string, string>) => ({ template_id: baseId, variant_id: 'kitchen-base-600', ...(finishes ? { finishes } : {}) });
let baseId = '';

type Catalogue = {
  templates: Array<{ id: string; slug: string; slots: Array<{ key: string; default_finish_id: string | null; default_swatch: string | null }>; variants: Array<Record<string, unknown>> }>;
  finishes: Array<{ id: string; name: string; image: string | null }>;
};
type Estimate = { priced: boolean; low: number | null; high: number | null; vat_rate: number };

test('the public quote maker is shut until Settings › Pages turns it on', async () => {
  await setPage(false);
  assert.equal((await call('GET', '/quote-maker/catalogue')).status, 403);
  assert.equal((await call('POST', '/quote-maker/estimate', undefined, { units: [] })).status, 403);
  await setPage(true);
  assert.equal((await call('GET', '/quote-maker/catalogue')).status, 200);
});

test('the unit library, pricing and breakdown are Admin only', async () => {
  for (const token of [undefined, tokens.editor, tokens.designer]) {
    const want = token ? 403 : 401;
    assert.equal((await call('GET', '/quote-maker/templates', token)).status, want);
    assert.equal((await call('GET', '/quote-maker/pricing', token)).status, want);
    assert.equal((await call('PUT', '/quote-maker/pricing', token, { ...PRICING, defaults: {} })).status, want);
    assert.equal((await call('POST', '/quote-maker/breakdown', token, { units: [] })).status, want);
    assert.equal((await call('POST', '/quote-maker/templates', token, {})).status, want);
  }
});

test('the starter library imports, prices nothing until defaults are chosen, then appears with the finishes on offer', async () => {
  const first = await importStarterLibrary(db);
  assert.ok(first.added + first.refreshed > 20);
  const library = await json<Array<{ id: string; slug: string; problems: string[] }>>(await call('GET', '/quote-maker/templates', tokens.admin));
  const base = library.find((t) => t.slug === 'kitchen-base')!;
  baseId = base.id;
  assert.ok(base.problems.length >= 1, 'no defaults yet');
  assert.equal((await json<Catalogue>(await call('GET', '/quote-maker/catalogue'))).templates.find((t) => t.slug === 'kitchen-base'), undefined);

  // A default must be a board of its role with a size.
  assert.equal((await call('PUT', '/quote-maker/pricing', tokens.admin, { ...PRICING, defaults: { carcass: ids.quartz } })).status, 400);
  assert.equal((await call('PUT', '/quote-maker/pricing', tokens.admin, { ...PRICING, defaults: { carcass: ids.hinge } })).status, 400);
  await json(await call('PUT', '/quote-maker/pricing', tokens.admin, { ...PRICING, defaults: { carcass: ids.white, front: ids.hidden, worktop: ids.quartz } }));
  assert.deepEqual((await json<{ defaults: object }>(await call('GET', '/quote-maker/pricing', tokens.admin))).defaults, { carcass: ids.white, front: ids.hidden, worktop: ids.quartz });

  const res = await call('GET', '/quote-maker/catalogue');
  const text = await res.clone().text();
  const catalogue = await json<Catalogue>(res);
  const listed = catalogue.templates.find((t) => t.slug === 'kitchen-base')!;
  assert.ok(listed, 'priceable now');
  assert.deepEqual(Object.keys(listed.variants[0]!).sort(), ['depth_mm', 'height_mm', 'id', 'width_mm']);
  // Only ticked finishes are offered, by their public name; the trade-only default is a colour, never named.
  assert.deepEqual(catalogue.finishes.map((f) => f.name).filter((n) => n.includes('Forest') || n.includes(run)), ['Forest green']);
  assert.match(catalogue.finishes.find((f) => f.name === 'Forest green')!.image ?? '', new RegExp(`test/${run}\\.jpg$`));
  assert.equal(listed.slots.find((s) => s.key === 'front')!.default_finish_id, null);
  for (const secret of ['cost', 'avg_cost', 'quote_cost', 'panels', 'hardware', 'labour', 'on_hand', `Trade-only front ${run}`, `Internal white MFC ${run}`])
    assert.ok(!text.includes(secret), `catalogue leaks ${secret}`);
});

test('a visitor gets a rounded range from live inventory, with VAT from Settings › VAT', async () => {
  await prisma.businessSettings.updateMany({ data: { vat_rate: 0 } });
  const none = await json<Estimate>(await call('POST', '/quote-maker/estimate', undefined, { units: [base600({ front: ids.green })] }));
  assert.equal(none.priced, true);
  assert.equal(none.vat_rate, 0);
  // white 48 + green quote_cost 320 (not avg 300) + quartz avg 145 + 1.5 h x £30, x 1.7
  const net = (48 + 320 + 145 + 45) * 1.7;
  assert.equal(none.low, Math.round((net * 0.95) / 50) * 50);
  assert.equal(none.high, Math.round((net * 1.15) / 50) * 50);

  const text = JSON.stringify(none);
  assert.ok(!/cost|margin|sheets/.test(text));

  await json(await call('PUT', '/settings/vat', tokens.admin, { vat_rate: 20 }));
  const vat = await json<Estimate>(await call('POST', '/quote-maker/estimate', undefined, { units: [base600({ front: ids.green })] }));
  assert.equal(vat.vat_rate, 20);
  assert.equal(vat.high, Math.round((net * 1.2 * 1.15) / 50) * 50);
  await json(await call('PUT', '/settings/vat', tokens.admin, { vat_rate: 0 }));
});

test('a visitor cannot price a hidden finish, a missing unit, a bad shape or a huge design', async () => {
  const bad = async (body: unknown, pattern?: RegExp) => {
    const res = await call('POST', '/quote-maker/estimate', undefined, body);
    const text = await res.text();
    assert.equal(res.status, 400, text);
    if (pattern) assert.match(text, pattern);
  };
  await bad({ units: [base600({ front: ids.hidden })] }, /not offered/);
  await bad({ units: [base600({ front: ids.quartz })] }, /not offered/);
  await bad({ units: [{ template_id: 'nope', variant_id: 'kitchen-base-600' }] }, /no longer offered/);
  await bad({ units: [{ template_id: baseId, variant_id: 'kitchen-base-601' }] }, /size/);
  await bad({ units: [base600({ front: 42 as unknown as string })] });
  await bad({ units: [{ ...base600(), finishes: ['x'] }] });
  await bad({ units: Array.from({ length: 81 }, () => base600()) });
  await bad({ units: [base600()], extra: true });
});

test('a £0 fitting means no range is shown; the Admin breakdown shows the working', async () => {
  const slug = `qm-${run}-hinged`;
  const template = {
    slug, name: 'Hinged test unit', room_types: ['kitchen'], mount: 'floor', elevation_mm: 0,
    structure: { doors: 1, drawers: 0, shelves: 0, back: false, plinth_mm: 0, worktop: false },
    slots: [{ key: 'carcass', label: 'Carcass', roles: ['carcass'] }, { key: 'front', label: 'Front', roles: ['front'] }],
    variants: [{ id: `${slug}-500`, width_mm: 500, height_mm: 700, depth_mm: 500, panels: [
      { label: 'Side', slot: 'carcass', length_mm: 700, width_mm: 500, qty: 2 },
      { label: 'Door', slot: 'front', length_mm: 700, width_mm: 494, qty: 1 },
    ] }],
    hardware: [{ item_id: ids.hinge, qty: 2 }],
    labour_hours: 1, labour_extra: 12.5,
  };
  const created = await json<{ id: string; updated_by: string; variants: Array<{ panels: Array<{ id: string }> }> }>(await call('POST', '/quote-maker/templates', tokens.admin, template), 201);
  assert.ok(created.updated_by && created.updated_by !== STARTER_BY, 'a saved unit is marked as edited');
  assert.ok(created.variants[0]!.panels.every((p) => p.id.startsWith(`${slug}-500-`)), 'panel ids filled in');

  const unit = { template_id: created.id, variant_id: `${slug}-500`, finishes: { front: ids.green } };
  assert.deepEqual(await json<Estimate>(await call('POST', '/quote-maker/estimate', undefined, { units: [unit] })), { priced: false, low: null, high: null, vat_rate: 0 });

  await prisma.inventoryItem.update({ where: { id: ids.hinge }, data: { quote_cost: 4.5 } });
  assert.equal((await json<Estimate>(await call('POST', '/quote-maker/estimate', undefined, { units: [unit] }))).priced, true);

  // Staff may price a trade-only finish; the visitor may not.
  const staff = await json<{
    boards: Array<{ name: string; sheets: number; cost: number; layout: unknown[] }>;
    hardware: Array<{ qty: number; cost: number }>;
    labour: { hours: number; cost: number };
    cost: number; net: number; unpriced: string[]; margin_pct: number;
  }>(await call('POST', '/quote-maker/breakdown', tokens.admin, { units: [{ ...unit, finishes: { front: ids.hidden } }] }));
  assert.deepEqual(staff.boards.map((b) => [b.name, b.sheets, b.cost]).sort(), [[`Internal white MFC ${run}`, 1, 48], [`Trade-only front ${run}`, 1, 100]]);
  assert.deepEqual(staff.hardware.map((h) => [h.qty, h.cost]), [[2, 9]]);
  assert.deepEqual(staff.labour, { hours: 1, cost: 42.5 });
  assert.equal(staff.cost, 48 + 100 + 9 + 42.5);
  assert.equal(staff.net, Math.round(staff.cost * 170) / 100);
  assert.deepEqual(staff.unpriced, []);
  assert.equal(staff.boards[0]!.layout.length, 1);
});

test('the library refuses bad units, and an edited unit survives the next import', async () => {
  const slug = `qm-${run}-check`;
  const ok = {
    slug, name: 'Check', room_types: ['office'], mount: 'wall', elevation_mm: 1500,
    structure: { doors: 0, drawers: 0, shelves: 1, back: false, plinth_mm: 0, worktop: false },
    slots: [{ key: 'carcass', label: 'Carcass', roles: ['carcass'] }],
    variants: [{ width_mm: 600, height_mm: 300, depth_mm: 250, panels: [{ label: 'Shelf', slot: 'carcass', length_mm: 600, width_mm: 250, qty: 1 }] }],
    hardware: [], labour_hours: 0.5, labour_extra: 0,
  };
  const refuse = async (body: unknown, status = 400) => assert.equal((await call('POST', '/quote-maker/templates', tokens.admin, body)).status, status);
  await refuse({ ...ok, variants: [{ ...ok.variants[0], panels: [{ ...ok.variants[0]!.panels[0], slot: 'front' }] }] });
  await refuse({ ...ok, slots: [{ ...ok.slots[0], default_item_id: ids.green }] });
  await refuse({ ...ok, slots: [ok.slots[0], ok.slots[0]] });
  await refuse({ ...ok, room_types: ['garage'] });
  await refuse({ ...ok, hardware: [{ item_id: 'inv_missing', qty: 1 }] });
  await refuse({ ...ok, labour_hours: -1 });
  await refuse({ ...ok, variants: [{ ...ok.variants[0], panels: Array.from({ length: 41 }, () => ok.variants[0]!.panels[0]) }] });
  await refuse({ ...ok, slug: 'Not A Slug' });
  await json(await call('POST', '/quote-maker/templates', tokens.admin, ok), 201);
  await refuse(ok, 409);

  // The Admin edits a shipped unit: the import keeps it; an unedited one follows the shipped copy.
  const library = await json<Array<{ id: string; slug: string; updated_by: string } & Record<string, unknown>>>(await call('GET', '/quote-maker/templates', tokens.admin));
  const wall = library.find((t) => t.slug === 'kitchen-wall')!;
  const id = wall.id;
  // What the library hands out goes straight back in, as the admin editor will send it.
  const body = Object.fromEntries(Object.entries(wall).filter(([key]) => !['id', 'problems', 'updated_by', 'created_at', 'updated_at'].includes(key)));
  await json(await call('PUT', `/quote-maker/templates/${id}`, tokens.admin, { ...body, name: 'Our wall unit' }));
  const larder = library.find((t) => t.slug === 'kitchen-larder')!;
  await prisma.unitTemplate.update({ where: { id: larder.id }, data: { name: 'Scribbled', updated_by: STARTER_BY } });
  const again = await importStarterLibrary(db);
  assert.ok(again.kept >= 1);
  assert.equal((await prisma.unitTemplate.findUnique({ where: { id } }))!.name, 'Our wall unit');
  assert.equal((await prisma.unitTemplate.findUnique({ where: { id: larder.id } }))!.name, 'Tall larder');
  await prisma.unitTemplate.update({ where: { id }, data: { name: 'Wall unit', updated_by: STARTER_BY } });
});

test('switching off a default board takes its units off the website, never prices them at £0', async () => {
  await prisma.inventoryItem.update({ where: { id: ids.white }, data: { active: false } });
  const catalogue = await json<Catalogue>(await call('GET', '/quote-maker/catalogue'));
  assert.equal(catalogue.templates.find((t) => t.slug === 'kitchen-base'), undefined);
  assert.equal((await call('POST', '/quote-maker/estimate', undefined, { units: [base600()] })).status, 400);
  const library = await json<Array<{ slug: string; problems: string[] }>>(await call('GET', '/quote-maker/templates', tokens.admin));
  assert.match(library.find((t) => t.slug === 'kitchen-base')!.problems.join(' '), /Carcass/);
  await prisma.inventoryItem.update({ where: { id: ids.white }, data: { active: true } });
});
