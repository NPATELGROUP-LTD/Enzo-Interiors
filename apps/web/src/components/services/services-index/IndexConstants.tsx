"use client";

// /services §03 — the things that don't vary.
//
// The schedule above is all difference: every column has a different lead
// time and a different price. This is the counterweight — the four things
// that are identical whichever discipline you pick — and it earns its place
// on a comparison page precisely because it is the one section with nothing
// to compare.
//
// The mechanic is a setting-out line: a single hairline runs down the left
// with a marker on it, and each promise inks in as the marker reaches it.
// That is a different use of scroll from anything on the landing page —
// nothing is pinned, nothing moves horizontally, and the only thing scroll
// changes is which promises are finished.
//
// ── What changed, and why not to change it back ──
// This used to be four dimmed paragraphs that brightened. Two problems: the
// un-reached state ran at 0.28/0.32 opacity on a forest ground, which is
// below anything readable, so three quarters of the section was effectively
// unreadable at any given moment; and four abstract promises with no visual
// difference between them read as one grey block of boilerplate.
//
// So: the un-reached state now bottoms out at a legible contrast (it is a
// *quieter* state, not a hidden one), each promise carries its own drawn
// symbol from ConstantMarks.tsx, and each one gets a header rule putting its
// index and its datum on one line — the same measuring-rule device the
// section headings use, one size down, which is what finally gave the four
// items an internal hierarchy. Pointing at a promise brings its drawing
// forward early; scrolling to it does the same on its own.
//
// Position is computed from the section's live bounding box on gsap.ticker
// rather than from a ScrollTrigger's cached start/end: triggers created
// before a taller section above finishes measuring go stale, and a stale
// trigger here would leave every promise permanently unfinished. That matters
// more now than it did, because §02 pins and adds a viewport of height
// directly above this one. Same reasoning as landing/ProcessLedger.tsx.
//
// ── Below lg: no plates ──
// The four drawings are the single heaviest thing in this section — with all
// four on screen the section measured 2,522px on a 375×812 viewport, over
// three full screens, for four short promises. They are also purely
// decorative (`aria-hidden="true"` already, on ConstantMarks.tsx) — the
// datum, title and body carry the whole promise without them. So below `lg`
// they simply are not rendered: same four promises, same setting-out line
// and marker, no illustration. The grid's own existing breakpoint already
// draws this line — a single column below `lg`, two beside each other from
// `lg` up — so gating the plate there keeps the two decisions (layout,
// content) at the one place that already made the first one.
import { useRef, useState } from "react";
import gsap from "gsap";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { useGSAP } from "@/hooks/useGSAP";
import { ConstantMark } from "./ConstantMarks";

interface Constant {
  title: string;
  body: string;
  datum: string;
}

const CONSTANTS: Constant[] = [
  {
    title: "One team, start to finish",
    body: "The person who measures your room is the person who draws it, and our own fitters install it. No subcontractors, no handovers, nobody blaming the last trade.",
    datum: "0 subcontractors",
  },
  {
    title: "Surveyed before it is quoted",
    body: "We come to you, measure every wall, and photograph the space before a number is written down. A quote given over the phone is a guess.",
    datum: "60–90 min visit",
  },
  {
    title: "Drawn in 3D before it is cut",
    body: "You see the room you are buying — finishes, handles, internal layout — and sign it off before a single sheet goes on the saw.",
    datum: "Included, always",
  },
  {
    title: "Five-year workmanship guarantee",
    body: "Every installation, every discipline, in writing. If something we fitted moves, sticks or fails, we come back and put it right.",
    datum: "5 years",
  },
];

