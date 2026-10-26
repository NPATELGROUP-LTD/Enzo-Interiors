const DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' });
const HOUR = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: 'numeric', hourCycle: 'h23' });

/** The date (YYYY-MM-DD) and hour on the clock in London, which is not UTC for half the year. */
export function londonNow(at: Date): { day: string; hour: number } {
  return { day: DAY.format(at), hour: Number(HOUR.format(at)) };
}
