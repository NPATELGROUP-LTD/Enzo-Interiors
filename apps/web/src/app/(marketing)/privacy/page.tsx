// /privacy — the privacy notice.
//
// ── Read this before editing ──
// The structure below follows UK GDPR Articles 13 and 14, which set out what
// a notice has to *contain* when you collect data from someone: who you are,
// what you collect, why, on what lawful basis, who you share it with, how
// long you keep it, what rights the person has, and how to complain. Each of
// those is one clause here, in that order, because a notice that answers them
// in a different order is harder to check against the law.
//
// Every company-specific fact that we cannot know is marked the same way the
// phone number is marked everywhere else on this site — in capitals, in
// square brackets. Those are not TODOs to be quietly deleted: a privacy
// notice that names no data controller does not satisfy Art. 13(1)(a), so
// they must be filled in before this page goes live, and the wording as a
// whole should be reviewed by a solicitor against how the business actually
// operates. This file is a correct, honest skeleton written from what the
// rest of this site does; it is not legal advice.
import type { Metadata } from "next";
import { LegalSheet, type LegalClause } from "@/components/legal/LegalSheet";

export const metadata: Metadata = {
  title: "Privacy Policy — Enzo Interiors",
  description:
    "How Enzo Interiors collects, uses and protects your personal data, and the rights you have under UK GDPR.",
};

const UPDATED = "5 September 2026";

