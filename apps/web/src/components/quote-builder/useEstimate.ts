"use client";

import { useMemo } from "react";
import { computeEstimate, type Estimate, type PricedUnit } from "@/lib/quote-builder/pricing";
import type { Catalogue } from "@/lib/quote-builder/types";

/**
 * Prices a set of units, recomputing only when something that affects the
 * price changes. Moving a unit around the plan does not, so dragging never
 * re-runs the board nesting.
 */
export function useEstimate(units: PricedUnit[], catalogue: Catalogue): Estimate {
  const key = JSON.stringify(units.map((u) => [u.id, u.templateId, u.variantId, u.materials]));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures everything in `units` the price depends on.
  return useMemo(() => computeEstimate(units, catalogue), [key, catalogue]);
}
