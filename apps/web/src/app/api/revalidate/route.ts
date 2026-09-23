import { timingSafeEqual } from "node:crypto";

import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

/**
 * Called by apps/api when content is published.
 *
 * The site reads its content with `next: { tags: ["content"] }` and a long
 * revalidation window, which is what keeps pages static and keeps them serving
 * if the API is restarting. That window would also mean an editor's change sat
 * invisible for an hour, so publishing drops the tag here and the next request
 * re-reads immediately.
 *
 * Authentication is a shared secret in a header rather than a query parameter,
 * so it does not end up in access logs or a referrer. Without a configured
 * secret the route refuses everything: an open revalidation endpoint is a free
 * way for anyone to force origin traffic.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const expected = process.env.REVALIDATE_SECRET;
  if (!expected) {
    console.error("[revalidate] REVALIDATE_SECRET is not set; refusing to revalidate.");
    return NextResponse.json({ revalidated: false, reason: "not configured" }, { status: 503 });
  }

  const provided = request.headers.get("x-revalidate-secret");
  // Length check first so the comparison below cannot be used to learn the
  // secret's length from timing alone.
  // Constant-time, so the secret cannot be guessed one character at a time.
  const a = Buffer.from(provided ?? "");
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ revalidated: false }, { status: 401 });
  }

  // Next 16 takes a cache-life profile as the second argument, and the choice
  // matters here. The documented recommendation, "max", marks the tag stale
  // and serves the OLD content once more while fetching the new in the
  // background — which for a CMS means the editor hits Publish, reloads, and
  // still sees their previous copy. `expire: 0` instead makes the next request
  // a blocking re-read, so the first load after publishing is the new content.
  // One slower request per publish is the right trade for that.
  revalidateTag("content", { expire: 0 });

  let reason = "unspecified";
  try {
    const body = (await request.json()) as { reason?: unknown };
    if (typeof body.reason === "string") reason = body.reason;
  } catch {
    // A publish with no body is still a valid publish.
  }

  console.log(`[revalidate] content cache dropped (${reason})`);
  return NextResponse.json({ revalidated: true, reason, at: new Date().toISOString() });
}
