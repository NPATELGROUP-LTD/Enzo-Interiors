"use client";

// /portfolio §03 — one job, in full.
//
// ── What this replaces, and why ──
// A catchment plot: every town we have worked in, drawn at its real bearing
// and distance from Leicester on rings at 5, 12 and 25 km. It was the most
// technically interesting thing on the page and the least useful. It
// answered "do you come to me?" — which the footer answers on every page of
// this site, and which /contact now answers properly with drive times — and
// to do it, it enumerated all nine projects for the third time on one page.
// §01 counts them, §02 shows them, and then §03 plotted them.
//
// A page that has just shown a visitor a wall of thumbnails owes them one
// thing next: the depth behind a thumbnail. So §03 takes a single project
// and gives it the room the grid cannot — the photograph large, the record's
// own fields set out as a specification, the materials named, and the
// paragraph that says what was actually decided. One project properly is
// worth nine projects listed.
//
// ── Which project, and why it is not hardcoded ──
// The most recent by year, falling back to the first published record. The
// client adds a project in the Content Manager and this section follows,
// which is the behaviour you want from a "latest work" slot — and it is
// still deterministic, so the page is the same for everyone until the
// records change.
//
// The small plate overlapping it is the *next* project in the register,
// which does two jobs: it makes the composition asymmetric rather than a
// picture beside some text, and it is a way back into the wall above
// without another "see all" link.
//
// Ground: cream. §01 and §02 are both near-black and §04 closes dark again;
// this is the page's one light section, and the one that most rewards being
// read rather than scanned.
import { useRef } from "react";
import gsap from "gsap";
import { ArrowUpRight } from "lucide-react";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { revealOnScroll, useGSAP } from "@/hooks/useGSAP";
import { EASE, REVEAL_START } from "@/lib/motion";
import type { PortfolioItem } from "@/lib/content";

/** Parses "2025" out of the record's year field. 0 when it is unparseable. */
function yearValue(item: PortfolioItem): number {
  const match = item.year.match(/\d{4}/);
  return match ? Number(match[0]) : 0;
}

