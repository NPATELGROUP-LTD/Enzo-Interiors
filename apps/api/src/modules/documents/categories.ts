import { BadRequestException } from '@nestjs/common';

import { DOCUMENT_TYPES } from '../../common/types/domain';

export const MAX_CATEGORIES = 30;
const MAX_NAME = 40;

/** What was saved (site_settings.document_categories), else the document types. Computed on read. */
export function resolveCategories(stored: unknown): string[] {
  return Array.isArray(stored) && stored.length > 0 ? (stored as string[]) : [...DOCUMENT_TYPES];
}

/** The label a document shows: its category, else its type (older rows have no category). */
export const categoryOf = (document: { category?: string | null; type: string }): string => document.category ?? document.type;

/** The Admin's new list, checked: 1 to 30 distinct names of up to 40 characters. */
export function parseCategories(input: unknown): string[] {
  if (!Array.isArray(input) || input.length < 1 || input.length > MAX_CATEGORIES) {
    throw new BadRequestException(`Keep between 1 and ${MAX_CATEGORIES} categories.`);
  }
  const seen = new Set<string>();
  return input.map((raw: unknown, index) => {
    const name = typeof raw === 'string' ? raw.trim() : '';
    if (!name) throw new BadRequestException(`Category ${index + 1} needs a name.`);
    if (name.length > MAX_NAME) throw new BadRequestException(`"${name.slice(0, MAX_NAME)}…" is too long (${MAX_NAME} characters at most).`);
    if (seen.has(name.toLowerCase())) throw new BadRequestException(`There are two categories called "${name}".`);
    seen.add(name.toLowerCase());
    return name;
  });
}
