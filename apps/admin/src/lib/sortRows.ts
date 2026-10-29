export type SortValue = string | number | null | undefined;

const empty = (value: SortValue) => value === null || value === undefined || value === '';

/**
 * The rows ordered by `read(row)`: numbers as numbers, text without regard to case or accents (and
 * "INV-10" after "INV-9"), empty values always last whichever way it runs, ties in their original order.
 */
export function sortRows<T>(rows: T[], read: (row: T) => SortValue, dir: 'asc' | 'desc'): T[] {
  const sign = dir === 'asc' ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, value: read(row) }))
    .sort((a, b) => {
      if (empty(a.value) || empty(b.value)) return Number(empty(a.value)) - Number(empty(b.value)) || a.index - b.index;
      const order =
        typeof a.value === 'number' && typeof b.value === 'number'
          ? a.value - b.value
          : String(a.value).localeCompare(String(b.value), 'en', { sensitivity: 'base', numeric: true });
      return sign * order || a.index - b.index;
    })
    .map(({ row }) => row);
}
