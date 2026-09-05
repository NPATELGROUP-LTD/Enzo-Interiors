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
import { cn } from "@/lib/utils";
import type { Service } from "@/lib/content";

/**
 * The repeating plan. `span` is the 12-column desktop width, `ratio` the
 * plate's shape, `lift` its vertical offset off the row's baseline — which
 * is what stops two plates of the same height sitting shoulder to shoulder
 * and reading as a grid again.
 */
const SHAPES = [
  { span: "lg:col-span-5", ratio: "4 / 5", lift: "lg:mt-0" },
  { span: "lg:col-span-7", ratio: "16 / 10", lift: "lg:mt-16" },
  { span: "lg:col-span-6", ratio: "16 / 11", lift: "lg:-mt-8" },
  { span: "lg:col-span-6", ratio: "4 / 3", lift: "lg:mt-10" },
] as const;

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

      <div className="relative mx-auto max-w-[1500px] px-5 py-20 sm:px-6 md:px-12 md:py-28">
        <h2 id="services-heading" className="sr-only">
          Services
        </h2>

        <SectionIntro
          layout="split"
          index="01"
          label="Disciplines"
          datum={`${services.length} of them`}
          lines={["Four kinds of room.", "One bench."]}
          lede="Nothing here is bought in and re-badged. Every carcass is cut, sprayed and fitted by the same people who measured the wall it goes on."
        />

        <ul className="mt-12 grid gap-6 md:mt-16 lg:grid-cols-12 lg:gap-x-6 lg:gap-y-0">
          {services.map((service, index) => {
            const shape = SHAPES[index % SHAPES.length]!;
            return (
              <li
                key={service.slug}
                data-plate
                className={cn("min-w-0", shape.span, shape.lift)}
              >
                <Link
                  href={`/services/${service.slug}`}
                  className="group block focus-visible:outline-none"
                >
                  <div className="relative overflow-hidden rounded-[22px] bg-enzo-forest focus-visible:ring-2 focus-visible:ring-ring group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-4">
                    <div style={{ aspectRatio: shape.ratio }} className="max-lg:aspect-[4/3]">
                      <ImageWithFallback
                        src={service.image}
                        alt={service.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.045]"
                      />
                    </div>

                    {/* Enough wash at the foot to hold the caption card's
                        shadow, and nothing over the middle of the plate —
                        the photograph is the point of this section. */}
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

                    {/* The caption, pinned to the plate rather than set
                        under it — a specimen label, and the one piece of
                        chrome that carries the arrow. */}
                    <span className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-3 rounded-2xl bg-enzo-cream/95 px-5 py-4 backdrop-blur-sm transition-colors duration-400 group-hover:bg-enzo-cream sm:inset-x-5 sm:bottom-5">
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-semibold tracking-[-0.02em] text-enzo-forest">
                          {service.title}
                        </span>
                        <span className="mt-0.5 block truncate text-[12.5px] text-enzo-forest/70">
                          {service.features.length} things included as standard
                        </span>
                      </span>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-enzo-forest text-enzo-cream transition-transform duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:rotate-45">
                        <ArrowUpRight className="h-4 w-4" />
                      </span>
                    </span>
                  </div>

                  {/* Three of the specification, set under the plate as
                      ruled lines. Under, not over: laid on the photograph
                      they competed with the caption, and a specification is
                      a thing you read, not a thing you look at. */}
                  <span className="mt-4 block border-t border-border/70 pt-3">
                    <span className="flex flex-wrap gap-x-5 gap-y-1.5">
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
