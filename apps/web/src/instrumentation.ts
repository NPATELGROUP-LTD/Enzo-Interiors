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
