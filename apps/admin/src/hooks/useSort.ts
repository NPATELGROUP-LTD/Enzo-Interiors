import { useMemo, useState } from 'react';

import { sortRows, type SortValue } from '@/lib/sortRows';

export interface SortHeader {
  active: boolean;
  dir: 'asc' | 'desc';
  onSort: () => void;
}

/**
 * Click-to-sort for a table's rows. `by` names each sortable column and reads its value from a row;
 * `header(key)` is what a <Th sort={…}> takes. Click once for ascending, again for descending, a
 * third time to go back to the original order.
 */
export function useSort<T>(rows: T[], by: Record<string, (row: T) => SortValue>) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);

  const sorted = useMemo(() => {
    const read = sort && by[sort.key];
    return sort && read ? sortRows(rows, read, sort.dir) : rows;
    // `by` is written inline at the call site, so it is not a dependency; the rows and the choice are.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort]);

  const header = (key: string): SortHeader => ({
    active: sort?.key === key,
    dir: sort?.key === key ? sort.dir : 'asc',
    onSort: () =>
      setSort((current) => (current?.key !== key ? { key, dir: 'asc' } : current.dir === 'asc' ? { key, dir: 'desc' } : null)),
  });

  return { rows: sorted, header };
}
