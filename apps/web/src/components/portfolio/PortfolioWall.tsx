"use client";

// /portfolio §02 — the wall.
//
// The register above is all type and one photograph at a time. This is the
// opposite: every project at once, on a near-black ground, in a mosaic where
// the tiles are deliberately different sizes so the wall has a rhythm rather
// than a grid's flat repetition.
//
// ── Filtering, without the flicker ──
// Filtering a grid normally means the surviving tiles teleport into their
// new positions, which reads as a page reload of a small area. This uses
// GSAP's Flip: the tile boxes are recorded, React re-renders the filtered
// set, and Flip animates every survivor from where it *was* to where it now
// *is*, while the ones entering scale up and the ones leaving are simply
// gone. The result is that a filter looks like the wall rearranging itself,
// which is the only reason to animate a filter at all.
//
// Flip measures real layout, so this has to run after React has committed
// the new DOM — hence `useLayoutEffect` and a ref holding the recorded
// state, not a `useEffect` racing the paint.
//
// ── Below sm: two things were actually wrong, not one ──
// The tab bar wrapped onto two or three ragged rows at phone widths, and the
// travelling underline indicator — built to slide between tabs on ONE row —
// kept its position at the bottom of the whole wrapped block regardless of
// which row the active tab was actually on. An underline sitting under the
// wrong row reads as broken, because it is: `offsetLeft` alone cannot
// describe a button's position once its siblings wrap. Below sm the tab bar
// is now a fixed two-column grid of self-contained toggle buttons instead —
// no shared indicator element, so there is nothing to get out of sync with
// a row it isn't on. sm and up keeps the original single-row, underline-
// tracked bar untouched.
//
// The tiles were worse: a single column, one full-width photograph after
// another, with no upper bound — a studio that publishes its hundredth room
// would ship a hundredth full-bleed image on the same endless column. Below
// sm the grid is now two columns, and only a page of tiles renders at a
// time; a "Show more" row extends it a page at a whole tap. sm and up is
// the original variable-span mosaic, complete, exactly as before — nothing
// about the desktop wall changed.
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { Flip } from "gsap/Flip";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { revealOnScroll, useGSAP } from "@/hooks/useGSAP";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { EASE, REVEAL_START } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { fill, type PortfolioItem, type PortfolioPageContent } from "@/lib/content";

gsap.registerPlugin(Flip);

/**
 * Tile sizes, cycled. Two wide-and-tall anchors per eight tiles is what
 * stops the wall reading as a grid; the rest fill around them. Any project
 * count lands somewhere sensible in the cycle.
 */
const SHAPES = [
  "sm:col-span-2 sm:row-span-2",
  "sm:col-span-1 sm:row-span-1",
  "sm:col-span-1 sm:row-span-1",
  "sm:col-span-1 sm:row-span-2",
  "sm:col-span-1 sm:row-span-1",
  "sm:col-span-2 sm:row-span-1",
  "sm:col-span-1 sm:row-span-1",
  "sm:col-span-1 sm:row-span-1",
];

/** One page of the mobile grid — three rows of two. */
const MOBILE_PAGE_SIZE = 6;

interface PortfolioWallProps {
  items: PortfolioItem[];
  onOpen: (id: string) => void;
  content: PortfolioPageContent["wall"];
}

