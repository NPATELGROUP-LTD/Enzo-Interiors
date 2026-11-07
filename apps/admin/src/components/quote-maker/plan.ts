/*
 * Quote maker (Admin), apps/api modules/quote-maker. Types mirror what the API serves; kept here so
 * removing the feature is this folder, pages/QuoteMaker.tsx and its route and menu entries.
 * Pricing is never worked out here: the API prices every design (costs never leave it for visitors).
 */

export const BOARD_ROLES = ['carcass', 'front', 'worktop', 'back'] as const;
export type BoardRole = (typeof BOARD_ROLES)[number];
export const MOUNTS = ['floor', 'wall', 'tall', 'gap'] as const;
export type Mount = (typeof MOUNTS)[number];
export type Layout = 'single' | 'galley' | 'L' | 'U';

export const ROOM_TYPES = [
  { id: 'bedroom', name: 'Bedroom & wardrobes' },
  { id: 'media-wall', name: 'Media wall' },
  { id: 'office', name: 'Home office' },
  { id: 'alcove', name: 'Alcoves & living storage' },
  { id: 'kitchen', name: 'Kitchen' },
] as const;
export const LAYOUTS: Array<{ id: Layout; name: string; walls: number }> = [
  { id: 'single', name: 'One wall', walls: 1 },
  { id: 'galley', name: 'Galley (two facing walls)', walls: 2 },
  { id: 'L', name: 'L-shape', walls: 2 },
  { id: 'U', name: 'U-shape', walls: 3 },
];
export const MOUNT_LABEL: Record<Mount, string> = { floor: 'Floor unit', wall: 'Wall unit', tall: 'Tall unit', gap: 'Appliance gap' };
export const ROLE_LABEL: Record<BoardRole, string> = { carcass: 'Carcass', front: 'Fronts', worktop: 'Worktop', back: 'Backs' };
export const LIMITS = { wall_min: 300, wall_max: 12_000, island_min: 600, island_max: 6_000, height_min: 1_800, height_max: 4_000 };

export interface TemplatePanel {
  id?: string;
  label: string;
  slot: string;
  length_mm: number;
  width_mm: number;
  qty: number;
}
export interface TemplateVariant {
  id?: string;
  width_mm: number;
  height_mm: number;
  depth_mm: number;
  panels: TemplatePanel[];
}
export interface TemplateSlot {
  key: string;
  label: string;
  roles: BoardRole[];
  default_item_id: string | null;
}
export interface TemplateStructure {
  doors: number;
  drawers: number;
  shelves: number;
  back: boolean;
  plinth_mm: number;
  worktop: boolean;
}
export interface UnitTemplate {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  room_types: string[];
  mount: Mount;
  elevation_mm: number;
  structure: TemplateStructure;
  slots: TemplateSlot[];
  variants: Array<TemplateVariant & { id: string }>;
  hardware: Array<{ item_id: string; qty: number }>;
  labour_hours: number;
  labour_extra: number;
  active: boolean;
  position: number;
  updated_by: string | null;
  /** Why it cannot be priced yet (no default board, a switched-off item). */
  problems: string[];
}
export interface Pricing {
  margin_pct: number;
  range_low_pct: number;
  range_high_pct: number;
  kerf_mm: number;
  edge_trim_mm: number;
  round_to: number;
  hourly_rate: number;
  defaults: Partial<Record<BoardRole, string | null>>;
}
/** The inventory item fields the quote maker reads (GET /inventory/items, Admin). */
export interface StockItem {
  id: string;
  sku: string;
  name: string;
  type: 'Sheet' | 'Hardware' | 'Bought-in';
  board_role: BoardRole | null;
  length_mm: number | null;
  width_mm: number | null;
  thickness_mm: number | null;
  swatch: string | null;
  public_name: string | null;
  show_on_site: boolean;
  quote_cost: number | null;
  avg_cost: number;
  active: boolean;
}

