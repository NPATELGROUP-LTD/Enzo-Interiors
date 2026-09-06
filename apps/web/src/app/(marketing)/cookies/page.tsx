// /cookies — the cookie policy.
//
// The governing rule in the UK is PECR regulation 6 (consent to store or read
// anything on a device), with UK GDPR supplying the standard consent has to
// meet. See src/lib/consent.ts for the full reasoning and the mechanism.
//
// The unusual thing about this page is that it is short and it is true: this
// site genuinely sets nothing but a consent record and, on the booking flow,
// the storage the form needs to not lose your answers. Rather than pad it out
// with the standard four paragraphs about "types of cookies", it says exactly
// what is stored, why, and for how long — which is what regulation 6(2)
// actually asks for ("clear and comprehensive information about the
// purposes").
//
// Company-specific values are marked in capitals inside square brackets and
// must be filled in before launch. If analytics is ever added, the table here
// and CONSENT_VERSION in src/lib/consent.ts both have to change — bumping the
// version re-asks everyone, which is the point of it.
import type { Metadata } from "next";
import { LegalSheet, type LegalClause } from "@/components/legal/LegalSheet";
import { CookieSettingsButton } from "@/components/legal/CookieSettingsButton";

export const metadata: Metadata = {
  title: "Cookie Policy — Enzo Interiors",
  description:
    "Exactly what this website stores on your device, why, and how to change your mind.",
};

const UPDATED = "5 September 2026";

const CLAUSES: LegalClause[] = [
  {
    id: "what-we-set",
    heading: "Everything this site stores",
    body: [
      "That is the whole list. There is no analytics, no tag manager, no advertising pixel, no social embed, no session recording and no A/B testing on this website.",
      [
        "enzo.consent — remembers the choice you made in the cookie notice, so you are not asked on every page. Stored in your browser's local storage, not sent to our server, kept until you clear it or change your choice. Strictly necessary: without it we could not honour your decision.",
        "Booking form progress — while you are part-way through the booking wizard, your answers are held in your browser so a refresh does not lose them. Cleared when you submit or leave. Strictly necessary for a service you asked for.",
      ],
      "Our hosting provider processes your IP address transiently in its server logs in order to deliver the page and to defend against abuse. That is not a cookie, it is not used to identify you, and it is not combined with anything else — see the privacy notice for the detail.",
    ],
  },
  {
    id: "consent",
    heading: "What we ask permission for",
    body: [
      "Under PECR we need your consent before storing or reading anything on your device that is not strictly necessary for a service you have asked for. Today nothing on this site falls into that category, so the notice you saw exists to record a decision rather than to unlock anything.",
      "We have still built the mechanism properly, because the moment analytics is added it has to sit behind a real choice rather than be retro-fitted. If you allow analytics now, that permission only takes effect if and when we add it; if you refuse, we will not add it for you.",
    ],
  },
  {
    id: "changing-your-mind",
    heading: "Changing your mind",
    body: [
      "You can change or withdraw your choice at any time, and it has to be as easy as giving it was — that is Article 7(3) of the UK GDPR, not a courtesy. Use the button below, or the “Cookie settings” link in the footer of every page.",
      "You can also clear site data for this domain in your browser's settings, which has the same effect: we will simply ask again next time.",
    ],
  },
  {
    id: "third-parties",
    heading: "Third parties",
    body: [
      "There are none embedded in this site. If we later add something that sets its own cookies — an embedded map, a review widget, a booking integration — it will be listed here by name and purpose before it goes live, and it will not load until you have allowed it.",
      "Links from this site to other websites (for example our social profiles) take you to services with their own cookies and their own policies, over which we have no control.",
    ],
  },
  {
    id: "more",
    heading: "More about cookies generally",
    body: [
      "The Information Commissioner's Office publishes plain-English guidance on cookies and similar technologies at ico.org.uk. If you think this site is not doing what this page says, tell us at [PRIVACY EMAIL] — and you can complain to the ICO directly at any time.",
    ],
  },
];

export default function CookiesPage() {
  return (
    <>
      <LegalSheet
        index="L3"
        eyebrow="Cookies"
        title="One item, and we asked first."
        intro="Most cookie policies are long because most websites store a lot. This one is short because this website stores almost nothing: a record of the choice you made about cookies, and — while you are filling it in — your progress through the booking form. No analytics, no advertising, no third-party trackers."
        updated={UPDATED}
        clauses={CLAUSES}
        contact={[
          { label: "Privacy policy", href: "/privacy" },
          { label: "Terms & conditions", href: "/terms" },
          { label: "Contact us", href: "/contact" },
        ]}
      />

      {/* The withdrawal control, on the page that explains withdrawal —
          Art. 7(3) asks for it to be as easy as consent, and a link to a
          policy that then tells you to go and find a setting is not that. */}
      <div className="bg-background pb-24 md:pb-32">
        <div className="shell">
          <div className="rounded-[20px] border border-border/70 bg-card p-6 md:p-8">
            <h2 className="font-title text-[1.25rem] font-semibold tracking-[-0.03em] text-primary">
              Change your choice now
            </h2>
            <p className="mt-2 max-w-[56ch] text-[14.5px] leading-[1.7] text-muted-foreground">
              This reopens the notice with your current answer in it. It takes
              effect immediately and applies to this browser.
            </p>
            <CookieSettingsButton className="mt-5 inline-flex rounded-full bg-primary px-7 py-3 text-[14px] font-medium text-primary-foreground transition-colors duration-300 hover:bg-enzo-forest-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
          </div>
        </div>
      </div>
    </>
  );
}
