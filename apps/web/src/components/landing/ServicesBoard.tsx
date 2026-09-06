"use client";

// Section 01 — the specimen board.
//
// ── What this replaces ──
// A row of equal-width vertical slats that expanded in place when you
// clicked one. Two problems with it. Only one discipline was ever legible at
// a time — the other three were 90px of rotated type — so the section that
// exists to say "we make four things" showed you one thing and three closed
// doors. And four identical rectangles in a row is the arrangement of a
// nav bar, not of a body of work: nothing about it said the four are
// different sizes of job.
//
// A board of specimens says it in the layout itself. The plates are four
// different shapes on an asymmetric grid, sitting at four different heights,
// with a caption pinned to each — the way finished pieces get photographed
// and pinned up in a studio. Everything is visible at once, nothing has to
// be opened, and the eye moves diagonally down the board instead of left to
// right along a rail.
//
// ── Variable-length, like everything else the client authors ──
// The shapes come from a repeating plan of four, laid onto a 12-column grid:
// 5+7 then 6+6, so every four services close two tidy rows and a fifth
// starts the rhythm again. Three services make one full row and a half; the
// grid handles it. Nothing here assumes there are four.
import { useRef } from "react";
import gsap from "gsap";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { fromOnScroll, useGSAP } from "@/hooks/useGSAP";
import { EASE } from "@/lib/motion";
import type { Service } from "@/lib/content";

/**
 * The plan: how tall each plate stands, as a fraction of the tallest.
 *
 * ── Why a shelf, and not the staggered grid this replaces ──
 * The previous version was a two-column board of plates at different sizes
 * with different top offsets. Three passes went into getting it to line up —
 * a constant 5/7 seam, positive-only offsets, a shared row gap — and each one
 * fixed the fault it was aimed at while leaving the same underlying problem
 * untouched: two columns whose cells are different heights and start at
 * different offsets *end* at different heights. The bottom of every row was
 * ragged, and the shorter column left a pocket of dead space above the next
 * row that no amount of gap-tuning resolves, because it is not a spacing
 * value that is wrong. It is the arrangement.
 *
 * So the plates now stand on one line. Equal widths, four different heights,
 * a single shared baseline (`items-end`) with a rule drawn along it, and the
 * captions in a matching row underneath. Every mismatch the old layout could
 * produce is structurally impossible here: the tops vary — which is the whole
 * visual idea — and the bottoms cannot, because they are all sitting on the
 * same line.
 *
 * It is also the right image for the product. These are four fitted pieces
 * standing against a wall, and the site already uses a drawn bench line for
 * exactly this in /about §05.
 *
 * The list repeats, so five services stand on the shelf as happily as four.
 */
const HEIGHTS = ["0.86", "1", "0.78", "0.94"] as const;

/** The tallest plate, which every other height is a fraction of. */
const SHELF_HEIGHT = "clamp(19rem, 30vw, 30rem)";

