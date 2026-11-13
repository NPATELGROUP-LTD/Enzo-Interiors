import 'reflect-metadata';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import type { QuotePricing, UnitTemplate } from '../../data/quote-maker-store';
import {
  type FillAnswers,
  type PriceItem,
  type Piece,
  fillPlan,
  fillRun,
  generatePanels,
  nestPieces,
  planShapeProblem,
  planUnits,
  priceDesign,
  resolveUnit,
  templateProblems,
  unitsOffWall,
  wallLabel,
} from './engine';
import { DEFAULT_PRICING, TemplateDto } from './quote-maker.module';
import { STARTER_LIBRARY } from './starter';

const MFC = { length_mm: 2800, width_mm: 2070, grain: false };
const VENEER = { length_mm: 2440, width_mm: 1220, grain: true };
const OPTS = { kerf_mm: 4, edge_trim_mm: 10 };
const piece = (length_mm: number, width_mm: number, key = `${length_mm}x${width_mm}`): Piece => ({ key, label: key, length_mm, width_mm, owner: 'u1' });

test('nesting: a single small piece is charged a whole board', () => {
  const result = nestPieces([piece(300, 200)], MFC, OPTS);
  assert.equal(result.sheets.length, 1);
  assert.equal(result.boards_charged, 1);
});

test('nesting: pieces share a board until it is full', () => {
  const four = [1, 2, 3, 4].map((i) => piece(1000, 1000, `p${i}`));
  assert.equal(nestPieces(four, MFC, OPTS).boards_charged, 1);
  assert.equal(nestPieces([...four, piece(1000, 1000, 'p5')], MFC, OPTS).boards_charged, 2);
});

test('nesting: a piece turns on a plain board but never against the grain', () => {
  const tall = piece(1100, 2000);
  assert.equal(nestPieces([tall], { ...VENEER, grain: false }, OPTS).oversize.length, 0);
  const grained = nestPieces([tall], VENEER, OPTS);
  assert.equal(grained.oversize.length, 1);
  assert.equal(grained.sheets.length, 0);
});

test('nesting: a piece longer than any sheet is charged the boards to joint it', () => {
  const result = nestPieces([piece(3500, 500)], MFC, OPTS);
  assert.equal(result.oversize[0]?.boards, 2);
  assert.equal(result.boards_charged, 2);
});

test('nesting: every placement sits inside the trimmed sheet, none overlap, none are lost', () => {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647), seed / 2147483647);
  const pieces = Array.from({ length: 60 }, (_, i) => piece(Math.round(150 + rand() * 1800), Math.round(100 + rand() * 900), `r${i}`));
  const result = nestPieces(pieces, MFC, OPTS);
  assert.equal(result.sheets.flatMap((s) => s.placements).length + result.oversize.length, pieces.length);
  for (const sheet of result.sheets) {
    for (const a of sheet.placements) {
      assert.ok(a.x >= 10 && a.y >= 10 && a.x + a.w <= 2790 && a.y + a.h <= 2060);
      for (const b of sheet.placements) {
        if (a !== b) assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
      }
    }
  }
});

test('nesting: the same pieces in any order give the same plan', () => {
  const pieces = [piece(700, 560, 'a'), piece(564, 560, 'b'), piece(564, 560, 'c'), piece(2000, 600, 'd')];
  assert.deepEqual(nestPieces(pieces, MFC, OPTS), nestPieces([...pieces].reverse(), MFC, OPTS));
});

/* ---- pricing ---- */

const board = (id: string, board_role: PriceItem['board_role'], cost: number, size = MFC, extra: Partial<PriceItem> = {}): PriceItem => ({
  id, name: id, board_role, length_mm: size.length_mm, width_mm: size.width_mm, grain: size.grain, active: true, show_on_site: false, cost, ...extra,
});
const ITEMS = new Map<string, PriceItem>(
  [
    board('white', 'carcass', 48),
    board('green', 'front', 320, VENEER, { show_on_site: true }),
    board('oak', 'front', 245, VENEER, { show_on_site: true }),
    board('quartz', 'worktop', 145, { length_mm: 3000, width_mm: 600, grain: true }),
    board('hidden', 'front', 100, VENEER),
    { ...board('hinge', null, 4.5), length_mm: null, width_mm: null },
  ].map((item) => [item.id, item]),
);
const PRICING: QuotePricing = { ...DEFAULT_PRICING, hourly_rate: 30, defaults: { carcass: 'white', front: 'green', worktop: 'quartz' } };

