"use client";

// Section 05 — three reviews, shown at once.
//
// The previous version put one quote on a stage with all nine clients listed
// beside it as a picker, plus an auto-advancing timer and a pause control.
// That is a lot of machinery on a landing page, and the roster was the same
// "long list of details" problem section 04 had. Three quotes read in the
// time it takes to scroll past, and the count still gets stated — as a datum
// in the heading rather than as nine rows.
//
// No timer, so nothing auto-updates and nothing needs pausing. The cards sit
// at different heights and drift at different rates, which is what makes
// three cards read as a considered arrangement rather than a row of boxes.
import { useRef } from "react";
import gsap from "gsap";
import { Quote } from "lucide-react";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { revealWhenVisible, scrollTimeline, useGSAP } from "@/hooks/useGSAP";
import { EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { Testimonial } from "@/lib/content";

interface ClientVoicesProps {
  testimonials: Testimonial[];
}

/** Vertical offset and drift rate per card, so the trio is not a flat row. */
const CARD_LIFT = ["lg:mt-0", "lg:mt-14", "lg:mt-6"];
const CARD_DRIFT = [10, 4, 7];

export function ClientVoices({ testimonials }: ClientVoicesProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const featured = testimonials.slice(0, 3);

  useGSAP(
    sectionRef,
    (section, reduced, { desktop }) => {
      const cards = gsap.utils.toArray<HTMLElement>("[data-voice-card]", section);
      if (!cards.length) return;

      if (reduced) {
        gsap.set(cards, { opacity: 1, y: 0, rotate: 0 });
        return;
      }

      // Cards arrive with a slight counter-rotation that settles to square —
      // enough to read as paper being laid down, not enough to look skewed.
      gsap.set(cards, {
        opacity: 0,
        y: 52,
        rotate: (index: number) => (index % 2 === 0 ? -1.5 : 1.5),
      });

      // The reveal is an IntersectionObserver, not a ScrollTrigger.
      //
      // The quotes used to be missing on most loads and present after a
      // refresh, which is the signature of a cached boundary measured
      // against a document that had not finished happening yet: above this
      // section sit the hero's pinned stage and section 02's sticky 425vh
      // track, and none of the page's photographs have loaded at mount. See
      // revealWhenVisible in hooks/useGSAP.ts for the full account.
      const stopWatching = revealWhenVisible(cards[0]!, () => {
        gsap.to(cards, {
          opacity: 1,
          y: 0,
          rotate: 0,
          duration: 0.95,
          ease: EASE.editorial,
          stagger: 0.1,
        });
      });

      if (!desktop) return stopWatching;

      cards.forEach((card, index) => {
        scrollTimeline(
          (timeline) =>
            timeline.fromTo(
              card,
              { yPercent: -CARD_DRIFT[index % CARD_DRIFT.length]! },
              {
                yPercent: CARD_DRIFT[index % CARD_DRIFT.length]!,
                ease: EASE.linear,
              },
            ),
          {
            trigger: section,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.8,
          },
        );
      });

      return stopWatching;
    },
    { queries: { desktop: "(min-width: 1024px)" } },
  );

  return (
    <section
      ref={sectionRef}
      id="home-reviews"
      aria-labelledby="voices-heading"
      className="relative overflow-hidden bg-enzo-sand scroll-mt-24"
    >
      <div className="mx-auto max-w-[1500px] px-4 py-14 sm:px-6 md:px-12 md:py-20">
        {/* Sand is the mount, cream is the reading surface. Solid forest on
            sand only reaches 6.1:1, which leaves no headroom for the tinted
            secondary text this section needs. */}
        <div className="rounded-[28px] bg-enzo-cream px-5 py-14 sm:px-10 md:px-14 md:py-20">
          <h2 id="voices-heading" className="sr-only">
            Client reviews
          </h2>
          <SectionIntro
            index="05"
            label="Clients"
            datum={`${testimonials.length} reviews · Leicestershire`}
            lines={["What people say", "once we have gone."]}
            lede="The real test of fitted furniture is the year after the fitters leave."
          />

          <div className="mt-10 flex flex-col gap-5 md:gap-6 lg:mt-14 lg:grid lg:grid-cols-3 lg:items-start lg:gap-6">
            {featured.map((testimonial, index) => {
              // Below `lg` only the first quote keeps card chrome; the other
              // two drop to rules. Three identical cards stacked under section
              // 04's vertical run is what made the phone layout read as one
              // undifferentiated column.
              const lead = index === 0;
              return (
                <figure
                  key={testimonial.name}
                  data-voice-card
                  className={cn(
                    "flex flex-col transition-shadow duration-500",
                    "lg:rounded-[20px] lg:bg-enzo-white lg:p-8 lg:shadow-[0_18px_40px_rgba(28,74,58,0.07)] lg:hover:shadow-[0_26px_60px_rgba(28,74,58,0.13)]",
                    lead
                      ? "rounded-[20px] bg-enzo-white p-6 shadow-[0_18px_40px_rgba(28,74,58,0.07)] sm:p-7"
                      : "border-t border-enzo-forest/12 pt-5 lg:border-t-0 lg:pt-8",
                    CARD_LIFT[index],
                  )}
                >
                  <Quote
                    aria-hidden="true"
                    strokeWidth={1.6}
                    className={cn(
                      "h-6 w-6 shrink-0 text-enzo-sand",
                      !lead && "hidden lg:block",
                    )}
                  />
                  <blockquote
                    className={cn(
                      "flex-1 font-medium leading-[1.5] tracking-[-0.01em] text-enzo-forest lg:mt-5 lg:text-[1.15rem]",
                      lead ? "mt-5 text-[1.05rem]" : "text-[0.95rem]",
                    )}
                  >
                    {testimonial.text}
                  </blockquote>
                  <figcaption
                    className={cn(
                      "flex items-center gap-3.5 lg:mt-7 lg:border-t lg:border-enzo-forest/12 lg:pt-5",
                      lead ? "mt-6 border-t border-enzo-forest/12 pt-5" : "mt-3",
                    )}
                  >
                    <ImageWithFallback
                      src={testimonial.image}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      className={cn(
                        "shrink-0 rounded-full object-cover lg:h-10 lg:w-10",
                        lead ? "h-10 w-10" : "h-8 w-8",
                      )}
                    />
                    <span className="min-w-0">
                      <cite className="block truncate text-[14px] font-medium not-italic text-enzo-forest">
                        {testimonial.name}
                      </cite>
                      <span className="block truncate text-[11.5px] uppercase tracking-[0.16em] text-enzo-forest/75">
                        {testimonial.role}
                      </span>
                    </span>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
