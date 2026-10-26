import { ApiError } from './api';

/**
 * Tells the API when something on this screen threw, so a broken page reaches
 * the people who run the platform and not only whoever saw it. Only the first
 * line of the message and `file.js:12` leave the browser (the API strips the
 * rest), at most five different faults per page load, and nothing in
 * development. A failed request is not reported: the API sees those itself.
 */
const APP = 'admin';
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';
/** Offline, cancelled, a browser extension, a layout quirk: nothing we can fix. */
const IGNORE = /ResizeObserver|Failed to fetch|NetworkError|Load failed|AbortError|Script error|extension:/i;
const sent = new Set<string>();

export function reportError(message: unknown, location?: string): void {
  if (!import.meta.env.PROD) return;
  const text = String(message ?? '').split('\n')[0]?.slice(0, 300) ?? '';
  const key = `${text}|${location ?? ''}`;
  if (!text || IGNORE.test(text) || sent.has(key) || sent.size >= 5) return;
  sent.add(key);
  fetch(`${BASE_URL}/alerts/browser`, {
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app: APP, message: text, ...(location ? { location } : {}) }),
  }).catch(() => undefined);
}

/** `index-abc.js:12` for a script from this site, nothing for anyone else's. */
function place(file: string | undefined, line: number | undefined): string | undefined {
  try {
    const url = new URL(file ?? '');
    return url.origin === window.location.origin ? `${url.pathname.split('/').pop()}:${line ?? 0}` : undefined;
  } catch {
    return undefined;
  }
}

export function installErrorReporting(): void {
  window.addEventListener('error', (event) => {
    const where = place(event.filename, event.lineno);
    if (event.filename && !where) return; // someone else's script
    reportError(event.message, where);
  });
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason instanceof ApiError) return;
    reportError(event.reason instanceof Error ? event.reason.message : event.reason);
  });
}
