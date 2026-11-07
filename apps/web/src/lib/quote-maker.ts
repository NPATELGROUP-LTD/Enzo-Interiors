/*
 * The public quote maker's types and calls, mirroring apps/api modules/quote-maker (the catalogue,
 * start, estimate and submit routes). Each app keeps its own copy (house rule). Nothing is priced
 * here: the API prices every design from live inventory and never sends a cost.
 */

import { tooMany } from "@/lib/enquiry";

const API = (process.env.NEXT_PUBLIC_API_PUBLIC_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000").replace(/\/+$/, "");

export type Mount = "floor" | "wall" | "tall" | "gap";
export type Layout = "single" | "galley" | "L" | "U";
export type BoardRole = "carcass" | "front" | "worktop" | "back";

export const LAYOUTS: Array<{ id: Layout; name: string; walls: number }> = [
  { id: "single", name: "One wall", walls: 1 },
  { id: "galley", name: "Galley", walls: 2 },
  { id: "L", name: "L-shape", walls: 2 },
  { id: "U", name: "U-shape", walls: 3 },
];
export const LIMITS = { wall_min: 300, wall_max: 12_000, island_min: 600, island_max: 6_000, height_min: 1_800, height_max: 4_000 };

export interface CatalogueTemplate {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  room_types: string[];
  mount: Mount;
  elevation_mm: number;
  structure: { doors: number; drawers: number; shelves: number; back: boolean; plinth_mm: number; worktop: boolean };
  slots: Array<{ key: string; label: string; roles: BoardRole[]; default_finish_id: string | null; default_swatch: string | null }>;
  variants: Array<{ id: string; width_mm: number; height_mm: number; depth_mm: number }>;
}
export interface Finish {
  id: string;
  name: string;
  role: BoardRole;
  swatch: string | null;
  image: string | null;
  grain: boolean;
  thickness_mm: number | null;
}
export interface Catalogue {
  room_types: Array<{ id: string; name: string }>;
  templates: CatalogueTemplate[];
  finishes: Finish[];
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
export interface Answers {
  room_type: string;
  layout: Layout;
  walls: number[];
  height_mm: number;
  island_mm?: number | null;
  upper: boolean;
  finishes?: Record<string, string>;
  gaps?: string[];
}
export interface Estimate {
  priced: boolean;
  low: number | null;
  high: number | null;
}

/* ----------------------------------------------------------------- helpers */

export const wallCount = (layout: Layout) => LAYOUTS.find((l) => l.id === layout)!.walls;
export const wallLabel = (plan: Pick<Plan, "walls">, index: number) =>
  index >= plan.walls.length ? "Island" : `Wall ${String.fromCharCode(65 + index)}`;
export const runs = (plan: Plan): PlanWall[] => [...plan.walls, ...(plan.island ? [plan.island] : [])];
export const planUnits = (plan: Plan) => runs(plan).flatMap((wall) => wall.units);
export const newUnitId = () => `u-${crypto.randomUUID().slice(0, 12)}`;
export const gbp = (n: number) => `£${n.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;

/** The plan for a new layout: walls kept where they still exist, new ones 3 m and empty. */
export function withLayout(plan: Plan, layout: Layout): Plan {
  const walls = Array.from({ length: wallCount(layout) }, (_, i) => plan.walls[i] ?? { length_mm: 3000, units: [] });
  return { ...plan, layout, walls };
}

const band = (mount: Mount): Mount[] => (mount === "wall" ? ["wall", "tall"] : ["floor", "tall", "gap"]);

export const clampX = (x: number, width: number, length: number) =>
  Math.max(0, Math.min(Math.round(x / 10) * 10, Math.max(0, length - width)));

/** The first x from the left where a unit fits between the units already in its band, or null. */
export function firstFree(others: Array<[number, number, Mount]>, width: number, mount: Mount, length: number): number | null {
  const taken = others.filter(([, , m]) => band(mount).includes(m)).sort((a, b) => a[0] - b[0]);
  let x = 0;
  for (const [start, w] of taken) {
    if (start - x >= width) return x;
    x = Math.max(x, start + w);
  }
  return length - x >= width ? x : null;
}

/** Units on a run that overlap another in their band (shown in red). */
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

export const bottomOf = (template: Pick<CatalogueTemplate, "mount" | "elevation_mm">) => (template.mount === "wall" ? template.elevation_mm : 0);

/** A unit's front colour: its chosen front finish, else the slot's default swatch. */
export function frontColour(unit: PlacedUnit, template: CatalogueTemplate, finishes: Map<string, Finish>): string | null {
  const slot = template.slots.find((s) => s.roles.includes("front")) ?? template.slots[0];
  if (!slot) return null;
  const chosen = unit.finishes?.[slot.key];
  return (chosen ? finishes.get(chosen)?.swatch : null) ?? slot.default_swatch;
}

/* -------------------------------------------------------------------- calls */

async function send<T>(method: "GET" | "POST", path: string, body: unknown, fallback: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}/quote-maker/${path}`, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new Error(fallback);
  }
  if (res.status === 429) throw new Error(await tooMany(res, fallback));
  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  if (!res.ok) {
    // A 400 says what is wrong with the design ("does not fit on Wall A"); anything else is ours.
    const message = res.status === 400 ? [json?.message].flat()[0] : null;
    throw new Error(typeof message === "string" ? message : fallback);
  }
  return json as T;
}

export const loadCatalogue = () => send<Catalogue>("GET", "catalogue", undefined, "The quote maker could not load. Please try again.");
export const startPlan = (answers: Answers) => send<Plan>("POST", "start", answers, "We could not set up your room. Please try again.");

export const estimate = (plan: Plan, signal?: AbortSignal) =>
  send<Estimate>(
    "POST",
    "estimate",
    { units: planUnits(plan).map(({ template_id, variant_id, finishes }) => ({ template_id, variant_id, ...(finishes ? { finishes } : {}) })) },
    "We could not price this just now.",
    signal,
  );

export interface Contact {
  name: string;
  email: string;
  phone: string;
  message: string;
  website: string;
}

export const submitDesign = (room_type: string, design: Plan, answers: Answers | null, contact: Contact) =>
  send<Estimate | undefined>(
    "POST",
    "submit",
    {
      room_type,
      design,
      ...(answers ? { answers } : {}),
      name: contact.name.trim(),
      email: contact.email.trim(),
      phone: contact.phone.trim() || undefined,
      message: contact.message.trim() || undefined,
      website: contact.website || undefined,
    },
    "Your design did not send. Please try again, or call us.",
  );