const base = STARTER_LIBRARY.find((t) => t.slug === 'kitchen-base')!;
const TEMPLATE: UnitTemplate = { ...base, id: 'base', hardware: [{ item_id: 'hinge', qty: 2 }], updated_by: null, created_at: '', updated_at: '' };
const resolve = (finishes: Record<string, string> = {}, key = 'a', variant = 'kitchen-base-600', publicOnly = true) => {
  const unit = resolveUnit({ template_id: 'base', variant_id: variant, finishes }, key, TEMPLATE, ITEMS, PRICING, publicOnly);
  assert.notEqual(typeof unit, 'string', String(unit));
  return unit as Exclude<typeof unit, string>;
};

test('pricing: an empty design is £0', () => {
  const result = priceDesign([], ITEMS, PRICING, 20);
  assert.equal(result.gross, 0);
  assert.deepEqual(result.lines, []);
});

test('pricing: one cabinet is a whole sheet of each board, plus hardware and labour, marked up, then VAT', () => {
  const result = priceDesign([resolve()], ITEMS, PRICING, 20);
  assert.deepEqual(result.boards.map((b) => [b.item_id, b.sheets]).sort(), [['green', 1], ['quartz', 1], ['white', 1]]);
  assert.equal(result.cost, 48 + 320 + 145 + 2 * 4.5 + 1.5 * 30);
  assert.equal(result.net, Math.round(result.cost * 170) / 100);
  assert.equal(result.vat, Math.round(result.net * 20) / 100);
  assert.equal(result.gross, result.net + result.vat);
  assert.equal(result.low % 50, 0);
  assert.equal(result.high % 50, 0);
  assert.ok(result.low < result.gross && result.high > result.gross);
  assert.deepEqual(result.labour, { hours: 1.5, cost: 45 });
  assert.deepEqual(result.hardware, [{ item_id: 'hinge', name: 'hinge', qty: 2, cost: 9 }]);
});

test('pricing: units of the same board share sheets', () => {
  const one = priceDesign([resolve()], ITEMS, PRICING, 0);
  const three = priceDesign([resolve({}, 'a'), resolve({}, 'b'), resolve({}, 'c')], ITEMS, PRICING, 0);
  const boards = (r: typeof one) => r.boards.reduce((sum, b) => sum + b.cost, 0);
  assert.ok(boards(three) < boards(one) * 3);
});

test('pricing: the lines add back up to the net price', () => {
  const units = [resolve({}, 'a'), resolve({ front: 'oak' }, 'b'), resolve({}, 'c', 'kitchen-base-1000')];
  const result = priceDesign(units, ITEMS, PRICING, 0);
  const sum = result.lines.reduce((total, line) => total + line.price, 0);
  assert.ok(Math.abs(sum - result.net) <= units.length * 0.01);
});

test('pricing: the margin changes the price, not the cost', () => {
  const a = priceDesign([resolve()], ITEMS, PRICING, 0);
  const b = priceDesign([resolve()], ITEMS, { ...PRICING, margin_pct: 40 }, 0);
  assert.equal(b.cost, a.cost);
  assert.equal(b.net, Math.round(a.cost * 140) / 100);
});

test('pricing: a board at £0 is reported, so the range is not shown', () => {
  const items = new Map(ITEMS).set('white', { ...ITEMS.get('white')!, cost: 0 });
  const unit = resolveUnit({ template_id: 'base', variant_id: 'kitchen-base-600' }, 'a', TEMPLATE, items, PRICING, true);
  assert.deepEqual(priceDesign([unit as Exclude<typeof unit, string>], items, PRICING, 0).unpriced, ['white']);
});

test('resolving: a visitor may pick only finishes on the website; staff any active board of the role', () => {
  assert.match(String(resolveUnit({ template_id: 'base', variant_id: 'kitchen-base-600', finishes: { front: 'hidden' } }, 'a', TEMPLATE, ITEMS, PRICING, true)), /not offered/);
  assert.equal(resolve({ front: 'hidden' }, 'a', 'kitchen-base-600', false).boards.front?.id, 'hidden');
  assert.match(String(resolveUnit({ template_id: 'base', variant_id: 'kitchen-base-600', finishes: { front: 'quartz' } }, 'a', TEMPLATE, ITEMS, PRICING, false)), /not offered/);
  assert.match(String(resolveUnit({ template_id: 'base', variant_id: 'nope' }, 'a', TEMPLATE, ITEMS, PRICING, true)), /size is no longer offered/);
  assert.match(String(resolveUnit({ template_id: 'gone', variant_id: 'x' }, 'a', undefined, ITEMS, PRICING, true)), /no longer offered/);
});

