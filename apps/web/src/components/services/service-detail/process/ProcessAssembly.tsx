"use client";

// Process — layout 4 of 4: THE ASSEMBLY.  (Fitted Wardrobes)
//
// ── What this replaces, and why ──
// A bank of drawer fronts you pulled open one at a time. It looked like the
// product, which was the appeal, and it worked against the content, which
// was the problem: a process is the one list on the page whose whole meaning
// is that the steps happen *in order*, and an accordion shows you exactly
// one of them and hides the rest. You could not see the shape of the job,
// which is the only thing this section exists to show.
//
// So nothing is hidden. Each stage is a full-width band, and down the left
// of the bands the wardrobe draws itself: an empty room at stage one, a
// carcass by the middle, shelves and rails after that, doors on at the end.
// Scroll the section and the thing you are buying is built beside the
// description of how it gets built. Reading order and build order are the
// same movement.
//
// ── Any number of stages ──
// The drawing is a function of progress, not of a stage count: each band
// asks for its own completeness — `index / (stages - 1)` — and every part of
// the unit appears once progress passes its own threshold. Three stages
// build it in three jumps, seven in seven. Nothing here assumes four.
//
// Ground: warm grey.
import { useRef } from "react";
import gsap from "gsap";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { fromOnScroll, useGSAP } from "@/hooks/useGSAP";
import { EASE } from "@/lib/motion";
import { spellCount } from "@/lib/service-metrics";
import {
  fill,
  type ProcessStep,
  type ProcessVariantContent,
  type ServiceDetailContent,
} from "@/lib/content";

/**
 * The unit, in the order it goes up. `at` is the completeness the part first
 * appears at, `d` its path in the drawing's own 120 x 150 space. Everything
 * shares one floor line, one ceiling line and the same two walls — all at
 * `at: 0` — so the first drawing is a recognisable empty room rather than a
 * stray line, and every drawing after it stacks into a column of the same
 * room with more in it.
 *
 * The thresholds are set a hair under the fractions a four-stage list
 * produces (0.33 rather than 0.34 for a stage at exactly 1/3), because
 * `index / (stages - 1)` lands on repeating decimals and a threshold on the
 * wrong side of one silently drops a part from a drawing.
 */
interface Part {
  /** Completeness at which this part first appears, 0–1. */
  at: number;
  d: string;
  weight: number;
  opacity: number;
  /** Drawn in sand rather than ink — the handles, and nothing else. */
  accent?: boolean;
}

const PARTS: Part[] = [
  { at: 0, d: "M4 138 H116 M4 10 H116", weight: 1, opacity: 0.3 },
  { at: 0, d: "M14 138 V10 M106 138 V10", weight: 1, opacity: 0.22 },
  // Carcass: gables, top and base.
  { at: 0.2, d: "M18 136 V26 H102 V136 Z", weight: 2.2, opacity: 1 },
  { at: 0.33, d: "M60 26 V136", weight: 1.4, opacity: 0.75 },
  // Shelves and the hanging rail.
  { at: 0.5, d: "M18 60 H60 M18 88 H60", weight: 1.2, opacity: 0.7 },
  { at: 0.58, d: "M64 52 H98", weight: 2.6, opacity: 0.9 },
  // Drawer bank.
  { at: 0.72, d: "M64 104 H98 M64 120 H98 M64 104 V136 M98 104 V136", weight: 1.2, opacity: 0.7 },
  // Doors and handles.
  { at: 0.9, d: "M18 26 V136 M60 26 V136 M102 26 V136", weight: 1.6, opacity: 1 },
  { at: 0.94, d: "M54 74 V96 M66 74 V96", weight: 2.4, opacity: 1, accent: true },
];

