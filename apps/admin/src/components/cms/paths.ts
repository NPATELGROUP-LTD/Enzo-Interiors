/**
 * Pure helpers for editing a content body by path.
 *
 * Split out of JsonEditor.tsx so they can be exercised without rendering
 * anything: these are the fiddliest logic in the CMS — an off-by-one in
 * `removeAt` silently deletes the wrong paragraph of a live page — and a
 * component file cannot be run under `node --test`.
 */

export type Path = Array<string | number>;

/** Immutable set-at-path. Arrays stay arrays, objects stay objects. */
export function setIn(root: unknown, path: Path, value: unknown): unknown {
  if (path.length === 0) return value;
  const [head, ...rest] = path;
  // Unreachable given the length check above, but the index signature is
  // `string | number | undefined` and narrowing it here is cheaper than
  // asserting at both use sites below.
  if (head === undefined) return value;

  if (typeof head === 'number') {
    const list = Array.isArray(root) ? [...root] : [];
    list[head] = setIn(list[head], rest, value);
    return list;
  }
  const object = { ...((root as Record<string, unknown>) ?? {}) };
  object[head] = setIn(object[head], rest, value);
  return object;
}

/** Immutable remove-at-path, for dropping one item out of a list. */
export function removeAt(root: unknown, path: Path): unknown {
  if (path.length === 0) return root;
  const last = path[path.length - 1];
  const parentPath = path.slice(0, -1);
  const parent = parentPath.reduce<unknown>(
    (node, key) =>
      typeof key === 'number'
        ? (node as unknown[])?.[key]
        : (node as Record<string, unknown>)?.[key],
    root,
  );

  if (typeof last === 'number' && Array.isArray(parent)) {
    return setIn(
      root,
      parentPath,
      parent.filter((_, index) => index !== last),
    );
  }
  if (typeof last === 'string' && parent && typeof parent === 'object') {
    const { [last]: _dropped, ...rest } = parent as Record<string, unknown>;
    return setIn(root, parentPath, rest);
  }
  return root;
}

/** "navSummary" / "hero_desc" -> "Nav summary". The editor never sees a key. */
export function humanize(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();
  if (!spaced) return key;
  // Tidy the handful of things that would otherwise read badly. The trailing
  // "id" goes because the editor picks a picture or a service from a list and
  // never sees the identifier: "Image", not "Image id".
  return (spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase())
    .replace(/ ids?$/i, '')
    .replace(/\bcta\b/gi, 'CTA')
    .replace(/\bseo\b/gi, 'SEO')
    .replace(/\bfaq(s?)\b/gi, (_, plural: string) => `FAQ${plural}`)
    .replace(/\burl\b/gi, 'URL');
}

/** The pane id for the scalar fields, which have no key of their own. */
export const DETAILS_SECTION = '__details';

/**
 * Splits a page into the panes the editor steps through.
 *
 * A page body is a handful of named sections — `hero`, `process`,
 * `investment` — plus a few loose scalars. Each section gets a pane; the
 * scalars share one "Page details" pane, because fifteen one-line entries in
 * the outline would be a worse map than none.
 *
 * `order` is the order the sections appear on the live page (see guide.ts).
 * It has to be supplied because the content cannot say it: jsonb stores an
 * object's keys by length and then alphabetically, so `home` arrives as hero,
 * work, invite, voices... Sections the guide does not know go last,
 * alphabetically, so a new one still shows up.
 */
export function splitSections(
  body: Record<string, unknown>,
  order: string[] = [],
): { scalars: string[]; sections: string[] } {
  const scalars: string[] = [];
  const sections: string[] = [];
  for (const [key, value] of Object.entries(body)) {
    // null counts as scalar: it renders as an empty text box, not a group.
    if (value !== null && typeof value === 'object') sections.push(key);
    else scalars.push(key);
  }
  const place = (key: string) => {
    const at = order.indexOf(key);
    return at === -1 ? order.length : at;
  };
  return {
    scalars,
    sections: sections.sort((a, b) => place(a) - place(b) || a.localeCompare(b)),
  };
}

/**
 * Keys that read top-down the way the site shows them: the heading before the
 * paragraph under it. Everything else follows, grouped by kind.
 */
const READING_ORDER = [
  'title',
  'name',
  'clientName',
  'q',
  'a',
  'eyebrow',
  'label',
  'heading',
  'headingLead',
  'headingAccent',
  'headingLines',
  'lines',
  'lead',
  'accent',
  'tail',
  'sub',
  'lede',
  'ledeShort',
  'body',
  'text',
  'description',
  'paragraphs',
  'datum',
  'note',
];

/**
 * The order an object's fields are shown in.
 *
 * Needed for the same jsonb reason as splitSections: stored order is by key
 * length, which puts `a` (the answer) above `q` (the question) and the
 * paragraph above its heading. Known reading-order keys come first; the rest
 * go pictures, short text, switches, simple lists, then lists of items and
 * nested groups, so a form scans from what a visitor sees down to structure.
 */
