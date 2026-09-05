"use client";

// Process — layout 2 of 4: THE TIMELINE.
//
// Read downwards, with the stage number held in a sticky column on the left
// while its description scrolls past on the right. The number changing is
// the only thing that moves, which makes the sequence feel like progress
// through a job rather than a list of four cards.
//
// Deliberately vertical: layout 1 travels sideways, so the page that uses
// this one gets the opposite axis and never reads as the same section.
//
// Ground: cream.
import { useRef, useState } from "react";
import gsap from "gsap";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { fromOnScroll, useGSAP } from "@/hooks/useGSAP";
import { EASE, REVEAL_START } from "@/lib/motion";
import { spellCount } from "@/lib/service-metrics";
import type { ProcessStep } from "@/lib/content";

export function ProcessTimeline({
  steps,
  id,
}: {
  steps: ProcessStep[];
  id: string;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);

  useGSAP(sectionRef, (section, reduced) => {
    const rows = gsap.utils.toArray<HTMLElement>("[data-step]", section);
    if (!rows.length) return;

    if (!reduced) {
      fromOnScroll(
        rows,
        {
          opacity: 0,
          y: 26,
          duration: 0.7,
          ease: EASE.enter,
          stagger: 0.08,
        },
        { trigger: rows[0], start: REVEAL_START },
      );
    }

    // Which stage the reading line is on. Live bounding boxes on the ticker
    // rather than per-row triggers — see components/landing/ProcessLedger.
    const track = () => {
      const line = window.innerHeight * 0.5;
      let index = 0;
      rows.forEach((row, i) => {
        if (row.getBoundingClientRect().top <= line) index = i;
      });
      setActive((current) => (current === index ? current : index));
    };

    gsap.ticker.add(track);
    track();

    return () => {
      gsap.ticker.remove(track);
    };
  });

  if (!steps.length) return null;

  return (
    <section
      ref={sectionRef}
      id={id}
      aria-labelledby="process-heading"
      className="relative bg-background scroll-mt-24"
    >
      <div className="mx-auto max-w-[1500px] px-5 py-20 sm:px-6 md:px-12 md:py-28">
        <h2 id="process-heading" className="sr-only">
          How it is built
        </h2>

        <SectionIntro
          layout="split"
          index="A4"
          label="Sequence"
          datum={`${steps.length} stages`}
          lines={[`${spellCount(steps.length)} stages,`, "top to bottom."]}
          lede="Nothing here is subcontracted and nothing skips a step."
        />

        <div className="mt-14 grid gap-10 md:mt-20 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] md:gap-16">
          {/* Sticky stage counter. The one moving part. */}
          <div className="hidden md:block">
            <div className="sticky top-1/3">
              <span
                className="font-title block font-semibold leading-none tracking-[-0.06em] text-primary"
                style={{ fontSize: "clamp(4rem, 9vw, 8rem)" }}
              >
                {String(active + 1).padStart(2, "0")}
              </span>
              <span className="mt-3 block h-px w-16 bg-enzo-sand" />
              <span className="mt-3 block text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                of {String(steps.length).padStart(2, "0")}
              </span>
              <span className="mt-6 block max-w-[12rem] text-[13px] leading-[1.5] text-enzo-forest-light">
                {steps[active]?.step}
              </span>
            </div>
          </div>

          <ol>
            {steps.map((step, index) => (
              <li
                key={step.step}
                data-step
                className="border-t border-border/60 py-8 last:border-b md:py-12"
              >
                <span className="font-display text-[10.5px] font-semibold uppercase tracking-[0.24em] text-enzo-forest-light md:hidden">
                  Stage {index + 1} / {steps.length}
                </span>
                <h3
                  className="mt-2 font-title font-semibold leading-[1.1] tracking-[-0.03em] text-primary md:mt-0"
                  style={{ fontSize: "clamp(1.3rem, 2.6vw, 2rem)" }}
                >
                  {step.step}
                </h3>
                <p className="mt-3 max-w-[52ch] text-[14.5px] leading-[1.7] text-muted-foreground">
                  {step.desc}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
