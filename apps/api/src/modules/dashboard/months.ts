const NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface Bucket {
  month: string;
  label: string;
  value: number;
}

/** The `count` months ending at `ym` ("2026-10"), oldest first, each at zero. */
export function lastMonths(ym: string, count: number): Bucket[] {
  const [y = 1970, m = 1] = ym.split('-').map(Number);
  return Array.from({ length: count }, (_, i) => {
    const at = new Date(Date.UTC(y, m - 1 - (count - 1 - i), 1));
    return { month: at.toISOString().slice(0, 7), label: NAMES[at.getUTCMonth()]!, value: 0 };
  });
}
