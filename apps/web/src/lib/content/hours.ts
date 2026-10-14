import type { HoursRow } from "./types";

/** Opening hours as Settings stores them, keyed by "monday" … "sunday". */
export interface OpeningHoursSetting {
  weekly: Record<string, Array<{ open: string; close: string }>>;
  notes: Record<string, string>;
  note: string;
}

const WEEK = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

/**
 * The printed list: Monday first, and runs of days with the same hours and no
 * note of their own folded into one row ("Tuesday – Thursday").
 */
export function hoursRows(hours: OpeningHoursSetting, closedLabel: string): HoursRow[] {
  const name = (day: string) => day[0]!.toUpperCase() + day.slice(1);
  const time = (day: string) => {
    const windows = hours.weekly[day] ?? [];
    return windows.length ? windows.map((w) => `${w.open} – ${w.close}`).join(", ") : closedLabel;
  };
  const runs: Array<{ first: string; last: string; time: string; note?: string }> = [];
  for (const day of WEEK) {
    const note = hours.notes[day]?.trim() || undefined;
    const previous = runs[runs.length - 1];
    if (previous && !previous.note && !note && previous.time === time(day)) previous.last = day;
    else runs.push({ first: day, last: day, time: time(day), note });
  }
  return runs.map(({ first, last, time: at, note }) => ({
    day: first === last ? name(first) : `${name(first)} – ${name(last)}`,
    time: at,
    ...(note ? { note } : {}),
  }));
}