export interface PlacedUnit {
  id: string;
  template_id: string;
  variant_id: string;
  x_mm: number;
  finishes?: Record<string, string>;
}
export interface PlanWall {
  length_mm: number;
  units: PlacedUnit[];
}
export interface Plan {
  layout: Layout;
  height_mm: number;
  walls: PlanWall[];
  island: PlanWall | null;
}
export interface DesignSummary {
  id: string;
  ref: string;
  title: string | null;
  room_type: string;
  source: 'web' | 'staff';
  units: number;
  estimate_low: number | null;
  estimate_high: number | null;
  enquiry: { id: string; name: string; email: string; status: string } | null;
  quotes: Array<{ id: string; number: string; status: string }>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
export type Design = DesignSummary & { design: Plan; answers: Record<string, unknown> | null };

export interface Placement {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  rotated?: boolean;
}
export interface Breakdown {
  boards: Array<{
    item_id: string;
    name: string;
    sheets: number;
    cost: number;
    layout: Array<{ placements: Placement[]; used_area: number }>;
    oversize: Array<{ label: string; length_mm: number; width_mm: number; boards: number }>;
  }>;
  hardware: Array<{ item_id: string; name: string; qty: number; cost: number }>;
  labour: { hours: number; cost: number };
  lines: Array<{ key: string; template_id: string; name: string; width_mm: number; cost: number; price: number }>;
  cost: number;
  margin: number;
  net: number;
  vat: number;
  gross: number;
  low: number;
  high: number;
  unpriced: string[];
  warnings: string[];
  vat_rate: number;
  margin_pct: number;
}

/* ----------------------------------------------------------------- helpers */

export const wallCount = (layout: Layout) => LAYOUTS.find((l) => l.id === layout)!.walls;
export const wallLabel = (plan: Pick<Plan, 'walls'>, index: number) =>
  index >= plan.walls.length ? 'Island' : `Wall ${String.fromCharCode(65 + index)}`;
/** Every run: the walls, then the island. Index = what wallLabel names. */
export const runs = (plan: Plan): PlanWall[] => [...plan.walls, ...(plan.island ? [plan.island] : [])];
/** Every unit, walls first then the island: the order the API's breakdown lines follow. */
export const planUnits = (plan: Plan) => runs(plan).flatMap((wall) => wall.units);

export const newUnitId = () => `u-${crypto.randomUUID().slice(0, 12)}`;

/** The plan for a new layout: walls kept where they still exist, new ones 3 m and empty. */
export function withLayout(plan: Plan, layout: Layout): Plan {
  const walls = Array.from({ length: wallCount(layout) }, (_, i) => plan.walls[i] ?? { length_mm: 3000, units: [] });
  return { ...plan, layout, walls };
}

/** Units that share the run's vertical band with `mount` (a wall unit never blocks a floor unit). */
const band = (mount: Mount): Mount[] => (mount === 'wall' ? ['wall', 'tall'] : ['floor', 'tall', 'gap']);

/** Where a unit `width` wide can sit on the run: x clamped to the wall, then snapped to 10 mm. */
export const clampX = (x: number, width: number, length: number) =>
  Math.max(0, Math.min(Math.round(x / 10) * 10, Math.max(0, length - width)));

/**
 * The first x from the left where a unit `width` wide fits between the units already in its band,
 * or null when the run is full. `others` are [x, width, mount] of the units on the run.
 */
export function firstFree(others: Array<[number, number, Mount]>, width: number, mount: Mount, length: number): number | null {
  const taken = others.filter(([, , m]) => band(mount).includes(m)).sort((a, b) => a[0] - b[0]);
  let x = 0;
  for (const [start, w] of taken) {
    if (start - x >= width) return x;
    x = Math.max(x, start + w);
  }
  return length - x >= width ? x : null;
}

/** Units on a run that overlap another in their band (shown in red; the API only checks the wall). */
export function overlaps(units: Array<{ id: string; x: number; w: number; mount: Mount }>): Set<string> {
  const out = new Set<string>();
  for (const a of units)
    for (const b of units)
      if (a.id < b.id && band(a.mount).includes(b.mount) && a.x < b.x + b.w && b.x < a.x + a.w) {
        out.add(a.id);
        out.add(b.id);
      }
  return out;
}

/** The bottom of a unit above the floor, mm. */
export const bottomOf = (template: Pick<UnitTemplate, 'mount' | 'elevation_mm'>) => (template.mount === 'wall' ? template.elevation_mm : 0);
