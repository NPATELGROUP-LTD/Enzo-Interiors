// /services/[category] — the service detail page.
//
// ── Every section is four designs, not one ──
// A service page is a hero, an "included" section, a 3D model, the process,
// the investment, questions and a close. Each of those exists in four
// genuinely different layouts, and a page uses the same variant index
// across all of them. So the four published services are four different
// pages end to end — different arrangements, different scroll mechanics,
// different ground sequences — rather than one template with the nouns
// swapped.
//
//        Sheet  variant 0        variant 1         variant 2         variant 3
//   A1  Hero    Masthead         Overlap           PlanCentre        SpecCard
//   A2  Scope   one quotation sheet; its ground alternates per variant
//   A3  Model   KitchenRun       WardrobeBay       MediaWall         WalkIn
//   A4  Proc.   Rail             Timeline          Stair             Assembly
//   A5  Invest  Sheets           Slider            Display           Doors
//   A6  Q&A     accordion (shared; ground alternates with the variant)
//
// The heroes differ in ground as well as layout — cream, near-black,
// forest, warm grey — which is what finally stopped the four pages opening
// identically. See hero/ServiceHero.tsx for the full reasoning.
//
// A3 used to be a finish/material display. It is now a turnable 3D model of
// the product itself: four ways of listing the same finish names was four
// ways of showing a colour chart, and a colour chart is not what anyone is
// trying to picture.
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
import { QuoteModalRoot } from "@/components/services/shared/QuoteRequestModal";
import { QuestionsNotes } from "@/components/services/shared/QuestionsNotes";
import { BookSurveyCta } from "@/components/services/shared/BookSurveyCta";
import { ServiceHero } from "@/components/services/service-detail/hero/ServiceHero";
import { ServiceIncluded } from "@/components/services/service-detail/included/ServiceIncluded";
import { ServiceModel } from "@/components/services/service-detail/model/ServiceModel";
import { ServiceProcess } from "@/components/services/service-detail/process/ServiceProcess";
import { ServiceInvestment } from "@/components/services/service-detail/investment/ServiceInvestment";
import { variantIndex } from "@/components/services/service-detail/variant";
import {
  fill,
  getCompany,
  getPage,
  getService,
  getServiceSlugs,
  getServiceDetails,
} from "@/lib/content";
import { getServiceMetrics } from "@/lib/service-metrics";

// SSG + ISR per docs/Enzo_Interiors_TRD_v3.1.md §9 (image-heavy detail page).
export const revalidate = 3600;

export async function generateStaticParams() {
  return (await getServiceSlugs()).map((category) => ({ category }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const [service, content] = await Promise.all([
    getService(category),
    getPage("service-detail"),
  ]);
  if (!service) return {};

  // Both halves come off the service record; only the suffix is page copy.
  return {
    title: fill(content.metadata.titleTemplate, { title: service.title }),
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

  const [all, content, shared, company] = await Promise.all([
    getServiceDetails(),
    getPage("service-detail"),
    getPage("shared"),
    getCompany(),
  ]);
  const position = all.findIndex((entry) => entry.slug === service.slug);
  const metrics = getServiceMetrics(service);
  const variant = variantIndex(position, QUESTION_GROUNDS.length, service.heroVariant);

  // The page's copy names the room in the reader's own words rather than
  // repeating the service title: "{categoryLower}" and "{titleLower}" are
  // filled from the one record this page is about.
  const categoryLower = service.category.toLowerCase();
  const titleLower = service.title.toLowerCase();

  return (
    <QuoteModalRoot
      serviceTitle={service.title}
      category={service.slug}
      content={shared.quoteModal}
    >
      {/* No quoteCta prop: each hero renders its own quote button, because
          the button has to be styled for its own ground — the four heroes
          now sit on cream, near-black, forest and warm grey. */}
      <ServiceHero
        id="sheet-hero"
        service={service}
        position={position}
        content={content.hero}
      />

      <ServiceIncluded
        id="sheet-included"
        service={service}
        position={position}
        content={content.included}
      />

      <ServiceModel
        id="sheet-model"
        service={service}
        position={position}
        content={content.model}
      />

      <ServiceProcess
        id="sheet-process"
        service={service}
        steps={service.process}
        position={position}
        content={content.process}
      />

      <ServiceInvestment
        id="sheet-investment"
        service={service}
        category={service.slug}
        pricing={service.pricing}
        position={position}
        content={content.investment}
        roomSizeContent={shared.roomSize}
      />

      <QuestionsNotes
        id="sheet-questions"
        index={content.questions.index}
        lines={content.questions.lines.map((line) => fill(line, { categoryLower }))}
        lede={fill(content.questions.lede, { titleLower })}
        faqs={service.faqs}
        content={shared.questions}
        className={QUESTION_GROUNDS[variant]}
      />

      <BookSurveyCta
        id="sheet-cta"
        lines={content.cta.lines}
        lede={fill(content.cta.lede, { titleLower })}
        ctaLabel={content.cta.ctaLabel}
        ctaHref={fill(content.cta.ctaHref, { slug: service.slug })}
        image={service.image}
        imageAlt={service.title}
        // No finish count here any more — the material displays are gone
        // from these pages, so a "12 finishes" fact would be the last
        // surviving trace of a section that no longer exists.
        facts={[
          fill(content.cta.facts.leadTime, { timeline: metrics.timeline }),
          metrics.fromPriceLabel
            ? fill(content.cta.facts.fromPrice, { price: metrics.fromPriceLabel })
            : content.cta.facts.fromPriceFallback,
          content.cta.facts.design,
          content.cta.facts.guarantee,
        ]}
        content={shared.bookSurveyCta}
        company={company}
      />
    </QuoteModalRoot>
  );
}
