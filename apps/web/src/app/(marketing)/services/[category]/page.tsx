// /services/[category] — the service detail page.
//
// ── Every section is four designs, not one ──
// A service page is a hero, an "included" section, finishes, process,
// investment, questions and a close. Each of those exists in four genuinely
// different layouts, and a page uses the same variant index across all of
// them. So the four published services are four different pages end to end
// — different arrangements, different scroll mechanics, different ground
// sequences — rather than one template with the nouns swapped.
//
//        Sheet  variant 0        variant 1         variant 2         variant 3
//   A1  Hero    SplitPlate       PhotoOverlay      DrawingLed        CentredStack
//   A2  Incl.   Ledger           Spine             Shelving          Manifest
//   A3  Finish  Block3D          SwatchWall        Columns           Pairing
//   A4  Proc.   Rail             Timeline          Stair             Cards
//   A5  Invest  Sheets           Ladder            Table             Focus
//   A6  Q&A     accordion (shared; ground alternates with the variant)
//
// See src/components/services/README.md for the file map and
// service-detail/variant.ts for how the index is chosen.
//
// ── Built to be authored, not hardcoded ──
// In production the client publishes services themselves, so this template
// never assumes the shape of the record it is given: variable-length
// features, process steps, tiers, materials and FAQs throughout, and an
// empty array drops its section rather than rendering an empty one. The
// variant is derived from the service's published position, so a fifth
// service starts the cycle again with no authoring; `heroVariant` on the
// record pins a page to one design set when someone wants to choose.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  QuoteModalRoot,
  QuoteTriggerButton,
} from "@/components/services/shared/QuoteRequestModal";
import { QuestionsAccordion } from "@/components/services/shared/QuestionsAccordion";
import { BookSurveyCta } from "@/components/services/shared/BookSurveyCta";
import { ServiceHero } from "@/components/services/service-detail/hero/ServiceHero";
import { ServiceIncluded } from "@/components/services/service-detail/included/ServiceIncluded";
import { ServiceFinishes } from "@/components/services/service-detail/finishes/ServiceFinishes";
import { ServiceProcess } from "@/components/services/service-detail/process/ServiceProcess";
import { ServiceInvestment } from "@/components/services/service-detail/investment/ServiceInvestment";
import { variantIndex } from "@/components/services/service-detail/variant";
import { getService, getServiceSlugs, getServiceDetails } from "@/lib/content";
import { getServiceMetrics } from "@/lib/service-metrics";

// SSG + ISR per docs/Enzo_Interiors_TRD_v3.1.md §9 (image-heavy detail page).
export const revalidate = 3600;

export function generateStaticParams() {
  return getServiceSlugs().map((category) => ({ category }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const service = await getService(category);
  if (!service) return {};

  return {
    title: `${service.title} — Enzo Interiors`,
    description: service.heroDesc,
  };
}

/**
 * The questions section is shared rather than four separate components —
 * an accordion is an accordion — so its *ground* alternates with the
 * variant instead, which is what stops the bottom of all four pages
 * landing on the same colour.
 */
const QUESTION_GROUNDS = ["bg-background", "bg-muted", "bg-card", "bg-background"];

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const service = await getService(category);

  // An unrecognised slug 404s rather than silently falling back to kitchens
  // the way the react-router boilerplate did — the correct behaviour for a
  // statically generated route.
  if (!service) {
    notFound();
  }

  const all = await getServiceDetails();
  const position = all.findIndex((entry) => entry.slug === service.slug);
  const metrics = getServiceMetrics(service);
  const variant = variantIndex(position, QUESTION_GROUNDS.length, service.heroVariant);

  return (
    <QuoteModalRoot serviceTitle={service.title} category={service.slug}>
      <ServiceHero
        id="sheet-hero"
        service={service}
        position={position}
        quoteCta={
          <QuoteTriggerButton className="rounded-full bg-enzo-cream px-7 py-3.5 text-[14px] font-medium text-enzo-forest transition-colors duration-300 hover:bg-enzo-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-2 focus-visible:ring-offset-enzo-dark">
            Get a free quote
          </QuoteTriggerButton>
        }
      />

      <ServiceIncluded id="sheet-included" service={service} position={position} />

      <ServiceFinishes id="sheet-finishes" service={service} position={position} />

      <ServiceProcess
        id="sheet-process"
        service={service}
        steps={service.process}
        position={position}
      />

      <ServiceInvestment
        id="sheet-investment"
        service={service}
        category={service.slug}
        pricing={service.pricing}
        position={position}
      />

      <QuestionsAccordion
        id="sheet-questions"
        index="A6"
        lines={["Questions about", service.category.toLowerCase() + "."]}
        lede={`The things people ask before committing to ${service.title.toLowerCase()}. Anything else, just call — we would rather answer it now than after you have ordered.`}
        faqs={service.faqs}
        className={QUESTION_GROUNDS[variant]}
      />

      <BookSurveyCta
        id="sheet-cta"
        lines={["Let's measure", "your room."]}
        lede={`A free survey, in your home, with no obligation attached. We will tell you honestly what your ${service.title.toLowerCase()} project needs before anyone talks about money.`}
        ctaLabel="Book a consultation"
        ctaHref={`/booking?service=${service.slug}`}
        facts={[
          `${metrics.timeline} lead time`,
          metrics.fromPriceLabel ? `From ${metrics.fromPriceLabel}` : "Quoted per room",
          `${metrics.finishes} finishes`,
          "5-year guarantee",
        ]}
      />
    </QuoteModalRoot>
  );
}
