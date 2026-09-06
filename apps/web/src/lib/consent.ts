"use client";

// Cookie consent state, and the rules it has to satisfy.
//
// ── What the law actually requires here ──
// The relevant instrument in the UK is PECR regulation 6, not the UK GDPR:
// PECR governs *storing or reading anything on a visitor's device*, and it
// requires prior, informed consent for everything except what is "strictly
// necessary for the provision of a service explicitly requested by the
// subscriber". UK GDPR then supplies the standard that consent has to meet —
// freely given, specific, informed, unambiguous, by clear affirmative action
// (Art. 4(11)), and as easy to withdraw as to give (Art. 7(3)).
//
// Three consequences the banner below is built around, all of which the
// average cookie banner gets wrong:
//
//   1. Nothing non-essential may be set *before* a choice is made. Not on
//      page load, not "pending" a decision. So the store starts in an
//      explicit `undecided` state and nothing reads it as permission.
//   2. Rejecting must be exactly as easy as accepting — one control, same
//      level, same prominence. A "Reject all" hidden behind a "Manage
//      preferences" screen is the specific dark pattern the ICO has named.
//   3. Consent must be withdrawable at any time, as easily as it was given,
//      which is why the footer carries a permanent "Cookie settings" control
//      and not just a link to a policy page.
//
// ── Why this file is tiny ──
// Because this site currently sets no non-essential cookies at all. There is
// no analytics, no tag manager, no embedded map, no pixel. The honest thing
// is to say so and to keep the mechanism ready rather than to ship a banner
// that asks permission for nothing — but the mechanism has to exist *before*
// anyone adds analytics, or it gets added afterwards and never retrofitted.
// `hasConsent("analytics")` is the gate that new script must sit behind.
import { useSyncExternalStore } from "react";

/**
 * Categories a visitor can decide about. "necessary" is not in the list on
 * purpose: it cannot be refused, so offering it as a choice would be a lie.
 */
export type ConsentCategory = "analytics" | "marketing";

export interface ConsentState {
  analytics: boolean;
  marketing: boolean;
  /** ISO timestamp of the decision — consent has to be demonstrable. */
  decidedAt: string;
  /** Bumped when the categories change, which re-asks rather than assuming. */
  version: number;
}

/** Raise this when a new category is introduced, to re-ask everyone. */
export const CONSENT_VERSION = 1;

const KEY = "enzo.consent";

// localStorage rather than a cookie: a cookie for consent would itself be
// sent on every request for no reason, and this value is only ever read by
// the browser. It is first-party, non-tracking, and strictly necessary for
// honouring the choice, so it needs no consent of its own.
function read(): ConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentState;
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    // Private mode, blocked storage, corrupt value. No stored consent is
    // indistinguishable from a refusal, which is the safe reading.
    return null;
  }
}

const listeners = new Set<() => void>();
let snapshot: ConsentState | null | undefined;

function emit() {
  snapshot = read();
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  // Another tab deciding counts as this tab deciding.
  window.addEventListener("storage", emit);
  return () => {
    listeners.delete(fn);
    if (!listeners.size) window.removeEventListener("storage", emit);
  };
}

function getSnapshot(): ConsentState | null {
  if (snapshot === undefined) snapshot = read();
  return snapshot;
}

/** The server has no storage, so it always renders the undecided state. */
function getServerSnapshot(): ConsentState | null {
  return null;
}

/** `null` means undecided — treat it as refusal for every purpose. */
export function useConsent(): ConsentState | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setConsent(choice: Record<ConsentCategory, boolean>): void {
  const next: ConsentState = {
    ...choice,
    decidedAt: new Date().toISOString(),
    version: CONSENT_VERSION,
  };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage refused. The choice still applies to this page view via the
    // in-memory snapshot below; it simply will not survive a reload, which
    // is the correct failure — we re-ask rather than assume.
  }
  snapshot = next;
  listeners.forEach((fn) => fn());
}

/** Withdrawal: clears the record so the banner asks again. */
export function clearConsent(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
  snapshot = null;
  listeners.forEach((fn) => fn());
}

/**
 * The gate every future non-essential script must sit behind. Returns false
 * while undecided, which is the whole point: no consent is not consent.
 */
export function hasConsent(category: ConsentCategory): boolean {
  return getSnapshot()?.[category] === true;
}

/** Lets the footer's "Cookie settings" control reopen the banner. */
export const REOPEN_EVENT = "enzo:consent:reopen";

export function reopenConsent(): void {
  window.dispatchEvent(new CustomEvent(REOPEN_EVENT));
}