export function PortfolioAnatomy({
  items,
  onOpen,
}: {
  items: PortfolioItem[];
  onOpen: (id: number) => void;
}) {
  const sectionRef = useRef<HTMLElement>(null);

  // Newest first, ties broken by published order — `reduce` rather than a
  // sort so the original array is never mutated and the tie-break is
  // explicit rather than an implementation detail of the sort.
  const feature = items.reduce<PortfolioItem | null>(
    (best, item) => (!best || yearValue(item) > yearValue(best) ? item : best),
    null,
  );
  const runnerUp =
    feature && items.length > 1
      ? items[(items.findIndex((item) => item.id === feature.id) + 1) % items.length]!
      : null;

  useGSAP(sectionRef, (section, reduced) => {
    const plate = section.querySelector<HTMLElement>("[data-anatomy-plate]");
    const inset = section.querySelector<HTMLElement>("[data-anatomy-inset]");
    const rows = gsap.utils.toArray<HTMLElement>("[data-anatomy-row]", section);

    if (reduced) {
      gsap.set([plate, inset].filter(Boolean), { clipPath: "inset(0% 0% 0% 0%)", opacity: 1 });
      gsap.set(rows, { opacity: 1, y: 0 });
      return;
    }

    revealOnScroll(
      section,
      (timeline) => {
        // The plate wipes up from its own base — a print being laid down —
        // and the small one lands on top of it after.
        timeline
          .fromTo(
            plate,
            { clipPath: "inset(100% 0% 0% 0%)" },
            { clipPath: "inset(0% 0% 0% 0%)", duration: 1, ease: EASE.editorial },
          )
          .from(
            rows,
            { opacity: 0, y: 20, duration: 0.6, ease: EASE.enter, stagger: 0.06 },
            0.25,
          )
          .from(
            inset,
            { opacity: 0, y: 28, scale: 0.94, duration: 0.7, ease: EASE.editorial },
            0.55,
          );
      },
      { start: REVEAL_START },
    );
  });

  if (!feature) return null;

  const facts = [
    { label: "Client", value: feature.client },
    { label: "Where", value: feature.location },
    { label: "On site", value: feature.duration },
    { label: "Finished", value: feature.year },
  ];

  return (
    <section
      ref={sectionRef}
      id="portfolio-anatomy"
      aria-labelledby="anatomy-heading"
      className="relative overflow-hidden bg-background scroll-mt-24"
    >
      <div className="mx-auto max-w-[1500px] px-5 py-20 sm:px-6 md:px-12 md:py-28">
        <h2 id="anatomy-heading" className="sr-only">
          One project in full
        </h2>

        <SectionIntro
          layout="split"
          index="03"
          label="In full"
          datum={`${feature.category} · ${feature.year}`}
          lines={["One of them,", "taken apart."]}
          lede="The wall above is nine thumbnails. This is what is behind one of them — who it was for, how long we were in their house, what it is made of, and what actually got decided."
          ledeShort="What is behind one of those thumbnails: who, where, how long, and what it is made of."
        />

        <div className="mt-14 grid gap-10 md:mt-20 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-center lg:gap-16">
          {/* ── The plate, and the one overlapping it ── */}
          <div className="relative">
            <button
              type="button"
              onClick={() => onOpen(feature.id)}
              data-anatomy-plate
              className="group block w-full overflow-hidden rounded-[24px] bg-enzo-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
              style={{ clipPath: "inset(100% 0% 0% 0%)" }}
            >
              <span className="relative block aspect-[4/3] lg:aspect-[5/4]">
                <ImageWithFallback
                  src={feature.image}
                  alt={feature.title}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(to top, rgba(16,26,22,0.5) 0%, transparent 45%)",
                  }}
                />
                {/* The caption, pinned to the plate. */}
                <span className="absolute inset-x-5 bottom-5 flex items-center justify-between gap-4 rounded-2xl bg-enzo-cream/95 px-5 py-4 text-left">
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold tracking-[-0.02em] text-enzo-forest">
                      {feature.title}
                    </span>
                    <span className="mt-0.5 block truncate text-[12.5px] text-enzo-forest/70">
                      {feature.location} &middot; {feature.duration} on site
                    </span>
                  </span>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-enzo-forest text-enzo-cream transition-transform duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:rotate-45">
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </span>
              </span>
            </button>

            {/* The next one in the register, overlapping the corner. Hidden
                below `sm`, where an overlapping plate is just a plate on top
                of the caption it is supposed to sit beside. */}
            {runnerUp && (
              <button
                type="button"
                onClick={() => onOpen(runnerUp.id)}
                data-anatomy-inset
                className="group absolute -bottom-8 -right-4 hidden w-40 overflow-hidden rounded-[18px] border-[6px] border-background bg-enzo-forest text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:block lg:-right-10 lg:w-48"
              >
                <span className="relative block aspect-[4/3]">
                  <ImageWithFallback
                    src={runnerUp.image}
                    alt={runnerUp.title}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-105"
                  />
                </span>
                <span className="block bg-enzo-cream px-3.5 py-3">
                  <span className="font-display block text-[9px] font-semibold uppercase tracking-[0.2em] text-enzo-forest-light">
                    Also on the bench
                  </span>
                  <span className="mt-1 block truncate text-[12.5px] font-medium text-enzo-forest">
                    {runnerUp.title}
                  </span>
                </span>
              </button>
            )}
          </div>

          {/* ── The record ── */}
          <div className="lg:pl-4">
            <p
              data-anatomy-row
              className="font-title font-semibold leading-[1.12] tracking-[-0.04em] text-primary"
              style={{ fontSize: "clamp(1.5rem, 2.8vw, 2.3rem)" }}
            >
              {feature.title}
            </p>

            <p
              data-anatomy-row
              className="mt-5 max-w-[52ch] text-[15px] leading-[1.75] text-foreground/75"
            >
              {feature.desc}
            </p>

            <dl data-anatomy-row className="mt-9 grid grid-cols-2 gap-x-8">
              {facts.map((fact) => (
                <div
                  key={fact.label}
                  className="border-t border-border/70 py-3.5"
                >
                  <dt className="font-display text-[9.5px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    {fact.label}
                  </dt>
                  <dd className="mt-1.5 text-[14.5px] leading-[1.35] text-primary">
                    {fact.value}
                  </dd>
                </div>
              ))}
            </dl>

            {feature.materials.length > 0 && (
              <div data-anatomy-row className="mt-8 border-t border-primary/25 pt-6">
                <span className="font-display block text-[9.5px] font-semibold uppercase tracking-[0.22em] text-enzo-forest-light">
                  Specified
                </span>
                <ul className="mt-3 flex flex-wrap gap-x-2 gap-y-2">
                  {feature.materials.map((material) => (
                    <li
                      key={material}
                      className="rounded-full border border-border px-3.5 py-1.5 text-[12.5px] text-primary"
                    >
                      {material}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              type="button"
              data-anatomy-row
              onClick={() => onOpen(feature.id)}
              className="touch-target group/cta mt-8 inline-flex items-center gap-2 border-b border-primary/25 pb-1 text-[13.5px] font-medium text-primary transition-colors duration-300 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
            >
              Open the full record
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 ease-out group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
