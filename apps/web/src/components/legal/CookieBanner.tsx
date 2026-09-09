"use client";

// The cookie notice.
//
// ── Built to the ICO's own guidance, not to the pattern everyone copies ──
// See src/lib/consent.ts for the legal reasoning. The three things this does
// that a stock banner does not:
//
//   • "Accept" and "Reject" are the same size, the same weight, the same
//     colour and adjacent. Rejecting is not one click further away than
//     accepting, and neither is hidden behind "Manage preferences".
//   • It never blocks the page. A modal overlay that cannot be dismissed
//     without a decision is not "freely given" consent, and it fails
//     WCAG 2.1 for anyone who cannot reach the buttons.
//   • Nothing non-essential runs before a choice — there is nothing to
//     switch off after the fact, because nothing was switched on.
//
// ── Accessibility ──
// `role="region"` with a label rather than `role="dialog"`: this is not
// modal, it does not trap focus, and announcing it as a dialog would tell a
// screen-reader user they are stuck in something they are not. It is
// keyboard-reachable in DOM order, its own focus ring is visible on the sand
// ground, and Escape dismisses the *panel* without recording a decision —
// which is not the same as consenting, so it comes back next visit.
//
// It sits above the site frame (z-[110]) because a fixed decorative border
// at z-[100] would otherwise paint over its bottom edge.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { REOPEN_EVENT, setConsent, useConsent } from "@/lib/consent";
import { cn } from "@/lib/utils";

export function CookieBanner() {
  const consent = useConsent();
  const [reopened, setReopened] = useState(false);
  const [detail, setDetail] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // The footer's permanent "Cookie settings" control — withdrawal has to be
  // as easy as consent was (UK GDPR Art. 7(3)).
  useEffect(() => {
    const open = () => {
      setReopened(true);
      setDetail(false);
      // Move the reader to the thing that just appeared. Without this the
      // control is at the very bottom of the page and the panel it opens is
      // announced nowhere.
      window.requestAnimationFrame(() => panelRef.current?.focus());
    };
    window.addEventListener(REOPEN_EVENT, open);
    return () => window.removeEventListener(REOPEN_EVENT, open);
  }, []);

  const open = consent === null || reopened;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      // Dismissing is not deciding: the panel closes for this view and the
      // question is asked again next time. Refusing by default is the only
      // reading that is safe under PECR.
      if (event.key === "Escape") setReopened(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  const decide = (value: boolean) => {
    setConsent({ analytics: value, marketing: false });
    setReopened(false);
  };

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      role="region"
      aria-label="Cookie choices"
      className="fixed inset-x-0 bottom-0 z-[110] p-3 focus:outline-none sm:p-5 md:p-6"
    >
      <div className="mx-auto w-full max-w-[64rem] rounded-[20px] border border-enzo-forest/15 bg-enzo-cream p-5 shadow-[0_18px_60px_rgba(16,26,22,0.28)] sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-8">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[10.5px] font-semibold uppercase tracking-[0.24em] text-enzo-forest-light">
              Cookies
            </h2>
            <p className="mt-2 max-w-[62ch] text-[13.5px] leading-[1.65] text-enzo-forest/85">
              This site sets one small item on your device so it remembers this
              choice, and nothing else. We use no analytics, no advertising and
              no third-party trackers — if that ever changes, we will ask first.{" "}
              <Link
                href="/cookies"
                className="underline decoration-enzo-forest/30 underline-offset-4 transition-colors hover:decoration-enzo-forest"
              >
                Read the cookie policy
              </Link>
              .
            </p>

            {detail && (
              <ul className="mt-4 border-t border-enzo-forest/12 pt-4 text-[12.5px] text-enzo-forest/80">
                <li className="flex items-start justify-between gap-6 py-2">
                  <span>
                    <strong className="font-semibold text-enzo-forest">
                      Strictly necessary
                    </strong>
                    <br />
                    Remembers this choice and keeps the enquiry form working.
                    Cannot be switched off.
                  </span>
                  <span className="shrink-0 pt-0.5 font-display text-[10px] uppercase tracking-[0.16em] text-enzo-forest/50">
                    Always on
                  </span>
                </li>
                <li className="flex items-start justify-between gap-6 border-t border-enzo-forest/12 py-2">
                  <span>
                    <strong className="font-semibold text-enzo-forest">
                      Analytics
                    </strong>
                    <br />
                    Not in use today. Turning this on now permits it only if we
                    add it later; leaving it off means we never will for you.
                  </span>
                  <label className="flex shrink-0 cursor-pointer items-center gap-2 pt-0.5">
                    <input
                      type="checkbox"
                      checked={analytics}
                      onChange={(event) => setAnalytics(event.target.checked)}
                      className="h-4 w-4 accent-enzo-forest"
                    />
                    <span className="font-display text-[10px] uppercase tracking-[0.16em]">
                      Allow
                    </span>
                  </label>
                </li>
              </ul>
            )}
          </div>

          {/* Accept and reject are one pair, matched in every respect. The
              third control changes what is on screen; it does not decide
              anything, so it is set as a quiet text button. */}
          <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row lg:flex-col">
            <button
              type="button"
              onClick={() => decide(detail ? analytics : true)}
              className={cn(
                // `border-transparent` is not cosmetic: without it the filled
                // button is 2px shorter than the outlined one beside it, and
                // "equal prominence" for accept and reject is the specific
                // thing the ICO looks at.
                "rounded-full border border-transparent bg-enzo-forest px-7 py-3 text-[13.5px] font-medium text-enzo-cream transition-colors duration-300",
                "hover:bg-enzo-forest-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-forest focus-visible:ring-offset-2 focus-visible:ring-offset-enzo-cream",
              )}
            >
              {detail ? "Save choices" : "Accept all"}
            </button>
            <button
              type="button"
              onClick={() => decide(false)}
              className={cn(
                "rounded-full border border-enzo-forest/30 px-7 py-3 text-[13.5px] font-medium text-enzo-forest transition-colors duration-300",
                "hover:border-enzo-forest hover:bg-enzo-forest/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-forest focus-visible:ring-offset-2 focus-visible:ring-offset-enzo-cream",
              )}
            >
              Reject all
            </button>
            <button
              type="button"
              onClick={() => setDetail((value) => !value)}
              aria-expanded={detail}
              className="touch-target rounded-full px-2 py-1 text-[12.5px] text-enzo-forest/70 underline decoration-enzo-forest/25 underline-offset-4 transition-colors hover:text-enzo-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-forest"
            >
              {detail ? "Hide details" : "Choose individually"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
