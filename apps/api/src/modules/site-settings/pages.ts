import { BadRequestException } from '@nestjs/common';

import { PAGE_KEYS, PageKey } from '../../common/types/domain';

/**
 * Until the real content is ready only the home page, contact and the legal
 * pages are on. Computed on read, never written into a row, so changing a
 * default here reaches every database that has not chosen for itself.
 */
export const PAGE_DEFAULTS: Record<PageKey, boolean> = {
  about: false,
  services: false,
  portfolio: false,
  booking: false,
  contact: true,
  privacy: true,
  terms: true,
  cookies: true,
  // The quote maker (/quote and its public API). Off until the owner opens it.
  quote: false,
};

/** Every page's switch: what was saved, else the default. Unknown keys are dropped. */
export function resolvePages(stored: unknown): Record<PageKey, boolean> {
  const saved = (stored && typeof stored === 'object' ? stored : {}) as Record<string, unknown>;
  return Object.fromEntries(
    PAGE_KEYS.map((key) => [key, typeof saved[key] === 'boolean' ? saved[key] : PAGE_DEFAULTS[key]]),
  ) as Record<PageKey, boolean>;
}

/** The admin's partial change: known pages, true or false, nothing else. */
export function parsePages(input: unknown): Partial<Record<PageKey, boolean>> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('Pages must be a list of switches.');
  const out: Partial<Record<PageKey, boolean>> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!(PAGE_KEYS as readonly string[]).includes(key)) throw new BadRequestException(`There is no "${key}" page to switch.`);
    if (typeof value !== 'boolean') throw new BadRequestException(`The ${key} page must be switched on or off.`);
    out[key as PageKey] = value;
  }
  return out;
}
