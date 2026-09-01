"use client";

// Process — layout 3 of 4: THE STAIR.
//
// Each stage sits one step further right and one step lower than the last,
// descending across the section. The indent *is* the progress indicator —
// no numbers on a rail, no bar filling, just the shape of the layout
// telling you how far through the job you are.
//
// The stagger is capped so a service with seven stages does not walk off
// the right-hand edge: past the fourth step the indent stops growing and
// the stair continues straight down.
//
// Ground: off-white — the media-wall page already has a cream section
// above it and a warm-grey one below.
import { useRef } from "react";
import gsap from "gsap";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { useGSAP } from "@/hooks/useGSAP";
import { EASE } from "@/lib/motion";
import { spellCount } from "@/lib/service-metrics";
import type { ProcessStep } from "@/lib/content";

/** Maximum number of steps the indent keeps growing for. */
const MAX_INDENT_STEPS = 4;

export function ProcessStair({
  steps,
  id,
}: {
  steps: ProcessStep[];
  id: string;
}) {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(sectionRef, (section, reduced) => {
    const treads = gsap.utils.toArray<HTMLElement>("[data-tread]", section);
    if (!treads.length) return;

    if (reduced) {
      gsap.set(treads, { opacity: 1, x: 0, y: 0 });
      return;
    }

    // Each tread arrives from up-and-left, i.e. from the previous step's
    // position, so the stair builds itself one tread at a time.
    treads.forEach((tread) => {
      gsap.from(tread, {
        opacity: 0,
        x: -34,
        y: -18,
        duration: 0.75,
        ease: EASE.editorial,
        scrollTrigger: { trigger: tread, start: "top 86%", once: true },
      });
    });
  });

  if (!steps.length) return null;

  return (
    <section
      ref={sectionRef}
      id={id}
      aria-labelledby="process-heading"
      className="relative overflow-hidden bg-card scroll-mt-24"
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
          lines={[`${spellCount(steps.length)} stages,`, "one after another."]}
          lede="Each step starts where the last one finished. Nothing here is subcontracted."
        />

        <ol className="mt-14 md:mt-20">
          {steps.map((step, index) => {
            const tread = Math.min(index, MAX_INDENT_STEPS);
            return (
              <li
                key={step.step}
                data-tread
                className="relative"
                style={{ marginLeft: `calc(${tread} * clamp(0rem, 5vw, 5.5rem))` }}
              >
                <div className="border-t border-border/70 py-8 md:py-11">
                  <div className="flex items-baseline gap-5">
                    <span className="font-display shrink-0 text-[10.5px] font-semibold tabular-nums tracking-[0.2em] text-enzo-forest-light">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3
                      className="font-title font-semibold leading-[1.08] tracking-[-0.035em] text-primary"
                      style={{ fontSize: "clamp(1.35rem, 3vw, 2.3rem)" }}
                    >
                      {step.step}
                    </h3>
                  </div>
                  <p className="mt-3 max-w-[50ch] pl-[calc(0.75rem+1.25rem)] text-[14.5px] leading-[1.7] text-muted-foreground">
                    {step.desc}
                  </p>
                </div>

                {/* The riser: a short vertical drop to the next tread. */}
                {index < steps.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-0 left-0 h-8 w-px bg-border"
                  />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
