"use client";

// /services/[category] §A4 — the build sequence, travelled sideways.
//
// The process is the one genuinely ordered thing on the page, and the old
// version showed it as four equal cards in a row, which says "four
// unrelated facts" rather than "first this, then this".
//
// So the stages sit on a rail that travels horizontally while the section
// holds the viewport: you move forward through the job by scrolling
// forward. It is deliberately the opposite axis to the landing page's own
// process section (a sticky vertical stage with a drawing) — same brand,
// different mechanic, and the two never appear on the same page anyway.
//
// The rail's travel is derived from its measured width, so a service with
// three stages and one with seven both scroll to exactly their own end.
// Below lg it becomes a plain vertical sequence: a horizontal rail on a
// phone means either a tiny plate or a very long hijack, and neither is
// worth it.
import { useRef, useState } from "react";
import gsap from "gsap";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { useGSAP } from "@/hooks/useGSAP";
import { EASE, REVEAL_START } from "@/lib/motion";
import { spellCount } from "@/lib/service-metrics";
import type { ProcessStep } from "@/lib/content";

/** Viewport-heights of scroll allotted per stage. */
const STAGE_VH = 64;

interface ProcessTrackProps {
  steps: ProcessStep[];
  id: string;
}

export function ProcessTrack({ steps, id }: ProcessTrackProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);

  useGSAP(
    sectionRef,
    (section, reduced, { desktop }) => {
      const list = gsap.utils.toArray<HTMLElement>("[data-process-item]", section);

      if (list.length && !reduced) {
        gsap.from(list, {
          opacity: 0,
          y: 24,
          duration: 0.7,
          ease: EASE.enter,
          stagger: 0.08,
          scrollTrigger: { trigger: list[0], start: REVEAL_START, once: true },
        });
      }

      if (!desktop) return;

      const track = section.querySelector<HTMLElement>("[data-track]");
      const rail = section.querySelector<HTMLElement>("[data-rail]");
      const bar = section.querySelector<HTMLElement>("[data-track-bar]");
      const plates = gsap.utils.toArray<HTMLElement>("[data-plate]", section);
      if (!track || !rail || !plates.length) return;

      const setRailX = gsap.quickSetter(rail, "x", "px");

      // Measured rather than assumed: the plates are clamp()-sized, so the
      // travel distance is only knowable after layout — and it changes with
      // the number of stages the client authored.
      let travel = 0;
      let centres: number[] = [];

      const measure = () => {
        travel = Math.max(0, rail.scrollWidth - window.innerWidth);
        centres = plates.map((plate) => plate.offsetLeft + plate.offsetWidth / 2);
      };

      if (reduced) {
        measure();
        setActive(0);
        return;
      }

      measure();

      // Same reasoning as components/landing/ProcessLedger.tsx: read the
      // live bounding box on the ticker instead of trusting a
      // ScrollTrigger's start/end, which are cached at creation and go
      // stale when a taller section above finishes measuring later.
      const tick = () => {
        const rect = track.getBoundingClientRect();
        const total = rect.height - window.innerHeight;
        const progress =
          total > 0 ? gsap.utils.clamp(0, 1, -rect.top / total) : 0;

        const x = -travel * progress;
        setRailX(x);
        if (bar) gsap.set(bar, { scaleX: progress });

        const viewportCentre = window.innerWidth / 2;
        let nearest = 0;
        let nearestDistance = Infinity;

        plates.forEach((plate, index) => {
          // Plate centres are measured once, so this needs no per-frame
          // layout reads — only arithmetic on the translation we just set.
          const distance = Math.abs(centres[index] + x - viewportCentre);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearest = index;
          }
          // Depth: plates away from the reading position sit back a little,
          // so the rail has a focus rather than being a flat strip.
          const falloff = gsap.utils.clamp(0, 1, distance / (window.innerWidth * 0.62));
          gsap.set(plate, {
            opacity: 1 - falloff * 0.6,
            scale: 1 - falloff * 0.055,
          });
        });

        setActive((current) => (current === nearest ? current : nearest));
      };

      gsap.ticker.add(tick);
      tick();

      const onResize = () => {
        measure();
        tick();
      };
      window.addEventListener("resize", onResize);

      return () => {
        gsap.ticker.remove(tick);
        window.removeEventListener("resize", onResize);
      };
    },
    { queries: { desktop: "(min-width: 1024px)" }, deps: [steps] },
  );

  if (!steps.length) return null;

  return (
    <section
      ref={sectionRef}
      id={id}
      aria-labelledby="service-process-heading"
      className="relative bg-muted scroll-mt-24"
    >
      <div className="mx-auto max-w-[1500px] px-5 pt-20 sm:px-6 md:px-12 md:pt-28">
        <h2 id="service-process-heading" className="sr-only">
          How it is built
        </h2>
        <SectionIntro
          layout="split"
          index="A4"
          label="Sequence"
          datum={`${steps.length} stages`}
          lines={[`${spellCount(steps.length)} stages,`, "in order."]}
          lede="Nothing here is subcontracted and nothing skips a step. Keep scrolling and the sequence moves with you."
        />
      </div>

      {/* ── Desktop: the rail ── */}
      <div
        data-track
        className="relative mt-12 hidden lg:block"
        style={{ height: `${Math.max(2, steps.length) * STAGE_VH + 40}vh` }}
      >
        <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden">
          <div
            data-rail
            className="flex items-stretch gap-8 will-change-transform"
            style={{
              // Starts flush with the page's own content column, so the
              // first plate lines up with the heading above it.
              paddingLeft: "max(3rem, calc((100vw - 1500px) / 2 + 3rem))",
              paddingRight: "40vw",
            }}
          >
            {steps.map((step, index) => (
              <article
                key={step.step}
                data-plate
                className="relative flex w-[clamp(20rem,30vw,29rem)] shrink-0 flex-col justify-between rounded-[20px] border border-border/70 bg-background p-9"
              >
                <div>
                  <div className="flex items-baseline justify-between gap-4">
                    <span
                      className="font-title font-semibold leading-none tracking-[-0.05em] text-primary/12"
                      style={{ fontSize: "clamp(3.4rem, 5vw, 5rem)" }}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="font-display text-[10.5px] font-semibold uppercase tracking-[0.26em] text-enzo-forest-light">
                      Stage {index + 1} / {steps.length}
                    </span>
                  </div>

                  <h3
                    className="mt-6 font-title font-semibold leading-[1.1] tracking-[-0.03em] text-primary"
                    style={{ fontSize: "clamp(1.35rem, 2vw, 1.8rem)" }}
                  >
                    {step.step}
                  </h3>
                  <p className="mt-4 max-w-[42ch] text-[14.5px] leading-[1.7] text-muted-foreground">
                    {step.desc}
                  </p>
                </div>

                <div className="mt-10 flex items-center gap-3">
                  <span aria-hidden="true" className="h-px flex-1 bg-border" />
                  <span className="h-1.5 w-1.5 rounded-full bg-enzo-sand" />
                </div>
              </article>
            ))}
          </div>

          {/* Position readout — the only chrome the rail needs. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-10 mx-auto flex max-w-[1500px] items-center gap-5 px-12">
            <span className="font-display shrink-0 text-[11px] font-semibold tabular-nums tracking-[0.2em] text-primary">
              {String(active + 1).padStart(2, "0")}
              <span className="text-foreground/35">
                /{String(steps.length).padStart(2, "0")}
              </span>
            </span>
            <span className="h-px flex-1 bg-border">
              <span
                data-track-bar
                className="block h-px origin-left bg-primary"
                style={{ transform: "scaleX(0)" }}
              />
            </span>
            <span className="shrink-0 text-[11px] uppercase tracking-[0.2em] text-foreground/45">
              {steps[active]?.step}
            </span>
          </div>
        </div>
      </div>

      {/* ── Below lg: the same sequence, read downwards ── */}
      <div className="mx-auto max-w-[1500px] px-5 pb-20 pt-10 sm:px-6 md:px-12 lg:hidden">
        <ol className="relative pl-8">
          <span
            aria-hidden="true"
            className="absolute bottom-6 left-[3px] top-3 w-px bg-border"
          />
          {steps.map((step, index) => (
            <li key={step.step} data-process-item className="relative pb-9 last:pb-0">
              <span
                aria-hidden="true"
                className="absolute -left-8 top-2 h-[7px] w-[7px] rounded-full bg-enzo-sand ring-4 ring-muted"
              />
              <span className="font-display text-[10.5px] font-semibold uppercase tracking-[0.24em] text-enzo-forest-light">
                Stage {index + 1} / {steps.length}
              </span>
              <h3 className="mt-2 font-title text-[1.2rem] font-semibold leading-[1.15] tracking-[-0.025em] text-primary">
                {step.step}
              </h3>
              <p className="mt-2 text-[14px] leading-[1.7] text-muted-foreground">
                {step.desc}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
