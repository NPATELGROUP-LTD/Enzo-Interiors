/**
 * Sends one of the site's forms to the API, which stores it and emails the
 * studio. Runs in the browser, so it uses the API's public address rather than
 * the internal one the server reads content from.
 */
const API = (process.env.NEXT_PUBLIC_API_PUBLIC_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000").replace(/\/+$/, "");

export interface Enquiry {
  kind: "contact" | "quote" | "booking";
  name: string;
  email: string;
  phone?: string;
  message?: string;
  /** Extra answers (room, tier, date...). Blank values are dropped. */
  details?: Record<string, string | undefined>;
  /** The honeypot field's value. People never fill it in. */
  website?: string;
}

/** Resolves on success; rejects with a message fit to show the visitor. */
export async function sendEnquiry(enquiry: Enquiry, fallbackError: string): Promise<void> {
  const details = Object.fromEntries(
    Object.entries(enquiry.details ?? {}).filter((entry): entry is [string, string] => !!entry[1]?.trim()),
  );
  let response: Response;
  try {
    response = await fetch(`${API}/enquiries`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...enquiry,
        phone: enquiry.phone?.trim() || undefined,
        website: enquiry.website || undefined,
        details: Object.keys(details).length ? details : undefined,
      }),
    });
  } catch {
    throw new Error(fallbackError);
  }
  if (response.status === 429) throw new Error(await tooMany(response, fallbackError));
  if (!response.ok) throw new Error(fallbackError);
}

/** The API's own "Too many attempts. Try again in 3 minutes." for a 429. */
export async function tooMany(response: Response, fallback: string): Promise<string> {
  const json = (await response.json().catch(() => null)) as { message?: string } | null;
  return typeof json?.message === "string" ? json.message : fallback;
}
