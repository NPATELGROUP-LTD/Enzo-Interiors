"use client";

// /about §06 — the note.
//
// ── Four designs discarded here ──
// 1. An SVG signature that inked itself in — the site's self-drawing stroke,
//    already used twice elsewhere, and a scribble standing in for a name is
//    decoration pretending to be evidence.
// 2. The letter as a printed page with a marginal apparatus: a gutter column
//    carrying a headnote, a mounted portrait, three cited figures and an
//    imprint, each hung off a hairline that broke around it. Six small
//    parallel items at 9.5–12px and a rule that breaks six times is a lot to
//    parse for the section that is meant to be the quiet one.
// 3. A pull-quote at headline scale, lifting one line out of the letter. The
//    sentence it lifted was very nearly the sentence the letter's own third
//    paragraph ends on, so the reader met the same idea twice.
// 4. The letter set plainly, byline first: 270 words of first-person prose in
//    one 44rem column. Honest, and unreadable in the way every "founder's
//    note" is unreadable — it is the only thing on this site that asks for
//    two minutes of uninterrupted attention, and it sits at the *end* of a
//    page, where nobody has two minutes left. Watching it, you could see
//    exactly what happens: people skim the first line and leave.
//
// ── What replaces it: the claim, then the reason ──
// The letter was already three arguments, and each of its paragraphs already
// opened with the argument and then justified it. So the layout stops
// flattening that structure and prints it: the opening sentence of each
// paragraph is set at heading scale, and the rest of that paragraph sits
// underneath at reading size.
//
// The result reads correctly at two speeds. Skim the three large lines and
// you have the whole position in about fifteen seconds — "I started Enzo
// because I kept seeing the same thing go wrong / So we do it the other way
// round / It is slower, and it means we turn work down when we are full."
// Read the small text under any of them and you get the evidence for that
// one. Nothing is repeated, nothing is hidden, and there is no "read more".
//
// ── Why the split is computed and not authored ──
// The paragraphs come from the page as plain strings, and the client will
// eventually author them. Asking for "a headline and a body" per paragraph is
// asking somebody to write in a shape; splitting on the first sentence takes
// the shape the prose already has. `splitClaim` falls back to using the whole
// paragraph as the claim when there is no sentence break to find, so a
// one-sentence paragraph still renders correctly rather than emptying.
//
// The author sits in a sticky column beside all three, so you know whose
// voice it is for the whole read rather than finding out at the end.
import { useRef } from "react";
import gsap from "gsap";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { revealOnScroll, useGSAP } from "@/hooks/useGSAP";
import { EASE, REVEAL_START } from "@/lib/motion";

interface AboutColophonProps {
  name: string;
  role: string;
  portrait: string;
  paragraphs: string[];
  /** When the note was written, and where — one quiet line at the end. */
  written: string;
  place: string;
}

/**
 * Splits a paragraph into its opening sentence and whatever follows.
 *
 * The minimum length matters: "So we do it the other way round." is a fine
 * claim at 32 characters, but a paragraph opening with "Yes." would give a
 * four-character headline and a wall of body text. Below the floor we keep
 * looking for the next sentence end instead.
 */
function splitClaim(paragraph: string): { claim: string; rest: string } {
  const MIN = 24;
  const pattern = /([.!?])\s+/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(paragraph)) !== null) {
    const end = match.index + 1;
    if (end >= MIN) {
      return {
        claim: paragraph.slice(0, end).trim(),
        rest: paragraph.slice(pattern.lastIndex).trim(),
      };
    }
  }
  return { claim: paragraph.trim(), rest: "" };
}

