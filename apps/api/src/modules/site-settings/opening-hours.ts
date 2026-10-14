import { BadRequestException } from '@nestjs/common';

import { OpeningHours } from '../../common/types/domain';
import { WEEKDAYS, toMinutes } from '../booking/slots';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_WINDOWS = 3;
export const DAY_NOTE_MAX = 120;
export const NOTE_MAX = 300;

const cap = (day: string) => day[0]!.toUpperCase() + day.slice(1);

function time(value: unknown, day: string): string {
  if (typeof value !== 'string' || !TIME.test(value)) {
    throw new BadRequestException(`${day}'s times must look like 09:30.`);
  }
  return value;
}

function text(value: unknown, label: string, max: number): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new BadRequestException(`${label} must be text.`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new BadRequestException(`${label} is too long (${max} characters at most).`);
  return trimmed;
}

/**
 * The admin's opening hours, checked with messages a person can act on and
 * rebuilt from scratch so nothing unexpected is ever stored.
 */
export function parseOpeningHours(input: unknown): OpeningHours {
  if (!input || typeof input !== 'object') throw new BadRequestException('Opening hours are missing.');
  const raw = input as Record<string, unknown>;
  const weekly = (raw.weekly ?? {}) as Record<string, unknown>;
  const notes = (raw.notes ?? {}) as Record<string, unknown>;
  const out: OpeningHours = { weekly: {}, notes: {}, note: text(raw.note, 'The note under the hours', NOTE_MAX) };

  for (const day of WEEKDAYS) {
    const name = cap(day);
    const list = weekly[day] ?? [];
    if (!Array.isArray(list) || list.length > MAX_WINDOWS) {
      throw new BadRequestException(`${name} can have up to ${MAX_WINDOWS} opening times.`);
    }
    const windows = list
      .map((item: { open?: unknown; close?: unknown } | null) => {
        const open = time(item?.open, name);
        const close = time(item?.close, name);
        if (toMinutes(close) <= toMinutes(open)) throw new BadRequestException(`${name} closes before it opens.`);
        return { open, close };
      })
      .sort((a, b) => toMinutes(a.open) - toMinutes(b.open));
    for (let i = 1; i < windows.length; i += 1) {
      if (toMinutes(windows[i]!.open) < toMinutes(windows[i - 1]!.close)) {
        throw new BadRequestException(`${name}'s opening times overlap.`);
      }
    }
    out.weekly[day] = windows;
    const note = text(notes[day], `${name}'s note`, DAY_NOTE_MAX);
    if (note) out.notes[day] = note;
  }
  return out;
}

/**
 * What Settings shows before anyone has saved opening hours: the hours the
 * company record already carries, so the page starts from the truth.
 */
export function fromCompany(company: Record<string, unknown> | null | undefined): OpeningHours {
  const hours = (company?.hours ?? {}) as { weekly?: unknown; note?: unknown };
  try {
    return parseOpeningHours({ weekly: hours.weekly, notes: {}, note: hours.note });
  } catch {
    return { weekly: Object.fromEntries(WEEKDAYS.map((day) => [day, []])), notes: {}, note: '' };
  }
}