const CLAUSES: LegalClause[] = [
  {
    id: "who-we-are",
    heading: "Who we are",
    body: [
      "Enzo Interiors designs, makes and fits bespoke interiors and fitted furniture in Leicester and across Leicestershire. For the purposes of UK data protection law we are the data controller for the personal data described in this notice.",
      "Registered company: [REGISTERED COMPANY NAME], company number [COMPANY NUMBER], registered office [REGISTERED ADDRESS]. Information Commissioner's Office registration number: [ICO REGISTRATION NUMBER].",
      "If you have a question about this notice or about how we handle your information, the quickest route is the contact page, or email [PRIVACY EMAIL].",
    ],
  },
  {
    id: "what-we-collect",
    heading: "What we collect, and when",
    body: [
      "We only collect information you give us, and only where you have asked us to do something with it. There is no tracking on this website and no profile is built from your browsing.",
      [
        "Enquiry and quote requests — your name, email address, phone number if you give one, the room or service you are asking about, and whatever you write in the message.",
        "Booking a survey — the above, plus the address of the property to be surveyed and the times you are available, because we cannot come and measure a room without knowing where it is.",
        "During a project — measurements, photographs of the rooms we are working in, drawings, correspondence, and the invoicing details needed to be paid.",
        "Server logs — your IP address and browser user-agent are processed transiently by our hosting provider to serve the page and to protect against abuse. These are not used to identify you and are not combined with anything else.",
      ],
      "We do not ask for, and would rather you did not send us, any special category data (health, beliefs, and so on). If a room has to be designed around a medical need or a disability, tell us only what we need in order to design it correctly.",
    ],
  },
  {
    id: "why-and-lawful-basis",
    heading: "Why we use it, and our lawful basis",
    body: [
      "Under Article 6 of the UK GDPR every use of personal data needs a lawful basis. Ours are:",
      [
        "Steps taken at your request before entering a contract (Art. 6(1)(b)) — answering an enquiry, arranging and carrying out a survey, and preparing a quotation.",
        "Performance of a contract (Art. 6(1)(b)) — designing, making, fitting and guaranteeing work you have ordered, and invoicing for it.",
        "Legal obligation (Art. 6(1)(c)) — keeping accounting and tax records, and any records required by consumer law.",
        "Legitimate interests (Art. 6(1)(f)) — keeping a record of the work we have done so we can honour the guarantee on it, and defending ourselves if a dispute arises. We have considered your interests against ours and consider this balance fair because the data is limited to what the job required.",
        "Consent (Art. 6(1)(a)) — only for optional things, such as using a photograph of your finished room in our portfolio. We ask separately, in writing, and you can withdraw it at any time.",
      ],
      "We do not sell your data, we do not share it for anyone else's marketing, and we do not send marketing email unless you have asked us to.",
    ],
  },
  {
    id: "photographs",
    heading: "Photographs of your home",
    body: [
      "We photograph rooms during a survey and again on completion. Survey photographs are working documents — they exist so the workshop can see the wall it is building for — and they are never published.",
      "Completion photographs are only ever used publicly with your separate written consent, and that consent is genuinely optional: it has no effect on the price, the timescale or anything else about your job. If you consent and later change your mind, tell us and we will remove the images from our website and social channels. We cannot recall copies other people have already saved or shared, and we will say so honestly rather than promise otherwise.",
    ],
  },
  {
    id: "sharing",
    heading: "Who else sees it",
    body: [
      "As few people as possible. We do not use subcontracted fitters, so nobody outside our own team is in your home.",
      [
        "Our hosting and email providers, who process data on our instructions under a written contract (UK GDPR Art. 28).",
        "Our accountant, for invoicing and statutory records.",
        "Suppliers, where a specific item has to be ordered to your address — and then only the delivery details.",
        "A public authority, where we are legally required to disclose something.",
      ],
      "Where a processor is outside the UK, we rely on UK adequacy regulations or on the International Data Transfer Addendum, and we will tell you which if you ask.",
    ],
  },
  {
    id: "retention",
    heading: "How long we keep it",
    body: [
      "Only as long as there is a reason to.",
      [
        "Enquiries that do not become jobs — up to 12 months, then deleted.",
        "Survey notes and drawings for a quotation you did not accept — up to 12 months.",
        "Completed projects — for the life of the workmanship guarantee plus 1 year, so we can honour a claim against the actual drawings.",
        "Invoices and accounting records — 6 years after the end of the relevant financial year, as required by HMRC.",
        "Consent records for photographs — for as long as the photograph is in use, plus 1 year.",
      ],
    ],
  },
  {
    id: "your-rights",
    heading: "Your rights",
    body: [
      "Under the UK GDPR you have the right to be informed, of access, to rectification, to erasure, to restrict processing, to data portability, to object, and rights relating to automated decision-making. We make no automated decisions about you and do no profiling.",
      "To exercise any of these, email [PRIVACY EMAIL] or write to us at the registered office above. We will respond within one month. There is no charge, and we will not ask you to justify the request.",
      "If you are unhappy with how we have handled your information you can complain to the Information Commissioner's Office at ico.org.uk, on 0303 123 1113, or at Wycliffe House, Water Lane, Wilmslow, Cheshire SK9 5AF. We would rather you came to us first so we can put it right, but you do not have to.",
    ],
  },
  {
    id: "security",
    heading: "Keeping it safe",
    body: [
      "The website is served over HTTPS. Access to project records is limited to the people working on your job. Devices are password-protected and encrypted, and we review who has access when someone joins or leaves.",
      "If a breach occurs that is likely to result in a risk to your rights and freedoms, we will report it to the ICO within 72 hours and tell you directly where the risk is high.",
    ],
  },
  {
    id: "changes",
    heading: "Changes to this notice",
    body: [
      `This notice was last updated on ${UPDATED}. If we change it materially we will update the date at the top and, where the change affects how we use data you have already given us, we will contact you rather than rely on you noticing.`,
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalSheet
      index="L1"
      eyebrow="Privacy"
      title="What we do with your information."
      intro="Short version: we collect what we need to measure your room, quote for it, build it and be paid for it — and nothing else. There is no tracking on this site, no advertising, and nothing is sold or shared for anyone else's marketing. The long version is below, in the order the law asks for it."
      updated={UPDATED}
      clauses={CLAUSES}
      contact={[
        { label: "Contact us", href: "/contact" },
        { label: "Cookie policy", href: "/cookies" },
        { label: "Terms & conditions", href: "/terms" },
      ]}
    />
  );
}
