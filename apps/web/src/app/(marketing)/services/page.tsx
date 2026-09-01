// /services — the discipline index.
//
// Rebuilt from the ground up. The previous page was a centred title on a
// green band followed by the same image-left / text-right block repeated
// once per service, then an FAQ: a page that told you nothing above the
// fold and got less interesting the further you scrolled.
//
// The replacement is four sections that share a language but no layout and
// no scroll mechanic:
//   01  the index itself, driving a procedural plan drawing (dark)
//   02  a real comparison schedule, revealed as a diagonal wave (cream)
//   03  the constants, inked in by a travelling setting-out line (forest)
//   04  questions, sticky heading against an animated list (off-white)
//   05  the ask, on a clear sheet with registration marks (near-black)
// Grounds run dark → cream → forest → off-white → dark, so the footer's
// darker ground reads as a continuation rather than a cut — the same
// reasoning as the landing page's section order.
//
// Stays a Server Component: it fetches the records and hands them down.
// Every section below is written against `ServiceDetail[]` of any length,
// because in production the client publishes services themselves from the
// Admin Content Manager — nothing here assumes there are four.
import type { Metadata } from "next";
import { ServiceIndexHero } from "@/components/services/ServiceIndexHero";
import { SpecMatrix } from "@/components/services/SpecMatrix";
import { StudioConstants } from "@/components/services/StudioConstants";
import { ServiceQuestions } from "@/components/services/ServiceQuestions";
import { ServiceInviteCta } from "@/components/services/ServiceInviteCta";
import { getServiceDetails, type FAQEntry } from "@/lib/content";

export const metadata: Metadata = {
  title: "Services — Enzo Interiors",
  description:
    "Fitted kitchens, bedrooms, wardrobes and media walls, drawn for your room and built in our Leicester workshop. Compare lead times, starting prices and what is included.",
};

// Cross-service questions — the ones that are the same whichever discipline
// you pick. Per-service questions live on the service's own page.
const FAQS: FAQEntry[] = [
  {
    q: "How long does a typical project take?",
    a: "Most projects run 4–8 weeks from first consultation to final installation, covering design, manufacture and fitting. The schedule above gives the lead time for each discipline individually.",
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
    a: "Absolutely. Each discipline has its own range of finishes — the schedule above shows how many — and we bring physical samples to your home so you can see them in your own light.",
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
      <ServiceIndexHero services={services} />
      <SpecMatrix services={services} />
      <StudioConstants />
      <ServiceQuestions
        id="services-questions"
        index="04"
        lines={["Asked before", "every job."]}
        lede="The questions that come up whichever discipline you are looking at. Each service page answers its own on top of these."
        faqs={FAQS}
      />
      <ServiceInviteCta
        id="services-cta"
        lines={["Start with a", "free survey."]}
        lede="Ninety minutes, in your home, no obligation. We measure the room properly and tell you what it would actually take — before anyone talks about money."
        ctaLabel="Book a consultation"
        ctaHref="/booking"
        facts={[
          "Free home survey",
          "3D design included",
          "5-year guarantee",
          "Leicester workshop",
        ]}
      />
    </div>
  );
}
