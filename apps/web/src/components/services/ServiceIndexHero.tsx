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
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { useGSAP } from "@/hooks/useGSAP";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { DUR, EASE } from "@/lib/motion";
import { getServiceMetrics, spellCount } from "@/lib/service-metrics";
import type { ServiceDetail } from "@/lib/content";
import { RoomPlan } from "./RoomPlan";

/** How long an untouched drawing holds one service before moving on. */
const CYCLE_MS = 4200;

interface ServiceIndexHeroProps {
  services: ServiceDetail[];
}

export function ServiceIndexHero({ services }: ServiceIndexHeroProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  // Once a visitor has driven the drawing themselves, the page stops
  // driving it for them — an auto-advance that keeps stealing control back
  // is the single most annoying thing a rotating hero can do.
  const [claimed, setClaimed] = useState(false);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

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
      gsap.set(lines, { yPercent: 0 });
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
      aria-labelledby="services-index-heading"
      className="relative flex min-h-[100svh] flex-col overflow-hidden bg-enzo-dark text-enzo-cream"
    >
      {/* ── Title block + drawing ── */}
      <div className="relative mx-auto flex w-full max-w-[1500px] flex-1 flex-col px-5 pt-[6.5rem] sm:px-6 md:px-12 md:pt-[8rem]">
        <div className="flex min-h-0 flex-1 flex-col gap-10 lg:flex-row lg:items-center lg:gap-14">
          <div className="lg:w-[44%]">
            <p
              data-hero-meta
              className="font-display text-[10.5px] font-semibold uppercase tracking-[0.3em] text-enzo-sand opacity-0"
              style={{ transform: "translateY(8px)" }}
            >
              Services
              <span className="pl-3 text-enzo-cream/35">
                {String(services.length).padStart(2, "0")}
              </span>
            </p>

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
              className="mt-6 max-w-[40ch] text-[15px] leading-[1.7] text-enzo-cream/60 opacity-0"
              style={{ transform: "translateY(8px)" }}
            >
              Drawn for your room, built in our Leicester workshop, fitted by
              the people who made it.
            </p>
          </div>

          {/* The drawing. Given the larger half of the fold and no frame,
              border or caption plate around it — it is the picture, not an
              illustration inside a card. */}
          <div
            data-hero-stage
            className="min-h-0 flex-1 opacity-0"
            style={{ transform: "translateY(24px)" }}
          >
            <div className="relative aspect-[4/3] w-full lg:h-full lg:max-h-[62vh]">
              {current && (
                <RoomPlan
                  key={current.slug}
                  slug={current.slug}
                  image={current.image}
                  caption={current.category}
                  className="absolute inset-0"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── The list ──
          A rail rather than an N-column grid: Tailwind cannot build a class
          from a runtime count, and a rail also gives overflow behaviour for
          free once the client publishes more services than fit. */}
      <div className="relative mx-auto w-full max-w-[1500px] px-5 pb-10 pt-8 sm:px-6 md:px-12 md:pb-12">
        <span aria-hidden="true" className="block h-px overflow-hidden">
          <span
            data-hero-rule
            className="block h-px origin-left bg-enzo-cream/15"
            style={{ transform: "scaleX(0)" }}
          />
        </span>

        <ul className="-mx-5 flex snap-x snap-mandatory overflow-x-auto px-5 sm:-mx-6 sm:px-6 md:mx-0 md:overflow-visible md:px-0">
          {services.map((service, index) => {
            const metrics = getServiceMetrics(service);
            const isActive = index === active;
            return (
              <li
                key={service.slug}
                data-hero-item
                className="min-w-[62%] shrink-0 snap-start opacity-0 sm:min-w-[38%] md:min-w-0 md:flex-1"
                style={{ transform: "translateY(16px)" }}
              >
                <Link
                  href={`/services/${service.slug}`}
                  onPointerEnter={() => claim(index)}
                  onFocus={() => claim(index)}
                  onClick={() => claim(index)}
                  className="group relative block pr-6 pt-5 focus-visible:outline-none"
                >
                  {/* The only marker: a short sand tick above the name you
                      are looking at, drawn on the same hairline. */}
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-0 h-px w-10 origin-left bg-enzo-sand transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                    style={{ transform: `scaleX(${isActive ? 1 : 0})` }}
                  />

                  <span
                    className="block text-[15px] font-medium tracking-[-0.015em] transition-colors duration-400"
                    style={{
                      color: isActive ? "#F2F0EB" : "rgba(242,240,235,0.38)",
                    }}
                  >
                    {service.title}
                  </span>
                  <span
                    className="mt-1.5 block text-[12px] tabular-nums transition-colors duration-400"
                    style={{
                      color: isActive
                        ? "rgba(242,240,235,0.55)"
                        : "rgba(242,240,235,0.22)",
                    }}
                  >
                    {metrics.timeline}
                    {metrics.fromPriceLabel && ` · from ${metrics.fromPriceLabel}`}
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
