import { draftMode } from "next/headers";
import { redirect } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

/**
 * Opens the site for an editor before it is public.
 *
 * The admin mints a ten-minute token (Settings → Preview site); the API checks
 * it, and only then does this set Next's draft-mode cookie, which lets that
 * one browser past the coming-soon page. Nothing unpublished is shown: the
 * preview is of the published site, before launch.
 */
export async function GET(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const ok =
    token.length > 0 &&
    token.length < 2000 &&
    (await fetch(`${API_BASE}/content/preview`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
      cache: "no-store",
      // A hung API must not hold the request open; a timeout counts as a failed check.
      signal: AbortSignal.timeout(5000),
    })
      .then((response) => response.ok)
      .catch(() => false));

  if (!ok) {
    return new Response("This preview link has expired. Open a new one from Settings in the admin.", {
      status: 401,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  (await draftMode()).enable();
  redirect("/");
}
