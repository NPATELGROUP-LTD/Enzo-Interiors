"use client";

// /about §06 — the note.
//
// ── Three designs discarded here ──
// 1. An SVG signature that inked itself in — the site's self-drawing stroke,
//    already used twice elsewhere, and a scribble standing in for a name is
//    decoration pretending to be evidence.
// 2. The letter as a printed page with a marginal apparatus: a gutter column
//    carrying a headnote, a mounted portrait, three cited figures and an
//    imprint, each hung off a hairline that broke around it. Six small
//    parallel items at 9.5–12px and a rule that breaks six times is a lot to
//    parse for the section that is meant to be the quiet one.
// 3. A pull-quote at headline scale. That one had a specific fault worth
//    recording: the sentence it lifted — "I would rather turn a job down
//    than rush it" — is very nearly the sentence the letter's own third
//    paragraph ends on. The reader met the same idea twice and could not
//    tell which part was the heading and which was the letter.
//
// ── What replaces it: a letter, with its author at the top ──
// The single change that does most of the work is moving the byline from the
// bottom to the top. You now know who is speaking, and what they do, before
// you read a word of it — where previously you read 270 words of first-person
// prose and only found out at the end whose voice it was.
//
// The heading is plain, short, and deliberately NOT a line from the letter,
// so nothing is said twice. The letter itself is marked as one continuous
// piece of speech by a single forest rule down its left edge — a device that
// says "this is someone talking" without needing a caption to explain it.
// Then the date and place, quietly, at the end, the way a letter is dated.
//
// Read order: who → why → what they said → when. Once, straight down.
import { useRef } from "react";
import gsap from "gsap";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { revealOnScroll, useGSAP } from "@/hooks/useGSAP";
import { EASE } from "@/lib/motion";

interface AboutColophonProps {
  name: string;
  role: string;
  portrait: string;
  paragraphs: string[];
  /** When the note was written, and where — one quiet line at the end. */
  written: string;
  place: string;
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

  useGSAP(sectionRef, (section, reduced) => {
    const lines = gsap.utils.toArray<HTMLElement>("[data-note-line]", section);
    const rise = gsap.utils.toArray<HTMLElement>("[data-note-rise]", section);
    const rule = section.querySelector<HTMLElement>("[data-note-rule]");
    const photo = section.querySelector<HTMLElement>("[data-note-photo]");

    if (reduced) {
      // `y: 0` AND `yPercent: 0`: GSAP resolves a markup translate to pixels
      // on the computed matrix, so setting one leaves the element parked at
      // the other — the bug recorded in AboutClose.
      gsap.set(lines, { yPercent: 0, y: 0 });
      gsap.set(rise, { opacity: 1, y: 0 });
      if (rule) gsap.set(rule, { scaleY: 1 });
      if (photo) gsap.set(photo, { scale: 1 });
      return;
    }

    gsap.set(lines, { yPercent: 100, y: 0 });

    // One sequence, in reading order: the byline, then the heading, then the
    // rule drawing down the letter's edge, then the letter itself.
    const tl = revealOnScroll(section, (timeline) => {
      timeline
        .to(
          rise,
          { opacity: 1, y: 0, duration: 0.6, ease: EASE.enter, stagger: 0.1 },
          0,
        )
        .to(
          lines,
          { yPercent: 0, duration: 0.9, ease: EASE.editorial, stagger: 0.08 },
          0.12,
        );

      if (rule) {
        timeline.to(
          rule,
          { scaleY: 1, duration: 1.1, ease: EASE.editorial },
          0.42,
        );
      }
      if (photo) {
        timeline.fromTo(
          photo,
          { scale: 1.06 },
          { scale: 1, duration: 0.9, ease: EASE.editorial },
          0,
        );
      }
    });

    return () => {
      tl.kill();
    };
  });

  return (
    <section
      ref={sectionRef}
      id="about-colophon"
      aria-labelledby="about-colophon-heading"
      className="relative overflow-hidden bg-muted text-primary scroll-mt-24"
    >
      {/* Narrow and centred: a letter, not a page of columns. */}
      <div className="mx-auto max-w-[44rem] px-5 py-20 sm:px-6 md:px-12 md:py-32">
        <span
          data-note-rise
          className="font-display block text-[10px] font-semibold uppercase tracking-[0.28em] text-enzo-forest-light opacity-0"
          style={{ transform: "translateY(10px)" }}
        >
          06 — The note
        </span>

        {/* ── The letterhead ──
            Who is speaking, before you read what they said. */}
        <div
          data-note-rise
          className="mt-7 flex items-center gap-4 opacity-0"
          style={{ transform: "translateY(12px)" }}
        >
          <div className="h-[68px] w-[68px] shrink-0 overflow-hidden rounded-[3px] bg-enzo-forest/10">
            <ImageWithFallback
              src={portrait}
              alt={name}
              data-note-photo
              className="h-full w-full object-cover will-change-transform"
            />
          </div>
          <div>
            <p className="font-title text-[17px] font-semibold leading-tight text-primary">
              {name}
            </p>
            <p className="mt-1 text-[13px] text-foreground/70">{role}</p>
          </div>
        </div>

        {/* ── Why you are being told this ──
            Plain, short, and not a sentence the letter also uses. */}
        <h2
          id="about-colophon-heading"
          className="mt-10 font-title font-semibold leading-[1.1] tracking-[-0.03em] md:mt-12"
          style={{ fontSize: "clamp(1.6rem, 3.4vw, 2.3rem)" }}
        >
          {["Why we work", "this way."].map((line) => (
            <span
              key={line}
              className="block overflow-hidden pb-[0.1em] -mb-[0.1em]"
            >
              <span
                data-note-line
                className="block"
                style={{ transform: "translateY(100%)" }}
              >
                {line}
              </span>
            </span>
          ))}
        </h2>

        {/* ── The letter ──
            One rule down the left edge marks the whole thing as one piece of
            speech, so no caption has to say so. It draws downward as the
            section arrives, in the direction the letter is read. */}
        <div className="relative mt-9 pl-6 md:mt-11 md:pl-8">
          <span
            data-note-rule
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-px origin-top bg-enzo-forest/45"
            style={{ transform: "scaleY(0)" }}
          />

          {paragraphs.map((paragraph, index) => (
            <p
              key={paragraph.slice(0, 24)}
              data-note-rise
              className={`max-w-[58ch] text-[16px] leading-[1.85] text-foreground/85 opacity-0 ${
                index > 0 ? "mt-6" : ""
              }`}
              style={{ transform: "translateY(14px)" }}
            >
              {paragraph}
            </p>
          ))}
        </div>

        <p
          data-note-rise
          className="mt-10 text-[12px] text-foreground/70 opacity-0"
          style={{ transform: "translateY(10px)" }}
        >
          Written {written}, at {place.toLowerCase()}.
        </p>
      </div>
    </section>
  );
}
