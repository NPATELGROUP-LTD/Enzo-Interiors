"use client";

// /about §05 — the people.
//
// ── What this replaces, and why ──
// Four portraits in a four-column grid, held grey and over-scaled, developing
// to colour when you pointed at one. The faces and the honest job titles were
// the right idea — it was the *form* that was wrong. Four equal rectangles in
// a row is the layout every agency "meet the team" section has, and a photo
// that desaturates on hover is the effect that goes with it.
//
// ── One bench, not four cards ──
// So the four people are drawn as a single ruled elevation instead. Unequal
// plates — different widths, different heights, no gutters, touching — all
// standing on one bench line that runs off both edges of the screen. That
// full-bleed line is the whole trick: it says the bench is longer than the
// frame, and it is what makes four photographs read as one object rather
// than four cards.
//
// A small sand try-square rides that line under your pointer. Whoever it
// reaches stands a little taller, looks up out of their work (the plate pans
// up rather than cross-fading), and their name underlines. Nothing is hidden
// behind it: all four faces, names, roles and notes are legible at rest, so
// a visitor who never moves the pointer loses only the gesture.
//
// ── The headroom band ──
// The near-black above a short plate is bounded by the top rule and the bench
// line, carries that column's index and tick, and is the only place you
// clearly see the carriage's hairline travelling. It is drawing headroom,
// not a hole — which matters on a page where two sections have already been
// rebuilt for reading as empty.
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { revealOnScroll, useGSAP } from "@/hooks/useGSAP";
import { EASE } from "@/lib/motion";

export interface TeamMember {
  name: string;
  role: string;
  /** The part of a job this person is actually in front of. */
  note: string;
  image: string;
}

/** Unequal on both axes, cycled — so the top edge of the bench is ragged
 *  however many people there are, and it can never look like a grid. */
const WIDTH_RHYTHM = [1.32, 0.86, 1.12, 0.7];
const HEIGHT_RHYTHM = [0.92, 0.74, 0.85, 0.68];

/** How much the person under the carriage stands up, as a share of the strip. */
const RISE = 0.08;

/** Plate heights below lg, cycled — so the stacked version is not four
 *  identical cards either. */
const MOBILE_HEIGHTS = [132, 104, 118, 96];

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

