// Is the workshop open right now, and if not, when next?
//
// The hours themselves are data, not code: they live on the company record in
// src/data/company.json, in one place, in the form a person would edit them
// ("10:00"). The content layer parses them into minutes (see lib/content) and
// this module answers the only question the site asks of them.
//
// Two shapes of the same fact exist on that record because two surfaces need it
// differently: the footer prints a grouped table a human reads, and the contact
// page answers "can I ring them right now?" — which needs the hours as numbers
// a clock can be compared against.
import { fill, type StudioHours } from "@/lib/content";

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
export function getStudioStatus(
  hours: StudioHours,
  now: Date = new Date(),
): StudioStatus {
  const { day, minutes } = londonNow(now);
  const labels = hours.status;

  const openWindow = hours.weekly[day]?.find(
    (window) => minutes >= window.open && minutes < window.close,
  );
  if (openWindow) {
    return { open: true, label: fill(labels.openUntil, { time: clock(openWindow.close) }) };
  }

  // Later today first, then forward through the week. Seven days covers
  // every case; the eighth would be today again.
  const laterToday = hours.weekly[day]?.find((window) => window.open > minutes);
  if (laterToday) {
    return {
      open: false,
      label: fill(labels.opensLaterToday, { time: clock(laterToday.open) }),
    };
  }

  for (let ahead = 1; ahead <= 7; ahead += 1) {
    const next = (day + ahead) % 7;
    const window = hours.weekly[next]?.[0];
    if (!window) continue;
    const when = ahead === 1 ? labels.tomorrow : DAY_NAMES[next];
    return {
      open: false,
      label: fill(labels.opensOn, { day: when, time: clock(window.open) }),
    };
  }

  return { open: false, label: labels.byAppointment };
}
