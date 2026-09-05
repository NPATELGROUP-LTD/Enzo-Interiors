"use client";

// §C3 — the ninety minutes we spend in your house.
//
// ── What this replaces, and why ──
// A grid of towns with drive times set at display scale. It answered "do you
// come to me?", which is a real question, and it answered it three times
// over: the footer carries the same territory, the masthead says Leicester
// and Leicestershire, and the lede said it again in words above the plates.
// Seven bordered boxes to restate a fact the page had already made twice is
// a lot of section for very little.
//
// The question the plates *were not* answering is the one that actually
// stops people filling the form in: what is a stranger going to do in my
// house for an hour and a half, and is it a sales visit. So this section is
// the visit itself, laid out against the clock.
//
// ── The layout is the data ──
// The four phases are drawn as one bar, and each phase's width is its real
// share of the ninety minutes: ten minutes is a tenth of the bar, thirty is
// a third. Nothing else on this site sizes anything by proportion, and it
// means the section's shape carries information before a word of it is read
// — most of the time goes on measuring, and the part people brace for (what
// do you want, what can you spend) is the last twenty minutes, not the
// first.
//
// Below `md` the bar becomes a vertical run with a proportional rule down
// the left, which keeps the same reading — the long phase is still visibly
// the long one — at a width where four columns would be 80px each.
//
// The territory survives as one line under the schedule, because that is the
// weight the fact deserves on a page whose footer repeats it.
//
// Ground: forest. It is the one full-strength colour on the page, and this
// section can carry it: short labels, big numbers, nothing to type into.
import { useRef } from "react";
import gsap from "gsap";
import { revealOnScroll, useGSAP } from "@/hooks/useGSAP";
import { EASE, REVEAL_START } from "@/lib/motion";

export interface TerritoryPlace {
  name: string;
  /** Drive from the workshop, in minutes. */
  minutes: number;
}

/**
 * The survey, in order, with the minutes each phase actually takes. The
 * numbers are what size the bar, so they want to stay honest rather than
 * flattering: they add up to the ninety minutes the rest of the site quotes.
 */
const PHASES = [
  {
    minutes: 10,
    title: "Looking, not measuring",
    body: "Where the light comes from, which way the doors swing, what you already keep in there and what you have given up trying to keep in there.",
  },
  {
    minutes: 30,
    title: "Every wall, twice",
    body: "Laser and tape, floor to ceiling, wall to wall, at three heights — because no room in a Leicester terrace is the same width at the skirting as it is at the picture rail.",
  },
  {
    minutes: 20,
    title: "The awkward half",
    body: "Sockets, pipes, the boiler flue, floor levels, out-of-plumb returns, the joist direction. Photographed, not remembered. This is the part that decides whether a quote survives contact with the room.",
  },
  {
    minutes: 30,
    title: "What you actually want",
    body: "Finishes, handles, how it should feel to open. And an honest conversation about money — including the times we say the job is not worth doing the way you have described it.",
  },
] as const;

const TOTAL = PHASES.reduce((sum, phase) => sum + phase.minutes, 0);

