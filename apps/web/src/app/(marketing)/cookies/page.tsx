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
// The text is in src/data/pages/legal.json under `cookies`. Company-specific
// values are marked in capitals inside square brackets and must be filled in
// before launch. If analytics is ever added, the stored-items list there and
// CONSENT_VERSION in src/lib/consent.ts both have to change — bumping the
// version re-asks everyone, which is the point of it.
import type { Metadata } from "next";
import { LegalSheet } from "@/components/legal/LegalSheet";
import { CookieSettingsButton } from "@/components/legal/CookieSettingsButton";
import { getPage } from "@/lib/content";

export async function generateMetadata(): Promise<Metadata> {
  const { cookies } = await getPage("legal");
  return cookies.metadata;
}

export default async function CookiesPage() {
  const { cookies, sheet } = await getPage("legal");

  return (
    <>
      <LegalSheet
        index={cookies.index}
        eyebrow={cookies.eyebrow}
        title={cookies.title}
        intro={cookies.intro}
        updated={cookies.updated}
        clauses={cookies.clauses}
        contact={cookies.contact}
        labels={sheet}
      />

      {/* The withdrawal control, on the page that explains withdrawal —
          Art. 7(3) asks for it to be as easy as consent, and a link to a
          policy that then tells you to go and find a setting is not that. */}
      <div className="bg-background pb-24 md:pb-32">
        <div className="shell">
          <div className="rounded-[20px] border border-border/70 bg-card p-6 md:p-8">
            <h2 className="font-title text-[1.25rem] font-semibold tracking-[-0.03em] text-primary">
              {cookies.settingsBox.heading}
            </h2>
            <p className="mt-2 max-w-[56ch] text-[14.5px] leading-[1.7] text-muted-foreground">
              {cookies.settingsBox.body}
            </p>
            <CookieSettingsButton className="mt-5 inline-flex rounded-full bg-primary px-7 py-3 text-[14px] font-medium text-primary-foreground transition-colors duration-300 hover:bg-enzo-forest-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
          </div>
        </div>
      </div>
    </>
  );
}
