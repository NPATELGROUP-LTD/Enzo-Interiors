// Ported from Boilerplate:src/app/components/pages/ServicesPage.tsx.
// Server Component — fetches services via src/lib/content's getServices()
// (the four services already carry `features` + `slug`, merged into
// src/lib/content/services.ts during this port). The only interactive
// piece is the FAQ accordion, which is the shared
// src/components/shared/FAQAccordion.tsx Client Component.
import Link from "next/link";
import { Check } from "lucide-react";
import { ScrollReveal } from "@/components/shared/ScrollReveal";
import { SectionLabel } from "@/components/shared/SectionLabel";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { FAQAccordion, type FAQEntry } from "@/components/shared/FAQAccordion";
import { getServices } from "@/lib/content";

const faqs: FAQEntry[] = [
  {
    q: "How long does a typical project take?",
    a: "Most projects take between 4-8 weeks from initial consultation to final installation. This includes the design phase, manufacturing, and fitting.",
  },
  {
    q: "Do you offer free consultations?",
    a: "Yes! We offer completely free, no-obligation home consultations. We'll visit your space, discuss your ideas, and provide expert advice.",
  },
  {
    q: "What areas do you cover?",
    a: "We're based in Leicester and cover the whole of Leicestershire, including Oadby, Wigston, Market Harborough, Loughborough, and surrounding areas.",
  },
  {
    q: "Can I choose my own materials and colours?",
    a: "Absolutely. We offer an extensive range of materials, colours, and finishes. We'll bring samples to your home so you can see how they look in your space.",
  },
  {
    q: "Do you provide a guarantee?",
    a: "Yes, all our work comes with a comprehensive 5-year workmanship guarantee, giving you complete peace of mind.",
  },
];

export default async function ServicesPage() {
  const services = await getServices();

  return (
    <div>
      {/* Hero */}
      <section className="relative h-[50vh] min-h-[400px] flex items-center justify-center bg-enzo-forest">
        <div className="text-center">
          <p className="text-enzo-sage text-[12px] uppercase tracking-[0.2em] mb-4">
            <Link href="/" className="hover:text-enzo-cream transition-colors">
              Home
            </Link>{" "}
            / Services
          </p>
          <h1
            className="text-enzo-cream"
            style={{ fontSize: "clamp(2.5rem, 5vw, 4.5rem)" }}
          >
            Our Services
          </h1>
        </div>
      </section>

      {/* Service Sections */}
      {services.map((service, i) => (
        <section
          key={service.slug}
          className={`py-24 ${i % 2 === 0 ? "bg-background" : "bg-card"}`}
        >
          <div className="max-w-[1400px] mx-auto px-6 md:px-12">
            <div
              className={`flex flex-col ${i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"} gap-12 items-center`}
            >
              <ScrollReveal className="md:w-[55%]">
                <div className="rounded-2xl overflow-hidden">
                  <ImageWithFallback
                    src={service.image}
                    alt={service.title}
                    className="w-full h-[400px] md:h-[500px] object-cover"
                  />
                </div>
              </ScrollReveal>
              <ScrollReveal className="md:w-[45%]" delay={0.15}>
                <SectionLabel
                  text={service.title.split(" ")[1] || service.title}
                  className="!justify-start"
                />
                <h2
                  className="text-primary mt-4"
                  style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)" }}
                >
                  {service.title}
                </h2>
                <p className="text-muted-foreground mt-4 text-[15px] leading-relaxed">
                  {service.description}
                </p>
                <ul className="mt-6 space-y-3">
                  {service.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-center gap-3 text-foreground text-[14px]"
                    >
                      <Check size={16} className="text-primary flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/services/${service.slug}`}
                  className="inline-flex items-center mt-8 px-8 py-3 rounded-full bg-primary text-primary-foreground text-[14px] tracking-wide hover:bg-enzo-forest-light transition-all duration-300"
                >
                  View Full Details &rarr;
                </Link>
              </ScrollReveal>
            </div>
          </div>
        </section>
      ))}

      {/* FAQ */}
      <section className="py-24 bg-background">
        <div className="max-w-3xl mx-auto px-6 md:px-12">
          <ScrollReveal>
            <SectionLabel text="FAQs" />
            <h2
              className="text-center text-primary mt-4"
              style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)" }}
            >
              Frequently Asked Questions
            </h2>
          </ScrollReveal>
          <div className="mt-12">
            <FAQAccordion faqs={faqs} />
          </div>
        </div>
      </section>
    </div>
  );
}
