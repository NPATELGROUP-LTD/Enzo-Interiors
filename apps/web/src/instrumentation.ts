/**
 * Re-reads the CMS once, right after the production server starts.
 *
 * The Docker image is built before the API it reads from is running, so every
 * page is prerendered from the content committed in src/data. Left alone, the
 * site would serve that build-time copy — without any edit made in the CMS —
 * until each page's hour-long revalidation window ran out, so every deploy
 * would briefly "undo" the client's work. Dropping the cache once the server
 * is listening makes the first request after a deploy read the live CMS.
 *
 * It goes through the site's own revalidate route rather than calling
 * revalidateTag here, because revalidation needs a request context and
 * register() runs before there is one.
 */
export function register(): void {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;
  // register() also runs inside `next build`'s workers, where there is no
  // server to call.
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return;

  const url = `http://127.0.0.1:${process.env.PORT ?? 3000}/api/revalidate`;
  const attempt = (triesLeft: number): void => {
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-revalidate-secret": secret },
      body: JSON.stringify({ reason: "server start" }),
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
      })
      .catch((error: unknown) => {
        // Usually just "not listening yet". Give up after ~30s: the pages
        // still refresh on their own timer, this only makes it immediate.
        if (triesLeft > 0) setTimeout(() => attempt(triesLeft - 1), 3000).unref();
        else console.warn("[content] Could not refresh the cache after start:", error);
      });
  };
  // unref: this must never be the thing keeping a process alive.
  setTimeout(() => attempt(10), 1000).unref();
}

/** The API the server talks to (http://api:4000 inside Docker), fixed at build time. */
const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const told = new Set<string>();

/**
 * A page or route that failed on the server is emailed to whoever runs the
 * platform, through the API (Settings > Alerts). Next calls this for every
 * request error, with the real message that production pages hide from
 * visitors. Only the route as written (/booking, never the address asked for)
 * and the first line of the message leave here; the API strips the rest.
 * Off until ALERT_SHARED_SECRET is set, and never allowed to fail a request.
 */
export async function onRequestError(
  error: unknown,
  _request: unknown,
  context: { routePath?: string; routeType?: string },
): Promise<void> {
  const secret = process.env.ALERT_SHARED_SECRET;
  if (process.env.NEXT_RUNTIME !== "nodejs" || !secret) return;
  const message = (error instanceof Error ? error.message : String(error)).split("\n")[0] ?? "";
  // The API de-duplicates too; this just spares it a request per visitor in a storm.
  const key = `${context.routePath}|${message}`;
  if (told.has(key)) return;
  told.add(key);
  if (told.size > 200) told.delete(told.values().next().value as string);
  try {
    await fetch(`${API}/alerts/web`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-alert-secret": secret },
      body: JSON.stringify({ message: message.slice(0, 300), route: `${context.routeType ?? "render"} ${context.routePath ?? ""}`.trim() }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // The alert is a courtesy. The page's own error is already logged.
  }
}
