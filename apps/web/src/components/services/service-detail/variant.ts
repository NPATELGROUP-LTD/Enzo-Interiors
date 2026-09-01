// How a service page picks its design.
//
// Every section of /services/[category] exists in four genuinely different
// layouts, and a page uses the same variant index across all of them. So
// the first published service gets layout 0 of the hero, of "included", of
// the finishes, the process and the investment — and the fourth gets layout
// 3 of each. The four service pages are therefore four different designs
// end to end, not one template with the nouns swapped.
//
// Assignment is by published position rather than by slug, which is what
// keeps this safe for a client-authored CMS: the designs stay evenly spread
// however many services exist, a fifth service starts the cycle again, and
// nobody has to choose anything. `heroVariant` on the record pins a page to
// one design set when someone does want to choose.
//
// Adding a fifth design later means adding one file per section and one
// entry to each section's variant list; nothing else changes.

/**
 * Resolves a section's variant. `override` comes from the service record,
 * `position` is the service's index in the published list — floored,
 * because a slug missing from the list would otherwise make the modulo
 * negative and index off the end of the array.
 */
export function variantIndex(
  position: number,
  count: number,
  override?: number,
): number {
  const requested = override ?? Math.max(0, position);
  return ((requested % count) + count) % count;
}

/** Props every section variant receives, so the pickers stay uniform. */
export interface SectionVariantProps {
  id: string;
}
