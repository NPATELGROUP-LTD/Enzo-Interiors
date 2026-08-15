"use client";

import { ScrollReveal } from "@/components/shared/ScrollReveal";
import { TestimonialsColumn } from "@/components/shared/TestimonialsColumn";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { Testimonial } from "@/lib/content";

interface TestimonialsMarqueeProps {
  testimonials: Testimonial[];
}

export function TestimonialsMarquee({ testimonials }: TestimonialsMarqueeProps) {
  const isMobile = !useMediaQuery("(min-width: 768px)");
  const col1 = testimonials.slice(0, 3);
  const col2 = testimonials.slice(3, 6);
  const col3 = testimonials.slice(6, 9);

  return (
    <section className="relative overflow-hidden bg-card py-24 md:py-32">
      <div className="mx-auto max-w-[1400px] px-6 md:px-12">
        <ScrollReveal>
          <div className="mb-5 flex justify-center">
            <div className="rounded-lg border border-border px-4 py-1 text-[13px] text-secondary">
              Client Stories
            </div>
          </div>
          <h2
            className="mt-2 text-center text-primary"
            style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
          >
            What Our Clients Say.
          </h2>
          <p className="mt-4 text-center text-[15px] text-muted-foreground">
            See what our customers have to say about us.
          </p>
        </ScrollReveal>

        {/* Mobile: a single static, non-animating column — an infinitely
            scrolling marquee is harder to read while the user is also
            trying to scroll the page on a small screen. */}
        {isMobile ? (
          <div className="mt-10 flex flex-col gap-4">
            <TestimonialsColumn testimonials={col1} static />
          </div>
        ) : (
          <div
            className="mt-10 flex max-h-[740px] justify-center gap-6 overflow-hidden"
            style={{
              maskImage:
                "linear-gradient(to bottom, transparent, black 25%, black 75%, transparent)",
            }}
          >
            <TestimonialsColumn testimonials={col1} duration={15} />
            <TestimonialsColumn
              testimonials={col2}
              duration={19}
              reverse
              className="hidden md:block"
            />
            <TestimonialsColumn testimonials={col3} duration={17} className="hidden lg:block" />
          </div>
        )}
      </div>
    </section>
  );
}
