/**
 * The newsletter's three calls. Runs in the browser, so it uses the API's
 * public address. The API answers a sign-up the same way whether or not the
 * address is already on the list.
 */
import { tooMany } from "@/lib/enquiry";

const API = (process.env.NEXT_PUBLIC_API_PUBLIC_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000").replace(/\/+$/, "");

export type NewsletterSource = "coming_soon" | "footer";

async function post(path: string, body: unknown): Promise<Response> {
  return fetch(`${API}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Resolves once the confirmation email is on its way; rejects with the API's message for a 429, else an empty one. */
export async function subscribe(email: string, source: NewsletterSource, website: string): Promise<void> {
  const response = await post("/newsletter", { email: email.trim(), source, website: website || undefined }).catch(() => null);
  if (!response) throw new Error("");
  if (response.status === 429) throw new Error(await tooMany(response, ""));
  if (!response.ok) throw new Error("");
}

/** "confirmed", "unsubscribed" (an old link), or "invalid". */
export async function confirmSubscription(token: string): Promise<"confirmed" | "unsubscribed" | "invalid"> {
  const response = await post("/newsletter/confirm", { token }).catch(() => null);
  if (!response?.ok) return "invalid";
  const { status } = (await response.json()) as { status: "confirmed" | "unsubscribed" };
  return status;
}

export async function unsubscribe(token: string): Promise<boolean> {
  const response = await post("/newsletter/unsubscribe", { token }).catch(() => null);
  return !!response?.ok;
}