export function AboutColophon({
  name,
  role,
  portrait,
  paragraphs,
  written,
  place,
}: AboutColophonProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const statements = paragraphs.map(splitClaim);

  useGSAP(sectionRef, (section, reduced) => {
    const rise = gsap.utils.toArray<HTMLElement>("[data-note-rise]", section);
    const claims = gsap.utils.toArray<HTMLElement>("[data-note-claim]", section);
    const rule = section.querySelector<HTMLElement>("[data-note-rule]");
    const photo = section.querySelector<HTMLElement>("[data-note-photo]");

    if (reduced) {
      gsap.set(rise, { opacity: 1, y: 0 });
      // `y: 0` as well as `yPercent: 0`: GSAP resolves the markup's
      // `translateY(100%)` to pixels on the computed matrix, so `yPercent: 0`
      // alone leaves every claim parked inside its mask. Same trap as
      // AboutClose.
      gsap.set(claims, { yPercent: 0, y: 0 });
      if (rule) gsap.set(rule, { scaleY: 1 });
      if (photo) gsap.set(photo, { scale: 1 });
      return;
    }

    gsap.set(claims, { yPercent: 100, y: 0 });

    revealOnScroll(
      section,
      (timeline) => {
        timeline
          .from(photo, { scale: 1.16, duration: 1.4, ease: EASE.editorial }, 0)
          .to(rule, { scaleY: 1, duration: 1.1, ease: EASE.editorial }, 0.1)
          .to(rise, { opacity: 1, y: 0, duration: 0.7, ease: EASE.enter, stagger: 0.07 }, 0.1)
          // The claims mask up from their own line, the way every headline on
          // this site arrives — they are headings, and they should behave
          // like the ones above them.
          .to(
            claims,
            { yPercent: 0, y: 0, duration: 0.95, ease: EASE.editorial, stagger: 0.14 },
            0.2,
          );
      },
      { start: REVEAL_START },
    );
  });

  if (!statements.length) return null;

  return (
    <section
      ref={sectionRef}
      id="about-colophon"
      aria-labelledby="about-colophon-heading"
      className="relative overflow-hidden bg-muted text-primary scroll-mt-24"
    >
      <div className="shell py-20 md:py-32">
        <span
          data-note-rise
          className="font-display block text-[10px] font-semibold uppercase tracking-[0.28em] text-enzo-forest-light opacity-0"
          style={{ transform: "translateY(10px)" }}
        >
          06 — The note
        </span>

        <h2 id="about-colophon-heading" className="sr-only">
          Why we work this way
        </h2>

        <div className="mt-10 grid gap-x-16 gap-y-12 md:mt-14 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          {/* ── Who is speaking ──
              Sticky, so the face stays with the voice for the whole read
              rather than scrolling away after the first claim. */}
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="overflow-hidden rounded-[4px] bg-enzo-forest/10">
              <ImageWithFallback
                src={portrait}
                alt={name}
                data-note-photo
                className="aspect-[4/5] w-full max-w-[15rem] object-cover will-change-transform lg:max-w-none"
              />
            </div>

            <div
              data-note-rise
              className="mt-5 opacity-0"
              style={{ transform: "translateY(12px)" }}
            >
              <p className="font-title text-[18px] font-semibold leading-tight text-primary">
                {name}
              </p>
              <p className="mt-1 text-[13.5px] leading-[1.5] text-foreground/70">
                {role}
              </p>
              <p className="mt-5 border-t border-border/70 pt-4 text-[12px] leading-[1.6] text-foreground/60">
                Written {written}, at {place.toLowerCase()}.
              </p>
            </div>
          </aside>

          {/* ── What was said ──
              One rule down the left with the numbers hung in the margin
              beside it, so three separate claims read as one threaded
              argument rather than three cards.

              The reason stays directly under its claim at every width. It was
              briefly set beside it in a third column, which filled the ground
              to the right nicely and read worse: the eye had to cross a gap
              to find the evidence for a sentence it had just read, and the
              two halves of one thought stopped being one thought. Under it
              is where the reader looks next.

              The horizontal rules that used to separate the three are gone —
              the spine and the numbers already say these are three of one
              thing, and a rule per item made four kinds of line fighting in
              one column. Space does the separating instead. */}
          <div className="relative pl-5 md:pl-7">
            <span
              data-note-rule
              aria-hidden="true"
              className="absolute inset-y-0 left-0 w-px origin-top bg-enzo-forest/40"
              style={{ transform: "scaleY(0)" }}
            />

            <ol className="space-y-14 md:space-y-20">
              {statements.map((statement, index) => (
                <li
                  key={statement.claim.slice(0, 24)}
                  className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-x-4 md:grid-cols-[3rem_minmax(0,1fr)] md:gap-x-6"
                >
                  {/* Nudged down to sit on the claim's cap line rather than
                      its line box — at 10px against 33px type that is the
                      difference between a marginal number and a floating one. */}
                  <span
                    data-note-rise
                    className="font-display col-start-1 row-start-1 block pt-[0.2rem] text-[10px] font-semibold tabular-nums tracking-[0.24em] text-enzo-forest-light opacity-0 md:pt-[0.35rem] xl:pt-[0.5rem]"
                    style={{ transform: "translateY(10px)" }}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  {/* The claim. Masked, so it arrives like every other
                      headline on the site. */}
                  <p
                    className="col-start-2 row-start-1 max-w-[32ch] overflow-hidden pb-[0.1em] -mb-[0.1em] font-title font-semibold leading-[1.14] tracking-[-0.035em] text-primary"
                    style={{ fontSize: "clamp(1.5rem, 2.6vw, 2.4rem)" }}
                  >
                    <span
                      data-note-claim
                      className="block"
                      style={{ transform: "translateY(100%)" }}
                    >
                      {statement.claim}
                    </span>
                  </p>

                  {statement.rest && (
                    <p
                      data-note-rise
                      className="col-start-2 mt-4 max-w-[56ch] text-[15.5px] leading-[1.72] text-foreground/80 opacity-0 md:mt-5 md:text-[16px]"
                      style={{ transform: "translateY(14px)" }}
                    >
                      {statement.rest}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
