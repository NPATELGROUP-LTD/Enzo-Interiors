"use client";

// "What's included" — layout 3 of 4: THE BUILD-UP.  (Media Walls)
//
// ── What this replaces, and why ──
// An elevation of the unit with the specification annotated onto it: point
// at a line in the schedule, the matching zone lights up on the drawing.
// Clever, and it answered a question nobody was asking. Everybody can
// already picture the *front* of a media wall — it is the thing they have
// been looking at on Instagram for six months. Drawing the front and
// labelling five rectangles on it told them nothing they had not worked out
// from the photograph two sections above.
//
// The thing they cannot picture, and the thing that actually separates a
// built-in wall from a TV bracket and a floating shelf, is what is *behind*
// the face. So this section turns the drawing ninety degrees and reads the
// wall as a section: four strata, from the existing wall outward to the
// sprayed front, each one named, each one explaining what it is for.
//
// That also makes it an honest sales argument rather than a diagram. "The
// brackets go into timber we have fixed, not into plasterboard" is a
// sentence a customer can check us on. A labelled rectangle is not.
//
// ── Mapping the client's feature list onto the strata ──
// The client authors a flat list of features in the Content Manager and
// will never tag them with a layer, so the features are dealt round the four
// strata in order and wrap. Every layer holds a share whatever the list's
// length, nothing is ever unlabelled, and a service with three features and
// one with fourteen both read correctly. A layer that ends up with none
// simply shows its own copy — the strata are the section's content, the
// features are the schedule against them.
//
// Ground: cream.
import { useRef } from "react";
import gsap from "gsap";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { revealOnScroll, useGSAP } from "@/hooks/useGSAP";
import { EASE, REVEAL_START } from "@/lib/motion";
import type { ServiceDetail } from "@/lib/content";

/**
 * The wall, read from the back forward. `hatch` is the id of the SVG
 * pattern drawn in each stratum's edge strip — the four are drawn
 * differently so the section reads as four materials, not four rows.
 */
const STRATA = [
  {
    name: "The wall you already have",
    role: "Structure",
    hatch: "masonry",
    body: "Stud or masonry, we find out which before anything is ordered. Where it is stud, we open it up and fix timber noggins across the studs, so the brackets that hold your screen are going into wood we have put there — not into two sheets of plasterboard and a wish.",
  },
  {
    name: "The service cavity",
    role: "Services",
    hatch: "cavity",
    body: "The gap nobody sees and everybody needs: power, aerial, HDMI and network run through it in conduit, so a box can be swapped in five years without cutting the wall open. It is also the air path — an enclosed amplifier that cannot breathe is an amplifier with a shortened life.",
  },
  {
    name: "The carcass",
    role: "Cabinetry",
    hatch: "board",
    body: "Boxes cut in our workshop from 18mm board, scribed to your actual walls and floor rather than to the drawing's idea of them. Fixed to the timber behind, glued and screwed, levelled across the run. This is the part that is still square in ten years.",
  },
  {
    name: "The face",
    role: "Finish",
    hatch: "face",
    body: "The half-millimetre everybody actually looks at: the sprayed fronts, the shadow gaps around the recess, the pelmet the light washes down from. Set out so the joints land where they look deliberate, which is the whole difference between fitted and installed.",
  },
] as const;

