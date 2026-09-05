"use client";

// /portfolio §04 — the close.
//
// ── What this replaces, and why ──
// The next number in the register, set at masthead scale and counting up to
// itself, with the ask beside it. The idea was good and the execution was a
// number: a visitor who has just scrolled an archive does not need a tenth
// entry drawn for them, and "00" ticking to "10" is a trick, not an
// argument. It also sat on cream, which meant the page ended on the same
// temperature as the section above it.
//
// This closes the way the landing page opens, because that composition is
// the one people on this site actually remember: a dark room, a two-tone
// headline where the last word takes the accent, one filled action with the
// arrow set in its own disc, and a photograph carrying a caption card. The
// two ends of the site now rhyme.
//
// ── The figures are read off the archive, not written ──
// Every number in the strip is computed from the same records the wall above
// was rendered from: how many projects, how many towns, how many weeks of
// bench and site time they add up to, and the years they span. Publish a
// project in the Content Manager and all four move. Nothing here is a claim
// somebody has to remember to update.
//
// Ground: near-black, running straight into the footer's own dark so the end
// of the page reads as one close rather than a section and then a footer.
import { useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ArrowUpRight } from "lucide-react";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { revealOnScroll, useGSAP } from "@/hooks/useGSAP";
import { EASE, REVEAL_START } from "@/lib/motion";
import type { PortfolioItem } from "@/lib/content";

/** Pulls the largest number out of "5 weeks" / "4-6 weeks". 0 if there is none. */
function weeksIn(duration: string): number {
  const numbers = duration.match(/\d+(?:\.\d+)?/g);
  return numbers?.length ? Math.max(...numbers.map(Number)) : 0;
}

