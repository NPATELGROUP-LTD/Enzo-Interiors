// /services — the discipline index.
//
// Five sections, no two sharing a layout or a scroll mechanic. See
// src/components/services/README.md for the file map.
//
//   01  IndexHero          the drawing, driven by the list under it (dark)
//   02  IndexPricingScale  one money scale, pinned and drawn by scroll (cream)
//   03  IndexConstants     a travelling rule inks each promise in (forest)
//   04  QuestionsNotes     the answers, typeset in two columns; below lg, a
//                          closed accordion (`mobileAccordion`) (off-white)
//   05  IndexClosing       the ask, set on a drawing sheet (near-black)
//
// Grounds run dark → cream → forest → off-white → dark, so the footer's
// darker ground reads as a continuation rather than a cut — the same
// reasoning as the landing page's section order.
//
// §02 is the only pinned section on the page, and it is the only one that
// should be: it takes the screen for one idea, holds it while the visitor
// draws the scale with their own wheel, and hands it back. Adding a second
// pin below it would turn the page into a slideshow and would also mean two
// triggers competing to re-measure everything under them.
//
// Stays a Server Component: it fetches the records and hands them down.
// Every section is written against `ServiceDetail[]` of any length, because
// in production the client publishes services themselves from the Admin
// Content Manager — nothing here assumes there are four.
import type { Metadata } from "next";
import { IndexHero } from "@/components/services/services-index/IndexHero";
import { IndexPricingScale } from "@/components/services/services-index/IndexPricingScale";
import { IndexConstants } from "@/components/services/services-index/IndexConstants";
import { QuestionsNotes } from "@/components/services/shared/QuestionsNotes";
import { IndexClosing } from "@/components/services/services-index/IndexClosing";
import { getServiceDetails, type FAQEntry } from "@/lib/content";

export const metadata: Metadata = {
  title: "Services — Enzo Interiors",
  description:
    "Fitted kitchens, bedrooms, wardrobes and media walls, drawn for your room and built in our Leicester workshop. See where each discipline starts and what is included.",
};

// Cross-service questions — the ones that are the same whichever discipline
// you pick. Per-service questions live on the service's own page.
const FAQS: FAQEntry[] = [
  {
    q: "How long does a typical project take?",
    a: "Most projects run 4–8 weeks from first consultation to final installation, covering design, manufacture and fitting. Each discipline's own lead time is on its page.",
  },
  {
    q: "Do you offer free consultations?",
    a: "Yes — a completely free, no-obligation home visit. We measure the space, photograph every wall, talk through how you use the room, and give you honest advice on what is worth doing.",
  },
  {
    q: "What areas do you cover?",
    a: "We are based in Leicester and cover the whole of Leicestershire, including Oadby, Wigston, Market Harborough, Loughborough and the surrounding villages.",
  },
  {
    q: "Can I choose my own materials and colours?",
    a: "Absolutely. Each discipline has its own range of finishes, and we bring physical samples to your home so you can see them in your own light before anything is ordered.",
  },
  {
    q: "Do you provide a guarantee?",
    a: "Every installation carries a five-year workmanship guarantee, in writing, whichever service you choose.",
  },
  {
    q: "Can you combine more than one service?",
    a: "Often, yes, and it usually works out better. A bedroom and its wardrobes designed together share finishes, and one visit and one fit means less disruption than booking them separately.",
  },
];

export default async function ServicesPage() {
  const services = await getServiceDetails();

  return (
    <div>
      <IndexHero services={services} />
      <IndexPricingScale services={services} />
      <IndexConstants />
      <QuestionsNotes
        id="services-questions"
        index="04"
        lines={["Asked before", "every job."]}
        lede="The questions that come up whichever discipline you are looking at. Each service page answers its own on top of these."
        faqs={FAQS}
        mobileAccordion
      />
      <IndexClosing services={services} />
    </div>
  );
}
