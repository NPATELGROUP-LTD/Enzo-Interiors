/**
 * `edited` over `shipped`, recursing into objects but never into arrays —
 * the same rule as the importer's addMissing (apps/api/scripts/import-content.ts).
 * A key added to src/data renders from the shipped copy until the next import
 * gives the CMS its own; without this, a component reading it gets undefined.
 */
export function withShipped<T>(shipped: T, edited: unknown): T {
  const isObject = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v);
  if (!isObject(shipped) || !isObject(edited)) return (edited ?? shipped) as T;
  const out: Record<string, unknown> = { ...shipped };
  for (const [key, value] of Object.entries(edited)) out[key] = withShipped(shipped[key], value);
  return out as T;
}
