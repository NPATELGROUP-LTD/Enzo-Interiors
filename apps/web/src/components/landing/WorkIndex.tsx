"use client";

// Section 04 — five rooms, not nine rows.
//
// This was a full typeset index: nine projects, each with category, place and
// year, plus a pointer-tracked photograph. On a landing page that is a wall
// of text nobody reads — the job here is to show the work and get out of the
// way, and the full index already exists on /portfolio.
//
// So: five projects, one asymmetric wall of photographs, and only the two
// facts that actually persuade — what the room is and where it is. Each tile
// drifts at its own rate as the section passes, which is what stops a static
// grid from feeling like a contact sheet.
//
// Below `lg` the wall becomes a horizontal snap carousel: five tiles of wildly
// different sizes stacked vertically is a very long page on a phone, and a
// swipeable row is the gesture people already expect for a gallery.
import { useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ArrowRight } from "lucide-react";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { useGSAP } from "@/hooks/useGSAP";
import { DUR, EASE, REVEAL_START } from "@/lib/motion";
import type { PortfolioItem } from "@/lib/content";

interface WorkIndexProps {
  items: PortfolioItem[];
}

/** Grid placement for the five featured tiles — a 12 x 5 wall, fully packed. */
const PLACEMENT = [
  "col-start-1 col-end-8 row-start-1 row-end-4",
  "col-start-8 col-end-13 row-start-1 row-end-3",
  "col-start-8 col-end-13 row-start-3 row-end-6",
  "col-start-1 col-end-5 row-start-4 row-end-6",
  "col-start-5 col-end-8 row-start-4 row-end-6",
];

/** Parallax travel per tile, in percent. Varied so the wall breathes. */
const DRIFT = [7, 12, 5, 14, 9];