export function AboutTeam({ team }: { team: TeamMember[] }) {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    sectionRef,
    (section, reduced) => {
      const plates = gsap.utils.toArray<HTMLElement>("[data-plate]", section);
      const cells = gsap.utils.toArray<HTMLElement>("[data-cell]", section);
      const rules = gsap.utils.toArray<HTMLElement>("[data-rule]", section);
      if (!plates.length) return;

      if (reduced) {
        gsap.set(plates, { clipPath: "inset(0 0 0 0)" });
        gsap.set([...cells, ...rules], { opacity: 1, y: 0 });
        return;
      }

      const tl = revealOnScroll(section, (timeline) => {
        // The rules FADE, they do not draw. A self-drawing rule is taken by
        // SectionIntro directly above this and by three other sections.
        timeline
          .to(rules, { opacity: 1, duration: 0.4, ease: "power2.out" }, 0)
          // clip-path, not height: four simultaneous tweens stay composited,
          // and each photograph uncovers upward off the shared baseline so
          // the ragged top profile assembles along the bench, left to right.
          .fromTo(
            plates,
            { clipPath: "inset(100% 0 0 0)" },
            {
              clipPath: "inset(0% 0 0 0)",
              duration: 0.9,
              ease: EASE.editorial,
              stagger: 0.07,
            },
            0.1,
          )
          .to(
            cells,
            { opacity: 1, y: 0, duration: 0.6, ease: EASE.enter, stagger: 0.06 },
            0.55,
          );
      });

      return () => {
        tl.kill();
      };
    },
    { queries: {} },
  );

  if (!team.length) return null;

  // Three or five people must still look deliberate. Up to four is one bench;
  // beyond that it splits so no column is ever squeezed below ~28% of a row
  // and the note never gets a 20-character measure.
  const perRow = team.length <= 4 ? team.length : Math.ceil(team.length / 2);
  const rows = chunk(team, perRow);

  return (
    <section
      ref={sectionRef}
      id="about-team"
      aria-labelledby="about-team-heading"
      className="relative overflow-hidden bg-enzo-dark text-enzo-cream scroll-mt-24"
    >
      <div className="mx-auto max-w-[1500px] px-5 py-20 sm:px-6 md:px-12 md:py-28">
        <h2 id="about-team-heading" className="sr-only">
          The people
        </h2>

        <SectionIntro
          layout="split"
          tone="dark"
          index="05"
          label="The bench"
          datum={`${team.length} of us`}
          lines={["This is everyone.", "All of us."]}
          lede="Not a department each. The person who measures your room is on this row, and so is the person who will be standing in it with a screwdriver."
        />

        <div className="mt-14 md:mt-16">
          {rows.map((row, rowIndex) => (
            <Bench
              key={rowIndex}
              row={row}
              offset={rowIndex * perRow}
              className={rowIndex > 0 ? "mt-16" : undefined}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/** One bench: a ruled strip of unequal plates on a shared baseline, and the
 *  register of names underneath, sharing the same column edges. */
function Bench({
  row,
  offset,
  className,
}: {
  row: TeamMember[];
  offset: number;
  className?: string;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const carriageRef = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(0);

  // Column widths as percentages of this row, from the rhythm.
  const weights = row.map((_, i) => WIDTH_RHYTHM[i % WIDTH_RHYTHM.length]!);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const widths = weights.map((w) => (w / totalWeight) * 100);
  const lefts = widths.map((_, i) => widths.slice(0, i).reduce((s, w) => s + w, 0));

  // ── The carriage ──
  // A pointermove listener rather than per-column hover: the marker is
  // supposed to travel continuously along the bench, and hover targets would
  // make it jump between column centres. Fine pointers only — a travelling
  // square is a pointer idea, and there is no pointer on a phone.
  useEffect(() => {
    const strip = stripRef.current;
    const carriage = carriageRef.current;
    if (!strip || !carriage) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const moveTo = gsap.quickTo(carriage, "x", { duration: 0.5, ease: "power3" });

    const onMove = (event: PointerEvent) => {
      const box = strip.getBoundingClientRect();
      const x = gsap.utils.clamp(0, box.width, event.clientX - box.left);
      moveTo(x);
      const share = (x / box.width) * 100;
      let index = 0;
      for (let i = 0; i < lefts.length; i += 1) if (share >= lefts[i]!) index = i;
      setActive(index);
    };

    const onLeave = () => {
      const box = strip.getBoundingClientRect();
      moveTo((box.width * (lefts[0]! + widths[0]! / 2)) / 100);
      setActive(0);
    };

    strip.addEventListener("pointermove", onMove);
    strip.addEventListener("pointerleave", onLeave);
    // One introductory pass, so the reader knows the object exists before
    // the pointer ever touches it.
    gsap.fromTo(
      carriage,
      { x: 0, opacity: 0 },
      {
        x: (stripRef.current!.getBoundingClientRect().width * (widths[0]! / 2)) / 100,
        opacity: 1,
        duration: 0.75,
        delay: 0.8,
        ease: EASE.editorial,
      },
    );

    return () => {
      strip.removeEventListener("pointermove", onMove);
      strip.removeEventListener("pointerleave", onLeave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.length]);

  return (
    <div className={className}>
      {/* ── The strip (lg and up) ── */}
      <div
        ref={stripRef}
        className="relative hidden lg:block"
        style={{ height: "clamp(300px, 30vw, 440px)" }}
      >
        <span
          data-rule
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px bg-enzo-cream/10 opacity-0"
        />

        {row.map((member, i) => {
          const on = i === active;
          const height = HEIGHT_RHYTHM[i % HEIGHT_RHYTHM.length]!;
          return (
            <div
              key={member.name}
              className="absolute bottom-0"
              style={{
                left: `${lefts[i]}%`,
                width: `${widths[i]}%`,
                // Height is a layout property, but these are out of flow, so
                // nothing can reflow around them and only ever one animates.
                height: `${(height + (on ? RISE : 0)) * 100}%`,
                transition: "height 500ms cubic-bezier(0.16, 1, 0.3, 1)",
                willChange: on ? "height" : undefined,
              }}
            >
              <div
                data-plate
                className="relative h-full w-full overflow-hidden bg-enzo-forest/40"
                style={{ clipPath: "inset(100% 0 0 0)" }}
              >
                <ImageWithFallback
                  src={member.image}
                  alt={member.name}
                  className="absolute inset-0 h-full w-full object-cover transition-[object-position] duration-[650ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{ objectPosition: `50% ${on ? 18 : 42}%` }}
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-0 bg-enzo-dark transition-opacity duration-400"
                  style={{ opacity: on ? 0.06 : 0.38 }}
                />
              </div>

              {/* The index, in the headroom above a short plate. */}
              <span
                aria-hidden="true"
                className="absolute -top-6 left-4 flex items-center gap-2"
              >
                <span
                  className="block h-2 w-px transition-colors duration-300"
                  style={{
                    backgroundColor: on ? "#D4C9B5" : "rgba(212,201,181,0.35)",
                  }}
                />
                <span
                  className="font-display text-[9.5px] font-semibold tabular-nums tracking-[0.22em] transition-colors duration-300"
                  style={{
                    color: on ? "#D4C9B5" : "rgba(212,201,181,0.55)",
                  }}
                >
                  {String(offset + i + 1).padStart(2, "0")}
                </span>
              </span>

            </div>
          );
        })}

        {row.map((_, i) =>
          i > 0 ? (
            <span
              key={`edge-${i}`}
              data-rule
              aria-hidden="true"
              className="absolute inset-y-0 w-px bg-enzo-cream/12 opacity-0"
              style={{ left: `${lefts[i]}%` }}
            />
          ) : null,
        )}

        {/* ── The bench line ──
            Full-bleed, so it visibly runs off both edges of the screen. Safe
            because the section is overflow-hidden. */}
        <span
          data-rule
          aria-hidden="true"
          className="absolute bottom-0 left-1/2 h-px w-screen -translate-x-1/2 bg-enzo-cream/20 opacity-0"
        />

        {/* ── The carriage ──
            A try-square riding the bench line. */}
        <span
          ref={carriageRef}
          aria-hidden="true"
          className="absolute bottom-0 left-0 z-10 opacity-0"
        >
          <span className="absolute bottom-0 left-0 block h-[calc(clamp(300px,30vw,440px)*0.92)] w-px -translate-x-1/2 bg-enzo-sand/25" />
          <span className="absolute -bottom-[3px] left-0 block h-1.5 w-1.5 -translate-x-1/2 rotate-45 bg-enzo-sand" />
        </span>
      </div>

      {/* ── The register (lg and up) ──
          Same widths as the plates, so every column edge lines up with the
          photograph above it. */}
      <div className="hidden lg:flex">
        {row.map((member, i) => {
          const on = i === active;
          return (
            <div
              key={member.name}
              data-cell
              className="border-l border-enzo-cream/12 pl-4 pr-6 pt-4 opacity-0 first:border-l-0 first:pl-0"
              style={{ width: `${widths[i]}%`, transform: "translateY(10px)" }}
            >
              <p
                className="font-title font-semibold tracking-[-0.025em] text-enzo-cream"
                style={{ fontSize: "clamp(1rem, 1.35vw, 1.3rem)" }}
              >
                {member.name}
              </p>
              <span
                aria-hidden="true"
                className="mt-1 block h-px origin-left bg-enzo-sand transition-transform duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{ width: 28, transform: `scaleX(${on ? 1 : 0})` }}
              />
              <p className="font-display mt-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-enzo-sand/85">
                {member.role}
              </p>
              <p className="mt-3 text-[12.5px] leading-[1.5] text-enzo-cream/70">
                {member.note}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── Below lg ──
          The bench stands on its end. The carriage is dropped entirely; the
          continuous object survives as a hairline down the left gutter with a
          tick and an index at each row. It is static — a scroll-inked
          setting-out line is /services §03, and a marker travelling a path is
          §03 two sections above this one. */}
      <ol className="relative lg:hidden">
        <span
          aria-hidden="true"
          className="absolute bottom-4 left-0 top-2 w-px bg-enzo-sand/45"
        />
        {row.map((member, i) => (
          <li
            key={member.name}
            data-cell
            className="grid grid-cols-[112px_minmax(0,1fr)] gap-x-3 border-t border-enzo-cream/12 py-5 pl-5 opacity-0 first:border-t-0"
            style={{ transform: "translateY(10px)" }}
          >
            <span
              aria-hidden="true"
              className="absolute left-0 flex -translate-x-1/2 items-center"
            >
              <span className="block h-px w-[7px] bg-enzo-sand/45" />
            </span>

            <div
              data-plate
              className="relative w-full overflow-hidden rounded-[3px] bg-enzo-forest/40"
              style={{
                height: MOBILE_HEIGHTS[i % MOBILE_HEIGHTS.length],
                clipPath: "inset(100% 0 0 0)",
              }}
            >
              <ImageWithFallback
                src={member.image}
                alt={member.name}
                className="absolute inset-0 h-full w-full object-cover"
                style={{ objectPosition: "50% 22%" }}
              />
            </div>

            <div>
              <p className="font-display text-[9.5px] font-semibold tabular-nums tracking-[0.22em] text-enzo-sand/85">
                {String(offset + i + 1).padStart(2, "0")}
              </p>
              <p className="mt-1 font-title text-[16px] font-semibold tracking-[-0.025em] text-enzo-cream">
                {member.name}
              </p>
              <p className="font-display mt-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-enzo-sand/85">
                {member.role}
              </p>
              <p className="mt-2 text-[12.5px] leading-[1.5] text-enzo-cream/70">
                {member.note}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
