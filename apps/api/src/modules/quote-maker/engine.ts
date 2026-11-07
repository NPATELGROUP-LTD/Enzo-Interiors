import type {
  BoardRole,
  Layout,
  PlacedUnit,
  Plan,
  PlanWall,
  QuotePricing,
  TemplatePanel,
  TemplateSlot,
  TemplateStructure,
  TemplateVariant,
  UnitTemplate,
} from '../../data/quote-maker-store';

/*
 * The quote maker's maths, ported from the prototype (commit db1a682, apps/quote-builder/src/lib).
 * Pure: no database, no Nest. Pence (integers) inside, £ out.
 *
 * Rules the owner set:
 *   - A board is charged whole, even when only a strip of it is used.
 *   - Pieces of the same board share sheets across the whole room, not just within one unit.
 *   - Price = (boards + hardware + labour) marked up by the margin; VAT on top; the range is rounded.
 */

export const ROOM_TYPES = [
  { id: 'bedroom', name: 'Bedroom & wardrobes' },
  { id: 'media-wall', name: 'Media wall' },
  { id: 'office', name: 'Home office' },
  { id: 'alcove', name: 'Alcoves & living storage' },
  { id: 'kitchen', name: 'Kitchen' },
] as const;
export const ROOM_TYPE_IDS = ROOM_TYPES.map((room) => room.id);

/** Above this a design is refused before nesting, so one request cannot tie the API up. */
export const MAX_PIECES = 3000;

/** An inventory item as the engine needs it. cost is £ per sheet / per each: quote_cost, else avg_cost. */
export interface PriceItem {
  id: string;
  name: string;
  board_role: BoardRole | null;
  length_mm: number | null;
  width_mm: number | null;
  grain: boolean;
  active: boolean;
  show_on_site: boolean;
  cost: number;
}

/** One unit as posted: which template, which size, and the finish picked per slot (item id). */
export interface DesignUnit {
  template_id: string;
  variant_id: string;
  finishes?: Record<string, string>;
}

export interface ResolvedUnit {
  key: string;
  template: UnitTemplate;
  variant: TemplateVariant;
  /** slot key -> the board its panels are cut from */
  boards: Record<string, PriceItem>;
}

const pence = (pounds: number) => Math.round(pounds * 100);
const pounds = (p: number) => Math.round(p) / 100;

/* ---------------------------------------------------------------- nesting */

// A guillotine packer: every cut runs edge to edge across whatever part of the sheet it is made in,
// which is how a panel saw works. Pieces go largest-first into the free rectangle they fit most
// snugly (best short-side fit), across every sheet already opened, before a new sheet is started.
// An estimate of a cutting plan, not an optimiser: good enough to price from, and deterministic.
// Sheet coordinates: x runs along the board's length, y along its width.

export interface Piece {
  key: string;
  label: string;
  length_mm: number;
  width_mm: number;
  /** The unit this piece belongs to, for the per-unit price share. */
  owner: string;
}

export interface Placement {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
}