export function IncludedBuildUp({
  service,
  id,
}: {
  service: ServiceDetail;
  id: string;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const features = service.features;

  useGSAP(sectionRef, (section, reduced) => {
    const bands = gsap.utils.toArray<HTMLElement>("[data-stratum]", section);
    const edges = gsap.utils.toArray<HTMLElement>("[data-edge]", section);
    if (!bands.length) return;

    if (reduced) {
      gsap.set(bands, { opacity: 1, x: 0 });
      gsap.set(edges, { scaleY: 1 });
      return;
    }

    // Back wall first, face last — the order it is actually built in, and
    // the reason the reveal is worth having at all.
    revealOnScroll(
      bands[0]!,
      (timeline) => {
        timeline
          .from(edges, {
            scaleY: 0,
            transformOrigin: "50% 0%",
            duration: 0.55,
            ease: EASE.editorial,
            stagger: 0.11,
          })
          .from(
            bands,
            {
              opacity: 0,
              x: -26,
              duration: 0.7,
              ease: EASE.enter,
              stagger: 0.11,
            },
            0.08,
          );
      },
      { start: REVEAL_START },
    );
  });

  if (!features.length && !STRATA.length) return null;

  return (
    <section
      ref={sectionRef}
      id={id}
      aria-labelledby="included-heading"
      className="relative overflow-hidden bg-background scroll-mt-24"
    >
      {/* The four material hatches, defined once. Kept in a zero-size svg so
          every stratum's edge strip can reference them by id. */}
      <svg aria-hidden="true" className="absolute h-0 w-0" focusable="false">
        <defs>
          <pattern id="hatch-masonry" width="18" height="10" patternUnits="userSpaceOnUse">
            <rect width="18" height="10" fill="none" />
            <path d="M0 0h18M0 5h18M0 10h18M9 0v5M0 5v5M18 5v5" stroke="currentColor" strokeWidth="0.9" opacity="0.5" />
          </pattern>
          <pattern id="hatch-cavity" width="8" height="8" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="0.9" fill="currentColor" opacity="0.45" />
            <circle cx="6" cy="6" r="0.9" fill="currentColor" opacity="0.45" />
          </pattern>
          <pattern id="hatch-board" width="9" height="9" patternUnits="userSpaceOnUse">
            <path d="M-2 7l9-9M0 9l9-9M7 11l4-4" stroke="currentColor" strokeWidth="1" opacity="0.5" />
          </pattern>
          <pattern id="hatch-face" width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="currentColor" opacity="0.55" />
          </pattern>
        </defs>
      </svg>

      <div className="mx-auto max-w-[1500px] px-5 py-20 sm:px-6 md:px-12 md:py-28">
        <h2 id="included-heading" className="sr-only">
          What is included
        </h2>

        <SectionIntro
          layout="split"
          index="A2"
          label="Section"
          datum={`${STRATA.length} layers · ${features.length} as standard`}
          lines={["The half of it", "you never see."]}
          lede="A media wall is four things stacked on the wall you already own. Read from the back forwards — because the two layers nobody photographs are the two that decide whether it is still straight in ten years."
          ledeShort="Four layers stacked on the wall you already own, read from the back forwards."
        />

        <ol className="mt-14 md:mt-20">
          {STRATA.map((stratum, index) => {
            // This layer's share of the authored feature list.
            const items = features.filter((_, i) => i % STRATA.length === index);
            return (
              <li
                key={stratum.name}
                data-stratum
                className="group relative grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-4 border-t border-border/70 py-8 last:border-b sm:grid-cols-[3.5rem_minmax(0,1fr)] sm:gap-x-7 md:py-10 lg:grid-cols-[3.5rem_minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-x-12"
              >
                {/* The edge of the layer, seen in section. This is the whole
                    graphic: four strips, four hatches, stacked down the page
                    in build order. */}
                <span className="row-span-2 block lg:row-span-1">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 36 200"
                    preserveAspectRatio="none"
                    className="block h-full min-h-[7rem] w-full text-primary"
                  >
                    <rect
                      data-edge
                      x="0.5"
                      y="0.5"
                      width="35"
                      height="199"
                      fill={`url(#hatch-${stratum.hatch})`}
                      stroke="currentColor"
                      strokeWidth="1"
                      strokeOpacity="0.45"
                    />
                  </svg>
                </span>

                <div className="lg:pt-1">
                  <span className="flex items-baseline gap-3">
                    <span className="font-display text-[10.5px] font-semibold tabular-nums tracking-[0.2em] text-enzo-forest-light">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="font-display text-[9.5px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                      {stratum.role}
                    </span>
                  </span>

                  <h3
                    className="mt-3 font-title font-semibold leading-[1.06] tracking-[-0.035em] text-primary"
                    style={{ fontSize: "clamp(1.3rem, 2.6vw, 2rem)" }}
                  >
                    {stratum.name}
                  </h3>

                  <p className="mt-3 max-w-[54ch] text-[14.5px] leading-[1.7] text-muted-foreground">
                    {stratum.body}
                  </p>
                </div>

                {/* The client's own schedule, dealt onto the layer it belongs
                    to. Empty for a layer is fine — it simply shows nothing
                    rather than an empty box with a rule around it. */}
                {items.length > 0 && (
                  <ul className="col-start-2 mt-5 lg:col-start-3 lg:mt-0 lg:pt-1">
                    <li className="font-display mb-3 text-[9.5px] font-semibold uppercase tracking-[0.22em] text-enzo-forest-light">
                      Included at this layer
                    </li>
                    {items.map((feature) => (
                      <li
                        key={feature}
                        className="flex gap-3 border-t border-border/60 py-2.5 text-[13.5px] leading-[1.45] text-primary"
                      >
                        <span
                          aria-hidden="true"
                          className="mt-[0.6em] h-px w-3 shrink-0 bg-enzo-sand"
                        />
                        {feature}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