export function PortfolioClose({ items }: { items: PortfolioItem[] }) {
  const sectionRef = useRef<HTMLElement>(null);

  const towns = new Set(items.map((item) => item.location.trim()).filter(Boolean));
  const weeks = items.reduce((total, item) => total + weeksIn(item.duration), 0);
  const years = items
    .map((item) => Number(item.year.match(/\d{4}/)?.[0] ?? 0))
    .filter((year) => year > 0);
  const span =
    years.length > 1 && Math.min(...years) !== Math.max(...years)
      ? `${Math.min(...years)}–${Math.max(...years)}`
      : years.length
        ? String(years[0])
        : "—";

  // Only figures that are actually true of the records get a cell, so an
  // archive of one project does not print "1 town, 0 weeks, —".
  const figures = [
    { value: String(items.length), label: items.length === 1 ? "Room finished" : "Rooms finished" },
    { value: String(towns.size), label: towns.size === 1 ? "Town" : "Towns" },
    weeks > 0 ? { value: String(weeks), label: "Weeks on site" } : null,
    { value: span, label: "Years of it" },
  ].filter((figure): figure is { value: string; label: string } => figure !== null);

  // The most recent record supplies the plate, so the close is never showing
  // a photograph the page has not already earned.
  const plate = items[items.length - 1] ?? items[0] ?? null;

  useGSAP(sectionRef, (section, reduced) => {
    const rows = gsap.utils.toArray<HTMLElement>("[data-close-row]", section);
    const cells = gsap.utils.toArray<HTMLElement>("[data-close-figure]", section);
    const picture = section.querySelector<HTMLElement>("[data-close-plate]");

    if (reduced) {
      gsap.set([...rows, ...cells], { opacity: 1, y: 0 });
      if (picture) gsap.set(picture, { clipPath: "inset(0% 0% 0% 0%)" });
      return;
    }

    revealOnScroll(
      section,
      (timeline) => {
        timeline
          .from(rows, {
            opacity: 0,
            y: 26,
            duration: 0.75,
            ease: EASE.editorial,
            stagger: 0.09,
          })
          .fromTo(
            picture,
            { clipPath: "inset(0% 0% 100% 0%)" },
            { clipPath: "inset(0% 0% 0% 0%)", duration: 1, ease: EASE.editorial },
            0.15,
          )
          .from(
            cells,
            { opacity: 0, y: 16, duration: 0.55, ease: EASE.enter, stagger: 0.07 },
            0.5,
          );
      },
      { start: REVEAL_START },
    );
  });

  return (
    <section
      ref={sectionRef}
      id="portfolio-next"
      aria-labelledby="portfolio-close-heading"
      className="relative overflow-hidden bg-enzo-dark text-enzo-cream scroll-mt-24"
    >
      {/* A single soft source top-left, so the ground is a dark room rather
          than a black rectangle. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 8% 0%, rgba(212,201,181,0.10), transparent 62%)",
        }}
      />

      <div className="relative mx-auto max-w-[1500px] px-5 py-24 sm:px-6 md:px-12 md:py-32">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:items-center lg:gap-20">
          {/* ── The ask ── */}
          <div>
            <span
              data-close-row
              className="font-display flex items-center gap-3 text-[10.5px] font-semibold uppercase tracking-[0.3em] text-enzo-sand"
            >
              04
              <span aria-hidden="true" className="h-px w-10 bg-enzo-cream/25" />
              <span className="text-enzo-cream/70">Next</span>
            </span>

            <h2
              id="portfolio-close-heading"
              data-close-row
              className="mt-7 max-w-[13ch] font-title font-semibold leading-[0.94] tracking-[-0.05em]"
              style={{ fontSize: "clamp(2.6rem, 6.5vw, 5rem)" }}
            >
              Stop scrolling.{" "}
              <span className="text-enzo-sage">Start measuring.</span>
            </h2>

            <p
              data-close-row
              className="mt-6 max-w-[46ch] text-[15.5px] leading-[1.7] text-enzo-cream/70"
            >
              Every room above began with somebody spending ninety minutes in
              a house with a tape measure and no order form. That part is free,
              and there is nothing to sign at the end of it.
            </p>

            <div data-close-row className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
              <Link
                href="/booking"
                className="group inline-flex items-center gap-3 rounded-full bg-enzo-cream py-2.5 pl-7 pr-2.5 text-[15px] font-medium text-enzo-forest transition-colors duration-300 hover:bg-enzo-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-4 focus-visible:ring-offset-enzo-dark"
              >
                Book a free survey
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-enzo-forest text-enzo-cream transition-transform duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:rotate-45">
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </Link>

              <Link
                href="/services"
                className="touch-target group/see text-[14.5px] text-enzo-cream/80"
              >
                <span className="border-b border-enzo-cream/25 pb-1 transition-colors duration-300 group-hover/see:border-enzo-sand">
                  See what we make
                </span>
              </Link>
            </div>

            {/* The archive, counted. */}
            <dl className="mt-14 grid grid-cols-2 gap-x-8 sm:grid-cols-4">
              {figures.map((figure) => (
                <div
                  key={figure.label}
                  data-close-figure
                  className="border-t border-enzo-cream/15 pt-4"
                >
                  <dt className="sr-only">{figure.label}</dt>
                  <dd>
                    <span className="font-title block text-[clamp(1.6rem,3vw,2.3rem)] font-semibold leading-none tabular-nums tracking-[-0.045em] text-enzo-cream">
                      {figure.value}
                    </span>
                    <span className="font-display mt-2 block text-[9.5px] font-semibold uppercase tracking-[0.2em] text-enzo-cream/60">
                      {figure.label}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* ── The plate ── */}
          {plate && (
            <div className="relative">
              <div
                data-close-plate
                className="overflow-hidden rounded-[26px] bg-enzo-forest"
                style={{ clipPath: "inset(0% 0% 100% 0%)" }}
              >
                <ImageWithFallback
                  src={plate.image}
                  alt={plate.title}
                  loading="lazy"
                  className="aspect-[4/5] w-full object-cover"
                />
              </div>

              <span className="absolute inset-x-5 bottom-5 block rounded-2xl bg-enzo-cream/95 px-5 py-4">
                <span className="block truncate text-[14.5px] font-semibold tracking-[-0.02em] text-enzo-forest">
                  {plate.title}
                </span>
                <span className="mt-0.5 block truncate text-[12.5px] text-enzo-forest/70">
                  {plate.location} &middot; {plate.year}
                </span>
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
