import { createHash } from 'node:crypto';

/**
 * Alerts go to an inbox, so what they carry is limited to what helps find the
 * fault: a route, a status and the first line of an error. This strips what a
 * stray error message can drag in with it: addresses, tokens, query strings.
 */
const STRIP: Array<[RegExp, string]> = [
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[email]'],
  [/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[token]'],
  [/\bBearer\s+\S+/gi, 'Bearer [token]'],
  // Long unbroken runs: tokens, secrets, UUIDs, record ids.
  [/\b[A-Za-z0-9_-]{24,}\b/g, '[token]'],
  [/\?[\w%.~+=&-]+/g, ''],
];

/** The first non-empty line, scrubbed, on one line and at most `max` characters. */
export function clean(text: string | undefined | null, max = 200): string {
  const line = String(text ?? '').split(/\r?\n/).find((row) => row.trim()) ?? '';
  const scrubbed = STRIP.reduce((out, [pattern, to]) => out.replace(pattern, to), line).replace(/\s+/g, ' ').trim();
  return scrubbed.length > max ? `${scrubbed.slice(0, max - 1)}…` : scrubbed;
}

/** The same problem hashes the same however many ids and counts its message carries. */
export function fingerprint(parts: Array<string | number | null | undefined>): string {
  const text = parts.map((part) => String(part ?? '').replace(/\d+/g, '#')).join('|');
  return createHash('sha1').update(text).digest('hex').slice(0, 16);
}

/** `file.js:123` of the first frame in our own code, or null. Never a path, never source. */
export function whereFrom(error: unknown): string | null {
  const stack = error instanceof Error ? error.stack : undefined;
  for (const line of stack?.split('\n').slice(1) ?? []) {
    if (line.includes('node_modules') || line.includes('node:')) continue;
    const match = /([^/()\s]+:\d+):\d+\)?\s*$/.exec(line);
    if (match) return match[1]!;
  }
  return null;
}
