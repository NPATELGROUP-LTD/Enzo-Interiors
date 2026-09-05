"use client";

// "What's included" — layout 4 of 4: THE BAYS.  (Fitted Wardrobes)
//
// ── What this replaces, and why ──
// A grid of compartments — hanging bays, shelves, drawers — with one
// authored feature written inside each. The metaphor was right and the
// argument was missing: every wardrobe ever sold has hanging, shelves and
// drawers in it, so a picture of hanging, shelves and drawers is a picture
// of the category, not of us. A customer standing in front of a flat-pack
// aisle sees the same diagram.
//
// The only thing a *fitted* wardrobe can say that a bought one cannot is
// that it was made for a room that is not a rectangle. So the section is one
// continuous run of joinery drawn across five bays, and each bay is a
// different piece of awkwardness a real Leicester bedroom throws at us: a
// rake, a chimney breast, a wall out of plumb, an eaves knee wall, a door in
// the wrong place. Read left to right the five bays butt up into a single
// elevation, which is the point — the run is continuous, the room underneath
// it is not.
//
// The client's own feature list then runs beneath as the schedule. It is
// still "what's included"; it just leads with the reason the list is worth
// anything.
//
// Ground: cream.
import { useRef } from "react";
import gsap from "gsap";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { revealOnScroll, useGSAP } from "@/hooks/useGSAP";
import { EASE, REVEAL_START } from "@/lib/motion";
import type { ServiceDetail } from "@/lib/content";

/**
 * One bay of the run. Every drawing shares the same 100 x 160 space, the
 * same floor line at y=150 and the same ceiling reference at y=8, so the
 * five sit shoulder to shoulder as one elevation rather than five sketches.
 *
 * `room` is the condition — drawn faintly, because it is the thing that was
 * already there. `unit` is the joinery, drawn heavy. `detail` is the part
 * worth pointing at, drawn in sand.
 */
const BAYS = [
  {
    condition: "A raked ceiling",
    answer: "The carcass is cut to the rake and the top scribed to the plaster, so the run finishes tight to the slope instead of stopping short with a dust shelf above it.",
    room: "M0 8 L100 38 M0 150 H100",
    unit: "M10 150 V16 L90 40 V150",
    inner: "M10 60 H90 M10 104 H90 M50 16 V150",
    detail: "M10 16 L90 40",
  },
  {
    condition: "A chimney breast",
    answer: "Two runs returned into the alcoves either side, set out to the same height and the same shadow gap, so the breast reads as part of the furniture rather than an interruption in it.",
    room: "M0 150 H100 M36 150 V52 H64 V150",
    unit: "M6 150 V22 H36 V52 M64 52 V22 H94 V150",
    inner: "M6 70 H36 M6 110 H36 M64 70 H94 M64 110 H94",
    detail: "M36 22 H64 V52",
  },
  {
    condition: "Walls out of plumb",
    answer: "Nothing in a Victorian terrace is square. Every end panel carries a scribe strip that gets cut on site to the wall's real line, which is why there is no tapering gap down the side of a finished run.",
    room: "M4 150 L14 8 M100 150 V8 M0 150 H100",
    unit: "M20 150 V20 H92 V150",
    inner: "M20 64 H92 M20 108 H92 M56 20 V150",
    detail: "M14 8 L20 20 L20 150 L4 150 Z",
  },
  {
    condition: "Eaves and a knee wall",
    answer: "Under a dormer the standing height runs out. Drawers and a low hanging rail go where you cannot stand, so the loft room stores what a loft room actually holds instead of wasting its best wall.",
    room: "M0 8 H40 L100 96 M0 150 H100",
    unit: "M8 150 V18 H44 L92 88 V150",
    inner: "M8 60 H44 M8 100 H44 M44 100 H92 M44 18 V150",
    detail: "M44 100 H92 V150 H44 Z",
  },
  {
    condition: "A door in the way",
    answer: "Where a run has to cross a doorway it bridges over it, with the head set to line through with the tops of the doors either side. The storage carries on; the swing is untouched.",
    room: "M0 150 H100 M34 150 V78 H68 V150",
    unit: "M6 150 V20 H94 V150 M34 78 H68",
    inner: "M6 60 H34 M6 106 H34 M68 60 H94 M68 106 H94 M34 20 V78 M68 20 V78",
    detail: "M34 78 H68 V150",
  },
] as const;

