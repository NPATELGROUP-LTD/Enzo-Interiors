// /services/[category] — the service detail page.
//
// Six sheets, each with its own layout and its own scroll behaviour. See
// src/components/services/README.md for the file map.
//
//   A1  ServiceHero            one of FOUR hero designs (see below)   dark
//   A2  DetailIncludedRail     drag rail of what is included          cream
//   A3  DetailFinishBlock      draggable CSS-3D finish sample         forest
//   A4  DetailProcessRail      scroll-driven horizontal sequence      warm grey
//   A5  DetailInvestment       tiers with a live room-size estimate   off-white
//   A6  QuestionsAccordion     sticky heading, animated list          cream
//       BookSurveyCta          the ask, type only                     near-black
//
// ── Why the hero is four designs and not one ──
// With a single hero, all four service pages read as one template with the
// nouns swapped, and each of them also read as the /services fold again.
// ServiceHero picks a design from the service's published position, so the
// four are spread evenly and a fifth service simply starts the cycle again
// — no authoring needed, nothing to keep in sync.
//
// ── Built to be authored, not hardcoded ──
// In production the client publishes services themselves, so this template
// never assumes the shape of the record it is given:
//   · the title masks up line by line, whatever its length
//   · the included rail numbers however many features exist and lets the
//     last plate reach the centre of the screen regardless of the count
//   · the finish block colours itself from finish *names* (lib/finish-swatch)
//   · the process rail measures its own travel, so 3 or 7 stages both work
//   · the investment grid reflows and picks its recommended tier by position
//   · empty process / pricing / materials / FAQ arrays render nothing at all
//     rather than an empty section, so a half-authored draft still looks
//     deliberate
// Adding a service in the Admin Content Manager is therefore the only step
// needed to get a complete, distinct page.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  QuoteModalRoot,
  QuoteTriggerButton,
} from "@/components/services/shared/QuoteRequestModal";
import { QuestionsAccordion } from "@/components/services/shared/QuestionsAccordion";
import { BookSurveyCta } from "@/components/services/shared/BookSurveyCta";
import { ServiceHero } from "@/components/services/service-detail/hero/ServiceHero";
import { DetailIncludedRail } from "@/components/services/service-detail/DetailIncludedRail";
import { DetailFinishBlock } from "@/components/services/service-detail/DetailFinishBlock";
import { DetailProcessRail } from "@/components/services/service-detail/DetailProcessRail";
import { DetailInvestment } from "@/components/services/service-detail/DetailInvestment";
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

      <DetailIncludedRail id="sheet-included" service={service} />

      <DetailFinishBlock id="sheet-finishes" service={service} />

      <DetailProcessRail id="sheet-process" steps={service.process} />

      <DetailInvestment
        id="sheet-investment"
        category={service.slug}
        pricing={service.pricing}
      />

      <QuestionsAccordion
        id="sheet-questions"
        index="A6"
        lines={["Questions about", service.category.toLowerCase() + "."]}
        lede={`The things people ask before committing to ${service.title.toLowerCase()}. Anything else, just call — we would rather answer it now than after you have ordered.`}
        faqs={service.faqs}
        className="bg-background"
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
