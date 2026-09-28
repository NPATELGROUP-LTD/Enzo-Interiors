/**
 * The booking page's calls to the API. Runs in the browser, so it uses the
 * API's public address, like the enquiry forms (lib/enquiry.ts).
 */
const API = (process.env.NEXT_PUBLIC_API_PUBLIC_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000").replace(/\/+$/, "");

export type FieldRule = "required" | "optional" | "off";

/** Free times per studio date, plus the form's rules, as set in the admin. */
export interface Availability {
  days: Record<string, string[]>;
  fields: { phone: FieldRule; address: FieldRule; postcode: FieldRule; notes: FieldRule };
  /** Bookable service slugs; empty = all of them. */
  services: string[];
  slotMinutes: number;
  horizonDays: number;
}

export async function fetchAvailability(from: string, to: string): Promise<Availability> {
  const response = await fetch(`${API}/booking/availability?from=${from}&to=${to}`, { cache: "no-store" });
  if (!response.ok) throw new Error(String(response.status));
  return (await response.json()) as Availability;
}

export interface Booking {
  service: string;
  date: string;
  time: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  postcode?: string;
  notes?: string;
  tier?: string;
  /** The honeypot field's value. */
  website?: string;
}

/** Thrown when someone else took the time first. */
export class SlotTakenError extends Error {}

/** Resolves with the booking's reference; rejects with a message fit to show. */
export async function sendBooking(booking: Booking, fallbackError: string): Promise<{ reference?: string }> {
  const body = Object.fromEntries(Object.entries(booking).filter(([, value]) => value?.trim()));
  let response: Response;
  try {
    response = await fetch(`${API}/booking`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(fallbackError);
  }
  if (response.status === 409) throw new SlotTakenError();
  if (response.status === 204) return {};
  const json = (await response.json().catch(() => null)) as { reference?: string; message?: string | string[] } | null;
  if (!response.ok) {
    // A 400 carries the API's own plain-English reason ("Enter your phone number.").
    const message = Array.isArray(json?.message) ? json.message[0] : json?.message;
    // So does a 429 ("Too many attempts. Try again in 3 minutes.").
    throw new Error((response.status === 400 || response.status === 429) && message ? message : fallbackError);
  }
  return { reference: json?.reference };
}