export function PortfolioWall({ items, onOpen, content }: PortfolioWallProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const flipState = useRef<Flip.FlipState | null>(null);
  // The "everything" tab is also the sentinel the filter compares against, so
  // it is read from the copy rather than duplicated as a constant here.
  const ALL = content.allLabel;
  const [filter, setFilter] = useState(ALL);
  const [mobilePage, setMobilePage] = useState(1);

  // Matches the grid's own `sm:` breakpoint exactly, so "desktop" here means
  // precisely the viewports where the full mosaic actually renders.
  const isMosaic = useMediaQuery("(min-width: 640px)");
  const reducedMotion = usePrefersReducedMotion();

  const categories = useMemo(
    () => [ALL, ...Array.from(new Set(items.map((item) => item.category)))],
    [items, ALL],
  );

  const shown = useMemo(
    () => (filter === ALL ? items : items.filter((item) => item.category === filter)),
    [items, filter, ALL],
  );

  // The full set on sm and up; a page of it below sm. This is the only
  // thing that decides what actually renders, so the mosaic's Flip
  // animation — which measures whatever is in the DOM — is untouched on
  // desktop: `visible` and `shown` are the same array there.
  const visible = isMosaic ? shown : shown.slice(0, mobilePage * MOBILE_PAGE_SIZE);
  const remaining = shown.length - visible.length;

  /** Records where every tile is, immediately before React re-renders. */
  const beginFilter = (next: string) => {
    if (next === filter) return;
    const grid = gridRef.current;
    if (grid && !reducedMotion) {
      flipState.current = Flip.getState(grid.querySelectorAll("[data-tile]"));
    }
    setFilter(next);
    setMobilePage(1);
  };

  // Plays the recorded state forward once the new DOM is committed.
  useLayoutEffect(() => {
    const state = flipState.current;
    if (!state) return;
    flipState.current = null;

    Flip.from(state, {
      duration: 0.62,
      ease: "power2.inOut",
      absolute: true,
      // Tiles that were not in the previous set have no "from " box, so Flip
      // is told explicitly how they should arrive rather than snapping in.
      onEnter: (elements) =>
        gsap.fromTo(
          elements,
          { opacity: 0, scale: 0.92 },
          { opacity: 1, scale: 1, duration: 0.45, ease: EASE.enter },
        ),
      onLeave: (elements) =>
        gsap.to(elements, { opacity: 0, scale: 0.94, duration: 0.28, ease: EASE.exit }),
    });
  }, [filter]);

  // The travelling underline, measured off the real buttons so it stays
  // aligned at any label length. sm and up only — below it the tab bar is
  // a grid of self-contained buttons with no shared indicator to move.
  useLayoutEffect(() => {
    if (!isMosaic) return;
    const bar = tabsRef.current;
    if (!bar) return;
    const rule = bar.querySelector<HTMLElement>("[data-tab-rule]");
    const active = bar.querySelector<HTMLElement>('[data-tab][aria-pressed="true"]');
    if (!rule || !active) return;

    gsap.to(rule, {
      x: active.offsetLeft,
      width: active.offsetWidth,
      duration: reducedMotion ? 0 : 0.45,
      ease: "power3.out",
    });
  }, [filter, categories.length, isMosaic, reducedMotion]);

  // A fresh page of mobile tiles has no scroll-triggered reveal of its own
  // — the one below fires once, on mount, over whatever was on screen then.
  // So newly appended tiles get the same clip-path uncover played directly,
  // scoped to just the tiles this click added.
  const prevMobilePage = useRef(mobilePage);
  useLayoutEffect(() => {
    if (isMosaic || mobilePage === prevMobilePage.current) {
      prevMobilePage.current = mobilePage;
      return;
    }
    const grid = gridRef.current;
    if (grid) {
      const tiles = grid.querySelectorAll<HTMLElement>("[data-tile]");
      const added = Array.from(tiles).slice(prevMobilePage.current * MOBILE_PAGE_SIZE);
      if (added.length) {
        if (reducedMotion) {
          gsap.set(added, { clipPath: "inset(0 0 0% 0)" });
        } else {
          gsap.fromTo(
            added,
            { clipPath: "inset(0 0 100% 0)" },
            {
              clipPath: "inset(0 0 0% 0)",
              duration: 0.7,
              ease: EASE.editorial,
              stagger: 0.05,
            },
          );
        }
      }
    }
    prevMobilePage.current = mobilePage;
  }, [mobilePage, isMosaic, reducedMotion]);

  useGSAP(sectionRef, (section, reduced) => {
    const tiles = gsap.utils.toArray<HTMLElement>("[data-tile]", section);
    if (!tiles.length) return;

    if (reduced) {
      gsap.set(tiles, { clipPath: "inset(0 0 0% 0)", opacity: 1 });
      return;
    }

    revealOnScroll(
      tiles[0]!,
      (timeline) =>
        timeline.fromTo(
          tiles,
          { clipPath: "inset(0 0 100% 0)" },
          {
            clipPath: "inset(0 0 0% 0)",
            duration: 0.9,
            ease: EASE.editorial,
            stagger: 0.06,
          },
        ),
      { start: REVEAL_START },
    );
  });

  if (!items.length) return null;

  return (
    <section
      ref={sectionRef}
      id="portfolio-wall"
      aria-labelledby="portfolio-wall-heading"
      className="relative overflow-hidden bg-enzo-dark text-enzo-cream scroll-mt-24"
    >
      <div className="shell py-20 md:py-28">
        <h2 id="portfolio-wall-heading" className="sr-only">
          {content.srHeading}
        </h2>

        <SectionIntro
          layout="split"
          tone="dark"
          index={content.index}
          label={content.label}
          datum={fill(content.datum, { count: shown.length })}
          lines={content.lines}
          lede={content.lede}
        />

        {/* ── Tab bar: sm and up ──
            The original single-row bar with the travelling underline,
            unchanged. */}
        <div
          ref={tabsRef}
          role="group"
          aria-label={content.filterGroupLabel}
          className="relative mt-12 hidden items-center gap-x-7 border-b border-enzo-cream/15 pb-4 sm:flex sm:flex-wrap sm:gap-y-3 md:mt-14"
        >
          {categories.map((category) => {
            const on = category === filter;
            return (
              <button
                key={category}
                data-tab
                type="button"
                aria-pressed={on}
                onClick={() => beginFilter(category)}
                className={cn(
                  "relative py-1 text-[14px] transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-4 focus-visible:ring-offset-enzo-dark",
                  on ? "text-enzo-cream" : "text-enzo-cream/70 hover:text-enzo-cream/85",
                )}
              >
                {category}
                <span className="ml-2 font-display text-[10px] tabular-nums tracking-[0.14em] text-enzo-cream/65">
                  {category === ALL
                    ? items.length
                    : items.filter((item) => item.category === category).length}
                </span>
              </button>
            );
          })}
          <span
            data-tab-rule
            aria-hidden="true"
            className="absolute -bottom-px left-0 h-px w-0 bg-enzo-sand"
          />
        </div>

        {/* ── Tab bar: below sm ──
            A fixed two-column grid of self-contained toggle buttons — each
            carries its own active state, so there is no shared indicator
            that can end up under the wrong row. */}
        <div
          role="group"
          aria-label={content.filterGroupLabel}
          className="mt-12 grid grid-cols-2 gap-2 sm:hidden"
        >
          {categories.map((category) => {
            const on = category === filter;
            const count =
              category === ALL
                ? items.length
                : items.filter((item) => item.category === category).length;
            return (
              <button
                key={category}
                type="button"
                aria-pressed={on}
                onClick={() => beginFilter(category)}
                className={cn(
                  "flex items-center justify-between gap-2 border px-3.5 py-3 text-left text-[13.5px] transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-2 focus-visible:ring-offset-enzo-dark",
                  on
                    ? "border-enzo-sand bg-enzo-sand/10 text-enzo-cream"
                    : "border-enzo-cream/15 text-enzo-cream/70",
                )}
              >
                {category}
                <span
                  className={cn(
                    "font-display shrink-0 text-[10px] tabular-nums tracking-[0.14em]",
                    on ? "text-enzo-sand" : "text-enzo-cream/65",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── The mosaic ──
            `auto-rows` plus row spans is what gives the tiles different
            heights from sm up. Below sm every tile is one column and one
            row of a fixed two-column grid — see the file-header note for
            why that, and the paging below it, replaced a single endless
            column. */}
        <div
          ref={gridRef}
          // `dense` matters here: tiles of mixed row/column span leave holes
          // wherever the next tile will not fit, and a photo wall with square
          // gaps punched in it reads as broken rather than as a mosaic. Dense
          // packing backfills them with whichever later tile does fit.
          className="mt-8 grid grid-cols-2 gap-3 [grid-auto-flow:dense] sm:auto-rows-[13rem] sm:grid-cols-3 lg:auto-rows-[15rem] lg:grid-cols-4"
        >
          {visible.map((item, i) => (
            <button
              key={item.id}
              data-tile
              data-flip-id={item.id}
              type="button"
              onClick={() => onOpen(item.id)}
              aria-label={fill(content.openTileLabel, { title: item.title })}
              className={cn(
                "group relative aspect-[3/4] overflow-hidden bg-enzo-forest text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-2 focus-visible:ring-offset-enzo-dark sm:aspect-auto",
                SHAPES[i % SHAPES.length],
              )}
            >
              <ImageWithFallback
                src={item.image}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06]"
              />

              {/* The caption rides up from the bottom edge on approach.
                  It sits on a gradient rather than a solid bar so the
                  photograph is never cut in half by a rectangle. Below sm,
                  where there is no hover, it is simply always there. */}
              <span className="absolute inset-x-0 bottom-0 translate-y-0 bg-gradient-to-t from-enzo-dark/90 via-enzo-dark/45 to-transparent px-3 pb-3 pt-10 opacity-100 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] sm:translate-y-3 sm:px-4 sm:pb-4 sm:pt-14 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100 sm:group-focus-visible:translate-y-0 sm:group-focus-visible:opacity-100">
                <span className="font-display block text-[9px] font-semibold uppercase tracking-[0.2em] text-enzo-sand sm:text-[9.5px] sm:tracking-[0.24em]">
                  {fill(content.tileMeta, { category: item.category, year: item.year })}
                </span>
                <span className="mt-1 block font-title text-[0.9rem] font-semibold leading-[1.2] tracking-[-0.02em] text-enzo-cream sm:mt-1.5 sm:text-[1.05rem]">
                  {item.title}
                </span>
                <span className="mt-0.5 block text-[10.5px] text-enzo-cream/70 sm:text-[12px]">
                  {item.location}
                </span>
              </span>

              {/* Corner mark — always there, so a tile reads as openable
                  before anybody hovers it. */}
              <span
                aria-hidden="true"
                className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full border border-enzo-cream/30 text-[12px] leading-none text-enzo-cream/60 transition-colors duration-300 group-hover:border-enzo-sand group-hover:bg-enzo-sand group-hover:text-enzo-forest sm:right-3 sm:top-3 sm:h-7 sm:w-7 sm:text-[13px]"
              >
                +
              </span>
            </button>
          ))}
        </div>

        {/* ── Show more — below sm only ──
            One page at a tap, not the whole remainder at once: with a
            hundred rooms published, revealing all of them on one press
            would just recreate the endless column a click later. */}
        {!isMosaic && remaining > 0 && (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => setMobilePage((page) => page + 1)}
              className="border border-enzo-cream/20 px-6 py-3 text-[13px] font-medium text-enzo-cream/80 transition-colors duration-300 hover:border-enzo-sand hover:text-enzo-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-2 focus-visible:ring-offset-enzo-dark"
            >
              {fill(content.showMore, {
                count: Math.min(MOBILE_PAGE_SIZE, remaining),
              })}
              <span className="ml-2 text-enzo-cream/65">
                {fill(content.remaining, { count: remaining })}
              </span>
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
