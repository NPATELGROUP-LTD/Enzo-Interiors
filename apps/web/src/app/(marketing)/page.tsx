// Landing page redesign: stays a Server Component (async, fetches
// services/portfolio/testimonials from src/lib/content) composing the
// reusable, self-contained landing/* section components.
//
// TEMPORARY: every section below Hero is disabled while the Navbar is being
// reworked in isolation, so it's easy to review the dock without scrolling
// past the rest of the page. Hero itself is swapped for a static-background
// placeholder (no video/animation) for the same reason. Restore the imports
// and JSX below to bring the full landing page back.
//
// import { Hero } from "@/components/landing/Hero";
// import { ServicesBento } from "@/components/landing/ServicesBento";
// import { ProcessTimeline } from "@/components/landing/ProcessTimeline";
// import { WhyEnzoBento } from "@/components/landing/WhyEnzoBento";
// import { PortfolioMasonry } from "@/components/landing/PortfolioMasonry";
// import { TestimonialsMarquee } from "@/components/landing/TestimonialsMarquee";
// import { BookingCTA } from "@/components/landing/BookingCTA";
// import { InstagramGrid } from "@/components/landing/InstagramGrid";
// import { getServices, getTestimonials, getPortfolioItems } from "@/lib/content";

export default async function HomePage() {
  // const [services, testimonials, portfolioItems] = await Promise.all([
  //   getServices(),
  //   getTestimonials(),
  //   getPortfolioItems(),
  // ]);

  return (
    <div>
      <section className="relative flex h-screen w-full items-end overflow-hidden bg-[radial-gradient(ellipse_at_top,_#2A5A4A_0%,_#1C4A3A_35%,_#0F241C_75%,_#0A1712_100%)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,_rgba(255,255,255,0.08),_transparent_60%)]" />
        <div className="relative mx-auto w-full max-w-[1400px] px-6 pb-20 md:px-12 md:pb-28">
          <p className="mb-4 text-[12px] uppercase tracking-[0.25em] text-enzo-cream/60">
            Navbar preview — static background
          </p>
          <h1
            className="max-w-3xl text-enzo-cream"
            style={{ fontSize: "clamp(2.75rem, 6vw, 5rem)" }}
          >
            Crafting Bespoke Interiors
          </h1>
        </div>
      </section>
      {/*
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
