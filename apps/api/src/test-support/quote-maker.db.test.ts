import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import { Prisma, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { DatabaseService } from '../data/database.service';
import { QuoteDesignsService } from '../modules/quote-maker/designs';
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
const CLIENT = `cli_qm_${run}`;
const PROJECT = `prj_qm_${run}`;
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
  await prisma.projectMaterial.deleteMany({ where: { project_id: PROJECT } });
  await prisma.projectQuote.deleteMany({ where: { client_id: CLIENT } });
  await prisma.quoteDesign.deleteMany({ where: { title: { startsWith: `QM ${run}` } } });
  await prisma.contactSubmission.deleteMany({ where: { email: `qm-visitor-${run}@test.enzo.local` } }); // its designs cascade
  await prisma.project.deleteMany({ where: { id: PROJECT } });
  await prisma.client.deleteMany({ where: { id: CLIENT } });
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

/* ------------------------------------------------------------ saved designs (PR 3) */

type Placed = { id: string; template_id: string; variant_id: string; x_mm: number; finishes?: Record<string, string> };
type PlanBody = { layout: string; height_mm: number; walls: Array<{ length_mm: number; units: Placed[] }>; island: { length_mm: number; units: Placed[] } | null };
type Design = {
  id: string; ref: string; title: string | null; source: string; units: number;
  estimate_low: number | null; estimate_high: number | null; design: PlanBody;
  quotes: Array<{ id: string; status: string }>;
};
const unitAt = (id: string, x_mm: number): Placed => ({ id, template_id: baseId, variant_id: 'kitchen-base-600', x_mm });
const single = (...units: Placed[]): PlanBody => ({ layout: 'single', height_mm: 2400, walls: [{ length_mm: 3000, units }], island: null });
const save = (plan: PlanBody, title = `QM ${run} kitchen`) => ({ title, room_type: 'kitchen', design: plan });
let designId = '';

test('saved designs, the questions and Make quote are Admin only', async () => {
  for (const token of [undefined, tokens.editor, tokens.designer]) {
    const want = token ? 403 : 401;
    assert.equal((await call('GET', '/quote-maker/designs', token)).status, want);
    assert.equal((await call('POST', '/quote-maker/designs', token, save(single()))).status, want);
    assert.equal((await call('POST', '/quote-maker/fill', token, { room_type: 'kitchen', layout: 'single', walls: [3000], height_mm: 2400, upper: false })).status, want);
    assert.equal((await call('POST', '/quote-maker/designs/x/quote', token, { project_id: 'x' })).status, want);
  }
});

test('the questions fill every wall of an L with units that fit, and the plan saves as it came', async () => {
  const plan = await json<PlanBody>(await call('POST', '/quote-maker/fill', tokens.admin, {
    room_type: 'kitchen', layout: 'L', walls: [3000, 2400], height_mm: 2400, island_mm: 1800, upper: true,
  }));
  assert.equal(plan.walls.length, 2);
  assert.ok(plan.island && plan.island.units.length > 0, 'island filled');
  const library = await json<Array<{ id: string; variants: Array<{ id: string; width_mm: number }> }>>(await call('GET', '/quote-maker/templates', tokens.admin));
  const width = (u: Placed) => library.find((t) => t.id === u.template_id)!.variants.find((v) => v.id === u.variant_id)!.width_mm;
  for (const wall of [...plan.walls, plan.island!]) {
    assert.ok(wall.units.length > 0);
    for (const unit of wall.units) assert.ok(unit.x_mm >= 0 && unit.x_mm + width(unit) <= wall.length_mm, 'inside its wall');
  }
  const saved = await json<Design>(await call('POST', '/quote-maker/designs', tokens.admin, save(plan, `QM ${run} filled`)), 201);
  assert.match(saved.ref, /^QD-\d{4,}$/);
  assert.equal(saved.source, 'staff');
  assert.deepEqual(saved.design, plan);
  assert.ok((saved.estimate_low === null) === (saved.estimate_high === null));
  assert.ok(saved.estimate_low === null || saved.estimate_low <= saved.estimate_high!);
});

test('a design is refused when its shape is wrong or a unit is off its wall; it is priced on save', async () => {
  const refuse = async (body: unknown, pattern: RegExp) => {
    const res = await call('POST', '/quote-maker/designs', tokens.admin, body);
    const text = await res.text();
    assert.equal(res.status, 400, text);
    assert.match(text, pattern);
  };
  await refuse(save(single(unitAt('a', 2600))), /does not fit on Wall A/);
  await refuse(save({ ...single(), layout: 'L' }), /2 wall/);
  await refuse(save(single(unitAt('a', 0), unitAt('a', 600))), /same id/);
  await refuse(save(single({ ...unitAt('a', 0), template_id: 'nope' })), /no longer in the Unit library/);
  await refuse(save(single({ ...unitAt('a', 0), variant_id: 'kitchen-base-601' })), /no longer in the Unit library/);
  await refuse({ ...save(single()), room_type: 'garage' }, /room_type/);

  // One base unit with the default (trade-only) front: white 48 + front 100 + quartz 145 + 1.5 h x £30, x 1.7, no VAT.
  const net = (48 + 100 + 145 + 45) * 1.7;
  const one = await json<Design>(await call('POST', '/quote-maker/designs', tokens.admin, save(single(unitAt('a', 0)))), 201);
  assert.deepEqual([one.estimate_low, one.estimate_high], [Math.round((net * 0.95) / 50) * 50, Math.round((net * 1.15) / 50) * 50]);
  designId = one.id;

  const two = await json<Design>(await call('PUT', `/quote-maker/designs/${designId}`, tokens.admin, save(single(unitAt('a', 0), unitAt('b', 600)))));
  assert.equal(two.units, 2);
  assert.ok(two.estimate_high! > one.estimate_high!);
  assert.equal((await call('GET', '/quote-maker/designs/nope', tokens.admin)).status, 404);
  assert.ok((await json<Design[]>(await call('GET', '/quote-maker/designs', tokens.admin))).some((d) => d.id === designId && !('design' in d)));
});

test('Make quote writes a Draft for the project, identical units on one line; the design adds its stock once', async () => {
  const stage = (await json<{ stages: string[] }>(await call('GET', '/inventory/settings', tokens.admin))).stages[0]!;
  await prisma.client.create({ data: { id: CLIENT, name: 'QM Client', email: `qm-client-${run}@test.enzo.local`, joined_date: new Date(), status: 'Active', password_hash: '' } });
  await prisma.project.create({ data: { id: PROJECT, client_id: CLIENT, name: `Kitchen ${run}`, type: 'Kitchen', status: stage } });
  assert.equal((await call('POST', `/quote-maker/designs/${designId}/quote`, tokens.admin, { project_id: 'prj_missing' })).status, 400);

  const quote = await json<{ id: string; status: string; client_id: string; project_id: string; design_id: string; items: Array<{ quantity: number; cost_price: number; margin_pct: number; unit_price: number }> }>(
    await call('POST', `/quote-maker/designs/${designId}/quote`, tokens.admin, { project_id: PROJECT }), 201);
  assert.deepEqual([quote.status, quote.client_id, quote.project_id, quote.design_id], ['Draft', CLIENT, PROJECT, designId]);
  assert.equal(quote.items.length, 1);
  assert.equal(quote.items[0]!.quantity, 2);
  assert.equal(Number(quote.items[0]!.margin_pct), 70);
  assert.equal(Number(quote.items[0]!.unit_price), Math.round(Number(quote.items[0]!.cost_price) * 170) / 100);
  assert.deepEqual((await json<Design>(await call('GET', `/quote-maker/designs/${designId}`, tokens.admin))).quotes.map((q) => q.id), [quote.id]);

  const first = await json<{ changed: number; lines: number }>(await call('POST', `/quote-maker/designs/${designId}/materials`, tokens.admin, { project_id: PROJECT }));
  assert.ok(first.changed >= 3 && first.changed === first.lines, 'carcass, front, worktop at least');
  const needs = await prisma.projectMaterial.findMany({ where: { project_id: PROJECT } });
  assert.ok(needs.every((n) => n.needed >= 1));
  assert.equal(needs.find((n) => n.item_id === ids.hinge), undefined, 'the starter base unit names no hinge');
  assert.deepEqual(await json(await call('POST', `/quote-maker/designs/${designId}/materials`, tokens.admin, { project_id: PROJECT })), { changed: 0, lines: first.lines });

  // Deleting the design keeps the quote, unlinked.
  await json(await call('DELETE', `/quote-maker/designs/${designId}`, tokens.admin));
  assert.equal((await prisma.projectQuote.findUnique({ where: { id: quote.id } }))!.design_id, null);
  assert.equal((await call('DELETE', `/quote-maker/designs/${designId}`, tokens.admin)).status, 404);
});

/* ------------------------------------------------------------ the website (PR 4) */

const VISITOR = `qm-visitor-${run}@test.enzo.local`;
const contact = { name: 'Quote Visitor', email: VISITOR, phone: '07700 900000', message: 'Grey handles please' };
const kitchen = { room_type: 'kitchen', layout: 'single', walls: [2400], height_mm: 2400, upper: false };

test('start and submit are shut with the page; a visitor starts only from what the website offers', async () => {
  await setPage(false);
  assert.equal((await call('POST', '/quote-maker/start', undefined, kitchen)).status, 403);
  assert.equal((await call('POST', '/quote-maker/submit', undefined, { rooms: [{ room_type: 'kitchen', design: single(unitAt('a', 0)) }], ...contact })).status, 403);
  await setPage(true);

  const offered = new Set((await json<Catalogue>(await call('GET', '/quote-maker/catalogue'))).templates.map((t) => t.id));
  const plan = await json<PlanBody>(await call('POST', '/quote-maker/start', undefined, { ...kitchen, finishes: { front: ids.green } }));
  const units = plan.walls[0]!.units;
  assert.ok(units.length > 0);
  assert.ok(units.every((u) => offered.has(u.template_id)), 'only catalogue units');
  assert.ok(units.some((u) => u.finishes?.front === ids.green));
  // A finish not ticked "show on website" is refused, even though staff may use it.
  assert.equal((await call('POST', '/quote-maker/start', undefined, { ...kitchen, finishes: { front: ids.hidden } })).status, 400);
});

test('a visitor sends a design: priced on the server, stored as a Quote enquiry with the design on it', async () => {
  // Honeypot: a quiet 204 and nothing stored.
  assert.equal((await call('POST', '/quote-maker/submit', undefined, { rooms: [{ room_type: 'kitchen', design: single(unitAt('a', 0)) }], ...contact, website: 'x' })).status, 204);
  assert.equal(await prisma.contactSubmission.count({ where: { email: VISITOR } }), 0);
  // An empty design or a hidden finish is refused before anything is stored.
  assert.equal((await call('POST', '/quote-maker/submit', undefined, { rooms: [{ room_type: 'kitchen', design: single() }], ...contact })).status, 400);
  const hidden = { ...unitAt('a', 0), finishes: { front: ids.hidden } };
  assert.equal((await call('POST', '/quote-maker/submit', undefined, { rooms: [{ room_type: 'kitchen', design: single(hidden) }], ...contact })).status, 400);
  assert.equal(await prisma.contactSubmission.count({ where: { email: VISITOR } }), 0);

  const units = [unitAt('a', 0), { ...unitAt('b', 600), finishes: { front: ids.green } }];
  const quoted = await json<Estimate>(await call('POST', '/quote-maker/estimate', undefined, { units: units.map(({ template_id, variant_id, finishes }) => ({ template_id, variant_id, finishes })) }));
  const sent = await json<{ priced: boolean; low: number; high: number }>(
    await call('POST', '/quote-maker/submit', undefined, { rooms: [{ room_type: 'kitchen', design: single(...units), answers: kitchen }], ...contact }), 201);
  assert.deepEqual(sent, { priced: true, low: quoted.low, high: quoted.high }, 'the same range the visitor was shown');

  const enquiry = await prisma.contactSubmission.findFirstOrThrow({ where: { email: VISITOR } });
  assert.deepEqual([enquiry.kind, enquiry.source, enquiry.status, enquiry.service_interest], ['quote', 'Quote', 'New', 'Kitchen']);
  assert.match(String((enquiry.details as Record<string, string>).Estimate), /^£[\d,]+ to £[\d,]+$/);
  const design = await prisma.quoteDesign.findFirstOrThrow({ where: { enquiry_id: enquiry.id } });
  assert.deepEqual([design.source, design.created_by, Number(design.estimate_low), Number(design.estimate_high)], ['web', null, sent.low, sent.high]);

  // The enquiry page finds its design; only the Admin may ask.
  const found = await json<Design[]>(await call('GET', `/quote-maker/designs?enquiry_id=${enquiry.id}`, tokens.admin));
  assert.deepEqual(found.map((d) => d.id), [design.id]);
  assert.equal((await call('GET', `/quote-maker/designs?enquiry_id=${enquiry.id}`, tokens.designer)).status, 403);
  assert.equal((await call('GET', `/quote-maker/designs?enquiry_id=${enquiry.id}`)).status, 401);
});

test('website designs that came to nothing go after 12 months; staff designs and live leads stay', async () => {
  const old = new Date(Date.now() - 400 * 86_400_000);
  const plan = single(unitAt('a', 0)) as unknown as Prisma.InputJsonValue;
  const lead = (status: string) =>
    prisma.contactSubmission.create({ data: { id: `enq_qm_${status}_${run}`, kind: 'quote', name: 'Old lead', email: VISITOR, message: '', status, created_at: old } });
  const make = (key: string, source: string, enquiry_id: string | null, created_at = old) =>
    prisma.quoteDesign.create({ data: { id: `qd_${key}_${run}`, source, title: `QM ${run} ${key}`, room_type: 'kitchen', design: plan, enquiry_id, created_at } });
  const lapsed = await make('lapsed', 'web', (await lead('Archived')).id);
  const converted = await make('converted', 'web', (await lead('Converted')).id);
  const staff = await make('staff', 'staff', null);
  const recent = await make('recent', 'web', null, new Date());

  assert.ok((await app.nest.get(QuoteDesignsService).purge()) >= 1);
  const left = new Set((await prisma.quoteDesign.findMany({ where: { id: { in: [lapsed.id, converted.id, staff.id, recent.id] } } })).map((d) => d.id));
  assert.deepEqual([...left].sort(), [converted.id, recent.id, staff.id].sort());
  assert.equal(await prisma.contactSubmission.count({ where: { id: `enq_qm_Archived_${run}` } }), 1, 'the enquiry itself stays');
});
