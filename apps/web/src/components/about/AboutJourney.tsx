"use client";

// /about §03 — the journey, set out.
//
// ── Three versions have been discarded here ──
// A centred zig-zag timeline (how every About page draws a history). A dial,
// which was really a tab bar. Then a horizontal road in a sticky box with a
// marker scrubbing along it — and that one failed in a way worth writing
// down, because the failure is the whole reason this file looks like it does.
//
// The road lived in a `h-[165svh]` track with a `sticky top-[18vh] h-[64svh]`
// inner. That is 1953px of section on a 900px screen, of which 909px was pure
// scroll runway: the reader scrolled through a third of a page of empty
// forest, and because the drive was measured against a section that ran out
// of page, the last stop was never reached while it was still on screen. The
// section was mostly nothing, and the animation never finished.
//
// ── What replaces it ──
// A setting-out run. Four dated plates step DOWN and to the RIGHT in normal
// flow — no sticky, no pinned stage, no runway — connected by ruled diagonal
// runs with the real elapsed months dimensioned on them, the way a drawing
// dimensions a distance it wants you to trust. Section height is exactly
// content height. The march is 618px of rightward travel over the descent,
// about 19° from vertical overall, with each run itself at 51°.
//
// Each plate deals itself in along that same 51° edge as you reach it, so the
// picture arrives on the diagonal the layout is already travelling.
//
// ── Why it always finishes ──
// Completion is structural rather than hopeful. Each plate's sweep is driven
// by ITS OWN top edge crossing from 96vh to 52vh — so every sweep, the last
// one included, completes in the middle of the screen with content above and
// below it. Nothing depends on the section having page left.
//
// ── Why gsap.ticker and not ScrollTrigger ──
// A trigger created before the taller sections above have finished measuring
// goes stale, and a stale trigger here would leave a plate half-dealt for
// ever. Same reasoning as landing/ProcessLedger and /services §03. The one
// thing this section adds: it reads FOUR bounding boxes per frame, so all
// four reads happen before any write. Interleaving them is a forced
// synchronous layout four times a frame on a page that also runs Lenis.
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { EASE } from "@/lib/motion";
import { spellCount } from "@/lib/service-metrics";
import { fill, type AboutPageContent } from "@/lib/content";

export interface Milestone {
  year: string;
  title: string;
  desc: string;
  image: string;
}

/**
 * The march, as percentages of the field's width. Stops step right by 14.67%
 * each; the last takes a 12.67% step instead so its right edge lands flush on
 * the field's right edge and the route visibly runs off the page — and so the
 * terminus gets the biggest picture.
 */
const STEPS = [
  { left: 0, plate: 30, text: 24 },
  { left: 14.67, plate: 30, text: 24 },
  { left: 29.33, plate: 30, text: 24 },
  { left: 42, plate: 36, text: 20 },
] as const;

/** The gutter between a plate and its caption, also in field percent. */
const GUTTER = 2;

/**
 * The clear band above each plate (except the first), in px. It grows down
 * the page so the descent opens out, and it is where the diagonal run and its
 * dimension figure live — the one region that would otherwise be dead space
 * is the region the mechanic occupies.
 */
const GAPS = [0, 132, 168, 204] as const;

/**
 * The sweep edge, 51° from vertical. On a 4:3 plate the edge's horizontal run
 * across the plate's height is height × tan(51°) = 0.75w × 1.2349 = 0.926w,
 * so the moving coordinate travels from -92.6% to 100% of the plate's width.
 */
const EDGE = 92.6;

/** How far a stop rises as it arrives. Capped below the smallest gap (132px)
 *  so a stop in flight can never climb into the type of the stop above it. */
const RISE = 90;
const DRIFT = 26;

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/**
 * "June 2025" -> an absolute month number. Returns null for anything that is
 * not Month-space-Year, because the client authors these strings and "Summer
 * 2025" must render a bare run rather than "NaN months".
 */