export function ContactVisit({
  id,
  places,
  note,
}: {
  id?: string;
  places: TerritoryPlace[];
  note: string;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const furthest = Math.max(...places.map((place) => place.minutes), 0);

  useGSAP(sectionRef, (section, reduced) => {
    const lead = gsap.utils.toArray<HTMLElement>("[data-lead]", section);
    const phases = gsap.utils.toArray<HTMLElement>("[data-phase]", section);
    const bars = gsap.utils.toArray<HTMLElement>("[data-bar]", section);
    if (!phases.length) return;

    if (reduced) {
      gsap.set([...lead, ...phases], { opacity: 1, y: 0 });
      gsap.set(bars, { scaleX: 1, scaleY: 1 });
      return;
    }

    revealOnScroll(
      section,
      (timeline) => {
        timeline
          .from(lead, { opacity: 0, y: 20, duration: 0.7, ease: EASE.enter, stagger: 0.08 })
          // The bar runs out left to right like a clock before anything is
          // written against it.
          .from(
            bars,
            {
              scaleX: 0,
              scaleY: 0,
              transformOrigin: "0% 0%",
              duration: 0.55,
              ease: EASE.editorial,
              stagger: 0.09,
            },
            0.18,
          )
          .from(
            phases,
            { opacity: 0, y: 18, duration: 0.6, ease: EASE.enter, stagger: 0.09 },
            0.34,
          );
      },
      { start: REVEAL_START },
    );
  });

  return (
    <section
      ref={sectionRef}
      id={id}
      aria-labelledby="visit-heading"
      className="relative bg-enzo-forest scroll-mt-24"
    >
      <div className="mx-auto max-w-[1500px] px-5 py-20 sm:px-6 md:px-12 md:py-28">
        <div className="grid gap-5 sm:gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:items-end lg:gap-16">
          <div>
            <span
              data-lead
              className="font-display flex items-baseline gap-3 text-[10.5px] font-semibold uppercase tracking-[0.28em] text-enzo-sand"
            >
              <span>C3</span>
              <span className="text-enzo-cream/70">The survey</span>
            </span>

            <h2
              id="visit-heading"
              data-lead
              className="mt-5 max-w-[15ch] font-title font-semibold leading-[1.02] tracking-[-0.04em] text-enzo-cream sm:mt-6"
              style={{ fontSize: "clamp(2rem, 4.6vw, 3.4rem)" }}
            >
              Ninety minutes, and nothing to sign.
            </h2>
          </div>

          <p
            data-lead
            className="text-[14.5px] leading-[1.7] text-enzo-cream/65 sm:text-[15px] lg:pb-2"
          >
            Nobody on commission comes to your house. The person who measures
            the room is the person who will draw it and fit it, and the widths
            below are the real proportions of what they spend the time on.
          </p>
        </div>

        {/* ── The clock ──
            One bar, four phases, each sized by its own share of the ninety
            minutes. `flexGrow` carries the proportion so the row always
            fills the width exactly, whatever the phases add up to. */}
        <div className="mt-12 md:mt-16">
          <div className="hidden items-end gap-1 md:flex">
            {PHASES.map((phase) => (
              <span
                key={phase.title}
                data-bar
                className="block h-2 rounded-[1px] bg-enzo-sand"
                style={{ flexGrow: phase.minutes, flexBasis: 0 }}
              />
            ))}
          </div>

          <ol className="md:flex md:items-stretch md:gap-1">
            {PHASES.map((phase, index) => {
              const share = Math.round((phase.minutes / TOTAL) * 100);
              return (
                <li
                  key={phase.title}
                  data-phase
                  className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-4 border-b border-enzo-cream/12 py-6 first:border-t md:block md:border-0 md:py-0 md:pr-6 md:pt-5 md:first:border-0"
                  style={{ flexGrow: phase.minutes, flexBasis: 0 }}
                >
                  {/* On a phone the bar has nowhere to run across, so each
                      phase carries its own share as a short vertical rule
                      instead — same proportion, read down. */}
                  <span className="flex flex-col items-start md:block">
                    <span className="font-title text-[1.5rem] font-semibold leading-none tabular-nums tracking-[-0.045em] text-enzo-sand md:text-[clamp(1.6rem,2.6vw,2.2rem)]">
                      {phase.minutes}
                      <span className="font-display ml-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-enzo-cream/70">
                        min
                      </span>
                    </span>
                    <span
                      data-bar
                      aria-hidden="true"
                      className="mt-3 block w-[3px] rounded-[1px] bg-enzo-sand md:hidden"
                      style={{ height: `${phase.minutes * 1.6}px` }}
                    />
                  </span>

                  <div className="md:mt-4">
                    <h3 className="flex items-baseline gap-2.5 text-[15px] font-semibold leading-[1.25] tracking-[-0.02em] text-enzo-cream">
                      <span className="font-display text-[10px] font-semibold tabular-nums tracking-[0.18em] text-enzo-cream/50">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {phase.title}
                    </h3>
                    <p className="mt-2.5 text-[13px] leading-[1.65] text-enzo-cream/65">
                      {phase.body}
                    </p>
                    <span className="sr-only">{share}% of the visit</span>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {/* The territory, at the weight it deserves on a page whose footer
            already carries it: one line, in ascending order of drive. */}
        <div className="mt-12 border-t border-enzo-cream/12 pt-7 md:mt-16">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
            <span className="font-display shrink-0 text-[10px] font-semibold uppercase tracking-[0.24em] text-enzo-sand">
              We drive to
            </span>
            {places.map((place, index) => (
              <span key={place.name} className="text-[14px] text-enzo-cream/85">
                {place.name}
                <span className="ml-1.5 tabular-nums text-enzo-cream/50">
                  {place.minutes}m
                </span>
                {index < places.length - 1 && (
                  <span aria-hidden="true" className="ml-3 text-enzo-cream/25">
                    /
                  </span>
                )}
              </span>
            ))}
            <span className="text-[14px] text-enzo-cream/50">
              — furthest {furthest} minutes.
            </span>
          </div>

          <p className="mt-5 max-w-[64ch] text-[12.5px] leading-[1.7] text-enzo-cream/60">
            {note}
          </p>
        </div>
      </div>
    </section>
  );
}
