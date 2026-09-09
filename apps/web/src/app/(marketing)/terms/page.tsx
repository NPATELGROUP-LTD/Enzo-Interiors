// /terms — website terms, and the consumer-law position on the work itself.
//
// ── Read this before editing ──
// Two different things get confused on pages like this and are kept apart
// here. Terms of *website use* (clauses 1–4) govern reading this site. Terms
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
// solicitor before launch. This file is not legal advice.
import type { Metadata } from "next";
import { LegalSheet, type LegalClause } from "@/components/legal/LegalSheet";

export const metadata: Metadata = {
  title: "Terms & Conditions — Enzo Interiors",
  description:
    "Terms for using the Enzo Interiors website, and your statutory rights when you order fitted furniture from us.",
};

const UPDATED = "5 September 2026";

const CLAUSES: LegalClause[] = [
  {
    id: "who",
    heading: "Who these terms are with",
    body: [
      "This website is operated by [REGISTERED COMPANY NAME], company number [COMPANY NUMBER], registered office [REGISTERED ADDRESS], VAT number [VAT NUMBER], trading as Enzo Interiors. References to “we”, “us” and “our” mean that company.",
      "By using this website you accept these terms. If you do not accept them, please do not use the site.",
    ],
  },
  {
    id: "site-use",
    heading: "Using this website",
    body: [
      "You may read, print and download material from this site for your own use in considering whether to engage us. You may not republish it, sell it, or use it to train an automated system, without our written permission.",
      "We try to keep the site available and correct, but we do not guarantee that it will be uninterrupted or error-free, and we may change or withdraw any part of it without notice.",
    ],
  },
  {
    id: "content-accuracy",
    heading: "Prices, images and figures on this site",
    body: [
      "Every figure on this website is indicative and is offered as a planning guide. It is not a quotation and it is not an offer capable of acceptance. We do not price a room we have not measured, and the only binding figure is the one in a written quotation issued after a survey.",
      "3D models and renders on this site are illustrative. They show construction principles and typical arrangements, not your room. Photographs show work we have completed for other clients; timber, paint and stone vary between batches, and a finish will not be identical to a photograph of it.",
      "Lead times quoted on this site are typical rather than promised. Your quotation will carry the lead time for your job.",
    ],
  },
  {
    id: "enquiries",
    heading: "Enquiries and surveys",
    body: [
      "Submitting an enquiry or booking a survey does not create a contract for work and commits you to nothing. The survey is free and carries no obligation.",
      "We ask that the property is accessible at the agreed time and that anyone whose agreement is needed for the work is available or has been consulted. If we cannot survey because access was not available, we will simply rearrange.",
    ],
  },
  {
    id: "your-rights",
    heading: "Your rights when you order work",
    body: [
      "Nothing on this website or in our contract terms removes or limits your statutory rights. Under the Consumer Rights Act 2015 goods we supply must be of satisfactory quality, fit for purpose and as described, and services must be performed with reasonable care and skill.",
      "Because we survey in your home, a contract signed there or shortly afterwards is likely to be an off-premises contract under the Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013. That gives you 14 days to cancel without giving a reason. Bespoke goods can be excepted from that right, but only where you have expressly requested that we begin and have acknowledged that you will lose the right — we will never treat you as having waived it silently, and we do not start cutting before that point.",
      "Full terms of supply — deposits, stage payments, variations, delays, guarantee and cancellation — are issued with your written quotation and form the contract. Please read them before you sign; ask us about anything in them and we will explain it in plain English.",
    ],
  },
  {
    id: "guarantee",
    heading: "Guarantee",
    body: [
      "Our workmanship is guaranteed for [GUARANTEE PERIOD] from completion. The guarantee covers our joinery, our fixings and our fitting. It does not cover damage, misuse, alteration by others, or normal movement of the building and of natural materials.",
      "Manufacturers' guarantees on appliances, hinges and runners are passed to you and run alongside this one; they do not replace it and they do not affect your statutory rights.",
    ],
  },
  {
    id: "liability",
    heading: "Liability",
    body: [
      "We do not exclude or limit liability for death or personal injury caused by our negligence, for fraud, or for anything else that cannot lawfully be excluded — and we would not try to.",
      "In relation to this website specifically, we are not liable for loss arising from reliance on indicative figures, illustrative renders or typical lead times published here, for the reasons set out above.",
    ],
  },
  {
    id: "complaints",
    heading: "If something goes wrong",
    body: [
      "Tell us. Email [COMPLAINTS EMAIL] or call the number on the contact page, and we will acknowledge within [ACKNOWLEDGEMENT PERIOD] and set out what we propose to do.",
      "If we cannot resolve it between us, you may be able to refer the matter to an alternative dispute resolution provider: [ADR PROVIDER, IF A MEMBER]. You can also seek advice from Citizens Advice on 0808 223 1133.",
    ],
  },
  {
    id: "law",
    heading: "Law and jurisdiction",
    body: [
      "These terms are governed by the law of England and Wales, and the courts of England and Wales have jurisdiction. If you live in Scotland or Northern Ireland you may also bring proceedings in your own courts.",
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalSheet
      index="L2"
      eyebrow="Terms"
      title="What you can expect, and what we ask."
      intro="These terms cover using this website. The terms for a job — deposits, timings, variations and cancellation — come with your written quotation, because they depend on the room. Nothing here reduces the rights the Consumer Rights Act gives you, and clause 5 says what those are."
      updated={UPDATED}
      clauses={CLAUSES}
      contact={[
        { label: "Privacy policy", href: "/privacy" },
        { label: "Cookie policy", href: "/cookies" },
        { label: "Contact us", href: "/contact" },
      ]}
    />
  );
}