test('availability: a slot with no usable default, or a switched-off fitting, makes a unit unavailable', () => {
  assert.deepEqual(templateProblems(TEMPLATE, ITEMS, PRICING), []);
  assert.equal(templateProblems(TEMPLATE, ITEMS, { ...PRICING, defaults: { carcass: 'white', front: 'green' } }).length, 1);
  const off = new Map(ITEMS).set('hinge', { ...ITEMS.get('hinge')!, active: false });
  assert.equal(templateProblems(TEMPLATE, off, PRICING).length, 1);
  // A slot's own default that is switched off is a problem, never a silent swap to the role default.
  const own = { ...TEMPLATE, slots: TEMPLATE.slots.map((s) => (s.key === 'front' ? { ...s, default_item_id: 'oak' } : s)) };
  const oakOff = new Map(ITEMS).set('oak', { ...ITEMS.get('oak')!, active: false });
  assert.equal(templateProblems(own, oakOff, PRICING).length, 1);
});

test('panel recipe: a 600 base unit is two sides, top, bottom, back, a shelf, one door, plinth and worktop', () => {
  const panels = generatePanels({ doors: 2, drawers: 0, shelves: 1, back: true, plinth_mm: 150, worktop: true }, { width_mm: 600, height_mm: 870, depth_mm: 560 }, [{ key: 'carcass' }, { key: 'front' }, { key: 'worktop' }], 'x');
  assert.deepEqual(panels.map((p) => [p.label, p.slot, p.length_mm, p.width_mm, p.qty]), [
    ['Side', 'carcass', 720, 560, 2],
    ['Top', 'carcass', 564, 560, 1],
    ['Bottom', 'carcass', 564, 560, 1],
    ['Back', 'carcass', 684, 564, 1],
    ['Shelf', 'carcass', 564, 522, 1],
    ['Door', 'front', 714, 594, 1], // one door per 600 mm, so a 600 unit has one
    ['Plinth', 'front', 600, 150, 1],
    ['Worktop', 'worktop', 600, 580, 1],
  ]);
});

test('starter library: every unit passes the same checks as an Admin save', () => {
  for (const template of STARTER_LIBRARY) {
    const errors = validateSync(plainToInstance(TemplateDto, template), { whitelist: true, forbidNonWhitelisted: true });
    assert.deepEqual(errors.map((e) => e.property), [], template.slug);
    const keys = new Set(template.slots.map((s) => s.key));
    for (const variant of template.variants) for (const panel of variant.panels) assert.ok(keys.has(panel.slot), `${template.slug} ${panel.label}`);
  }
  assert.equal(new Set(STARTER_LIBRARY.map((t) => t.slug)).size, STARTER_LIBRARY.length);
});

/* ---------------------------------------------------------------- plans & questions */

const starter = STARTER_LIBRARY.map((t, i) => ({ ...t, id: t.slug, updated_by: null, created_at: '', updated_at: '', position: i })) as UnitTemplate[];
const ids = () => {
  let n = 0;
  return () => `u${(n += 1)}`;
};
const answers = (over: Partial<FillAnswers> = {}): FillAnswers => ({
  room_type: 'kitchen', layout: 'single', walls: [3000], height_mm: 2400, island_mm: null, upper: false, finishes: {}, gaps: [], ...over,
});
const widthOf = (u: { template_id: string; variant_id: string }) => starter.find((t) => t.id === u.template_id)!.variants.find((v) => v.id === u.variant_id)!.width_mm;

test('fill: covers the most wall with the fewest units, widest first', () => {
  assert.deepEqual(fillRun([300, 400, 500, 600, 800, 1000], 3000), [1000, 1000, 1000]);
  assert.deepEqual(fillRun([300, 400, 500, 600, 800, 1000], 2700), [1000, 1000, 400, 300]);
  // Greedy would take 1000 and leave 150; 600 + 550 cannot be made, so 1100 is the most that fits.
  assert.deepEqual(fillRun([600, 1000, 500], 1150), [600, 500]);
  assert.deepEqual(fillRun([600], 500), []);
});

