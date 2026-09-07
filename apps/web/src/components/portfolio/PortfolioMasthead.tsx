"use client";

// /portfolio §01 — the fold.
//
// ── What this replaces, and why ──
// The fold used to be a register: every project as a ruled row, with the
// photograph following the cursor. It was a nice mechanic attached to the
// wrong job. §02 already shows every project — so the fold was the *second*
// full list on a page with nine projects in it, and the two sections said
// the same thing twice in different fonts.
//
// A fold's job is to say what this page is and make you want to scroll. So
// it does that instead: one enormous plate that runs the archive past you on
// a slow cut, a masthead over it, and a strip of the four numbers that
// actually describe the collection — rooms, disciplines, towns, the span of
// years. No list. The list is the next section, where it belongs.
//
// Every figure is counted off the records rather than typed, so publishing a
// tenth project in a new town moves three of them without anybody editing
// this file.
//
// The plate cuts on a timer and stops the moment the visitor takes over,
// which is the same rule the /services fold and the /about statement follow.
import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { useGSAP } from "@/hooks/useGSAP";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils";
import { DUR, EASE } from "@/lib/motion";
import type { PortfolioItem } from "@/lib/content";

/** How long one room holds before the plate cuts to the next. */
const HOLD_MS = 4200;

export function PortfolioMasthead({ items }: { items: PortfolioItem[] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const [claimed, setClaimed] = useState(false);
  const reduced = usePrefersReducedMotion();

  const pick = useCallback((index: number) => {
    setClaimed(true);
    setActive(index);
  }, []);

  useEffect(() => {
    if (claimed || reduced || items.length < 2) return;
    const id = window.setInterval(
      () => setActive((current) => (current + 1) % items.length),
      HOLD_MS,
    );
    return () => window.clearInterval(id);
  }, [claimed, reduced, items.length]);

  useGSAP(sectionRef, (section, isReduced) => {
    const lines = gsap.utils.toArray<HTMLElement>("[data-mast-line]", section);
    const body = gsap.utils.toArray<HTMLElement>("[data-mast-body]", section);
    const plate = section.querySelector<HTMLElement>("[data-mast-plate]");

    if (isReduced) {
      gsap.set(body, { opacity: 1, y: 0 });
      gsap.set(lines, { yPercent: 0, y: 0 });
      if (plate) gsap.set(plate, { clipPath: "inset(0 0 0 0)" });
      return;
    }

    gsap.set(lines, { yPercent: 100, y: 0 });

    // Above the fold, so it plays on load — there is no scroll to wait for.
    const tl = gsap.timeline({ delay: 0.12 });
    tl.fromTo(
      plate,
      { clipPath: "inset(0 0 100% 0)" },
      { clipPath: "inset(0 0 0% 0)", duration: 1.2, ease: EASE.editorial },
    )
      .to(
        lines,
        { yPercent: 0, duration: DUR.editorial, ease: EASE.editorial, stagger: 0.09 },
        0.2,
      )
      .to(
        body,
        { opacity: 1, y: 0, duration: DUR.enter, ease: EASE.enter, stagger: 0.07 },
        0.6,
      );

    return () => {
      tl.kill();
    };
  });

  if (!items.length) return null;

  const current = items[active] ?? items[0]!;
  const towns = new Set(items.map((item) => item.location)).size;
  const disciplines = new Set(items.map((item) => item.category)).size;
  const years = items.map((item) => item.year).sort();
  const span =
    years[0] === years[years.length - 1]
      ? years[0]!
      : `${years[0]}–${years[years.length - 1]!.slice(-2)}`;

  const figures = [
    { value: String(items.length), label: "Rooms finished" },
    { value: String(disciplines), label: "Disciplines" },
    { value: String(towns), label: "Towns & villages" },
    { value: span, label: "Years" },
  ];

  return (
    <section
      ref={sectionRef}
      id="portfolio-hero"
      aria-labelledby="portfolio-masthead-heading"
      className="relative overflow-hidden bg-enzo-dark text-enzo-cream scroll-mt-24"
    >
      {/* ── The plate ──
          Full bleed and tall: the room is the first thing on the page, and
          the type sits on it rather than beside it. */}
      <div
        data-mast-plate
        className="relative h-[68svh] min-h-[24rem] w-full overflow-hidden bg-enzo-forest md:h-[76svh]"
        style={{ clipPath: "inset(0 0 100% 0)" }}
      >
        {/* Every room is mounted and cross-faded rather than swapping one
            `src`. Swapping the source means a decode on every cut, which on
            a slow connection shows a blank frame in the middle of the fold. */}
        {items.map((item, index) => (
          <ImageWithFallback
            key={item.id}
            src={item.image}
            alt={index === active ? item.title : ""}
            aria-hidden={index === active ? undefined : true}
            className="absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{
              opacity: index === active ? 1 : 0,
              transform: index === active ? "scale(1)" : "scale(1.05)",
            }}
          />
        ))}
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-enzo-dark via-enzo-dark/45 to-enzo-dark/70"
        />

        {/* Masthead, on the plate. */}
        <div className="absolute inset-x-0 bottom-0 shell flex flex-col pb-8 md:pb-10">
          <div className="flex items-center gap-4">
            <span
              data-mast-body
              className="font-display shrink-0 text-[10.5px] font-semibold uppercase tracking-[0.3em] text-enzo-sand opacity-0"
              style={{ transform: "translateY(8px)" }}
            >
              01 — Archive
            </span>
            <span
              data-mast-body
              className="font-display shrink-0 text-[10.5px] font-semibold uppercase tracking-[0.3em] text-enzo-cream/65 opacity-0"
              style={{ transform: "translateY(8px)" }}
            >
              {String(items.length).padStart(2, "0")} finished
            </span>
          </div>

          <h1
            id="portfolio-masthead-heading"
            className="mt-5 font-title font-semibold leading-[0.92] tracking-[-0.05em] md:mt-7"
            style={{ fontSize: "clamp(2.4rem, 7vw, 6rem)" }}
          >
            {["Every room", "we have finished."].map((line) => (
              <span key={line} className="block overflow-hidden pb-[0.08em] -mb-[0.08em]">
                <span
                  data-mast-line
                  className="block"
                  style={{ transform: "translateY(100%)" }}
                >
                  {line}
                </span>
              </span>
            ))}
          </h1>

          {/* What you are looking at, and the cut marks that drive it. */}
          <div
            data-mast-body
            className="mt-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-4 opacity-0 md:mt-8"
            style={{ transform: "translateY(14px)" }}
          >
            <p className="text-[13px] text-enzo-cream/70">
              <span className="text-enzo-cream">{current.title}</span>
              <span className="px-2 text-enzo-cream/30">·</span>
              {current.location}
              <span className="px-2 text-enzo-cream/30">·</span>
              {current.year}
            </p>

            <div
              role="group"
              aria-label="Choose a room"
              className="flex flex-wrap items-center"
            >
              {items.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={index === active}
                  aria-label={item.title}
                  onClick={() => pick(index)}
                  className="group flex h-11 items-center px-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-4 focus-visible:ring-offset-enzo-dark"
                >
                  <span
                    aria-hidden="true"
                    className="block h-px transition-[width,background-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:bg-enzo-cream"
                    style={{
                      width: index === active ? 34 : 14,
                      backgroundColor:
                        index === active ? "#D4C9B5" : "rgba(242,240,235,0.3)",
                    }}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── The collection, in four figures ──
          Counted off the records, so a project published in a new town moves
          three of these on its own.

          Below `sm` this is a ruled *list*, not a grid. The four figures are
          not the same shape — three are single digits and the fourth is a
          seven-character year span — and a 2×2 grid on a 375px screen gives
          each cell about 115px of usable width, which "2024–26" at 32px
          overruns by half its length. Worse, the two-column layout made the
          longest label wrap while its neighbours did not, so one grid row
          stood visibly taller than the other. One figure per line removes
          both problems at once: the value sits left, the label sits right on
          the same baseline, and each row is exactly as tall as one line of
          type. The grid returns at `sm`, where the cells are wide enough for
          it. */}
      <div className="shell">
        <div className="overflow-hidden border-t border-enzo-cream/15 sm:-ml-px">
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {figures.map((figure) => (
              <div
                key={figure.label}
                data-mast-body
                className="flex items-baseline justify-between gap-4 border-b border-enzo-cream/15 py-4 opacity-0 sm:block sm:border-l sm:px-5 sm:py-7 md:px-8 md:py-9 lg:border-b-0"
                style={{ transform: "translateY(14px)" }}
              >
                <dd
                  className={cn(
                    "font-title font-semibold leading-[0.9] tabular-nums tracking-[-0.045em]",
                    "text-[1.75rem] sm:text-[clamp(2rem,3.6vw,3.2rem)]",
                  )}
                >
                  {figure.value}
                </dd>
                {/* Tracking eases off below md. At the 2-column width
                    "Towns & villages" is 16 characters against a ~128px box
                    net of padding, and 0.24em tracking alone adds 38 units
                    of letter-spacing on top of the glyphs — enough to wrap
                    it to a second line while its three neighbours sit on
                    one. Tighter tracking below md removes that overhang; md
                    and up restores the original spacing. On the single
                    column it also stops the longest label crowding the
                    figure it shares a line with. */}
                <dt className="font-display text-right text-[10px] font-semibold uppercase tracking-[0.13em] text-enzo-cream/65 sm:mt-3 sm:text-left md:tracking-[0.24em]">
                  {figure.label}
                </dt>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
