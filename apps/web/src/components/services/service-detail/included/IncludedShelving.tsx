"use client";

// "What's included" — layout 3 of 4: THE SHELVING.
//
// An asymmetric grid of cells of different spans, stacked like the bays and
// shelves of a fitted unit. The layout is the product: the section looks
// like the thing the page is selling.
//
// Spans repeat on a fixed six-cell rhythm rather than being random, so the
// wall stays balanced at any item count — 6 items and 14 items both build a
// wall rather than leaving a ragged hole at the bottom.
//
// Ground: warm grey, so the cells (cream) read as the shelves and the
// ground reads as the carcass behind them.
import { useRef } from "react";
import gsap from "gsap";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { useGSAP } from "@/hooks/useGSAP";
import { EASE, REVEAL_START } from "@/lib/motion";
import type { ServiceDetail } from "@/lib/content";

/** Column spans on a 6-wide grid, cycled. Sums to complete rows. */
const SPANS = [
  "md:col-span-4 md:row-span-2",
  "md:col-span-2",
  "md:col-span-2",
  "md:col-span-2",
  "md:col-span-2",
  "md:col-span-2",
];

export function IncludedShelving({
  service,
  id,
}: {
  service: ServiceDetail;
  id: string;
}) {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(sectionRef, (section, reduced) => {
    const cells = gsap.utils.toArray<HTMLElement>("[data-cell]", section);
    if (!cells.length) return;

    if (reduced) {
      gsap.set(cells, { opacity: 1, y: 0, scaleY: 1 });
      return;
    }

    // Cells rise and un-squash from their bottom edge — panels being stood
    // into a carcass, not tiles fading in.
    gsap.from(cells, {
      opacity: 0,
      y: 26,
      scaleY: 0.92,
      transformOrigin: "50% 100%",
      duration: 0.7,
      ease: EASE.editorial,
      stagger: 0.045,
      scrollTrigger: { trigger: cells[0], start: REVEAL_START, once: true },
    });
  });

  return (
    <section
      ref={sectionRef}
      id={id}
      aria-labelledby="included-heading"
      className="relative bg-muted scroll-mt-24"
    >
      <div className="mx-auto max-w-[1500px] px-5 py-20 sm:px-6 md:px-12 md:py-28">
        <h2 id="included-heading" className="sr-only">
          What is included
        </h2>

        <SectionIntro
          layout="split"
          index="A2"
          label="Included"
          datum={`${service.features.length} as standard`}
          lines={["Every bay,", "every fitting."]}
          lede={service.overview}
        />

        <div className="mt-14 grid auto-rows-[minmax(9rem,auto)] grid-cols-1 gap-2 sm:grid-cols-2 md:mt-16 md:grid-cols-6">
          {service.features.map((feature, index) => (
            <article
              key={feature}
              data-cell
              className={`group relative flex flex-col justify-between overflow-hidden rounded-[14px] bg-background p-6 transition-colors duration-400 hover:bg-card ${SPANS[index % SPANS.length]}`}
            >
              <span className="font-display text-[10.5px] font-semibold tabular-nums tracking-[0.18em] text-enzo-forest-light">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="mt-6 text-[15.5px] font-medium leading-[1.35] tracking-[-0.02em] text-primary">
                {feature}
              </p>
              {/* Shelf line at the foot of each cell. */}
              <span
                aria-hidden="true"
                className="absolute inset-x-6 bottom-0 h-px origin-left scale-x-0 bg-enzo-sand transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-100"
              />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
