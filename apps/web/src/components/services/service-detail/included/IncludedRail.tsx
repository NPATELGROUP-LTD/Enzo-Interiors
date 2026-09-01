"use client";

// "What's included" — layout 4 of 4: THE HANGING RAIL (wardrobes).
//
// Replaces a single column of very large type, which was legible and
// completely inert — a list set big is still a list.
//
// Here the items hang from a rail: a horizontal rule across the top with
// each item on a drop of a different length, like garments on hangers. The
// varied drops are what make it read as a rail rather than a row of equal
// cards, and they come from a fixed repeating rhythm rather than a random
// number, so the arrangement is stable and balanced at any item count.
//
// Ground: cream.
import { useRef } from "react";
import gsap from "gsap";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { useGSAP } from "@/hooks/useGSAP";
import { EASE, REVEAL_START } from "@/lib/motion";
import type { ServiceDetail } from "@/lib/content";

/** Drop lengths in rem, cycled — the rhythm of a hung rail. */
const DROPS = [0, 2.4, 1.1, 3.2, 0.6, 2.0];

export function IncludedRail({
  service,
  id,
}: {
  service: ServiceDetail;
  id: string;
}) {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(sectionRef, (section, reduced) => {
    const rail = section.querySelector<HTMLElement>("[data-rail-line]");
    const drops = gsap.utils.toArray<HTMLElement>("[data-drop]", section);
    if (!drops.length) return;

    if (reduced) {
      gsap.set(drops, { opacity: 1, y: 0 });
      if (rail) gsap.set(rail, { scaleX: 1 });
      return;
    }

    const tl = gsap.timeline({
      scrollTrigger: { trigger: section, start: REVEAL_START, once: true },
    });

    // The rail is threaded first, then the items drop onto it — with a
    // slight overshoot, so they land rather than fade.
    tl.to(rail, { scaleX: 1, duration: 0.9, ease: EASE.editorial }).from(
      drops,
      {
        opacity: 0,
        y: -26,
        duration: 0.7,
        ease: "back.out(1.7)",
        stagger: 0.055,
      },
      0.3,
    );

    return () => {
      tl.kill();
    };
  });

  return (
    <section
      ref={sectionRef}
      id={id}
      aria-labelledby="included-heading"
      className="relative overflow-hidden bg-background scroll-mt-24"
    >
      <div className="mx-auto max-w-[1500px] px-5 py-20 sm:px-6 md:px-12 md:py-28">
        <h2 id="included-heading" className="sr-only">
          What is included
        </h2>

        <SectionIntro
          layout="split"
          index="A2"
          label="On the rail"
          datum={`${service.features.length} as standard`}
          lines={["Everything hanging", "in the price."]}
          lede={service.overview}
        />

        <div className="relative mt-16 md:mt-20">
          {/* The rail. */}
          <span aria-hidden="true" className="absolute inset-x-0 top-0 block h-px overflow-hidden">
            <span
              data-rail-line
              className="block h-px origin-left bg-primary/45"
              style={{ transform: "scaleX(0)" }}
            />
          </span>

          <ul className="flex flex-wrap gap-x-4 gap-y-10 pt-0">
            {service.features.map((feature, index) => (
              <li
                key={feature}
                data-drop
                className="group relative flex min-w-[9rem] max-w-[15rem] flex-1 flex-col"
                style={{ paddingTop: `${DROPS[index % DROPS.length] + 1.6}rem` }}
              >
                {/* The hanger drop. */}
                <span
                  aria-hidden="true"
                  className="absolute left-6 top-0 w-px bg-border transition-colors duration-300 group-hover:bg-primary"
                  style={{ height: `${DROPS[index % DROPS.length] + 1.6}rem` }}
                />
                <span
                  aria-hidden="true"
                  className="absolute left-6 h-[7px] w-[7px] -translate-x-[3px] rounded-full bg-primary/30 transition-colors duration-300 group-hover:bg-primary"
                  style={{ top: `${DROPS[index % DROPS.length] + 1.3}rem` }}
                />

                <article className="rounded-[14px] border border-border/70 bg-card p-5 transition-[transform,border-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-1 group-hover:border-primary/40">
                  <span className="font-display block text-[10px] font-semibold tabular-nums tracking-[0.2em] text-enzo-forest-light">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p className="mt-3 text-[14px] font-medium leading-[1.4] tracking-[-0.015em] text-primary">
                    {feature}
                  </p>
                </article>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
