// Facts *derived* from a service record, rather than a second set of facts
// authored beside it.
//
// The /services specification matrix compares services against each other,
// which needs numbers — but the client authors services in the Content
// Manager and will not be filling in a "comparison figures" panel as well.
// So every figure here is computed from fields they already fill in: the
// cheapest tier's `from`, the `timeline` string, and the lengths of the
// `materials` / `features` / `process` / `pricing` arrays. Add a service in
// the Admin app and it lands in the matrix with correct figures and no
// further authoring.
//
// Everything is total: a service with no pricing tiers, an unparseable
// timeline or an empty materials list still returns a usable record, so an
// in-progress draft never blows up the public page.
import type { ServiceDetail } from "@/lib/content";

export interface ServiceMetrics {
  /** Cheapest tier's displayed price, e.g. "£1,500". Null when no tiers. */
  fromPriceLabel: string | null;
  /** That same price as a number, for relative bar widths. */
  fromPriceValue: number | null;
  /** The authored lead-time string, e.g. "4-6 weeks". */
  timeline: string;
  /**
   * Upper bound of the lead time in weeks, parsed out of `timeline`. Used
   * only to size a comparison bar — null when the string doesn't contain a
   * number, in which case the bar is simply not drawn.
   */
  leadWeeks: number | null;
  finishes: number;
  included: number;
  stages: number;
  tiers: number;
}

/** Parses a UK currency label like "£4,500" into 4500. Null if unparseable. */
export function parsePriceLabel(label: string): number | null {
  const digits = label.replace(/[^0-9.]/g, "");
  if (!digits) return null;
  const value = Number(digits);
  return Number.isFinite(value) ? value : null;
}

/**
 * Pulls the largest number out of a lead-time string: "4-6 weeks" → 6,
 * "2 weeks" → 2. The upper bound rather than the lower one, because a
 * comparison bar should show the worst case a visitor might plan around.
 */
function parseLeadWeeks(timeline: string): number | null {
  const numbers = timeline.match(/\d+(?:\.\d+)?/g);
  if (!numbers?.length) return null;
  const max = Math.max(...numbers.map(Number));
  return Number.isFinite(max) ? max : null;
}

export function getServiceMetrics(service: ServiceDetail): ServiceMetrics {
  const priced = service.pricing
    .map((tier) => ({ tier, value: parsePriceLabel(tier.from) }))
    .filter((entry): entry is { tier: (typeof service.pricing)[number]; value: number } =>
      entry.value !== null,
    );

  // The cheapest tier, not `pricing[0]` — the client is free to reorder
  // tiers in the Content Manager, and "from" must mean the actual floor.
  const cheapest = priced.length
    ? priced.reduce((min, entry) => (entry.value < min.value ? entry : min))
    : null;

  return {
    fromPriceLabel: cheapest?.tier.from ?? null,
    fromPriceValue: cheapest?.value ?? null,
    timeline: service.timeline,
    leadWeeks: parseLeadWeeks(service.timeline),
    finishes: service.materials.length,
    included: service.features.length,
    stages: service.process.length,
    tiers: service.pricing.length,
  };
}

/**
 * Spells small counts as words ("Four disciplines" reads better than "4
 * disciplines" in a headline) and falls back to the numeral beyond twelve,
 * where the word form starts to fight the line length.
 */
const NUMBER_WORDS = [
  "Zero",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
];

export function spellCount(count: number): string {
  return NUMBER_WORDS[count] ?? String(count);
}