function monthIndex(value: string): number | null {
  const match = /^([A-Za-z]+)\s+(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const month = MONTHS.indexOf(match[1]!.toLowerCase());
  if (month < 0) return null;
  return Number(match[2]) * 12 + month;
}

function elapsed(
  from: string,
  to: string,
  labels: { monthsOne: string; monthsOther: string },
): string | null {
  const a = monthIndex(from);
  const b = monthIndex(to);
  if (a === null || b === null) return null;
  const months = b - a;
  if (months <= 0) return null;
  return months === 1 ? labels.monthsOne : fill(labels.monthsOther, { count: months });
}

export function AboutJourney({
  milestones,
  content,
}: {
  milestones: Milestone[];
  content: AboutPageContent["journey"];
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const stopRefs = useRef<(HTMLLIElement | null)[]>([]);
  const groupRefs = useRef<(HTMLDivElement | null)[]>([]);
  const plateRefs = useRef<(HTMLDivElement | null)[]>([]);
  const reduced = usePrefersReducedMotion();
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  // ── Desktop: the scrubbed deal ──
  useEffect(() => {
    if (!isDesktop || reduced) return;
    const stops = stopRefs.current.filter(Boolean) as HTMLLIElement[];
    if (!stops.length) return;

    const ease = gsap.parseEase("power2.out");

    const tick = () => {
      // Every read first. Writing between reads forces a synchronous layout
      // once per stop per frame — see the note at the top of this file.
      const tops: number[] = [];
      for (const stop of stops) tops.push(stop.getBoundingClientRect().top);

      const vh = window.innerHeight;
      for (let i = 0; i < stops.length; i += 1) {
        // The last plate is given a longer window: the terminus takes its time.
        const span = vh * (i === stops.length - 1 ? 0.62 : 0.48);
        const q = gsap.utils.clamp(0, 1, (vh * 0.96 - tops[i]!) / span);
        const e = ease(q);

        const plate = plateRefs.current[i];
        if (plate) plate.style.setProperty("--a", `${-EDGE + e * (100 + EDGE)}%`);

        const group = groupRefs.current[i];
        if (group) {
          gsap.set(group, { x: -DRIFT * (1 - e), y: -RISE * (1 - e) });
        }

        const stop = stops[i]!;
        const made = q > 0.6 ? "true" : "false";
        if (stop.dataset.made !== made) stop.dataset.made = made;
      }
    };

    gsap.ticker.add(tick);
    tick();
    return () => {
      gsap.ticker.remove(tick);
    };
  }, [isDesktop, reduced, milestones.length]);

  // ── Reduced motion, and every breakpoint below lg ──
  // Below lg the march is abandoned rather than faked: 618px of rightward
  // travel does not exist on a 375px screen. The diagonal sweep survives as a
  // one-shot per plate, because it is a clip-path and it costs nothing.
  useEffect(() => {
    const plates = plateRefs.current.filter(Boolean) as HTMLDivElement[];
    const stops = stopRefs.current.filter(Boolean) as HTMLLIElement[];
    const groups = groupRefs.current.filter(Boolean) as HTMLDivElement[];
    if (!plates.length) return;

    if (reduced || isDesktop) {
      if (!reduced) return;
      // Pixel-identical to "all four arrived". No half-state is possible.
      for (const plate of plates) plate.style.setProperty("--a", "100%");
      for (const stop of stops) stop.dataset.made = "true";
      gsap.set(groups, { x: 0, y: 0 });
      return;
    }

    gsap.set(groups, { x: 0, y: 0 });
    const triggers = plates.map((plate, i) => {
      const state = { a: -EDGE };
      const tl = gsap.timeline({ paused: true });
      tl.to(state, {
        a: 100,
        duration: 0.9,
        ease: EASE.editorial,
        onUpdate: () => plate.style.setProperty("--a", `${state.a}%`),
      });
      return ScrollTrigger.create({
        trigger: plate,
        start: "top 85%",
        once: true,
        animation: tl,
        onEnter: () => {
          const stop = stopRefs.current[i];
          if (stop) stop.dataset.made = "true";
        },
      });
    });

    return () => {
      for (const trigger of triggers) trigger.kill();
    };
  }, [isDesktop, reduced, milestones.length]);

  if (!milestones.length) return null;

  const total = (() => {
    const a = monthIndex(milestones[0]!.year);
    const b = monthIndex(milestones[milestones.length - 1]!.year);
    if (a === null || b === null || b <= a) return null;
    return b - a;
  })();

  return (
    <section
      ref={sectionRef}
      id="about-journey"
      aria-labelledby="about-journey-heading"
      className="relative overflow-hidden bg-enzo-forest text-enzo-cream scroll-mt-24"
    >
      <div className="shell py-20 md:py-28">
        <h2 id="about-journey-heading" className="sr-only">
          {content.srHeading}
        </h2>

        <SectionIntro
          layout="split"
          tone="dark"
          index={content.index}
          label={content.label}
          datum={
            total
              ? fill(content.datumWithTotal, {
                  months: spellCount(total),
                  stops: spellCount(milestones.length),
                })
              : fill(content.datumWithoutTotal, { stops: spellCount(milestones.length) })
          }
          lines={content.lines}
          lede={content.lede}
        />

        {/* ── The field ──
            An ordered list in NORMAL FLOW. Each stop carries its own left
            margin, so the run marches right as the list runs down, and the
            section is exactly as tall as its contents. Nothing is pinned and
            there is no runway to leave empty. */}
        <ol className="relative mt-16 hidden lg:block">
          {milestones.map((milestone, index) => {
            const step = STEPS[Math.min(index, STEPS.length - 1)]!;
            const prev = STEPS[Math.min(index - 1, STEPS.length - 1)];
            const width = step.plate + GUTTER + step.text;
            const gap = GAPS[Math.min(index, GAPS.length - 1)]!;
            const months =
              index > 0 ? elapsed(milestones[index - 1]!.year, milestone.year, content) : null;

            // The run connects the previous plate's bottom-right corner to
            // this plate's top-right corner, expressed in this item's own
            // width so it stays correct at any viewport.
            const runRight = ((step.plate / width) * 100).toFixed(3);
            const runLeft =
              prev && index > 0
                ? (((prev.left + prev.plate - step.left) / width) * 100).toFixed(3)
                : "0";

            return (
              <li
                key={milestone.year}
                ref={(node) => {
                  stopRefs.current[index] = node;
                }}
                data-made="false"
                className="group relative"
                style={{
                  marginLeft: `${step.left}%`,
                  width: `${width}%`,
                  paddingTop: gap ? `${gap}px` : undefined,
                }}
              >
                {/* ── The run ──
                    One SVG line stretched corner-to-corner with
                    preserveAspectRatio="none" and a non-scaling stroke: a 1px
                    diagonal at any width with no path measurement, no
                    getTotalLength and no ResizeObserver. */}
                {index > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute top-0"
                    style={{
                      left: `${runLeft}%`,
                      width: `${Number(runRight) - Number(runLeft)}%`,
                      height: `${gap}px`,
                    }}
                  >
                    <svg
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      className="block h-full w-full overflow-visible"
                    >
                      <line
                        x1="0"
                        y1="0"
                        x2="100"
                        y2="100"
                        vectorEffect="non-scaling-stroke"
                        stroke="#D4C9B5"
                        strokeWidth="1"
                        className="opacity-25 transition-opacity duration-700 group-data-[made=true]:opacity-50"
                      />
                    </svg>

                    {/* The dimension figure, sitting on the run the way a
                        drawing breaks a dimension line to print its number. */}
                    {months && (
                      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-enzo-forest px-2.5 py-1">
                        <span className="font-display block whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.26em] text-enzo-sand/85">
                          {months}
                        </span>
                      </span>
                    )}
                  </span>
                )}

                {/* The group that settles. The run stays put — only the plate
                    and its caption rise. */}
                <div
                  ref={(node) => {
                    groupRefs.current[index] = node;
                  }}
                  className="flex items-start"
                  style={{ transform: "translate(-26px, -90px)" }}
                >
                  <div
                    ref={(node) => {
                      plateRefs.current[index] = node;
                    }}
                    className="relative aspect-[4/3] shrink-0 overflow-hidden bg-enzo-forest-light/20"
                    style={
                      {
                        width: `${(step.plate / width) * 100}%`,
                        "--a": `${-EDGE}%`,
                        clipPath:
                          "polygon(-1% -1%, var(--a) -1%, calc(var(--a) + 92.6%) 101%, -1% 101%)",
                      } as React.CSSProperties
                    }
                  >
                    <ImageWithFallback
                      src={milestone.image}
                      alt={milestone.title}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    {/* The lit edge that leads the sweep in. Past q=1 the band
                        sits beyond 100% and is clipped away, so it exits the
                        corner rather than parking on it. */}
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 bg-enzo-sand"
                      style={{
                        clipPath:
                          "polygon(var(--a) -1%, calc(var(--a) + 3px) -1%, calc(var(--a) + 3px + 92.6%) 101%, calc(var(--a) + 92.6%) 101%)",
                      }}
                    />
                  </div>

                  <div
                    className="shrink-0"
                    style={{
                      width: `${(step.text / width) * 100}%`,
                      marginLeft: `${(GUTTER / width) * 100}%`,
                    }}
                  >
                    <p className="font-display flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-enzo-sand">
                      <span
                        aria-hidden="true"
                        className="block h-px w-4 bg-enzo-sand/50 transition-all duration-700 group-data-[made=true]:w-7 group-data-[made=true]:bg-enzo-sand"
                      />
                      {milestone.year}
                    </p>
                    <h3
                      className="mt-3 font-title font-semibold leading-[1.12] tracking-[-0.03em]"
                      style={{ fontSize: "clamp(1.3rem, 1.9vw, 1.6rem)" }}
                    >
                      {milestone.title}
                    </h3>
                    <p className="mt-3.5 text-[14.5px] leading-[1.7] text-enzo-cream/70">
                      {milestone.desc}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}

          {/* The overall dimension, closing the run flush with its right edge
              — the last thing a setting-out drawing prints. */}
          {total && (
            <li
              aria-hidden="true"
              className="mt-14 flex items-center gap-4"
              style={{ marginLeft: `${STEPS[3]!.left}%`, width: `${100 - STEPS[3]!.left}%` }}
            >
              <span className="block h-px flex-1 bg-enzo-cream/20" />
              <span className="font-display shrink-0 text-[10.5px] font-semibold uppercase tracking-[0.26em] text-enzo-sand/85">
                {fill(content.overallLabel, { months: spellCount(total) })}
              </span>
            </li>
          )}
        </ol>

        {/* ── Below lg ──
            The march is abandoned rather than faked. Same information, same
            drafting language: the diagonal runs lie flat as ruled rows with
            the elapsed figure printed on them. */}
        <ol className="mt-12 lg:hidden">
          {milestones.map((milestone, index) => {
            const months =
              index > 0 ? elapsed(milestones[index - 1]!.year, milestone.year, content) : null;
            return (
              <li
                key={milestone.year}
                ref={(node) => {
                  if (!isDesktop) stopRefs.current[index] = node;
                }}
                data-made="false"
                className="group"
              >
                {months && (
                  <div
                    aria-hidden="true"
                    className="my-7 flex items-center gap-4 md:my-9"
                  >
                    <span className="font-display shrink-0 bg-enzo-forest text-[10.5px] font-semibold uppercase tracking-[0.26em] text-enzo-sand/85">
                      {months}
                    </span>
                    <span className="block h-px flex-1 bg-enzo-cream/18" />
                  </div>
                )}

                <div
                  ref={(node) => {
                    if (!isDesktop) plateRefs.current[index] = node;
                  }}
                  className="relative aspect-[4/3] w-full overflow-hidden bg-enzo-forest-light/20 md:w-[68%]"
                  style={
                    {
                      "--a": `${-EDGE}%`,
                      clipPath:
                        "polygon(-1% -1%, var(--a) -1%, calc(var(--a) + 92.6%) 101%, -1% 101%)",
                    } as React.CSSProperties
                  }
                >
                  <ImageWithFallback
                    src={milestone.image}
                    alt={milestone.title}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </div>

                <p className="font-display mt-5 text-[10.5px] font-semibold uppercase tracking-[0.26em] text-enzo-sand">
                  {milestone.year}
                </p>
                <h3 className="mt-2.5 font-title text-[1.3rem] font-semibold leading-[1.15] tracking-[-0.03em]">
                  {milestone.title}
                </h3>
                <p className="mt-2.5 max-w-[46ch] text-[14.5px] leading-[1.7] text-enzo-cream/70">
                  {milestone.desc}
                </p>
              </li>
            );
          })}

          {total && (
            <li aria-hidden="true" className="mt-9 flex items-center gap-4">
              <span className="block h-px flex-1 bg-enzo-cream/20" />
              <span className="font-display shrink-0 text-[10.5px] font-semibold uppercase tracking-[0.26em] text-enzo-sand/85">
                {fill(content.overallLabel, { months: spellCount(total) })}
              </span>
            </li>
          )}
        </ol>
      </div>
    </section>
  );
}
