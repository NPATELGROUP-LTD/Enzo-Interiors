// Ported from Boilerplate:src/app/components/pages/ServiceDetailPage.tsx.
// Server Component using generateStaticParams + revalidate for SSG/ISR per
// docs/Enzo_Interiors_TRD_v3.1.md §9 (image-heavy service detail page).
// Interactive pieces (quote modal + its trigger buttons, FAQ accordion) are
// split into Client Components — see ./QuoteModal.tsx and
// src/components/shared/FAQAccordion.tsx. Everything else (hero, features,
// process, pricing cards) renders on the server.
//
// Deviation from the boilerplate: an unknown slug there silently fell back
// to "kitchens" (an artifact of react-router's client-only routing). Here,
// with real SSG + generateStaticParams, an unrecognised slug 404s via
// notFound() instead — the more correct behavior for a statically generated
// route.
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Star, Clock, Ruler, Palette, Phone } from "lucide-react";
import { ScrollReveal } from "@/components/shared/ScrollReveal";
import { SectionLabel } from "@/components/shared/SectionLabel";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { FAQAccordion } from "@/components/shared/FAQAccordion";
import { SERVICE_DETAILS, SERVICE_SLUGS } from "./data";
import { QuoteModalRoot, QuoteTriggerButton } from "./QuoteModal";
import { QuoteEstimator } from "./QuoteEstimator";

export const revalidate = 3600;

