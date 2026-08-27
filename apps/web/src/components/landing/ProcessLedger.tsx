"use client";

// Section 02 — the build sequence, told on a sticky stage.
//
// The process genuinely is a sequence, so this is the one section where
// numbering carries information rather than decorating the layout, and each
// stage is stamped with its real duration instead of a generic "Step 2 of 5".
//
// Activation is scroll position only. It used to also fire on `mouseenter`,
// which meant the stage under the pointer won — the drawing jumped around
// while you were reading, and a stage could flash past before you had seen
// what it added. Now each stage owns a fixed slice of scroll (STAGE_VH per
// stage), so it holds still long enough to actually watch the drawing change.
//
// Sticky, not pinned: `position: sticky` needs no wrapper, so unlike
// ScrollTrigger's pin it never re-parents a node React is tracking.
//
// Below `lg` the sticky stage is dropped entirely — a full-screen drawing
// plus copy does not fit a phone. There the drawing inks all the way through
// once and the stages become a plain numbered list.
import { useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight } from "lucide-react";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { useGSAP } from "@/hooks/useGSAP";
import { DUR, EASE, REVEAL_START } from "@/lib/motion";
import { ElevationDrawing } from "./ElevationDrawing";

/** Viewport-heights of scroll each stage holds the stage for. */
const STAGE_VH = 85;

const STAGES = [
  {
    title: "Consultation",
    datum: "60–90 min",
    body: "We come to you, measure the room properly, photograph every wall and ask how you actually use the space.",
  },
  {
    title: "Design",
    datum: "5–7 days",
    body: "You get a 3D visual of the finished room and a fixed, itemised quote — refined until you stop finding things to change.",
  },
  {
    title: "Making",
    datum: "2–4 weeks",
    body: "Cut, edged and assembled in our Leicester workshop by the people who drew it. Every panel is made for your room.",
  },
  {
    title: "Fitting",
    datum: "2–5 days",
    body: "Scribed to your walls, levelled and sealed. Floors covered, dust contained, every gap lined up.",
  },
  {
    title: "Handover",
    datum: "same day",
    body: "We walk the room with you, clear the snag list, then leave care notes and a five-year workmanship guarantee.",
  },
];