export function IncludedBays({
  service,
  id,
}: {
  service: ServiceDetail;
  id: string;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const features = service.features;

  useGSAP(sectionRef, (section, reduced) => {
    const bays = gsap.utils.toArray<HTMLElement>("[data-bay]", section);
    const strokes = gsap.utils.toArray<SVGGeometryElement>("[data-ink]", section);
    const rows = gsap.utils.toArray<HTMLElement>("[data-schedule-row]", section);
    if (!bays.length) return;

    if (reduced) {
      gsap.set(bays, { opacity: 1 });
      gsap.set(strokes, { strokeDashoffset: 0, opacity: 1 });
      gsap.set(rows, { opacity: 1, y: 0 });
      return;
    }

    // pathLength is normalised to 1 in the markup, so one dash pair inks any
    // shape in without measuring it.
    gsap.set(strokes, { strokeDasharray: 1, strokeDashoffset: 1, opacity: 1 });
    gsap.set(bays, { opacity: 1 });

    revealOnScroll(
      bays[0]!,
      (timeline) => {
        timeline
          .to(strokes, {
            strokeDashoffset: 0,
            duration: 0.85,
            ease: EASE.editorial,
            stagger: 0.018,
          })
          .from(
            rows,
            { opacity: 0, y: 16, duration: 0.5, ease: EASE.enter, stagger: 0.035 },
            0.4,
          );
      },
      { start: REVEAL_START },
    );
  });

  return (
    <section
      ref={sectionRef}
      id={id}
      aria-labelledby="included-heading"
      className="relative overflow-hidden bg-background scroll-mt-24"
    >
      <div className="mx-auto max-w-[1500px] px-5 py-20 sm:px-6 md:px-12 md:py-28">
        <h2 id="included-heading" className="sr-only">
          What is included
        </h2>

        <SectionIntro
          layout="split"
          index="A2"
          label="Elevation"
          datum={`${BAYS.length} conditions · ${features.length} as standard`}
          lines={["Built to the room,", "not to a catalogue."]}
          lede="Five bays of one run, across five things a real bedroom does to a straight line. A bought wardrobe answers none of them; the gap down the side of it is where the answer should have been."
          ledeShort="Five bays of one run, across five things a real bedroom does to a straight line."
        />

        {/* ── The run ──
            On a desk the five bays butt together with no gap and no
            individual border, so they read as one continuous elevation
            sitting on one floor line. Below `md` that reading is impossible
            at 375px — five bays would be 70px each — so each bay becomes its
            own row with the drawing beside the words, which is the same
            information in the arrangement a phone can actually hold. */}
        <div className="mt-14 md:mt-20">
          <ol className="md:grid md:grid-cols-5">
            {BAYS.map((bay, index) => (
              <li
                key={bay.condition}
                data-bay
                className="flex items-center gap-5 border-t border-border/70 py-6 last:border-b md:block md:border-t-0 md:py-0 md:last:border-b-0"
              >
                <svg
                  viewBox="0 0 100 160"
                  role="img"
                  aria-label={`Wardrobe run at ${bay.condition.toLowerCase()}`}
                  className="w-24 shrink-0 text-primary md:w-full"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {/* The room: what was already there. */}
                  <path
                    data-ink
                    pathLength={1}
                    d={bay.room}
                    stroke="currentColor"
                    strokeWidth="1.1"
                    strokeOpacity="0.3"
                  />
                  {/* The part worth pointing at, in sand and heavier. */}
                  <path
                    data-ink
                    pathLength={1}
                    d={bay.detail}
                    stroke="var(--enzo-sand)"
                    strokeWidth="4"
                    strokeOpacity="0.85"
                  />
                  {/* The joinery. */}
                  <path
                    data-ink
                    pathLength={1}
                    d={bay.unit}
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    data-ink
                    pathLength={1}
                    d={bay.inner}
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeOpacity="0.55"
                  />
                </svg>

                <div className="md:mt-6 md:border-t md:border-border/70 md:pr-5 md:pt-4">
                  <span className="flex items-baseline gap-2.5">
                    <span className="font-display text-[10px] font-semibold tabular-nums tracking-[0.2em] text-enzo-forest-light">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3 className="text-[14.5px] font-semibold leading-[1.25] tracking-[-0.02em] text-primary">
                      {bay.condition}
                    </h3>
                  </span>
                  <p className="mt-2 text-[12.5px] leading-[1.6] text-muted-foreground">
                    {bay.answer}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* ── The schedule ──
            What is in the price, set as a ruled index under the drawing.
            Two columns from `sm` so a fourteen-item list does not become a
            fourteen-row ladder under a five-bay elevation. */}
        {features.length > 0 && (
          <div className="mt-16 border-t border-primary/25 pt-8 md:mt-24">
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="font-display text-[10.5px] font-semibold uppercase tracking-[0.26em] text-enzo-forest-light">
                Standard on every run
              </h3>
              <span className="text-[11.5px] tabular-nums text-muted-foreground">
                {features.length} items
              </span>
            </div>

            <ul className="mt-5 grid gap-x-12 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature, index) => (
                <li
                  key={feature}
                  data-schedule-row
                  className="grid grid-cols-[2rem_minmax(0,1fr)] items-baseline gap-x-2 border-b border-border/70 py-3.5"
                >
                  <span className="font-display text-[10px] font-semibold tabular-nums tracking-[0.16em] text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[14.5px] leading-[1.4] text-primary">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
