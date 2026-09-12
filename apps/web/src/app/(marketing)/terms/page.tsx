// /terms — website terms, and the consumer-law position on the work itself.
//
// ── Read this before editing ──
// The text itself is in src/data/pages/legal.json under `terms`.
//
// Two different things get confused on pages like this and are kept apart
// there. Terms of *website use* (clauses 1–4) govern reading this site. Terms
// of *supply* for a fitted-furniture contract are a much heavier document —
// they have to deal with the Consumer Rights Act 2015, the Consumer Contracts
// (Information, Cancellation and Additional Charges) Regulations 2013, and in
// particular the fact that a survey carried out in someone's home makes the
// resulting contract an "off-premises contract" with a 14-day cancellation
// right that is *not* lost simply because the goods are bespoke unless the
// customer has expressly agreed and acknowledged it.
//
// This page therefore states the consumer's statutory position accurately and
// says plainly that the job's own terms are issued with the quotation. It
// deliberately does not attempt to be those terms: a set of supply terms
// written without knowing the business's deposit structure, lead times and
// insurance would be worse than none. [SQUARE-BRACKET CAPITALS] mark facts
// only the business can supply, and the whole page should be reviewed by a
// solicitor before launch. This is not legal advice.
import type { Metadata } from "next";
import { LegalSheet } from "@/components/legal/LegalSheet";
import { getPage } from "@/lib/content";

export async function generateMetadata(): Promise<Metadata> {
  const { terms } = await getPage("legal");
  return terms.metadata;
}

export default async function TermsPage() {
  const { terms, sheet } = await getPage("legal");

  return (
    <LegalSheet
      index={terms.index}
      eyebrow={terms.eyebrow}
      title={terms.title}
      intro={terms.intro}
      updated={terms.updated}
      clauses={terms.clauses}
      contact={terms.contact}
      labels={sheet}
    />
  );
}