export interface NestResult {
  sheets: Array<{ placements: Placement[]; used_area: number }>;
  /** Pieces bigger than a sheet, and the boards charged to make each up with joints. */
  oversize: Array<{ label: string; length_mm: number; width_mm: number; boards: number }>;
  boards_charged: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function turns(piece: Piece, grain: boolean) {
  const along = { w: piece.length_mm, h: piece.width_mm, rotated: false };
  if (grain || piece.length_mm === piece.width_mm) return [along];
  return [along, { w: piece.width_mm, h: piece.length_mm, rotated: true }];
}

function split(rect: Rect, w: number, h: number, kerf: number): Rect[] {
  const rightW = rect.w - w - kerf;
  const belowH = rect.h - h - kerf;
  // The full-length strip goes to the larger leftover, so one generous offcut survives, not two narrow ones.
  const horizontalFirst = rect.w * belowH >= rect.h * rightW;
  const out: Rect[] = [];
  if (horizontalFirst) {
    if (rightW > 0) out.push({ x: rect.x + w + kerf, y: rect.y, w: rightW, h });
    if (belowH > 0) out.push({ x: rect.x, y: rect.y + h + kerf, w: rect.w, h: belowH });
  } else {
    if (rightW > 0) out.push({ x: rect.x + w + kerf, y: rect.y, w: rightW, h: rect.h });
    if (belowH > 0) out.push({ x: rect.x, y: rect.y + h + kerf, w, h: belowH });
  }
  return out;
}

export function nestPieces(
  pieces: Piece[],
  sheet: { length_mm: number; width_mm: number; grain: boolean },
  options: { kerf_mm: number; edge_trim_mm: number },
): NestResult {
  const trim = Math.max(0, options.edge_trim_mm);
  const kerf = Math.max(0, options.kerf_mm);
  const usableL = sheet.length_mm - 2 * trim;
  const usableW = sheet.width_mm - 2 * trim;
  const sorted = [...pieces].sort(
    (a, b) =>
      Math.max(b.length_mm, b.width_mm) - Math.max(a.length_mm, a.width_mm) ||
      b.length_mm * b.width_mm - a.length_mm * a.width_mm ||
      a.key.localeCompare(b.key),
  );
  const sheets: Array<{ placements: Placement[]; used_area: number; free: Rect[] }> = [];
  const oversize: NestResult['oversize'] = [];

  for (const piece of sorted) {
    const ways = turns(piece, sheet.grain);
    if (!ways.some((o) => o.w <= usableL && o.h <= usableW)) {
      const boards = Math.min(
        ...ways.map((o) => Math.ceil(o.w / Math.max(usableL, 1)) * Math.ceil(o.h / Math.max(usableW, 1))),
      );
      oversize.push({ label: piece.label, length_mm: piece.length_mm, width_mm: piece.width_mm, boards });
      continue;
    }
    let best: { sheet: (typeof sheets)[number]; rect: Rect; o: (typeof ways)[number]; score: number } | null = null;
    for (const candidate of sheets) {
      for (const rect of candidate.free) {
        for (const o of ways) {
          if (o.w > rect.w || o.h > rect.h) continue;
          const score = Math.min(rect.w - o.w, rect.h - o.h);
          if (!best || score < best.score) best = { sheet: candidate, rect, o, score };
        }
      }
    }
    if (!best) {
      const rect: Rect = { x: trim, y: trim, w: usableL, h: usableW };
      const fresh = { placements: [] as Placement[], used_area: 0, free: [rect] };
      sheets.push(fresh);
      best = { sheet: fresh, rect, o: ways.find((o) => o.w <= rect.w && o.h <= rect.h)!, score: 0 };
    }
    const { sheet: target, rect, o } = best;
    target.placements.push({ label: piece.label, x: rect.x, y: rect.y, w: o.w, h: o.h, rotated: o.rotated });
    target.used_area += o.w * o.h;
    target.free = target.free.filter((f) => f !== rect).concat(split(rect, o.w, o.h, kerf));
  }

  return {
    sheets: sheets.map(({ placements, used_area }) => ({ placements, used_area })),
    oversize,
    boards_charged: sheets.length + oversize.reduce((sum, o) => sum + o.boards, 0),
  };
}

/* ----------------------------------------------------------- panel recipe */

/** Nominal board thickness the standard cut-list is drawn around. */
const T = 18;
/** Gap around and between doors and drawer fronts. */
const FRONT_GAP = 3;
const WORKTOP_OVERHANG = 20;
const SHELF_SETBACK = 20;
const DRAWER_LINE_MM = 170;

/** Doors per unit: never more than the structure asks for, one per 600 mm of width. */
export const doorCount = (structure: TemplateStructure, width_mm: number) =>
  structure.doors <= 0 ? 0 : Math.max(1, Math.min(structure.doors, Math.ceil(width_mm / 600)));

/**
 * The standard cut-list for a box carcass. A starting point only: the panels saved on a size are
 * what is priced, and the Admin may change them. Fronts, plinths and end panels are cut from
 * `front`, backs from `back`, worktops from `worktop`, all else from `carcass`, when the template has them.
 */
export function generatePanels(
  structure: TemplateStructure,
  size: { width_mm: number; height_mm: number; depth_mm: number },
  slots: Array<Pick<TemplateSlot, 'key'>>,
  idPrefix: string,
): TemplatePanel[] {
  const has = (key: string) => slots.some((slot) => slot.key === key);
  const fallback = has('carcass') ? 'carcass' : (slots[0]?.key ?? 'carcass');
  const slotFor = (kind: 'front' | 'back' | 'worktop' | 'carcass') => (has(kind) ? kind : fallback);
  const W = Math.round(size.width_mm);
  const D = Math.round(size.depth_mm);
  const carcassH = Math.max(T * 3, Math.round(size.height_mm - structure.plinth_mm));
  const innerW = W - 2 * T;
  const panels: TemplatePanel[] = [];
  const add = (kind: 'front' | 'back' | 'worktop' | 'carcass', label: string, length: number, width: number, qty = 1) => {
    if (qty <= 0 || length <= 0 || width <= 0) return;
    panels.push({ id: `${idPrefix}-${panels.length}`, label, slot: slotFor(kind), length_mm: Math.round(length), width_mm: Math.round(width), qty });
  };

  add('carcass', 'Side', carcassH, D, 2);
  add('carcass', 'Top', innerW, D);
  add('carcass', 'Bottom', innerW, D);
  if (structure.back) add('back', 'Back', carcassH - 2 * T, innerW);
  add('carcass', 'Shelf', innerW, D - SHELF_SETBACK - (structure.back ? T : 0), structure.shelves);

  const doors = doorCount(structure, W);
  const drawers = Math.max(0, structure.drawers);
  const drawerH = drawers === 0 ? 0 : doors > 0 ? DRAWER_LINE_MM : Math.floor((carcassH - FRONT_GAP * (drawers + 1)) / drawers);
  add('front', 'Drawer front', W - 2 * FRONT_GAP, drawerH, drawers);
  if (doors > 0) {
    const doorH = carcassH - FRONT_GAP - drawers * (drawerH + FRONT_GAP) - FRONT_GAP;
    const doorW = (W - 2 * FRONT_GAP - FRONT_GAP * (doors - 1)) / doors;
    // Door length runs up the door, so a grained front keeps a vertical grain.
    add('front', 'Door', doorH, doorW, doors);
  }
  if (structure.plinth_mm > 0) add('front', 'Plinth', W, structure.plinth_mm);
  if (structure.worktop) add('worktop', 'Worktop', W, D + WORKTOP_OVERHANG);
  return panels;
}

/* -------------------------------------------------------------- resolving */

const isBoard = (item: PriceItem | undefined, roles: readonly BoardRole[]): item is PriceItem =>
  !!item && item.active && !!item.board_role && roles.includes(item.board_role) && !!item.length_mm && !!item.width_mm;

/**
 * The board a slot falls back to when nobody picks one: the slot's own default if it has one
 * (which must be usable: a switched-off default makes the unit unavailable, never a silent swap),
 * else the pricing settings' default for the first role that has one.
 */
export function slotDefault(slot: TemplateSlot, items: Map<string, PriceItem>, pricing: QuotePricing): PriceItem | undefined {
  if (slot.default_item_id) {
    const own = items.get(slot.default_item_id);
    return isBoard(own, slot.roles) ? own : undefined;
  }
  for (const role of slot.roles) {
    const item = items.get(pricing.defaults[role] ?? '');
    if (isBoard(item, [role])) return item;
  }
  return undefined;
}

/** Why a template cannot be priced right now; empty = it can. Shown in the Unit library, and hides it from visitors. */
export function templateProblems(template: UnitTemplate, items: Map<string, PriceItem>, pricing: QuotePricing): string[] {
  const out: string[] = [];
  if (!template.variants.length) out.push('Add at least one size.');
  const used = new Set(template.variants.flatMap((variant) => variant.panels.map((panel) => panel.slot)));
  for (const slot of template.slots) {
    if (!used.has(slot.key) || slotDefault(slot, items, pricing)) continue;
    out.push(
      slot.default_item_id
        ? `${slot.label}: its default board is switched off or no longer a ${slot.roles.join('/')} board with a size.`
        : `${slot.label}: choose a default board here or in Pricing settings.`,
    );
  }
  for (const line of template.hardware) {
    if (!items.get(line.item_id)?.active) out.push('A hardware item is switched off or deleted.');
  }
  return out;
}

/**
 * One posted unit made concrete, or why it cannot be. publicOnly: the finishes a visitor may pick
 * are the items ticked "show on website"; staff may pick any active board of the slot's role.
 */
export function resolveUnit(
  unit: DesignUnit,
  key: string,
  template: UnitTemplate | undefined,
  items: Map<string, PriceItem>,
  pricing: QuotePricing,
  publicOnly: boolean,
): ResolvedUnit | string {
  if (!template || (publicOnly && !template.active)) return 'A unit in this design is no longer offered.';
  const variant = template.variants.find((v) => v.id === unit.variant_id);
  if (!variant) return `${template.name}: that size is no longer offered.`;
  if (templateProblems(template, items, pricing).length) return `${template.name} is not available right now.`;
  const boards: Record<string, PriceItem> = {};
  for (const slot of template.slots) {
    const chosen = unit.finishes?.[slot.key];
    const item = chosen ? items.get(chosen) : slotDefault(slot, items, pricing);
    if (chosen && !(isBoard(item, slot.roles) && (!publicOnly || item.show_on_site)))
      return `${template.name}: that ${slot.label.toLowerCase()} finish is not offered.`;
    if (item) boards[slot.key] = item;
  }
  return { key, template, variant, boards };
}

/* ---------------------------------------------------------------- pricing */

export interface Breakdown {
  boards: Array<{ item_id: string; name: string; sheets: number; cost: number; layout: NestResult['sheets']; oversize: NestResult['oversize'] }>;
  hardware: Array<{ item_id: string; name: string; qty: number; cost: number }>;
  labour: { hours: number; cost: number };
  /** One per unit; their prices add back up to `net` (to within a penny a unit). */
  lines: Array<{ key: string; template_id: string; name: string; width_mm: number; cost: number; price: number }>;
  cost: number;
  margin: number;
  net: number;
  vat: number;
  gross: number;
  low: number;
  high: number;
  /** Items used that cost £0 (no quote cost, nothing received yet): the figure is not to be trusted. */
  unpriced: string[];
  warnings: string[];
}

export const pieceCount = (units: ResolvedUnit[]) =>
  units.reduce((sum, unit) => sum + unit.variant.panels.reduce((n, panel) => n + panel.qty, 0), 0);

export function priceDesign(units: ResolvedUnit[], items: Map<string, PriceItem>, pricing: QuotePricing, vatRate: number): Breakdown {
  const warnings = new Set<string>();
  const unpriced = new Set<string>();
  const pieces = new Map<string, Piece[]>();
  const hardware = new Map<string, number>();
  const extras = new Map<string, number>(); // unit key -> hardware + labour, pence
  let labourHours = 0;
  let labourPence = 0;
  let hardwarePence = 0;

  for (const unit of units) {
    for (const panel of unit.variant.panels) {
      const board = unit.boards[panel.slot];
      if (!board) continue; // a slot nobody configured cuts nothing; templateProblems reports it
      const list = pieces.get(board.id) ?? [];
      for (let i = 0; i < panel.qty; i += 1)
        list.push({ key: `${unit.key}:${panel.id}:${i}`, label: panel.label, length_mm: panel.length_mm, width_mm: panel.width_mm, owner: unit.key });
      pieces.set(board.id, list);
    }
    let extra = pence(unit.template.labour_hours * pricing.hourly_rate) + pence(unit.template.labour_extra);
    labourHours += unit.template.labour_hours;
    labourPence += extra;
    for (const line of unit.template.hardware) {
      const item = items.get(line.item_id);
      if (!item) continue;
      if (item.cost <= 0) unpriced.add(item.name);
      hardware.set(item.id, (hardware.get(item.id) ?? 0) + line.qty);
      extra += line.qty * pence(item.cost);
      hardwarePence += line.qty * pence(item.cost);
    }
    extras.set(unit.key, (extras.get(unit.key) ?? 0) + extra);
  }

  const boards: Breakdown['boards'] = [];
  const boardShare = new Map<string, number>();
  for (const [itemId, list] of pieces) {
    const board = items.get(itemId)!;
    if (board.cost <= 0) unpriced.add(board.name);
    const nest = nestPieces(list, { length_mm: board.length_mm!, width_mm: board.width_mm!, grain: board.grain }, pricing);
    const cost = nest.boards_charged * pence(board.cost);
    const area = list.reduce((sum, p) => sum + p.length_mm * p.width_mm, 0);
    for (const o of nest.oversize)
      warnings.add(`${o.label} (${o.length_mm} × ${o.width_mm} mm) is larger than a ${board.name} sheet and needs a joint.`);
    // Each unit carries the share of the board cost its pieces take up, so the lines add back up to the total.
    for (const p of list) boardShare.set(p.owner, (boardShare.get(p.owner) ?? 0) + (area ? (p.length_mm * p.width_mm * cost) / area : 0));
    boards.push({ item_id: itemId, name: board.name, sheets: nest.boards_charged, cost, layout: nest.sheets, oversize: nest.oversize });
  }
  boards.sort((a, b) => b.cost - a.cost || a.name.localeCompare(b.name));

  const markup = 1 + pricing.margin_pct / 100;
  const boardsPence = boards.reduce((sum, b) => sum + b.cost, 0);
  const costPence = boardsPence + hardwarePence + labourPence;
  const netPence = Math.round(costPence * markup);
  const vatPence = Math.round((netPence * vatRate) / 100);
  const grossPence = netPence + vatPence;
  const step = Math.max(1, pricing.round_to) * 100;
  const round = (p: number) => Math.round(p / step) * step;

  return {
    boards: boards.map((b) => ({ ...b, cost: pounds(b.cost) })),
    hardware: [...hardware].map(([id, qty]) => {
      const item = items.get(id)!;
      return { item_id: id, name: item.name, qty, cost: pounds(qty * pence(item.cost)) };
    }),
    labour: { hours: Math.round(labourHours * 100) / 100, cost: pounds(labourPence) },
    lines: units.map((unit) => {
      const cost = (boardShare.get(unit.key) ?? 0) + (extras.get(unit.key) ?? 0);
      return { key: unit.key, template_id: unit.template.id, name: unit.template.name, width_mm: unit.variant.width_mm, cost: pounds(cost), price: pounds(cost * markup) };
    }),
    cost: pounds(costPence),
    margin: pounds(netPence - costPence),
    net: pounds(netPence),
    vat: pounds(vatPence),
    gross: pounds(grossPence),
    low: pounds(round(grossPence * (1 - pricing.range_low_pct / 100))),
    high: pounds(round(grossPence * (1 + pricing.range_high_pct / 100))),
    unpriced: [...unpriced],
    warnings: [...warnings],
  };
}

/* ------------------------------------------------------------------ plans */

export const LAYOUTS = ['single', 'galley', 'L', 'U'] as const satisfies readonly Layout[];
/** Walls each layout has. In an L or a U, each wall's left end meets the previous wall's right end. */
export const WALL_COUNT: Record<Layout, number> = { single: 1, galley: 2, L: 2, U: 3 };

/** Bounds a posted plan is held to before anything is looked up. */
export const PLAN_LIMITS = { wall_min: 300, wall_max: 12_000, island_min: 600, island_max: 6_000, height_min: 1_800, height_max: 4_000 };

/** Every unit of a plan, walls first then the island, in the order prices and lines refer to them (by index). */
export const planUnits = (plan: Plan): Array<PlacedUnit & { wall: number }> => [
  ...plan.walls.flatMap((wall, i) => wall.units.map((unit) => ({ ...unit, wall: i }))),
  ...(plan.island?.units ?? []).map((unit) => ({ ...unit, wall: plan.walls.length })),
];

/** "Wall A", "Wall B", ..., "Island": how the editor and the quote lines name a run. */
export const wallLabel = (plan: Pick<Plan, 'walls'>, index: number) =>
  index >= plan.walls.length ? 'Island' : `Wall ${String.fromCharCode(65 + index)}`;

/** Why the plan's shape is wrong (before templates are looked up), or null. */
export function planShapeProblem(plan: Plan, maxUnits: number): string | null {
  if (plan.walls.length !== WALL_COUNT[plan.layout]) return `This layout has ${WALL_COUNT[plan.layout]} wall(s).`;
  const L = PLAN_LIMITS;
  if (plan.height_mm < L.height_min || plan.height_mm > L.height_max) return `The ceiling must be ${L.height_min}–${L.height_max} mm.`;
  if (plan.walls.some((w) => w.length_mm < L.wall_min || w.length_mm > L.wall_max)) return `Each wall must be ${L.wall_min}–${L.wall_max} mm.`;
  if (plan.island && (plan.island.length_mm < L.island_min || plan.island.length_mm > L.island_max))
    return `The island must be ${L.island_min}–${L.island_max} mm.`;
  const units = planUnits(plan);
  if (units.length > maxUnits) return `A design can have at most ${maxUnits} units.`;
  if (new Set(units.map((u) => u.id)).size !== units.length) return 'Two units in this design have the same id.';
  return null;
}

/** Indexes (as planUnits) of the units that do not sit inside their wall, given their widths. */
export function unitsOffWall(plan: Plan, widths: number[]): number[] {
  const lengths = [...plan.walls.map((w) => w.length_mm), plan.island?.length_mm ?? 0];
  return planUnits(plan).flatMap((unit, i) => (unit.x_mm < 0 || unit.x_mm + widths[i]! > lengths[unit.wall]! ? [i] : []));
}

/* ------------------------------------------------------------- questions */

/** What the questions ask. Lengths in mm; finishes are slot key -> item id, applied to every unit that has the slot. */
export interface FillAnswers {
  room_type: string;
  layout: Layout;
  walls: number[];
  height_mm: number;
  island_mm: number | null;
  upper: boolean;
  finishes: Record<string, string>;
  /** Unpriced spaces (appliances) to leave at the start of wall A, as template ids. */
  gaps: string[];
}

/** Bedrooms are lined with wardrobes; every other room starts from its floor units. */
const MAIN_MOUNT: Partial<Record<string, UnitTemplate['mount']>> = { bedroom: 'tall' };

/**
 * The widths that fill a run best: the most wall covered, then the fewest units, widest first.
 * Exact over whole millimetres (a run is at most 12 m and a unit has at most 20 sizes).
 */
export function fillRun(widths: number[], length: number): number[] {
  const L = Math.max(0, Math.floor(length));
  const sizes = [...new Set(widths.filter((w) => Number.isInteger(w) && w > 0 && w <= L))];
  const count = new Int32Array(L + 1).fill(-1); // fewest units that cover exactly i mm, -1 = cannot
  const last = new Int32Array(L + 1);
  count[0] = 0;
  for (let i = 1; i <= L; i += 1)
    for (const w of sizes)
      if (w <= i && count[i - w]! >= 0 && (count[i]! < 0 || count[i - w]! + 1 < count[i]!)) {
        count[i] = count[i - w]! + 1;
        last[i] = w;
      }
  let i = L;
  while (i > 0 && count[i]! < 0) i -= 1;
  const out: number[] = [];
  for (; i > 0; i -= last[i]!) out.push(last[i]!);
  return out.sort((a, b) => b - a);
}

/**
 * The questions turned into a plan to carry on from: the room type's first floor unit (in a bedroom,
 * tall) along every wall, its first wall unit above if asked and it clears the run below, appliance
 * gaps first on wall A. In an L or a U each later wall starts clear of the corner the previous wall
 * owns. `templates` are the ones that may be used, in Unit library order.
 */
export function fillPlan(answers: FillAnswers, templates: UnitTemplate[], newId: () => string): Plan {
  // Units made for this room (it is their first room type) come before ones shared from another.
  const forRoom = templates
    .filter((t) => t.room_types.includes(answers.room_type) && t.variants.length)
    .sort((a, b) => Number(b.room_types[0] === answers.room_type) - Number(a.room_types[0] === answers.room_type));
  const want = MAIN_MOUNT[answers.room_type] ?? 'floor';
  const main = forRoom.find((t) => t.mount === want) ?? forRoom.find((t) => t.mount === 'floor' || t.mount === 'tall');
  const mainTop = main ? Math.max(...main.variants.map((v) => v.height_mm)) : 0;
  const upper = answers.upper ? forRoom.find((t) => t.mount === 'wall' && t.elevation_mm >= mainTop) : undefined;
  const gaps = answers.gaps.flatMap((id) => templates.filter((t) => t.id === id && t.mount === 'gap' && t.variants.length));
  const corner = answers.layout === 'L' || answers.layout === 'U';

  const place = (template: UnitTemplate, variant: TemplateVariant, x_mm: number): PlacedUnit => {
    const finishes = Object.fromEntries(template.slots.flatMap((slot) => (answers.finishes[slot.key] ? [[slot.key, answers.finishes[slot.key]!]] : [])));
    return { id: newId(), template_id: template.id, variant_id: variant.id, x_mm, ...(Object.keys(finishes).length ? { finishes } : {}) };
  };
  const run = (template: UnitTemplate | undefined, from: number, to: number): PlacedUnit[] => {
    if (!template || to <= from) return [];
    let x = from;
    return fillRun(template.variants.map((v) => v.width_mm), to - from).map((width) => {
      const unit = place(template, template.variants.find((v) => v.width_mm === width)!, x);
      x += width;
      return unit;
    });
  };
  const depth = (template: UnitTemplate | undefined) => (template ? Math.max(...template.variants.map((v) => v.depth_mm)) : 0);

  const walls = answers.walls.slice(0, WALL_COUNT[answers.layout]).map((length_mm, i): PlanWall => {
    const units: PlacedUnit[] = [];
    let start = corner && i > 0 ? depth(main) : 0;
    if (i === 0)
      for (const gap of gaps) {
        const variant = gap.variants[0]!;
        if (start + variant.width_mm > length_mm) break;
        units.push(place(gap, variant, start));
        start += variant.width_mm;
      }
    units.push(...run(main, start, length_mm), ...run(upper, corner && i > 0 ? depth(upper) : 0, length_mm));
    return { length_mm, units };
  });
  const islandUnit = forRoom.find((t) => t.mount === 'floor');
  const island = answers.island_mm ? { length_mm: answers.island_mm, units: run(islandUnit, 0, answers.island_mm) } : null;
  return { layout: answers.layout, height_mm: answers.height_mm, walls, island };
}
