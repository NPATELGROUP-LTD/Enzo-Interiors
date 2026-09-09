// Instant-estimate calculator for the Service Detail page's Pricing section.
//
// Per docs/Enzo_Interiors_App_Flow_v4.md: "selecting a room size/tier triggers
// a real-time (<200ms) price range" that feeds into the "Get a Free Quote"
// modal. There's no `apps/api` yet (see docs/architecture.md's reference to a
// future `POST /quotes/estimate` endpoint), so this is a pure, synchronous,
// framework-agnostic stand-in: no React imports, and the function signature
// mirrors what that endpoint would eventually accept/return so swapping this
// out for a real `fetch("/quotes/estimate", { method: "POST", body: ... })`
// later is a drop-in change at the call site.
//
// Base prices are NOT invented here — they're parsed at call time from the
// same `pricing[].from` strings already authored in
// `src/lib/content/services.ts` (e.g. "£4,500"), so this module never
// duplicates/hardcodes a second copy of those figures.

import { parsePriceLabel } from "@/lib/service-metrics";

export type RoomSize = "small" | "medium" | "large";

/**
 * Room-size multipliers applied to a tier's "from " price to produce a
 * low-high range. Chosen so that:
 *  - "small" projects can land at or slightly below the advertised "from "
 *    price (a smaller-than-typical room costing less than the headline figure),
 *  - "medium" (the assumed baseline the "from " price was written for) brackets
 *    the base price itself, skewed slightly upward (rooms are rarely *exactly*
 *    the minimum spec),
 *  - "large" projects scale up substantially, reflecting more cabinetry/units/
 *    materials for a bigger space.
 * These are intentionally simple linear multipliers, not a real costing
 * model — good enough for an indicative instant range, not a firm quote.
 */
const ROOM_SIZE_MULTIPLIERS: Record<RoomSize, { low: number; high: number }> = {
  small: { low: 0.85, high: 1.1 },
  medium: { low: 1.0, high: 1.35 },
  large: { low: 1.3, high: 1.8 },
};

/**
 * Computes an instant low-high estimate range for a given category/tier/room
 * size combination. Pure and synchronous (no network, no React) so it
 * resolves in well under the <200ms budget from
 * docs/Enzo_Interiors_App_Flow_v4.md.
 *
 * Returns null when the base price can't be parsed (defensive — callers
 * should always pass a real `pricing[].from` value from data.ts, but this
 * keeps the function total rather than throwing).
 */
export function estimateQuote(input: {
  /** Service category slug, e.g. "kitchens" — matches `getServiceSlugs()`. */
  category: string;
  /** Pricing tier name for that category, e.g. "Essential" | "Premium" | "Luxury". */
  tier: string;
  /** The tier's displayed starting price, e.g. "£4,500" (from `pricing[].from`). */
  basePriceLabel: string;
  roomSize: RoomSize;
}): { low: number; high: number } | null {
  const basePrice = parsePriceLabel(input.basePriceLabel);
  if (basePrice === null) return null;

  const multiplier = ROOM_SIZE_MULTIPLIERS[input.roomSize];
  if (!multiplier) return null;

  const low = Math.round((basePrice * multiplier.low) / 50) * 50;
  const high = Math.round((basePrice * multiplier.high) / 50) * 50;

  return { low, high };
}

export const ROOM_SIZE_LABELS: Record<RoomSize, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
};

export const ROOM_SIZES: RoomSize[] = ["small", "medium", "large"];
