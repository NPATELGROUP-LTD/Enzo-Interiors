"use client";

// /services §01 — the fold.
//
// Deliberately spare. Six things are on it: a label, a two-line title, one
// sentence, the drawing, a hairline, and the list of disciplines. Nothing
// else — no background texture, no glow, no chrome around the drawing, no
// per-item cards or arrow buttons. The one idea it carries is the drawing
// itself (RoomPlan.tsx): a plan of the room with the finished photograph
// clipped inside its footprint. Pointing at a name in the list below
// re-draws it.
//
// Three things were tried here and removed, so they aren't re-tried:
//   · a ruled grid behind everything — it turned the fold into graph paper
//     and argued with the drawing's own linework
//   · a soft radial "light" — a glow on a near-black ground reads as a
//     gradient artefact, not as light
//   · outlined (text-stroke) titles for the inactive items — clever for
//     one screenshot, but four hollow words is harder to read than four
//     dimmed ones, and it made a simple list look busy
// Inactive items are simply dimmer. That is the whole treatment.
//
// Scales with however many services the client publishes: the title counts
// them, and the list is a flex rail that becomes swipeable when there are
// more names than the width can hold.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ArrowRight } from "lucide-react";
import { useGSAP } from "@/hooks/useGSAP";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { DUR, EASE } from "@/lib/motion";
import { getServiceMetrics, spellCount } from "@/lib/service-metrics";
import type { ServiceDetail } from "@/lib/content";
import { RoomPlanDrawing, type PlanFrame } from "../shared/RoomPlanDrawing";

/** How long an untouched drawing holds one service before moving on. */
const CYCLE_MS = 4200;

interface IndexHeroProps {
  services: ServiceDetail[];
}