export function ServicesBoard({ services }: { services: Service[] }) {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(sectionRef, (section, reduced) => {
    const plates = gsap.utils.toArray<HTMLElement>("[data-plate]", section);
    const footer = section.querySelector<HTMLElement>("[data-board-footer]");

    if (reduced) {
      gsap.set([...plates, footer].filter(Boolean), { opacity: 1, y: 0, scale: 1 });
      return;
    }

    // Each plate arrives on its own trigger rather than one stagger for the
    // set: they sit at four different heights on purpose, so a single
    // stagger would fire the low ones while they are still off screen and
    // waste the reveal on nobody.
    plates.forEach((plate) => {
      fromOnScroll(
        plate,
        {
          opacity: 0,
          y: 46,
          scale: 0.97,
          duration: 0.9,
          ease: EASE.editorial,
        },
        { start: "top 88%" },
      );
    });

    if (footer) {
      fromOnScroll(
        footer,
        { opacity: 0, y: 20, duration: 0.7, ease: EASE.enter },
        { start: "top 92%" },
      );
    }
  });

  if (!services.length) return null;

  return (
    <section
      ref={sectionRef}
      id="home-services"
      aria-labelledby="services-heading"
      className="relative overflow-hidden bg-background scroll-mt-24"
    >
      {/* Seam out of the hero's near-black frame. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-enzo-dark/15 to-transparent"
      />

      <div className="relative shell py-20 md:py-28">
        <h2 id="services-heading" className="sr-only">
          Services
        </h2>

        {/* Split at the intro's own default. There is no two-column grid
            underneath any more for a custom template to line up with — the
            shelf is four equal columns — so the heading and its lede simply
            take the left and right of the row, which is what the default is
            for. */}
        <SectionIntro
          layout="split"
          index="01"
          label="Disciplines"
          datum={`${services.length} of them`}
          lines={["Four kinds of room.", "One bench."]}
          lede="Nothing here is bought in and re-badged. Every carcass is cut, sprayed and fitted by the same people who measured the wall it goes on."
        />

        {/* ── The shelf ──
            One flex row, `items-end`, so four different heights share one
            baseline. Below `lg` it becomes a plain stack: four plates of
            varying height side by side at phone width would be four slivers,
            and the shelf idea needs room to read. */}
        <ul className="mt-12 flex flex-col gap-10 md:mt-16 lg:flex-row lg:items-end lg:gap-6">
          {services.map((service, index) => {
            const height = HEIGHTS[index % HEIGHTS.length]!;
            return (
              <li key={service.slug} data-plate className="min-w-0 lg:flex-1">
                <Link
                  href={`/services/${service.slug}`}
                  className="group block focus-visible:outline-none"
                >
                  {/* The plate. Its height is a fraction of SHELF_HEIGHT
                      from `lg` up — `calc()` on a clamp, so the whole shelf
                      scales with the viewport while the four plates keep
                      their proportions to one another. Below `lg` the height
                      is dropped for a plain 4/3, because there is no shelf. */}
                  <div
                    className="relative overflow-hidden rounded-[22px] bg-enzo-forest max-lg:aspect-[4/3] focus-visible:ring-2 focus-visible:ring-ring group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-4"
                    style={{ height: `calc(${SHELF_HEIGHT} * ${height})` }}
                  >
                    <ImageWithFallback
                      src={service.image}
                      alt={service.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.045]"
                    />

                    {/* Enough wash at the foot to hold the caption card, and
                        nothing over the middle of the plate — the photograph
                        is the point of this section. */}
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0"
                      style={{
                        background:
                          "linear-gradient(to top, rgba(16,26,22,0.55) 0%, rgba(16,26,22,0.10) 38%, transparent 62%)",
                      }}
                    />

                    <span className="font-display absolute right-5 top-5 text-[10.5px] font-semibold tabular-nums tracking-[0.24em] text-enzo-cream/80">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>

                  {/* ── Below the line ──
                      The caption and the specification sit *under* the shelf
                      rather than floating on the plate, which is what lets the
                      four of them share a baseline and a top edge at once. */}
                  <span className="mt-5 block border-t border-primary/25 pt-4">
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate text-[16px] font-semibold tracking-[-0.02em] text-primary">
                          {service.title}
                        </span>
                        <span className="mt-1 block text-[12.5px] text-foreground/70">
                          {service.features.length} things included as standard
                        </span>
                      </span>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:rotate-45">
                        <ArrowUpRight className="h-4 w-4" />
                      </span>
                    </span>

                    <span className="mt-4 flex flex-col gap-1.5">
                      {service.features.slice(0, 3).map((feature) => (
                        <span
                          key={feature}
                          className="flex items-center gap-2 text-[12.5px] text-foreground/70"
                        >
                          <span aria-hidden="true" className="h-px w-3 shrink-0 bg-enzo-sand" />
                          {feature}
                        </span>
                      ))}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        <div
          data-board-footer
          className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-border/70 pt-7 lg:mt-20"
        >
          <p className="text-[13.5px] text-foreground/70">
            Not sure which of them you need? We work that out on the first visit.
          </p>
          <Link
            href="/services"
            className="touch-target group/all inline-flex items-center gap-2 border-b border-primary/25 pb-1 text-[13.5px] font-medium text-primary transition-colors duration-300 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
          >
            Compare all {services.length}
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 ease-out group-hover/all:translate-x-0.5 group-hover/all:-translate-y-0.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
