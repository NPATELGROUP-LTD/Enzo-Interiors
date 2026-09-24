// Landing page. Stays a Server Component (async, fetches services /
// portfolio / testimonials / page copy from src/lib/content) composing the
// self-contained landing/* section components.
//
// Section order below is deliberate rather than inherited. The hero ends
// in near-black, so the page opens into cream (01), stays on paper for the
// drawing (02), drops back to forest for the craft diagram (03), lifts to
// white for the work index (04), warms to sand for the client reviews
// (05), and closes on near-black again so the footer's darker ground reads
// as a continuation instead of a cut. No two neighbouring sections share a
// layout idiom or a scroll mechanic — an asymmetric board of plates, a
// sticky scroll-driven drawing, a click-and-drag 3D viewer, a drifting photo wall,
// staggered quote cards, counter-running marquees — which is what keeps six
// sections from blurring together. Only one of them (02) is driven by scroll
// position, deliberately: two scroll-choreographed sections in a row read as
// the same section twice.
//
// The former BookingCTA and InstagramGrid are now one section
// (StudioInvite): the hero already closes on a booking CTA, so a second
// full-bleed one mid-page was repeating the ask rather than building on it.
import type { Metadata } from "next";

import { Hero } from "@/components/landing/Hero";
import { ServicesBoard } from "@/components/landing/ServicesBoard";
import { ProcessLedger } from "@/components/landing/ProcessLedger";
import { WorkshopModule } from "@/components/landing/WorkshopModule";
import { WorkIndex } from "@/components/landing/WorkIndex";
import { ClientVoices } from "@/components/landing/ClientVoices";
import { StudioInvite } from "@/components/landing/StudioInvite";
import {
  getCompany,
  getHeroRooms,
  getPage,
  getPortfolioItems,
  getServices,
  getTestimonials,
  media,
} from "@/lib/content";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { metadata } = await getPage("home");
  return pageMetadata({ ...metadata, path: "/", ogKey: "home" });
}

export default async function HomePage() {
  const [services, testimonials, portfolioItems, content, rooms, company] =
    await Promise.all([
      getServices(),
      getTestimonials(),
      getPortfolioItems(),
      getPage("home"),
      getHeroRooms(),
      getCompany(),
    ]);

  // The hero's media ids are resolved here, on the server. The hero picks its
  // variant at runtime in the browser, so it cannot look them up itself
  // without shipping the whole media table to the client.
  const heroImages = {
    loaderLogo: media(content.hero.loader.logoId),
    ctaCard: media(content.hero.cta.card.imageId),
    ctaShowcase: content.hero.cta.imageIds.map(media),
  };

  return (
    <div>
      <Hero
        hero={content.hero}
        heroStatic={content.heroStatic}
        rooms={rooms}
        images={heroImages}
        staticImages={content.heroStatic.imageIds.map(media)}
      />
      <ServicesBoard services={services} content={content.servicesBoard} />
      <ProcessLedger content={content.process} />
      <WorkshopModule
        content={content.workshop}
        fallbackImage={media(content.workshop.fallback.imageId)}
      />
      <WorkIndex items={portfolioItems} content={content.work} />
      <ClientVoices testimonials={testimonials} content={content.voices} />
      <StudioInvite
        items={portfolioItems}
        content={content.invite}
        company={company}
      />
    </div>
  );
}