export function ProcessAssembly({
  steps,
  id,
  content,
  common,
}: {
  steps: ProcessStep[];
  id: string;
  content: ProcessVariantContent;
  common: ServiceDetailContent["process"];
}) {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(sectionRef, (section, reduced) => {
    const bands = gsap.utils.toArray<HTMLElement>("[data-band]", section);
    if (!bands.length) return;

    if (reduced) {
      gsap.set(bands, { opacity: 1, y: 0 });
      gsap.set(gsap.utils.toArray("[data-part]", section), { strokeDashoffset: 0 });
      return;
    }

    // Each band on its own trigger: they are a sequence, and one stagger
    // fired at the top of the section would ink in the last drawing while it
    // is still three screens below the fold.
    bands.forEach((band) => {
      const parts = gsap.utils.toArray<SVGGeometryElement>("[data-part]", band);
      fromOnScroll(
        band,
        { opacity: 0, y: 24, duration: 0.65, ease: EASE.enter },
        { start: "top 85%" },
      );
      if (parts.length) {
        // Resting state is drawn (offset 0) and the tween comes *from*
        // undrawn (offset 1). `.from()` inside a paused timeline applies its
        // start values the moment the timeline is built, so nothing ever
        // paints as a finished drawing first and then rewinds.
        gsap.set(parts, { strokeDasharray: 1, strokeDashoffset: 0 });
        fromOnScroll(
          parts,
          {
            strokeDashoffset: 1,
            duration: 0.7,
            ease: EASE.editorial,
            stagger: 0.05,
          },
          { trigger: band, start: "top 85%" },
        );
      }
    });
  });

  if (!steps.length) return null;

  const last = Math.max(1, steps.length - 1);

  return (
    <section
      ref={sectionRef}
      id={id}
      aria-labelledby="process-heading"
      className="relative bg-muted scroll-mt-24"
    >
      <div className="shell py-20 md:py-28">
        <h2 id="process-heading" className="sr-only">
          {common.srHeading}
        </h2>

        <SectionIntro
          layout="split"
          index={common.index}
          label={content.label}
          datum={fill(content.datum, { count: steps.length })}
          lines={content.lines.map((line) =>
            fill(line, { countWord: spellCount(steps.length) }),
          )}
          lede={content.lede}
          ledeShort={content.ledeShort}
        />

        <ol className="mt-14 md:mt-20">
          {steps.map((step, index) => {
            const progress = index / last;
            return (
              <li
                key={step.step}
                data-band
                className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-x-5 border-t border-border/70 py-7 last:border-b sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-x-10 md:py-10 lg:grid-cols-[7rem_minmax(0,0.85fr)_minmax(0,1fr)] lg:gap-x-14"
              >
                {/* The unit at this stage. */}
                <svg
                  viewBox="0 0 120 150"
                  role="img"
                  aria-label={fill(common.assemblyAriaLabel, { index: index + 1 })}
                  className="w-full text-primary"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {PARTS.filter((part) => progress >= part.at).map((part) => (
                    <path
                      key={part.d}
                      data-part
                      pathLength={1}
                      d={part.d}
                      stroke={part.accent ? "var(--enzo-sand)" : "currentColor"}
                      strokeWidth={part.weight}
                      strokeOpacity={part.opacity}
                    />
                  ))}
                </svg>

                <div>
                  <span className="flex items-baseline gap-3">
                    <span className="font-display text-[10.5px] font-semibold tabular-nums tracking-[0.2em] text-enzo-forest-light">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {/* How far through the job this stage leaves you, said
                        as a number because the drawing beside it is already
                        saying it as a picture. */}
                    <span className="font-display text-[9.5px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                      {fill(common.builtLabel, {
                        percent: Math.round(((index + 1) / steps.length) * 100),
                      })}
                    </span>
                  </span>

                  <h3
                    className="mt-3 font-title font-semibold leading-[1.06] tracking-[-0.035em] text-primary"
                    style={{ fontSize: "clamp(1.25rem, 2.5vw, 1.95rem)" }}
                  >
                    {step.step}
                  </h3>
                </div>

                <p className="col-start-2 mt-3 max-w-[56ch] text-[14.5px] leading-[1.7] text-muted-foreground lg:col-start-3 lg:mt-0 lg:pt-8">
                  {step.desc}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
