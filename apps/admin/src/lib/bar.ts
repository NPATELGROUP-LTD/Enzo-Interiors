/**
 * Which pages the phone's bottom bar shows at a width, and which go under More.
 * A slot is at least 64px wide (icon, label and a 44px target with room to
 * spare) and there are never more than eight, so the icons are neither cramped
 * on a small phone nor spread thin on a tablet. More takes a slot of its own
 * only when something is left over. apps/portal has an identical copy.
 */
export function barSplit<T>(pages: T[], width: number): { shown: T[]; more: T[] } {
  const slots = Math.max(3, Math.min(8, Math.floor(width / 64)));
  if (pages.length <= slots) return { shown: pages, more: [] };
  return { shown: pages.slice(0, slots - 1), more: pages.slice(slots - 1) };
}
