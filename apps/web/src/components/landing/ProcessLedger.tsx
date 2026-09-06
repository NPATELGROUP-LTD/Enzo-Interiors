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
import { ArrowRight } from "lucide-react";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { fromOnScroll, observeScroll, useGSAP } from "@/hooks/useGSAP";
import { DUR, EASE, REVEAL_START } from "@/lib/motion";
import { ElevationDrawing } from "./ElevationDrawing";

/** Viewport-heights of scroll each stage holds the stage for. */
const STAGE_VH = 85;

/**
 * The pinned frame's column template, used by BOTH rows — the heading/lede
 * above and the drawing/stage below. Declared once because the whole point is
 * that the two agree; two hand-matched template strings would drift the first
 * time either was touched.
 */
const PINNED_COLUMNS = "minmax(0,1fr) minmax(0,23rem)";

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
      let cleanupActive: (() => void) | undefined;

      if (desktop && track) {
        // The stage index is a pure function of how far through the track's
        // own live bounding box we are — computed directly from
        // getBoundingClientRect() rather than from ScrollTrigger's cached
        // start/end.
        const computeActive = () => {
          const rect = track.getBoundingClientRect();
          const total = rect.height - window.innerHeight;
          const progress = total > 0 ? gsap.utils.clamp(0, 1, -rect.top / total) : 0;
          const index = Math.min(STAGES.length - 1, Math.floor(progress * STAGES.length));
          setActive((current) => (current === index ? current : index));
        };

        // A per-trigger onUpdate/onRefresh only fires while scroll is inside
        // *that trigger's own* cached start/end pixel bounds, measured once
        // at creation. Elsewhere on the page — the hero's pinned stage in
        // particular — finalises its real height a frame after mount (see
        // HeroSequence), so those bounds are stale by the time real
        // scrolling reaches here: onUpdate never fires during the actual
        // pass, which reads as the section stuck on stage one forever no
        // matter how far you scroll. gsap.ticker runs every animation frame
        // regardless of any trigger's cached bounds — the same loop Lenis
        // itself is driven from (see SmoothScroll) — so it has no stale
        // cache to depend on.
        gsap.ticker.add(computeActive);
        computeActive();
        cleanupActive = () => gsap.ticker.remove(computeActive);
      } else {
        const drawing = section.querySelector<HTMLElement>("[data-process-drawing]");
        if (drawing) {
          observeScroll({
            trigger: drawing,
            start: "top 80%",
            once: true,
            onEnter: () => setActive(STAGES.length - 1),
          });
        }
      }

      if (reduced) return cleanupActive;

      const cards = gsap.utils.toArray<HTMLElement>("[data-stage-card]", section);
      if (cards.length) {
        fromOnScroll(
          cards,
          {
            opacity: 0,
            y: 28,
            duration: DUR.enter,
            ease: EASE.enter,
            stagger: 0.08,
          },
          { trigger: cards[0], start: REVEAL_START },
        );
      }

      const drawing = section.querySelector<HTMLElement>("[data-process-drawing]");
      if (drawing) {
        fromOnScroll(
          drawing,
          {
            opacity: 0,
            y: 40,
            scale: 0.97,
            duration: 1,
            ease: EASE.editorial,
          },
          { trigger: drawing, start: "top 88%" },
        );
      }

      return cleanupActive;
    },
    { queries: { desktop: "(min-width: 1024px)" } },
  );

  const current = STAGES[active]!;

  // Declared once, rendered in whichever of the two frames the current width
  // uses (see the comment at the sticky frame). Only ever one of them is
  // displayed, so the duplicated <h2> never reaches the accessibility tree.
  // `splitTemplate` matches the content grid below exactly, so the heading
  // sits over the drawing and the lede sits over the stage column — one spine
  // down the whole pinned frame instead of two rows that happen to share a
  // width. See SectionIntro for why the default split is wrong here.
  const intro = (
    <SectionIntro
      layout="split"
      splitTemplate={PINNED_COLUMNS}
      index="02"
      label="Process"
      datum="five to eight weeks"
      lines={["Drawn, made and fitted", "by the same hands."]}
      lede="Five stages, one team. Keep scrolling and the drawing builds itself, exactly the way your room does."
    />
  );

  return (
    <section ref={sectionRef} id="home-process"
      aria-labelledby="process-heading" className="bg-muted scroll-mt-24">
      <h2 id="process-heading" className="sr-only">
        Our process
      </h2>

      {/* Below `lg` there is no sticky stage to put the heading inside, so it
          opens the section the way every other one does. */}
      <div className="shell pt-20 md:pt-28 lg:hidden">{intro}</div>

      {/* ── Desktop: sticky stage, scroll-driven ── */}
      <div
        data-process-track
        className="relative hidden lg:block"
        style={{ height: `${STAGE_VH * STAGES.length}vh` }}
      >
        {/* ── The pinned frame, laid out exactly as §A4 on a service page ──
            One viewport tall, and read top-down: the sheet rule, the heading
            and the lede sit in a `shrink-0` block with the header's clearance
            padded into it, and everything below takes `flex-1` of whatever is
            left. Nothing is centred, so nothing can drift under the navbar
            when the content grows, and the title, the index and the datum are
            all on screen for the whole traverse rather than only at the start
            of it.

            Two earlier attempts are worth recording because both are the
            obvious thing to reach for and both fail. `justify-center` on a
            100vh box overflows *both* ends the moment the content is taller
            than the box — the drawing ran off the bottom and the heading slid
            up under the header. Letting the frame take its natural height and
            stick below the header fixed that and lost the point: the frame
            then sized itself to its content, so the drawing had no ceiling to
            be measured against and the composition changed shape with every
            viewport. A fixed frame with a flexible middle is the arrangement
            that holds. */}
        <div className="sticky top-0 flex h-[100svh] flex-col overflow-hidden">
          <div className="shell shrink-0 pt-[7.5rem]">
            {/* Title one step down from its usual clamp, as §A4 does: a
                3.5rem headline inside a frame that also has to hold a drawing
                and a column of copy is a headline taking someone else's
                room. */}
            {intro}
          </div>

          {/* The middle takes what is left. `min-h-0` is what allows a flex
              child to shrink below its content size — without it the row keeps
              its natural height and the frame overflows regardless of what
              the drawing is told to do. The bottom padding keeps the drawing
              clear of the stage readout pinned under it. */}
          <div className="flex min-h-0 flex-1 items-center overflow-hidden pb-[clamp(2rem,5vh,4rem)] pt-[clamp(1rem,3vh,2.5rem)]">
            <div className="shell h-full w-full">
              <div
                // gap-x-12 and not xl:gap-x-16: SectionIntro's split row uses
                // gap-x-12, and two grids can only share a spine if they share
                // a gutter. At xl the content row was 68px against the intro's
                // 51px, which made the first column 17px narrower and pushed
                // everything in it out of line with the heading above.
                className="grid h-full min-h-0 w-full items-center gap-x-12 [grid-template-columns:var(--pinned-cols)]"
                style={{ "--pinned-cols": PINNED_COLUMNS } as React.CSSProperties}
              >
                {/* ── The drawing ──
                    Bounded by the frame, not by the column it sits in. Every
                    ancestor from the sticky frame down now has a definite
                    height, so `h-full` here is a real number and the 16:9
                    ratio turns it into a width — the reverse of the first
                    version, which sized the drawing off the column and
                    therefore off the *window width*, producing a 728px-tall
                    drawing on a 1900px screen and shoving the heading off the
                    top of its own section.

                    The budget is written as a *max-width* converted through
                    the 16:9 ratio rather than as a max-height, and that is not
                    a stylistic choice: `h-auto` leaves the height indefinite,
                    `aspect-ratio` then has nothing to resolve from, and the
                    box collapses to nothing. (It did — 293px wide.) Driving
                    from width means the sheet fills its column until doing so
                    would make it taller than the frame allows, and stops
                    exactly there — so it is never clipped and never crowds the
                    stage readout below it.

                    The budget is `100svh - 26rem`, not a flat fraction of the
                    viewport. A fraction looks right at one height and fails at
                    the others, because the block above the drawing is a fixed
                    cost — the header clearance plus the heading — not a
                    proportional one. Subtracting that cost leaves the real
                    remainder at every height: at 700px it yields a small sheet
                    with room to breathe, at 1100px a large one, and neither
                    ends up 12px off the bottom of the frame. 62rem is the
                    ceiling, so a very tall window does not turn the drawing
                    into the whole page. */}
                {/* Left-aligned, not centred. Centring the sheet inside its
                    column put its left edge ~90px in from the heading's, so
                    the two most prominent things in the frame — the title and
                    the drawing — agreed with nothing. Ranged left they share
                    an edge, and the slack falls into the gutter between the
                    columns where it reads as spacing rather than as drift. */}
                <div
                  data-process-drawing
                  className="flex h-full min-h-0 w-full items-center justify-start"
                >
                  <ElevationDrawing
                    active={active}
                    className="aspect-[16/9] h-auto w-full max-w-[min(100%,62rem,calc((100svh-26rem)*16/9))]"
                  />
                </div>

              {/* ── The stage column ──
                  Rebuilt for the width it actually has. It was a top-heavy
                  stack with four different vertical gaps (3 / 4 / 8 / 8) and,
                  at the foot, five stage names laid into five equal flex
                  columns. That last part was the real fault: the names are
                  6 to 12 characters long and the columns were ~68px each, so
                  "CONSULTATION" truncated while "DESIGN" sat in a third of
                  its box — five labels of one size pretending to be a scale.

                  The bar keeps the five equal segments, because *those* are
                  genuinely equal: one per stage, filled up to where you are.
                  The names come out from under it and run as a single wrapping
                  line, which is what a list of five short words wants to be in
                  a column this wide. Nothing truncates at any width, and the
                  active one is the only thing carrying full contrast. */}
              <div className="flex flex-col gap-6">
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
                    <h3
                      className="mt-3 font-title font-semibold leading-[1.05] tracking-[-0.03em] text-primary"
                      style={{ fontSize: "clamp(1.7rem, 2.2vw, 2.3rem)" }}
                    >
                      {current.title}
                    </h3>
                    <p className="mt-4 max-w-[34ch] text-[15px] leading-[1.7] text-foreground/80">
                      {current.body}
                    </p>
                  </div>
                </div>

                <div>
                  {/* Five equal segments, filled to the current stage. */}
                  <ol
                    className="flex gap-1.5"
                    aria-label={`Stage ${active + 1} of ${STAGES.length}`}
                  >
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
                      </li>
                    ))}
                  </ol>

                  {/* The names, as one wrapping line rather than five boxes.
                      aria-hidden because the <ol> above already announces the
                      position and the heading announces the stage — this is
                      the same information a third time, for the eye only. */}
                  <p
                    aria-hidden="true"
                    className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] uppercase tracking-[0.12em]"
                  >
                    {STAGES.map((stage, index) => (
                      <span key={stage.title} className="flex items-center gap-2">
                        <span
                          className="transition-colors duration-300"
                          style={{
                            color:
                              index === active
                                ? "var(--enzo-forest)"
                                // 80%, not 45%: measured against the real
                                // tokens, forest needs four fifths strength to
                                // clear 4.5:1 on cream (75% lands at 4.40),
                                // and these are the names of the stages, not
                                // a hairline.
                                : "color-mix(in oklab, var(--enzo-forest) 80%, transparent)",
                            fontWeight: index === active ? 600 : 400,
                          }}
                        >
                          {stage.title}
                        </span>
                        {index < STAGES.length - 1 && (
                          <span className="text-primary/25">/</span>
                        )}
                      </span>
                    ))}
                  </p>
                </div>

                <Link
                  href="/booking"
                  className="touch-target group/book inline-flex w-fit items-center gap-2 border-b border-primary/25 pb-1 text-[13px] font-medium text-primary transition-colors duration-300 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
                >
                  Start at stage one
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 ease-out group-hover/book:translate-x-1" />
                </Link>
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>

      {/* ── Mobile: drawing once, then a plain list ── */}
      <div className="shell pb-20 lg:hidden">
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
            className="touch-target inline-flex items-center gap-2 whitespace-nowrap border-b border-primary/25 pb-1 text-[13px] font-medium text-primary"
          >
            Start at stage one
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
