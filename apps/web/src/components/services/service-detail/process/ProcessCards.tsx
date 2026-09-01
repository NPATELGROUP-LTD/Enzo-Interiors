"use client";

// Process — layout 4 of 4: THE OFFSET GRID.
//
// Stages as a grid of plates where every other column is pushed down, so
// the section reads as an arrangement rather than a row or a list. Nothing
// is scroll-driven here at all — the other three process layouts each hand
// scroll a job to do, and one page in four is better off letting the reader
// take the whole sequence in at a glance.
//
// The offset is applied by column parity rather than by index, so it holds
// its shape at any stage count and collapses cleanly to a single column on
// a phone.
//
// Ground: cream.
import { useRef } from "react";
import gsap from "gsap";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { useGSAP } from "@/hooks/useGSAP";
import { EASE, REVEAL_START } from "@/lib/motion";
import { spellCount } from "@/lib/service-metrics";
import type { ProcessStep } from "@/lib/content";

export function ProcessCards({
  steps,
  id,
}: {
  steps: ProcessStep[];
  id: string;
}) {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(sectionRef, (section, reduced) => {
    const cards = gsap.utils.toArray<HTMLElement>("[data-card]", section);
    if (!cards.length) return;

    if (reduced) {
      gsap.set(cards, { opacity: 1, y: 0, rotate: 0 });
      return;
    }

    gsap.from(cards, {
      opacity: 0,
      y: 34,
      rotate: (index: number) => (index % 2 === 0 ? -1.6 : 1.6),
      duration: 0.85,
      ease: EASE.editorial,
      stagger: 0.08,
      scrollTrigger: { trigger: cards[0], start: REVEAL_START, once: true },
    });
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
          lines={[`${spellCount(steps.length)} stages,`, "start to finish."]}
          lede="The whole job on one screen. One team throughout — nothing here is subcontracted."
        />

        <ol className="mt-14 grid gap-5 sm:grid-cols-2 md:mt-20 lg:grid-cols-3">
          {steps.map((step, index) => (
            <li
              key={step.step}
              data-card
              // Odd columns sit lower. Parity of the index within the
              // current column count is not knowable in CSS, so the offset
              // is applied on the wider breakpoints only, where the column
              // count is known.
              className={`group ${index % 2 === 1 ? "sm:mt-12 lg:mt-0" : ""} ${
                index % 3 === 1 ? "lg:mt-14" : ""
              } ${index % 3 === 2 ? "lg:mt-7" : ""}`}
            >
              <article className="flex h-full flex-col rounded-[18px] border border-border/70 bg-card p-8 transition-[transform,border-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1.5 hover:border-primary/35">
                <span
                  className="font-title font-semibold leading-none tracking-[-0.06em] text-primary/12 transition-colors duration-400 group-hover:text-primary/25"
                  style={{ fontSize: "3.4rem" }}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-6 font-title text-[1.2rem] font-semibold leading-[1.15] tracking-[-0.03em] text-primary">
                  {step.step}
                </h3>
                <p className="mt-3 flex-1 text-[14px] leading-[1.7] text-muted-foreground">
                  {step.desc}
                </p>
                <span
                  aria-hidden="true"
                  className="mt-7 block h-px w-10 origin-left bg-enzo-sand transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-[2.6]"
                />
              </article>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
