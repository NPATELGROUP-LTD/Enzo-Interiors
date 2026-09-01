// /services/[category] — the service detail page, rebuilt as a drawing set.
//
// The previous page was a photo hero with the title dropped on a gradient,
// then five stacked centred sections: description, four process circles,
// three pricing cards, FAQs, CTA. It read as one long column of centred
// text, and every service page looked identical to every other because the
// layout carried none of the content's character.
//
// This is a sheet set instead: each sheet has its own layout and its own
// scroll behaviour — a hard-split cover with a full-bleed photograph, a
// numbered schedule beside a procedurally drawn plan, a draggable 3D finish
// block, a horizontally travelling process rail, fanned investment sheets,
// and a sticky-headed question list. Sheet numbers (A2, A3, …) are carried
// by each section's own heading. Grounds alternate near-black → cream →
// forest → warm grey → off-white → cream → near-black, so no two adjacent
// sheets share a ground or a mechanic.
//
// A floating sheet-index rail used to run down the left margin. Removed:
// the page's content column is 1500px wide, so on every viewport between
// about 1280px and 1620px there is no margin for it to live in and it sat
// on top of the title. A fixed element that needs a gutter the layout does
// not guarantee is a bug waiting for a specific window width.
//
// ── Built to be authored, not hardcoded ──
// In production the client publishes services themselves, so this template
// never assumes the shape of the record it is given:
//   · the title masks up word by word, whatever its length
//   · the schedule numbers however many features exist
//   · the finish block colours itself from finish *names* (lib/finish-swatch)
//   · the process rail measures its own travel, so 3 or 7 stages both work
//   · the investment grid reflows and picks its recommended tier by position
//   · empty process / pricing / materials / FAQ arrays render nothing at all
//     rather than an empty section, so a half-authored draft still looks
//     deliberate.
// Adding a service in the Admin Content Manager is therefore the only step
// needed to get a complete, distinct page.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QuoteModalRoot, QuoteTriggerButton } from "@/components/services/QuoteModal";
import { ServiceQuestions } from "@/components/services/ServiceQuestions";
import { ServiceInviteCta } from "@/components/services/ServiceInviteCta";
import { ServiceCoverSheet } from "@/components/services/detail/ServiceCoverSheet";
import { ServiceSchedule } from "@/components/services/detail/ServiceSchedule";
import { MaterialBlock } from "@/components/services/detail/MaterialBlock";
import { ProcessTrack } from "@/components/services/detail/ProcessTrack";
import { InvestmentSheets } from "@/components/services/detail/InvestmentSheets";
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
  const position = {
    index: all.findIndex((entry) => entry.slug === service.slug),
    total: all.length,
  };
  const metrics = getServiceMetrics(service);

  return (
    <QuoteModalRoot serviceTitle={service.title} category={service.slug}>
      <ServiceCoverSheet
        id="sheet-cover"
        service={service}
        position={position}
        quoteCta={
          <QuoteTriggerButton className="group inline-flex items-center gap-2.5 rounded-full bg-enzo-cream px-7 py-3.5 text-[14px] font-medium text-enzo-forest transition-colors duration-300 hover:bg-enzo-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-2 focus-visible:ring-offset-enzo-dark">
            Get a free quote
          </QuoteTriggerButton>
        }
      />

      <ServiceSchedule id="sheet-schedule" service={service} />

      <MaterialBlock id="sheet-finishes" service={service} />

      <ProcessTrack id="sheet-process" steps={service.process} />

      <InvestmentSheets
        id="sheet-investment"
        category={service.slug}
        pricing={service.pricing}
      />

      <ServiceQuestions
        id="sheet-questions"
        index="A6"
        lines={["Questions about", service.category.toLowerCase() + "."]}
        lede={`The things people ask before committing to ${service.title.toLowerCase()}. Anything else, just call — we would rather answer it now than after you have ordered.`}
        faqs={service.faqs}
        className="bg-background"
      />

      <ServiceInviteCta
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
