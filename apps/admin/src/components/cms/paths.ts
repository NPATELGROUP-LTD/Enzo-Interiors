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
    return setIn(root, parentPath, parent.filter((_, index) => index !== last));
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
 * Splits an entry into the panes the editor navigates between.
 *
 * A page body is a handful of named sections — `hero`, `process`,
 * `investment` — plus a few loose scalars like `title`. Rendering all of it
 * at once means scrolling ten kilobytes of nested form to change one
 * paragraph, so each section becomes its own pane.
 *
 * The scalars do NOT each get a pane. Fifteen one-line entries in the rail
 * would be a worse map than no rail at all, so they collapse into a single
 * "Details" pane at the top. An entry that is mostly scalars — a testimonial,
 * a FAQ — therefore ends up with one pane, and the caller renders it flat.
 *
 * Sections come back alphabetical, which is a choice rather than laziness.
 * The order the page was written in does not survive the round trip: content
 * is stored in a `jsonb` column, and Postgres orders a jsonb object's keys by
 * key length and then alphabetically, so `home` arrives as hero, work,
 * invite, voices, process, workshop, heroStatic, servicesBoard. There is no
 * document order left to preserve, and length-then-alpha is arbitrary to a
 * human looking for a section by name. Alphabetical at least puts "Hero" next
 * to "Hero static" and "Services board" under S.
 */
export function splitSections(body: Record<string, unknown>): {
  scalars: string[];
  sections: string[];
} {
  const scalars: string[] = [];
  const sections: string[] = [];
  for (const [key, value] of Object.entries(body)) {
    // null counts as scalar: it renders as an empty text box, not a group.
    if (value !== null && typeof value === 'object') sections.push(key);
    else scalars.push(key);
  }
  return { scalars, sections: sections.sort((a, b) => humanize(a).localeCompare(humanize(b))) };
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