export function ProcessLedger() {
  const sectionRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);

  useGSAP(
    sectionRef,
    (section, reduced, { desktop }) => {
      const track = section.querySelector<HTMLElement>("[data-process-track]");

      if (desktop && track) {
        // The stage index is a pure function of how far through the track's
        // own live bounding box we are — computed directly from
        // getBoundingClientRect() on every update rather than from
        // ScrollTrigger's cached start/end. The cached version depends on
        // when the trigger was last refreshed relative to everything above
        // it settling its real height (the hero's pinned stage in particular
        // finalises a frame after mount — see HeroSequence), and no single
        // refresh-after-a-delay is reliably later than that: it reads as
        // this section opening on its last stage instead of its first, and
        // how often depends on load timing. Measuring live has no timing to
        // get wrong — it's simply always correct, in both scroll directions.
        const computeActive = () => {
          const rect = track.getBoundingClientRect();
          const total = rect.height - window.innerHeight;
          const progress = total > 0 ? gsap.utils.clamp(0, 1, -rect.top / total) : 0;
          const index = Math.min(STAGES.length - 1, Math.floor(progress * STAGES.length));
          setActive((current) => (current === index ? current : index));
        };

        ScrollTrigger.create({
          trigger: track,
          start: "top top",
          end: "bottom bottom",
          onUpdate: computeActive,
          onRefresh: computeActive,
        });
        computeActive();
      } else {
        const drawing = section.querySelector<HTMLElement>("[data-process-drawing]");
        if (drawing) {
          ScrollTrigger.create({
            trigger: drawing,
            start: "top 80%",
            once: true,
            onEnter: () => setActive(STAGES.length - 1),
          });
        }
      }

      if (reduced) return;

      const cards = gsap.utils.toArray<HTMLElement>("[data-stage-card]", section);
      if (cards.length) {
        gsap.from(cards, {
          opacity: 0,
          y: 28,
          duration: DUR.enter,
          ease: EASE.enter,
          stagger: 0.08,
          scrollTrigger: { trigger: cards[0], start: REVEAL_START, once: true },
        });
      }

      const drawing = section.querySelector<HTMLElement>("[data-process-drawing]");
      if (drawing) {
        gsap.from(drawing, {
          opacity: 0,
          y: 40,
          scale: 0.97,
          duration: 1,
          ease: EASE.editorial,
          scrollTrigger: { trigger: drawing, start: "top 88%", once: true },
        });
      }
    },
    { queries: { desktop: "(min-width: 1024px)" } },
  );

  const current = STAGES[active]!;

  return (
    <section ref={sectionRef} aria-labelledby="process-heading" className="bg-muted">
      <div className="mx-auto max-w-[1500px] px-5 pt-20 sm:px-6 md:px-12 md:pt-28">
        <h2 id="process-heading" className="sr-only">
          Our process
        </h2>
        <SectionIntro
          index="02"
          label="Process"
          datum="five to eight weeks"
          lines={["Drawn, made and fitted", "by the same hands."]}
          lede="Five stages, one team. Keep scrolling and the drawing builds itself, exactly the way your room does."
        />
      </div>

      {/* ── Desktop: sticky stage, scroll-driven ── */}
      <div
        data-process-track
        className="relative mt-12 hidden lg:block"
        style={{ height: `${STAGE_VH * STAGES.length}vh` }}
      >
        <div className="sticky top-0 flex h-screen items-center">
          <div className="mx-auto w-full max-w-[1500px] px-12">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,320px)] items-center gap-12 xl:gap-16">
              <div data-process-drawing>
                <ElevationDrawing active={active} />
              </div>

              <div>
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-[13px] font-semibold tabular-nums text-primary">
                    {String(active + 1).padStart(2, "0")}
                  </span>
                  <span className="font-display text-[11px] uppercase tracking-[0.24em] text-enzo-forest-light">
                    {current.datum}
                  </span>
                </div>

                {/* key remounts the block so the crossfade replays per stage */}
                <div
                  key={active}
                  className="animate-in fade-in slide-in-from-bottom-2 duration-500 motion-reduce:animate-none"
                >
                  <h3 className="mt-3 text-[2rem] font-semibold leading-[1.05] tracking-[-0.03em] text-primary xl:text-[2.4rem]">
                    {current.title}
                  </h3>
                  <p className="mt-4 text-[15px] leading-[1.75] text-foreground/80">
                    {current.body}
                  </p>
                </div>

                {/* Segmented progress — five real segments, so the visitor can
                    see both where they are and how much is left. */}
                <ol className="mt-10 flex gap-1.5" aria-label="Process stages">
                  {STAGES.map((stage, index) => (
                    <li key={stage.title} className="flex-1">
                      <span
                        className="block h-[3px] w-full overflow-hidden rounded-full bg-primary/15"
                        aria-current={index === active ? "step" : undefined}
                      >
                        <span
                          className="block h-full origin-left rounded-full bg-primary transition-transform duration-500 ease-out"
                          style={{ transform: `scaleX(${index <= active ? 1 : 0})` }}
                        />
                      </span>
                      <span
                        className="mt-2 block truncate text-[10.5px] uppercase tracking-[0.14em] transition-colors duration-300"
                        style={{
                          color:
                            index === active
                              ? "var(--enzo-forest)"
                              : "color-mix(in oklab, var(--enzo-forest) 45%, transparent)",
                        }}
                      >
                        {stage.title}
                      </span>
                    </li>
                  ))}
                </ol>

                <Link
                  href="/booking"
                  className="group/book mt-10 inline-flex items-center gap-2 border-b border-primary/25 pb-1 text-[13px] font-medium text-primary transition-colors duration-300 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
                >
                  Start at stage one
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 ease-out group-hover/book:translate-x-1" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile: drawing once, then a plain list ── */}
      <div className="mx-auto max-w-[1500px] px-5 pb-20 sm:px-6 lg:hidden">
        <div data-process-drawing className="mt-10">
          <ElevationDrawing active={active} />
        </div>

        <ol className="mt-8">
          {STAGES.map((stage, index) => (
            <li
              key={stage.title}
              data-stage-card
              className="flex gap-4 border-t border-border/70 py-5 last:border-b"
            >
              <span className="font-display mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold tabular-nums text-primary-foreground">
                {index + 1}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="text-[1.15rem] font-semibold tracking-[-0.02em] text-primary">
                    {stage.title}
                  </h3>
                  <span className="font-display text-[10.5px] uppercase tracking-[0.2em] text-enzo-forest-light">
                    {stage.datum}
                  </span>
                </div>
                <p className="mt-1.5 text-[14px] leading-[1.7] text-foreground/75">{stage.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-[16px] bg-card px-5 py-4">
          <p className="text-[13px] leading-[1.6] text-foreground/75">
            Typical project: <span className="text-primary">five to eight weeks</span>.
          </p>
          <Link
            href="/booking"
            className="inline-flex items-center gap-2 whitespace-nowrap border-b border-primary/25 pb-1 text-[13px] font-medium text-primary"
          >
            Start at stage one
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