export function orderKeys(body: Record<string, unknown>, mediaKeys: string[] = []): string[] {
  const kind = (key: string): number => {
    const value = body[key];
    if (mediaKeys.includes(key)) return -1;
    if (typeof value === 'boolean') return 2;
    if (Array.isArray(value)) {
      return value.some((item) => item !== null && typeof item === 'object') ? 4 : 3;
    }
    if (value !== null && typeof value === 'object') return 5;
    return 0;
  };
  const reading = (key: string) => {
    const at = READING_ORDER.indexOf(key);
    return at === -1 ? READING_ORDER.length : at;
  };
  return Object.keys(body).sort(
    (a, b) => reading(a) - reading(b) || kind(a) - kind(b) || a.localeCompare(b),
  );
}

/** Keys that name the thing they sit in, most telling first. */
const TITLE_KEYS = [
  'title',
  'heading',
  'name',
  'clientName',
  'q',
  'label',
  'step',
  'tier',
  'item',
  'ask',
  'year',
  'text',
  'lead',
  'value',
  'open',
  'day',
];

/** Keys that describe the thing, for the second line under its title. */
const DETAIL_KEYS = ['body', 'desc', 'description', 'text', 'lede', 'sub', 'a', 'note', 'why', 'promise'];

/** A string, or a list of strings read as one line; otherwise ''. */
function words(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string'))
    return value.join(' ').trim();
  return '';
}

/**
 * A human line for one item in a list, for its collapsed row.
 *
 * Titles beat eyebrows ("From the Anchor..." rather than "01 → 02"), and an
 * item whose words live one level down — a hero room's caption — is named by
 * them rather than by its id.
 */
export function summarize(item: unknown): string {
  if (typeof item === 'string') return item;
  if (!item || typeof item !== 'object') return '';
  const record = item as Record<string, unknown>;
  for (const key of TITLE_KEYS.concat(READING_ORDER)) {
    const text = words(record[key]);
    if (text) return text;
  }
  for (const value of Object.values(record)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const text = summarize(value);
      if (text) return text;
    }
  }
  const first = Object.entries(record).find(
    ([key, value]) => !/^(id|key|kind)$/.test(key) && words(value),
  );
  return first ? words(first[1]) : '';
}

/** The item's describing words, when they are not already its title. */
export function describe(item: unknown, title: string): string {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return '';
  const record = item as Record<string, unknown>;
  for (const key of DETAIL_KEYS) {
    const text = words(record[key]);
    if (text && text !== title) return text;
  }
  for (const value of Object.values(record)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const text = describe(value, title);
      if (text) return text;
    }
  }
  return '';
}

/** Keys whose value is a web address. */
export function isLinkKey(key: string): boolean {
  return /^(href|url|link)$|(Href|Url)$/.test(key);
}

/**
 * Text-and-link pairs in one object — `ctaLabel` + `ctaHref`, `label` +
 * `href` — which the editor shows as one button rather than two boxes.
 */
export function buttonPairs(keys: string[]): Array<[label: string, href: string]> {
  return keys.flatMap((key) => {
    const prefix = key === 'label' ? '' : key.endsWith('Label') ? key.slice(0, -5) : null;
    if (prefix === null) return [];
    const href = prefix ? `${prefix}Href` : 'href';
    return keys.includes(href) ? [[key, href] as [string, string]] : [];
  });
}

/**
 * A heading written as parts — `{ lead: 'Stop', accent: 'Dreaming', tail: '.' }`
 * per line — where the accent is the word the website highlights.
 */
export function isSentenceList(list: unknown[]): boolean {
  return (
    list.length > 0 &&
    list.every(
      (item) =>
        !!item &&
        typeof item === 'object' &&
        !Array.isArray(item) &&
        typeof (item as Record<string, unknown>).accent === 'string' &&
        Object.keys(item).every((key) => ['lead', 'accent', 'tail'].includes(key)),
    )
  );
}

/**
 * The columns for a list short enough to edit as a table — opening hours,
 * trust figures, footer links — or null when its items need room of their own.
 *
 * A list qualifies when every item is a flat record of at most four short
 * words-or-numbers, counting only the keys `visible` shows and refusing any
 * key `plain` says needs its own control (a picture, a dropdown).
 */
export function compactColumns(
  list: unknown[],
  visible: (key: string) => boolean,
  plain: (key: string) => boolean,
): string[] | null {
  if (list.length === 0) return null;
  const columns: string[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    for (const [key, value] of Object.entries(item)) {
      if (!visible(key)) continue;
      if (!plain(key)) return null;
      const short =
        value === null ||
        typeof value === 'number' ||
        (typeof value === 'string' && value.length <= 70);
      if (!short) return null;
      if (!columns.includes(key)) columns.push(key);
    }
  }
  if (columns.length === 0 || columns.length > 4) return null;
  const sample = Object.assign({}, ...(list as object[])) as Record<string, unknown>;
  return orderKeys(sample).filter((key) => columns.includes(key));
}

/**
 * A blank copy of an existing list item, for the Add button.
 *
 * Inferred from the item already there rather than declared anywhere, which is
 * the same bargain the rest of this editor makes: the content describes its own
 * shape, so adding a field to a process step in one place makes it appear on
 * every new one without a schema edit.
 */
export function blankLike(sample: unknown): unknown {
  if (typeof sample === 'string') return '';
  if (typeof sample === 'number') return 0;
  if (typeof sample === 'boolean') return false;
  if (Array.isArray(sample)) return [];
  if (sample && typeof sample === 'object') {
    return Object.fromEntries(
      Object.entries(sample as Record<string, unknown>).map(([key, value]) => [
        key,
        blankLike(value),
      ]),
    );
  }
  return '';
}
