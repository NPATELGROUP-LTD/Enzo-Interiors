import type {
  BoardRole,
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
