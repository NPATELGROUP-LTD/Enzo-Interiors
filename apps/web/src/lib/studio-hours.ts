// The workshop's opening hours, in one place.
//
// Two shapes of the same fact, because two things need it and they need it
// differently: the footer prints a grouped table a human reads, and the
// contact page answers "can I ring them right now?" — which needs the hours
// as numbers a clock can be compared against.
//
// Keeping both here rather than typing the times twice is the whole point:
// the two used to be separate literals, and the first time somebody changed
// Friday's split afternoon they would have changed one of them.

/** Minutes past midnight, Europe/London. */
export interface HoursWindow {
  open: number;
  close: number;
}

const at = (hour: number, minute = 0) => hour * 60 + minute;

/** Keyed by JS day index — 0 is Sunday. An empty array is a closed day. */
export const STUDIO_HOURS: Record<number, HoursWindow[]> = {
  0: [],
  1: [],
  2: [{ open: at(10), close: at(17) }],
  3: [{ open: at(10), close: at(17) }],
  4: [{ open: at(10), close: at(17) }],
  // Friday shuts over lunch, which is exactly the case a single
  // open/close pair per day cannot describe.
  5: [
    { open: at(10), close: at(12, 30) },
    { open: at(14, 30), close: at(17) },
  ],
  6: [{ open: at(10), close: at(17) }],
};

/**
 * The printed table. Consecutive identical days are combined (Tue–Thu all
 * read the same and are back-to-back); Saturday matches them too but sits
 * the far side of Friday's split hours, so it stays its own row rather than
 * being grouped across the break.
 */
export const HOURS_ROWS = [
  { day: "Monday", time: "Closed" },
  { day: "Tuesday – Thursday", time: "10:00 – 17:00" },
  { day: "Friday", time: "10:00 – 12:30, 14:30 – 17:00" },
  { day: "Saturday", time: "10:00 – 17:00" },
  { day: "Sunday", time: "Closed" },
] as const;

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function clock(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/**
 * Where the workshop's own clock is, not the visitor's.
 *
 * A joiner in Leicester is shut at 18:00 GMT whether you are reading this
 * in Leicester or in Lisbon, so the comparison is done in Europe/London
 * rather than against the browser's local time.
 */
function londonNow(now: Date): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    day: WEEKDAY_INDEX[value("weekday")] ?? 0,
    // `hour: "2-digit"` with hour12 off reports midnight as "24" in some
    // ICU builds, which would put the clock an hour past the end of the day.
    minutes: (Number(value("hour")) % 24) * 60 + Number(value("minute")),
  };
}

export interface StudioStatus {
  open: boolean;
  /** One short line: "Open until 17:00", "Opens Tuesday 10:00". */
  label: string;
}

/**
 * Whether the workshop is open right now, and the next thing that happens
 * to that answer.
 *
 * Must be called after mount, never during render: it reads a clock, and a
 * server rendering "Opens Tuesday" into HTML a client then hydrates as
 * "Open until 17:00" is a hydration mismatch.
 */
export function getStudioStatus(now: Date = new Date()): StudioStatus {
  const { day, minutes } = londonNow(now);

  const openWindow = STUDIO_HOURS[day]?.find(
    (window) => minutes >= window.open && minutes < window.close,
  );
  if (openWindow) {
    return { open: true, label: `Open until ${clock(openWindow.close)}` };
  }

  // Later today first, then forward through the week. Seven days covers
  // every case; the eighth would be today again.
  const laterToday = STUDIO_HOURS[day]?.find((window) => window.open > minutes);
  if (laterToday) {
    return { open: false, label: `Opens ${clock(laterToday.open)} today` };
  }

  for (let ahead = 1; ahead <= 7; ahead += 1) {
    const next = (day + ahead) % 7;
    const window = STUDIO_HOURS[next]?.[0];
    if (!window) continue;
    const when = ahead === 1 ? "tomorrow" : DAY_NAMES[next];
    return { open: false, label: `Opens ${when} ${clock(window.open)}` };
  }

  return { open: false, label: "By appointment" };
}
