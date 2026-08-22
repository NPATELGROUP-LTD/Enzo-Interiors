"use client";

// Section 02 — a sticky drawing paired with a scrolling ledger.
//
// The process genuinely is a sequence, so this is the one section where
// numbering carries information rather than decorating the layout, and
// each stage is stamped with its real duration instead of a generic
// "Step 2 of 5". Scrolling the ledger inks in the matching stage of the
// elevation held on the left, so the copy and the drawing explain each
// other rather than sitting side by side.
import { useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight } from "lucide-react";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { useGSAP } from "@/hooks/useGSAP";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { DUR, EASE, REVEAL_START } from "@/lib/motion";
import { ElevationDrawing } from "./ElevationDrawing";

const STAGES = [
  {
    title: "Consultation",
    datum: "60–90 min",
    body: "We come to you, measure the room properly, photograph every wall and ask how you actually use the space. No sales pitch, no obligation.",
  },
  {
    title: "Design",
    datum: "5–7 days",
    body: "You get a 3D visual of the finished room and a fixed, itemised quote. We keep refining it until you stop finding things to change.",
  },
  {
    title: "Making",
    datum: "2–4 weeks",
    body: "Cut, edged and assembled in our Leicester workshop by the people who drew it. Every panel is made for your room, not pulled off a rack.",
  },
  {
    title: "Fitting",
    datum: "2–5 days",
    body: "Scribed to your walls, levelled and sealed. Floors covered, dust contained, doors adjusted until every gap lines up.",
  },
  {
    title: "Handover",
    datum: "same day",
    body: "We walk the room with you, clear anything on your snag list, then leave care notes and a five-year workmanship guarantee.",
  },
];

export function ProcessLedger() {
  const sectionRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  useGSAP(
    sectionRef,
    (section, reduced, { desktop }) => {
      const rows = gsap.utils.toArray<HTMLElement>("[data-stage-row]", section);
      if (rows.length === 0) return;

      if (desktop) {
        // One trigger per row rather than a single scrubbed timeline: the
        // ledger has to stay in step when the visitor jumps with a
        // keyboard or lands mid-section from an anchor, and enter/enterBack
        // handles both directions without tracking progress by hand.
        rows.forEach((row, index) => {
          ScrollTrigger.create({
            trigger: row,
            start: "top 62%",
            end: "bottom 42%",
            onEnter: () => setActive(index),
            onEnterBack: () => setActive(index),
          });
        });
      } else {
        // No room for a sticky drawing on a phone, so the elevation sits
        // above the ledger and inks all the way through once as it arrives.
        const drawing = section.querySelector<HTMLElement>("[data-ledger-drawing]");
        if (drawing) {
          ScrollTrigger.create({
            trigger: drawing,
            start: "top 78%",
            once: true,
            onEnter: () => setActive(STAGES.length - 1),
          });
        }
      }

      if (reduced) return;

      gsap.from(rows, {
        opacity: 0,
        y: 26,
        duration: DUR.enter,
        ease: EASE.enter,
        stagger: 0.08,
        scrollTrigger: { trigger: rows[0], start: REVEAL_START, once: true },
      });
    },
    { queries: { desktop: "(min-width: 1024px)" } },
  );

  return (
    <section ref={sectionRef} aria-labelledby="process-heading" className="bg-muted">
      <div className="mx-auto max-w-[1400px] px-6 py-24 md:px-12 md:py-32">
        <h2 id="process-heading" className="sr-only">
          Our process
        </h2>
        <SectionIntro
          index="02"
          label="Process"
          datum="five to eight weeks"
          lines={["Drawn, made and fitted", "by the same hands."]}
          lede="Five stages, one team. This is exactly what happens between the first knock on your door and the day you start filling the shelves."
        />

        <div className="mt-16 grid gap-12 lg:mt-20 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:gap-20">
          <div data-ledger-drawing className="lg:sticky lg:top-[14vh] lg:self-start">
            <ElevationDrawing active={active} caption={STAGES[active]!.title} />
            <p className="mt-4 text-[12.5px] leading-[1.6] text-foreground/75">
              Every job starts as a drawing like this one, dimensioned off your walls. You
              approve it before a single panel is cut.
            </p>
          </div>

          <ol className="relative">
            {STAGES.map((stage, index) => {
              const isActive = index === active;
              return (
                <li
                  key={stage.title}
                  data-stage-row
                  data-active={isActive}
                  onMouseEnter={() => {
                    if (isDesktop) setActive(index);
                  }}
                  className="group relative border-t border-border/70 py-7 first:border-t-0 lg:py-8"
                >
                  {/* Progress rule: the row's own top border, inked in. */}
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-primary transition-transform duration-700 ease-out group-first:hidden group-data-[active=true]:scale-x-100"
                  />

                  <div className="flex items-baseline gap-4">
                    <span className="font-display flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-[10px] font-semibold tabular-nums text-enzo-forest-light transition-colors duration-300 group-data-[active=true]:border-primary group-data-[active=true]:bg-primary group-data-[active=true]:text-primary-foreground">
                      {index + 1}
                    </span>
                    <h3 className="font-serif text-[1.5rem] font-normal leading-tight text-primary/70 transition-all duration-500 ease-out group-data-[active=true]:translate-x-1 group-data-[active=true]:text-primary md:text-[1.75rem]">
                      {stage.title}
                    </h3>
                    <span className="ml-auto whitespace-nowrap text-[11px] uppercase tracking-[0.2em] text-enzo-forest-light transition-colors duration-300 group-data-[active=true]:text-primary">
                      {stage.datum}
                    </span>
                  </div>

                  <p className="mt-3 max-w-[52ch] pl-10 text-[14px] leading-[1.75] text-foreground/75 transition-colors duration-500 group-data-[active=true]:text-foreground/80">
                    {stage.body}
                  </p>
                </li>
              );
            })}

            <li className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-[18px] bg-card px-6 py-5">
              <p className="text-[13.5px] leading-[1.6] text-foreground/75">
                Typical project:{" "}
                <span className="text-primary">five to eight weeks</span> from first visit to
                handover.
              </p>
              <Link
                href="/booking"
                className="group/book inline-flex items-center gap-2 whitespace-nowrap border-b border-primary/25 pb-1 text-[13px] font-medium text-primary transition-colors duration-300 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
              >
                Start at stage one
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 ease-out group-hover/book:translate-x-1" />
              </Link>
            </li>
          </ol>
        </div>
      </div>
    </section>
  );
}