export function IndexConstants() {
  const sectionRef = useRef<HTMLElement>(null);
  const [reached, setReached] = useState(0);
  const [hovered, setHovered] = useState<number | null>(null);

  useGSAP(sectionRef, (section, reduced) => {
    const list = section.querySelector<HTMLElement>("[data-constants-list]");
    const marker = section.querySelector<HTMLElement>("[data-constants-marker]");

    if (reduced) {
      setReached(CONSTANTS.length);
      if (marker) gsap.set(marker, { scaleY: 1 });
      return;
    }

    if (!list) return;

    const track = () => {
      const rect = list.getBoundingClientRect();
      // The reading line sits at 62% of the viewport — a little above
      // centre, which is where the eye actually rests while scrolling.
      const readLine = window.innerHeight * 0.62;
      const progress = gsap.utils.clamp(0, 1, (readLine - rect.top) / rect.height);

      if (marker) {
        gsap.set(marker, { scaleY: progress });
      }

      const index = Math.min(
        CONSTANTS.length,
        Math.floor(progress * CONSTANTS.length + 0.35),
      );
      setReached((current) => (current === index ? current : index));
    };

    gsap.ticker.add(track);
    track();

    return () => {
      gsap.ticker.remove(track);
    };
  });

  return (
    <section
      ref={sectionRef}
      id="services-constants"
      aria-labelledby="services-constants-heading"
      className="relative overflow-hidden bg-enzo-forest scroll-mt-24"
    >
      <div className="mx-auto max-w-[1500px] px-5 py-20 sm:px-6 md:px-12 md:py-28">
        <h2 id="services-constants-heading" className="sr-only">
          What every job includes
        </h2>

        <SectionIntro
          layout="split"
          tone="dark"
          index="03"
          label="Constant"
          datum="on every job"
          lines={["Four things that", "never vary."]}
          lede="Whichever discipline you pick, and whatever it costs, these are fixed. They are the reason the schedule above is worth trusting."
        />

        <div
          data-constants-list
          className="relative mt-14 pl-8 sm:pl-12 md:mt-20 md:pl-20"
        >
          {/* The setting-out line, and the marker travelling down it. */}
          <span
            aria-hidden="true"
            className="absolute left-0 top-0 h-full w-px bg-enzo-cream/15 sm:left-3 md:left-6"
          />
          <span
            aria-hidden="true"
            data-constants-marker
            className="absolute left-0 top-0 h-full w-px origin-top bg-enzo-sand sm:left-3 md:left-6"
            style={{ transform: "scaleY(0)" }}
          />

          {CONSTANTS.map((item, index) => {
            const done = index < reached;
            // Reached and pointed-at are the same state, so a visitor who
            // wants a drawing early can hover for it rather than scrolling
            // until the page decides to show them.
            const live = done || hovered === index;
            return (
              <article
                key={item.title}
                onPointerEnter={() => setHovered(index)}
                onPointerLeave={() =>
                  setHovered((current) => (current === index ? null : current))
                }
                className="relative border-t border-enzo-cream/12 py-10 first:border-t-0 first:pt-0 md:py-16"
              >
                {/* Station mark on the line for this promise. */}
                <span
                  aria-hidden="true"
                  className="absolute -left-8 top-11 h-2 w-2 rounded-full transition-[background-color,transform] duration-500 sm:-left-9 md:-left-14 md:top-[4.5rem]"
                  style={{
                    backgroundColor: live ? "#D4C9B5" : "rgba(242,240,235,0.25)",
                    transform: `translateX(-3.5px) scale(${live ? 1.4 : 1})`,
                  }}
                />

                {/* Per-promise header rule: index on the left, datum on the
                    right, a hairline measuring between them — the section
                    heading's own device, one size down.

                    It spans the whole row rather than sitting inside the text
                    column. That is what stops the plate on the right reading
                    as something that fell off the layout: the rule now
                    measures the full width the row occupies, and its datum
                    lands on the plate's own right edge. */}
                <div className="flex items-center gap-4">
                  <span className="font-display text-[12px] font-semibold tabular-nums tracking-[0.18em] text-enzo-sand">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span aria-hidden="true" className="h-px flex-1 bg-enzo-cream/20">
                    <span
                      className="block h-px origin-left bg-enzo-sand transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
                      style={{ transform: `scaleX(${live ? 1 : 0})` }}
                    />
                  </span>
                  <span className="whitespace-nowrap font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-enzo-cream/70">
                    {item.datum}
                  </span>
                </div>

                {/* Two near-equal columns. The plate fills its own column
                    instead of being capped at a token 15rem in the corner —
                    a drawing that small could not carry any detail, and the
                    space left over beside it read as a hole rather than as a
                    margin. */}
                <div className="mt-7 grid gap-8 md:mt-9 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-center lg:gap-14">
                  <div className="min-w-0">
                    <h3
                      className="font-title font-semibold leading-[1.04] tracking-[-0.035em] transition-colors duration-700 ease-out"
                      style={{
                        fontSize: "clamp(1.75rem, 3.9vw, 3.15rem)",
                        // Quieter until the marker reaches it — not hidden.
                        // This was 0.28, which is unreadable on forest, and a
                        // reveal is worth nothing if it is bought by making
                        // three quarters of the section illegible.
                        color: live ? "#F2F0EB" : "rgba(242,240,235,0.62)",
                      }}
                    >
                      {item.title}
                    </h3>

                    <p
                      className="mt-5 max-w-[52ch] text-[15.5px] leading-[1.75] transition-colors duration-700 ease-out md:text-[16.5px]"
                      style={{
                        color: live
                          ? "rgba(242,240,235,0.9)"
                          : "rgba(242,240,235,0.65)",
                      }}
                    >
                      {item.body}
                    </p>
                  </div>

                  {/* The plate — lg and up only. See the file-header note:
                      it is the heaviest thing in the section and purely
                      decorative, so below lg it is simply not rendered
                      rather than being shrunk to fit. */}
                  <ConstantMark
                    index={index}
                    on={live}
                    className="hidden w-full lg:block"
                  />
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
