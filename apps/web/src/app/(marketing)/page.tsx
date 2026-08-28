// Landing page. Stays a Server Component (async, fetches services /
// portfolio / testimonials from src/lib/content) composing the
// self-contained landing/* section components.
//
// Section order below is deliberate rather than inherited. The hero ends
// in near-black, so the page opens into cream (01), stays on paper for the
// drawing (02), drops back to forest for the craft diagram (03), lifts to
// white for the work index (04), warms to sand for the client reviews
// (05), and closes on near-black again so the footer's darker ground reads
// as a continuation instead of a cut. No two neighbouring sections share a
// layout idiom or a scroll mechanic — click-to-open doors, a sticky
// scroll-driven drawing, a click-and-drag 3D viewer, a drifting photo wall,
// staggered quote cards, counter-running marquees — which is what keeps six
// sections from blurring together. Only one of them (02) is driven by scroll
// position, deliberately: two scroll-choreographed sections in a row read as
// the same section twice.
//
// The former BookingCTA and InstagramGrid are now one section
// (StudioInvite): the hero already closes on a booking CTA, so a second
// full-bleed one mid-page was repeating the ask rather than building on it.
import { Hero } from "@/components/landing/Hero";
import { ServicesDoors } from "@/components/landing/ServicesDoors";
import { ProcessLedger } from "@/components/landing/ProcessLedger";
import { WorkshopModule } from "@/components/landing/WorkshopModule";
import { WorkIndex } from "@/components/landing/WorkIndex";
import { ClientVoices } from "@/components/landing/ClientVoices";
import { StudioInvite } from "@/components/landing/StudioInvite";
import { getServices, getTestimonials, getPortfolioItems } from "@/lib/content";

export default async function HomePage() {
  const [services, testimonials, portfolioItems] = await Promise.all([
    getServices(),
    getTestimonials(),
    getPortfolioItems(),
  ]);

  return (
    <div>
      <Hero />
      <ServicesDoors services={services} />
      <ProcessLedger />
      <WorkshopModule />
      <WorkIndex items={portfolioItems} />
      <ClientVoices testimonials={testimonials} />
      <StudioInvite items={portfolioItems} />
    </div>
  );
}