test('fill: a kitchen run with wall units above and a dishwasher gap first', () => {
  const plan = fillPlan(answers({ upper: true, gaps: ['gap-dishwasher'], finishes: { front: 'oak', worktop: 'quartz' } }), starter, ids());
  const [wall] = plan.walls;
  const floor = wall!.units.filter((u) => u.template_id !== 'kitchen-wall').sort((a, b) => a.x_mm - b.x_mm);
  // A larder at the free end, the dishwasher next to it, then the base units; wall units only over those.
  assert.deepEqual(floor.slice(0, 2).map((u) => u.template_id), ['kitchen-larder', 'gap-dishwasher']);
  assert.ok(wall!.units.filter((u) => u.template_id === 'kitchen-wall').every((u) => u.x_mm >= widthOf(floor[0]!)));
  assert.equal(floor.reduce((sum, u) => sum + widthOf(u), 0), 3000);
  assert.ok(wall!.units.some((u) => u.template_id === 'kitchen-wall'));
  // Finishes land only on the slots a unit has: the wall unit has no worktop.
  const wallUnit = wall!.units.find((u) => u.template_id === 'kitchen-wall')!;
  assert.deepEqual(wallUnit.finishes, { front: 'oak' });
  assert.equal(planShapeProblem(plan, 80), null);
  assert.deepEqual(unitsOffWall(plan, planUnits(plan).map(widthOf)), []);
});

test('fill: in an L the second wall starts clear of the corner', () => {
  const plan = fillPlan(answers({ layout: 'L', walls: [3000, 2400] }), starter, ids());
  assert.equal(plan.walls.length, 2);
  assert.equal(Math.min(...plan.walls[1]!.units.map((u) => u.x_mm)), 560);
  assert.equal(plan.walls[0]!.units[0]!.x_mm, 0);
});

test('fill: bedrooms are lined with wardrobes and top boxes; alcove shelving never sits on a tall unit', () => {
  const bedroom = fillPlan(answers({ room_type: 'bedroom', walls: [2400], upper: true }), starter, ids());
  const used = new Set(bedroom.walls[0]!.units.map((u) => u.template_id));
  assert.deepEqual([...used].sort(), ['wardrobe-hinged', 'wardrobe-top-box']);
  const alcove = fillPlan(answers({ room_type: 'alcove', walls: [1000], upper: true }), starter, ids());
  assert.deepEqual(alcove.walls[0]!.units.map((u) => u.template_id), ['alcove-cupboard', 'alcove-shelving']);
});

test('fill: a media wall has a column each side and low units between; a short wall is not framed', () => {
  const [wall] = fillPlan(answers({ room_type: 'media-wall', walls: [3600] }), starter, ids()).walls;
  const columns = wall!.units.filter((u) => u.template_id === 'media-column');
  assert.deepEqual(columns.map((u) => u.x_mm + (u.x_mm ? widthOf(u) : 0)), [0, 3600]);
  assert.ok(wall!.units.some((u) => u.template_id === 'media-base'));
  assert.deepEqual(unitsOffWall({ layout: 'single', height_mm: 2400, walls: [wall!], island: null }, wall!.units.map(widthOf)), []);
  const short = fillPlan(answers({ room_type: 'media-wall', walls: [1200] }), starter, ids()).walls[0]!;
  assert.ok(short.units.every((u) => u.template_id !== 'media-column'));
});

test('plans: shape problems are caught before anything is looked up', () => {
  const plan = fillPlan(answers(), starter, ids());
  assert.match(planShapeProblem({ ...plan, layout: 'U' }, 80)!, /3 wall/);
  assert.match(planShapeProblem({ ...plan, height_mm: 900 }, 80)!, /ceiling/);
  assert.match(planShapeProblem(plan, 2)!, /at most 2/);
  const dup = { ...plan, walls: [{ ...plan.walls[0]!, units: [plan.walls[0]!.units[0]!, plan.walls[0]!.units[0]!] }] };
  assert.match(planShapeProblem(dup, 80)!, /same id/);
  const off = { ...plan, walls: [{ length_mm: 3000, units: [{ ...plan.walls[0]!.units[0]!, x_mm: 2500 }] }] };
  assert.deepEqual(unitsOffWall(off, [1000]), [0]);
  assert.equal(wallLabel(plan, 0), 'Wall A');
  assert.equal(wallLabel(plan, 1), 'Island');
});