export function WorkIndex({ items }: WorkIndexProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const featured = items.slice(0, 5);

  useGSAP(
    sectionRef,
    (section, reduced, { desktop }) => {
      const tiles = gsap.utils.toArray<HTMLElement>("[data-work-tile]", section);
      const cards = gsap.utils.toArray<HTMLElement>("[data-work-card]", section);

      if (reduced) {
        gsap.set([...tiles, ...cards], { opacity: 1, y: 0, scale: 1 });
        return;
      }

      // The tiles themselves are the reveal — they rise and settle, rather
      // than only their captions fading in.
      if (tiles.length) {
        gsap.from(tiles, {
          opacity: 0,
          y: 56,
          scale: 0.96,
          duration: 1,
          ease: EASE.editorial,
          stagger: 0.07,
          scrollTrigger: { trigger: section, start: REVEAL_START, once: true },
        });
      }
      if (cards.length) {
        gsap.from(cards, {
          opacity: 0,
          y: 30,
          duration: DUR.enter,
          ease: EASE.enter,
          stagger: 0.06,
          scrollTrigger: { trigger: cards[0], start: REVEAL_START, once: true },
        });
      }

      if (!desktop) return;

      // Per-tile drift. Each image is taller than its frame, so it can travel
      // without ever exposing an edge.
      //
      // Driven from gsap.ticker rather than a scrub tween pinned to
      // `scrollTrigger: { trigger: tile, ... }`: that per-tile trigger's
      // start/end are pixel values cached once at creation, and the hero's
      // pinned stage finalises its real height a frame after mount (see
      // HeroSequence) — so those cached bounds go stale, and the tile's
      // real pass through the viewport can fall entirely outside them. The
      // tween then just sits at whichever end it last resolved to
      // (permanently mid- or full-drift) no matter how far you scroll.
      // gsap.ticker runs every animation frame regardless of any trigger's
      // cached bounds — the same loop Lenis itself is driven from (see
      // SmoothScroll) — so the position below is computed fresh from each
      // tile's own live geometry every frame instead.
      const setters = tiles.map((tile, index) => {
        const image = tile.querySelector<HTMLElement>("[data-work-image]");
        if (!image) return null;
        const rate = DRIFT[index % DRIFT.length]!;
        const setY = gsap.quickSetter(image, "yPercent") as (v: number) => void;
        return () => {
          const rect = tile.getBoundingClientRect();
          const total = window.innerHeight + rect.height;
          const progress = gsap.utils.clamp(0, 1, (window.innerHeight - rect.top) / total);
          setY(gsap.utils.interpolate(-rate, rate, progress));
        };
      });

      const applyDrift = () => setters.forEach((set) => set?.());
      gsap.ticker.add(applyDrift);
      applyDrift();

      return () => gsap.ticker.remove(applyDrift);
    },
    { queries: { desktop: "(min-width: 1024px)" } },
  );

  return (
    <section ref={sectionRef} aria-labelledby="work-heading" className="relative bg-enzo-white">
      <div className="mx-auto max-w-[1500px] px-5 py-20 sm:px-6 md:px-12 md:py-28">
        <h2 id="work-heading" className="sr-only">
          Recent work
        </h2>

        <SectionIntro
          layout="split"
          index="04"
          label="Work"
          datum={`${items.length} projects · Leicestershire`}
          lines={["Recent work,", "and where it lives."]}
          lede="Five of the last nine. Every one drawn, built and fitted by us."
          actions={
            <Link
              href="/portfolio"
              className="group/all hidden items-center gap-2 whitespace-nowrap border-b border-primary/25 pb-1 text-[13px] font-medium text-primary transition-colors duration-300 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 lg:inline-flex"
            >
              See all {items.length} projects
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 ease-out group-hover/all:translate-x-1" />
            </Link>
          }
        />

        {/* ── Desktop: the wall ── */}
        {/* `grid-rows-5` would define five EXPLICIT rows at minmax(0,1fr) —
            and with no height on the grid those collapse to nothing, because
            every tile is absolutely positioned and contributes no intrinsic
            height. Leaving the rows implicit lets `auto-rows` set them. */}
        <div className="mt-9 hidden grid-cols-12 gap-3 lg:grid lg:auto-rows-[clamp(112px,10.5vw,158px)]">
          {featured.map((item, index) => (
            <Link
              key={item.id}
              href="/portfolio"
              data-work-tile
              data-cursor="view"
              className={`group relative overflow-hidden rounded-[18px] bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${PLACEMENT[index]}`}
            >
              <ImageWithFallback
                data-work-image
                src={item.image}
                alt={item.title}
                loading="lazy"
                className="absolute inset-x-0 top-[-14%] h-[128%] w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.05]"
              />
              <span
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-enzo-forest/85 via-enzo-forest/15 to-transparent opacity-80 transition-opacity duration-500 group-hover:opacity-100"
              />
              <span className="absolute inset-x-5 bottom-5 block translate-y-1 transition-transform duration-500 ease-out group-hover:translate-y-0">
                <span className="block text-[1.15rem] font-semibold leading-tight tracking-[-0.02em] text-enzo-cream">
                  {item.title}
                </span>
                <span className="mt-1 flex items-center gap-2 text-[12px] text-enzo-cream/75">
                  {item.location}
                  <span aria-hidden="true" className="h-px w-3 bg-enzo-sand" />
                  <span className="font-display tabular-nums">{item.year}</span>
                </span>
              </span>
            </Link>
          ))}
        </div>

        {/* ── Mobile: an offset editorial run ──
            Not a carousel. Section 05 sits directly under this one and a
            second swipe-row would make the two read as the same component
            twice; and a carousel hides four of the five projects behind a
            gesture. Stepping the cards left and right against an oversized
            index numeral gives the column a rhythm as you scroll it. */}
        <ol className="mt-8 flex flex-col gap-9 lg:hidden">
          {featured.map((item, index) => {
            const stepRight = index % 2 === 1;
            return (
              <li key={item.id} className={stepRight ? "pl-11" : "pr-11"}>
                <Link
                  href="/portfolio"
                  data-work-card
                  className="group relative block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <span
                    aria-hidden="true"
                    className={`font-display absolute top-2 w-11 text-[2.1rem] font-semibold leading-none tabular-nums text-primary/20 ${
                      stepRight ? "-left-11 text-left" : "-right-11 text-right"
                    }`}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <span className="block overflow-hidden rounded-[18px] bg-muted">
                    <ImageWithFallback
                      src={item.image}
                      alt={item.title}
                      loading="lazy"
                      className="aspect-[5/4] w-full object-cover"
                    />
                  </span>

                  {/* Caption sits under the photograph rather than over it —
                      on a small screen, type on a busy image is the first
                      thing to become unreadable. */}
                  <span className="mt-3 flex items-baseline justify-between gap-3 border-t border-border/70 pt-3">
                    <span className="text-[1.05rem] font-semibold leading-tight tracking-[-0.02em] text-primary">
                      {item.title}
                    </span>
                    <span className="shrink-0 text-[11.5px] uppercase tracking-[0.14em] text-foreground/75">
                      {item.location}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>

        <Link
          href="/portfolio"
          className="mt-4 inline-flex items-center gap-2 border-b border-primary/25 pb-1 text-[13px] font-medium text-primary lg:hidden"
        >
          See all {items.length} projects
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}
