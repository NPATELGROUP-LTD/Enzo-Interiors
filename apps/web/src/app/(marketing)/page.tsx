// Landing page redesign: stays a Server Component (async, fetches
// services/portfolio/testimonials from src/lib/content) composing the
// reusable, self-contained landing/* section components.
//
// TEMPORARY: sections below the Hero v3 sequence are still disabled while
// the Navbar is being reworked in isolation, so it's easy to review without
// scrolling past the rest of the page. Hero itself is live again
// (feature/hero-frame-scroll-v3) — the earlier static navbar-preview
// placeholder is gone. HeroParallaxCTA also exists but is intentionally not
// wired in yet while the hero scroll mechanics are still being iterated on.
// Restore the remaining imports and JSX below to bring the full landing
// page back.
//
// import { ServicesBento } from "@/components/landing/ServicesBento";
// import { ProcessTimeline } from "@/components/landing/ProcessTimeline";
// import { WhyEnzoBento } from "@/components/landing/WhyEnzoBento";
// import { PortfolioMasonry } from "@/components/landing/PortfolioMasonry";
// import { TestimonialsMarquee } from "@/components/landing/TestimonialsMarquee";
// import { BookingCTA } from "@/components/landing/BookingCTA";
// import { InstagramGrid } from "@/components/landing/InstagramGrid";
// import { getServices, getTestimonials, getPortfolioItems } from "@/lib/content";
import { Hero } from "@/components/landing/Hero";

export default async function HomePage() {
  // const [services, testimonials, portfolioItems] = await Promise.all([
  //   getServices(),
  //   getTestimonials(),
  //   getPortfolioItems(),
  // ]);

  return (
    <div>
      <Hero />
      {/*
      <HeroParallaxCTA />
      <ServicesBento services={services} />
      <ProcessTimeline />
      <WhyEnzoBento />
      <PortfolioMasonry items={portfolioItems} />
      <TestimonialsMarquee testimonials={testimonials} />
      <BookingCTA />
      <InstagramGrid items={portfolioItems} />
      */}
    </div>
  );
}
