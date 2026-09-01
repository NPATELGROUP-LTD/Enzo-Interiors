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
// with a marker on it, and each promise inks from outline to solid as the
// marker reaches it. That is a different use of scroll from anything on the
// landing page — nothing is pinned, nothing moves horizontally, and the only
// thing scroll changes is which lines are finished.
//
// Position is computed from the section's live bounding box on gsap.ticker
// rather than from a ScrollTrigger's cached start/end: triggers created
// before a taller section above finishes measuring go stale, and a stale
// trigger here would leave every line permanently unfinished. Same reasoning
// as components/landing/ProcessLedger.tsx.
import { useRef, useState } from "react";
import gsap from "gsap";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { useGSAP } from "@/hooks/useGSAP";

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

export function StudioConstants() {
  const sectionRef = useRef<HTMLElement>(null);
  const [reached, setReached] = useState(0);

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
      aria-labelledby="services-constants-heading"
      className="relative overflow-hidden bg-enzo-forest"
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
            return (
              <article
                key={item.title}
                className="relative border-t border-enzo-cream/12 py-8 first:border-t-0 first:pt-0 md:py-12"
              >
                {/* Station mark on the line for this promise. */}
                <span
                  aria-hidden="true"
                  className="absolute -left-8 top-10 h-2 w-2 -translate-x-[3.5px] rounded-full transition-all duration-500 sm:-left-9 md:-left-14 md:top-14"
                  style={{
                    backgroundColor: done ? "#D4C9B5" : "rgba(242,240,235,0.2)",
                    transform: `translateX(-3.5px) scale(${done ? 1.35 : 1})`,
                  }}
                />

                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <span className="font-display text-[11px] font-semibold tabular-nums tracking-[0.18em] text-enzo-sand">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.24em] text-enzo-cream/45">
                    {item.datum}
                  </span>
                </div>

                <h3
                  className="mt-3 font-title font-semibold leading-[1.06] tracking-[-0.035em] transition-colors duration-700 ease-out"
                  style={{
                    fontSize: "clamp(1.6rem, 3.6vw, 3rem)",
                    // Dim until the marker reaches it, then full strength.
                    // This was an outline (text-stroke) that filled in —
                    // a nice idea on paper, but hollow display type is
                    // genuinely harder to read than dimmed type, and it
                    // made a plain list of promises look ornamental.
                    color: done ? "#F2F0EB" : "rgba(242,240,235,0.28)",
                  }}
                >
                  {item.title}
                </h3>

                <p
                  className="mt-4 max-w-[56ch] text-[14.5px] leading-[1.7] transition-opacity duration-700 ease-out"
                  style={{
                    color: "rgba(242,240,235,0.7)",
                    opacity: done ? 1 : 0.32,
                  }}
                >
                  {item.body}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
