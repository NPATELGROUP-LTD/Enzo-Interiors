// /privacy — the privacy notice.
//
// ── Read this before editing ──
// The text itself is in src/data/pages/legal.json under `privacy`. Its clause
// order follows UK GDPR Articles 13 and 14, which set out what a notice has to
// *contain* when you collect data from someone: who you are, what you collect,
// why, on what lawful basis, who you share it with, how long you keep it, what
// rights the person has, and how to complain. Each of those is one clause, in
// that order, because a notice that answers them in a different order is
// harder to check against the law — so add to that list rather than reordering
// it.
//
// Every company-specific fact that we cannot know is marked in capitals inside
// square brackets. Those are not TODOs to be quietly deleted: a privacy notice
// that names no data controller does not satisfy Art. 13(1)(a), so they must be
// filled in before this page goes live, and the wording as a whole should be
// reviewed by a solicitor against how the business actually operates. The
// content is a correct, honest skeleton written from what the rest of this site
// does; it is not legal advice.
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { LegalSheet } from "@/components/legal/LegalSheet";
import { getPage } from "@/lib/content";

export async function generateMetadata(): Promise<Metadata> {
  const metadata = (await getPage("legal")).privacy.metadata;
  return pageMetadata({ ...metadata, path: "/privacy", ogKey: "privacy" });
}

export default async function PrivacyPage() {
  const { privacy, sheet } = await getPage("legal");

  return (
    <LegalSheet
      index={privacy.index}
      eyebrow={privacy.eyebrow}
      title={privacy.title}
      intro={privacy.intro}
      updated={privacy.updated}
      clauses={privacy.clauses}
      contact={privacy.contact}
      labels={sheet}
    />
  );
}