export function generateStaticParams() {
  return SERVICE_SLUGS.map((category) => ({ category }));
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const service = SERVICE_DETAILS[category];

  if (!service) {
    notFound();
  }

  return (
    <QuoteModalRoot serviceTitle={service.title} category={category}>
      <div>
        {/* Hero */}
        <section className="relative h-[60vh] min-h-[500px] flex items-end overflow-hidden">
          <div className="absolute inset-0">
            <ImageWithFallback
              src={service.image}
              alt={service.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />
          </div>
          <div className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-12 pb-16 w-full">
            <p className="text-enzo-sage text-[12px] uppercase tracking-[0.2em] mb-4">
              <Link
                href="/"
                className="hover:text-enzo-cream transition-colors"
              >
                Home
              </Link>
              {" / "}
              <Link
                href="/services"
                className="hover:text-enzo-cream transition-colors"
              >
                Services
              </Link>
              {" / "}
              {service.title}
            </p>
            <h1
              className="text-enzo-cream"
              style={{ fontSize: "clamp(2.5rem, 5vw, 4.5rem)" }}
            >
              {service.title}
            </h1>
            <p className="text-enzo-cream/70 text-[16px] md:text-[18px] mt-4 max-w-2xl">
              {service.heroDesc}
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <QuoteTriggerButton className="px-8 py-3.5 rounded-full bg-primary text-primary-foreground text-[14px] tracking-wide hover:bg-enzo-forest-light transition-all duration-300 border border-enzo-forest-light">
                Get a Free Quote &rarr;
              </QuoteTriggerButton>
              <Link
                href="/booking"
                className="px-8 py-3.5 rounded-full border border-enzo-cream/40 text-enzo-cream text-[14px] tracking-wide hover:bg-enzo-cream/10 transition-all duration-300"
              >
                Book Consultation
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-enzo-sage" />
                <span className="text-enzo-cream/70 text-[13px]">
                  {service.timeline} typical
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Ruler size={16} className="text-enzo-sage" />
                <span className="text-enzo-cream/70 text-[13px]">
                  Free home measurement
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Star size={16} className="text-enzo-sage" />
                <span className="text-enzo-cream/70 text-[13px]">
                  5-year guarantee
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Description */}
        <section className="py-20 bg-background">
          <div className="max-w-[1400px] mx-auto px-6 md:px-12">
            <div className="flex flex-col md:flex-row gap-16">
              <ScrollReveal className="md:w-1/2">
                <SectionLabel text="About This Service" className="!justify-start" />
                <h2
                  className="text-primary mt-4"
                  style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)" }}
                >
                  Crafted With Precision
                </h2>
                <p className="text-muted-foreground mt-6 text-[15px] leading-relaxed">
                  {service.description}
                </p>
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {service.features.map((f) => (
                    <div
                      key={f}
                      className="flex items-center gap-3 text-foreground text-[14px]"
                    >
                      <Check size={16} className="text-primary flex-shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>
              </ScrollReveal>
              <ScrollReveal className="md:w-1/2" delay={0.15}>
                <h3 className="text-primary mb-6" style={{ fontSize: "1.3rem" }}>
                  Materials &amp; Finishes
                </h3>
                <div className="flex flex-wrap gap-2">
                  {service.materials.map((m) => (
                    <span
                      key={m}
                      className="px-4 py-2 rounded-full border border-border text-foreground text-[13px] flex items-center gap-2"
                    >
                      <Palette size={14} className="text-enzo-sage" />
                      {m}
                    </span>
                  ))}
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* Process */}
        <section className="py-20 bg-enzo-forest">
          <div className="max-w-[1400px] mx-auto px-6 md:px-12">
            <ScrollReveal>
              <SectionLabel text="Our Process" light />
              <h2
                className="text-enzo-cream mt-4 text-center"
                style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)" }}
              >
                From Vision to Reality
              </h2>
            </ScrollReveal>
            <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {service.process.map((p, i) => (
                <ScrollReveal key={p.step} delay={i * 0.1}>
                  <div className="relative">
                    <div
                      className="w-12 h-12 rounded-full bg-enzo-cream text-primary flex items-center justify-center text-[14px] mb-4"
                      style={{ fontWeight: 600 }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <h4 className="text-enzo-cream" style={{ fontSize: "1.1rem" }}>
                      {p.step}
                    </h4>
                    <p className="text-enzo-sage text-[14px] mt-2 leading-relaxed">
                      {p.desc}
                    </p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="py-20 bg-card">
          <div className="max-w-[1400px] mx-auto px-6 md:px-12">
            <ScrollReveal>
              <SectionLabel text="Pricing" />
              <h2
                className="text-center text-primary mt-4"
                style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)" }}
              >
                Investment Guide
              </h2>
              <p className="text-center text-muted-foreground mt-3 text-[15px]">
                Every project is unique — these are starting prices for
                guidance. Pick a room size below for an instant estimate.
              </p>
            </ScrollReveal>
            <div className="mt-12">
              <QuoteEstimator category={category} pricing={service.pricing} />
            </div>
          </div>
        </section>

        {/* FAQs */}
        <section className="py-20 bg-background">
          <div className="max-w-3xl mx-auto px-6 md:px-12">
            <ScrollReveal>
              <SectionLabel text="FAQs" />
              <h2
                className="text-center text-primary mt-4"
                style={{ fontSize: "clamp(1.8rem, 3vw, 2.2rem)" }}
              >
                Common Questions
              </h2>
            </ScrollReveal>
            <div className="mt-10">
              <FAQAccordion faqs={service.faqs} exclusive />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-enzo-forest">
          <div className="text-center px-6">
            <h2
              className="text-enzo-cream"
              style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)" }}
            >
              Ready to get started?
            </h2>
            <p className="text-enzo-sage mt-3 text-[16px]">
              Get a free, no-obligation quote for your{" "}
              {service.title.toLowerCase()} project.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <QuoteTriggerButton className="px-10 py-4 rounded-full bg-enzo-cream text-primary text-[15px] hover:bg-white transition-all duration-300">
                Get Your Free Quote
              </QuoteTriggerButton>
              <a
                href="tel:0116XXXXXXX"
                className="flex items-center gap-2 px-10 py-4 rounded-full border border-enzo-cream/40 text-enzo-cream text-[15px] hover:bg-enzo-cream/10 transition-all duration-300"
              >
                <Phone size={16} /> Call Us
              </a>
            </div>
          </div>
        </section>
      </div>
    </QuoteModalRoot>
  );
}