export function IndexHero({ services }: IndexHeroProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  // Once a visitor has driven the drawing themselves, the page stops
  // driving it for them — an auto-advance that keeps stealing control back
  // is the single most annoying thing a rotating hero can do.
  const [claimed, setClaimed] = useState(false);
  // Where the drawn room sits inside the stage, so the caption can hang off
  // the room's own left wall instead of the stage's edge — see the caption
  // below. Null until the drawing has measured itself once.
  const [frame, setFrame] = useState<PlanFrame | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  // Stable identity: RoomPlanDrawing keys its measuring effect on this, and a
  // fresh closure each render would re-observe on every state change.
  const handleFrame = useCallback((next: PlanFrame) => setFrame(next), []);

  useEffect(() => {
    if (claimed || reducedMotion || services.length < 2) return;
    const id = window.setInterval(
      () => setActive((current) => (current + 1) % services.length),
      CYCLE_MS,
    );
    return () => window.clearInterval(id);
  }, [claimed, reducedMotion, services.length]);

  useGSAP(sectionRef, (section, reduced) => {
    const meta = gsap.utils.toArray<HTMLElement>("[data-hero-meta]", section);
    const lines = gsap.utils.toArray<HTMLElement>("[data-hero-line]", section);
    const items = gsap.utils.toArray<HTMLElement>("[data-hero-item]", section);
    const stage = section.querySelector<HTMLElement>("[data-hero-stage]");
    const rule = section.querySelector<HTMLElement>("[data-hero-rule]");

    if (reduced) {
      gsap.set([...meta, ...items, stage].filter(Boolean), { opacity: 1, y: 0 });
      // `y: 0` too: GSAP has already resolved the markup's `translateY(100%)`
      // to pixels on the computed matrix, so `yPercent: 0` alone leaves the
      // title masked off and a reduced-motion visitor sees no headline. Same
      // reasoning as the non-reduced branch below.
      gsap.set(lines, { yPercent: 0, y: 0 });
      if (rule) gsap.set(rule, { scaleX: 1 });
      return;
    }

    // Same trick SectionIntro uses: restate the markup's percentage
    // transform in GSAP's own units before tweening it, or GSAP reads the
    // resolved pixel value off the computed matrix and the tween to
    // `yPercent: 0` has nothing to do.
    gsap.set(lines, { yPercent: 100, y: 0 });

    // Above the fold, so it plays on load — there is no scroll to wait for.
    const tl = gsap.timeline({ delay: 0.15 });

    tl.to(meta, { opacity: 1, y: 0, duration: DUR.enter, ease: EASE.enter, stagger: 0.06 })
      .to(
        lines,
        { yPercent: 0, duration: DUR.editorial, ease: EASE.editorial, stagger: 0.08 },
        0.08,
      )
      .to(stage, { opacity: 1, y: 0, duration: 1, ease: EASE.editorial }, 0.24)
      .to(rule, { scaleX: 1, duration: 0.9, ease: EASE.editorial }, 0.42)
      .to(items, { opacity: 1, y: 0, duration: DUR.enter, ease: EASE.enter, stagger: 0.06 }, 0.5);

    return () => {
      tl.kill();
    };
  });

  const claim = (index: number) => {
    setClaimed(true);
    setActive(index);
  };

  const current = services[active] ?? services[0];

  return (
    <section
      ref={sectionRef}
      id="services-hero"
      aria-labelledby="services-index-heading"
      className="relative flex min-h-[100svh] flex-col overflow-hidden bg-enzo-dark text-enzo-cream scroll-mt-24"
    >
      {/* ── Title block + drawing ── */}
      <div className="relative shell flex flex-1 flex-col pt-[6.5rem] md:pt-[8rem]">
        <div className="flex min-h-0 flex-1 flex-col gap-10 lg:flex-row lg:items-center lg:gap-14">
          <div className="lg:w-[44%]">

            <h1
              id="services-index-heading"
              className="mt-6 font-title font-semibold leading-[0.98] tracking-[-0.045em]"
              style={{ fontSize: "clamp(2.4rem, 5.4vw, 4.6rem)" }}
            >
              {[`${spellCount(services.length)} disciplines.`, "One workshop."].map(
                (line) => (
                  <span
                    key={line}
                    className="block overflow-hidden pb-[0.1em] -mb-[0.1em]"
                  >
                    <span
                      data-hero-line
                      className="block"
                      style={{ transform: "translateY(100%)" }}
                    >
                      {line}
                    </span>
                  </span>
                ),
              )}
            </h1>

            <p
              data-hero-meta
              className="mt-6 max-w-[40ch] text-[15px] leading-[1.7] text-enzo-cream/70 opacity-0"
              style={{ transform: "translateY(8px)" }}
            >
              Drawn for your room, built in our Leicester workshop, fitted by
              the people who made it.
            </p>
          </div>

          {/* The drawing. Given the larger half of the fold and no frame,
              border or caption plate around it — it is the picture, not an
              illustration inside a card.

              It is also a link. Before, the only way through to a service
              was the small list underneath, and nothing said so — the
              biggest, most obviously interactive thing on the fold did
              nothing when clicked, which is the worst possible signal. Now
              the drawing opens whatever it is showing, and says so. */}
          <div
            data-hero-stage
            className="min-h-0 flex-1 opacity-0"
            style={{ transform: "translateY(24px)" }}
          >
            {current && (
              <Link
                href={`/services/${current.slug}`}
                className="group/plan block focus-visible:outline-none"
                aria-label={`Open ${current.title}`}
              >
                <div className="relative aspect-[4/3] w-full lg:h-[calc(100%-2.5rem)] lg:max-h-[58vh]">
                  <RoomPlanDrawing
                    key={current.slug}
                    slug={current.slug}
                    image={current.image}
                    caption={current.category}
                    // Position, not hash — so the four published services
                    // each draw a different room shape rather than risking
                    // two of them landing on the same one.
                    pattern={active}
                    onFrame={handleFrame}
                    className="absolute inset-0"
                  />
                  {/* No hover ring. A box drawn around a technical drawing
                      reads as part of the drawing — it looked like another
                      wall. The link's affordance is the underlined label
                      below, which is always visible anyway. */}
                </div>

                {/* The instruction, always visible — not a hover-only hint.
                    Indented to the room's own left wall rather than to the
                    stage: the SVG letterboxes inside its box and the plan
                    carries its own draughting margin, so type set flush to
                    the container floated a good 60px clear of the
                    photograph it was captioning. The drawing reports where
                    it actually landed and the caption hangs off that, which
                    holds at every width and for all four room shapes. */}
                <span
                  className="mt-5 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3 lg:mt-6"
                  style={
                    frame
                      ? {
                          paddingLeft: frame.left,
                          paddingRight: Math.max(0, frame.width - frame.right),
                        }
                      : undefined
                  }
                >
                  <span className="shrink-0 whitespace-nowrap text-[13.5px] font-medium text-enzo-cream underline decoration-enzo-sand/50 decoration-1 underline-offset-[6px] transition-[text-decoration-color] duration-300 group-hover/plan:decoration-enzo-sand">
                    Open {current.title}
                  </span>
                  <span className="min-w-0 text-[12px] leading-[1.5] text-enzo-cream/65">
                    {current.description}
                  </span>
                </span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── The list ──
          A rail rather than an N-column grid: Tailwind cannot build a class
          from a runtime count, and a rail also gives overflow behaviour for
          free once the client publishes more services than fit.

          ── Below md, this was broken, not just cramped ──
          The rail's mobile sizing (`min-w-[62%]`, `overflow-x-auto`, no
          scroll affordance) hid two of four disciplines off the right edge
          of a phone screen with nothing to say they were there —
          `scrollWidth` measured 871px against a 375px viewport. A visitor
          saw two names and had no reason to think a third existed. Below md
          the four rows are now a plain vertical list instead: no scrolling,
          all four always visible, a full-width tap target per row and a
          trailing arrow — the same "this goes somewhere" mark
          ServicesDoors' mobile accordion already uses — saying plainly that
          the row navigates. md and up is the original rail, untouched. */}
      <div className="relative shell pb-10 pt-8 md:pb-12">
        <span aria-hidden="true" className="block h-px overflow-hidden">
          <span
            data-hero-rule
            className="block h-px origin-left bg-enzo-cream/15"
            style={{ transform: "scaleX(0)" }}
          />
        </span>

        <ul className="flex flex-col md:flex-row">
          {services.map((service, index) => {
            const metrics = getServiceMetrics(service);
            const isActive = index === active;
            return (
              <li
                key={service.slug}
                data-hero-item
                className="border-t border-enzo-cream/10 opacity-0 first:border-t-0 md:min-w-0 md:flex-1 md:border-t-0"
                style={{ transform: "translateY(16px)" }}
              >
                <Link
                  href={`/services/${service.slug}`}
                  onPointerEnter={() => claim(index)}
                  onFocus={() => claim(index)}
                  onClick={() => claim(index)}
                  className="group relative block focus-visible:outline-none"
                >
                  {/* ── md and up: the original rail item, unchanged ── */}
                  <span className="hidden md:block md:pr-6 md:pt-5">
                    {/* The only marker: a short sand tick above the name you
                        are looking at, drawn on the same hairline. */}
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-0 h-px w-10 origin-left bg-enzo-sand transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                      style={{ transform: `scaleX(${isActive ? 1 : 0})` }}
                    />

                    <span
                      className="block text-[15px] font-medium tracking-[-0.015em] underline decoration-transparent decoration-1 underline-offset-4 transition-[color,text-decoration-color] duration-400 group-hover:decoration-enzo-sand group-focus-visible:decoration-enzo-sand"
                      style={{
                        // The dimmed state is the point of this list, but
                        // 0.38 alpha put a *service name* at 2.6:1 on forest.
                        // 0.65 is the 4.5:1 floor for cream on this ground and
                        // still reads as clearly unselected against the full-
                        // strength active row and its sand underline.
                        color: isActive ? "#F2F0EB" : "rgba(242,240,235,0.65)",
                      }}
                    >
                      {service.title}
                    </span>
                    <span
                      className="mt-1.5 block text-[12px] tabular-nums transition-colors duration-400"
                      style={{
                        color: isActive
                          ? "rgba(242,240,235,0.85)"
                          : "rgba(242,240,235,0.65)",
                      }}
                    >
                      {metrics.timeline}
                      {metrics.fromPriceLabel && ` · from ${metrics.fromPriceLabel}`}
                    </span>
                  </span>

                  {/* ── Below md: a full-width row, everything visible,
                      nothing to discover by scrolling. No active-dimming —
                      touch has no hover, and a tap navigates away almost
                      immediately, so distinguishing "the one you are
                      looking at" from the other three buys nothing here;
                      all four simply read at full legibility. */}
                  <span className="flex items-center justify-between gap-4 py-5 md:hidden">
                    <span className="min-w-0">
                      <span className="block text-[16px] font-medium tracking-[-0.015em] text-enzo-cream">
                        {service.title}
                      </span>
                      <span className="mt-1 block text-[13px] tabular-nums text-enzo-cream/70">
                        {metrics.timeline}
                        {metrics.fromPriceLabel && ` · from ${metrics.fromPriceLabel}`}
                      </span>
                    </span>
                    <ArrowRight
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-enzo-cream/35 transition-transform duration-300 group-hover:translate-x-1"
                    />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
