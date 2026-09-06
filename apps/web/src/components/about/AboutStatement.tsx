"use client";

// /about §01 — the statement. One screen, one sentence.
//
// An About page usually opens by describing itself ("Our Story", a portrait,
// three paragraphs). This one opens by saying what the studio does, in one
// sentence, at masthead scale — with the noun in the middle of it swapping
// through the four disciplines on a slot of its own.
//
// ── The word is a plain <span>, and that is the fix ──
// It used to be a <button>, so that hovering it paused the cycle. A <button>
// does not inherit type from its parent — the UA sheet gives it a ~13px
// system font — and the headline's inherited `letter-spacing: -0.05em`
// resolves to about -4.6px, which at 13px drags every glyph on top of the
// next one. The result was a smear of overlapping letters where a word should
// be. `font: inherit` fixes it in some engines and not in others, so the
// button is gone entirely: the word is a span that inherits normally and
// cannot be got wrong.
//
// A row of ticks used to sit under the headline so you could jump straight
// to a discipline. Removed at the client's request — the sentence now simply
// cycles on its own, on a timer, for as long as anyone is reading it.
//
// ── One screen ──
// The section is exactly `100svh`. Below lg the portrait becomes the ground
// the type sits on rather than a column beside it, because a portrait next to
// a three-line headline and a paragraph cannot fit one phone screen without
// something being cut.
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { useGSAP } from "@/hooks/useGSAP";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { DUR, EASE } from "@/lib/motion";

/** How long a word holds before the sentence moves on. */
const HOLD_MS = 2800;

interface AboutStatementProps {
  /** Lower-case discipline nouns, e.g. "kitchens". */
  disciplines: string[];
  portrait: string;
}

export function AboutStatement({ disciplines, portrait }: AboutStatementProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const slotRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [index, setIndex] = useState(0);
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");

  useEffect(() => {
    if (reduced || disciplines.length < 2) return;
    const id = window.setInterval(
      () => setIndex((current) => (current + 1) % disciplines.length),
      HOLD_MS,
    );
    return () => window.clearInterval(id);
  }, [reduced, disciplines.length]);

  // ── The swap ──
  // The slot's width animates to the measured width of the incoming word, so
  // the rest of the sentence slides instead of snapping. The hidden twin is
  // what it is measured against — you cannot measure text that is not laid
  // out.
  useEffect(() => {
    const slot = slotRef.current;
    const measure = measureRef.current;
    if (!slot || !measure) return;

    const apply = () => {
      const width = measure.offsetWidth;
      if (!width) return;
      if (reduced) gsap.set(slot, { width });
      else gsap.to(slot, { width, duration: 0.5, ease: "power3.inOut" });
    };

    apply();
    // Re-measure once the display face has loaded. The first pass runs
    // against the fallback, and a fallback metric baked into the slot width
    // would clip the real word for the life of the page.
    let cancelled = false;
    void document.fonts?.ready.then(() => {
      if (!cancelled) apply();
    });

    const word = slot.querySelector<HTMLElement>("[data-word]");
    if (word && !reduced) {
      gsap.fromTo(
        word,
        { yPercent: 34, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 0.6, ease: EASE.editorial },
      );
    }

    return () => {
      cancelled = true;
    };
  }, [index, reduced]);

  useGSAP(sectionRef, (section, isReduced) => {
    const lines = gsap.utils.toArray<HTMLElement>(
      "[data-statement-line]",
      section,
    );
    const body = gsap.utils.toArray<HTMLElement>(
      "[data-statement-body]",
      section,
    );
    const plate = section.querySelector<HTMLElement>("[data-statement-plate]");
    const photo = section.querySelector<HTMLElement>("[data-statement-photo]");

    if (isReduced) {
      gsap.set(body, { opacity: 1, y: 0 });
      gsap.set(lines, { yPercent: 0, y: 0 });
      if (plate) gsap.set(plate, { clipPath: "inset(0 0 0 0)" });
      if (photo) gsap.set(photo, { scale: 1 });
      return;
    }

    gsap.set(lines, { yPercent: 100, y: 0 });

    const tl = gsap.timeline({ delay: 0.15 });
    tl.fromTo(
      plate,
      { clipPath: "inset(0 0 100% 0)" },
      { clipPath: "inset(0 0 0% 0)", duration: 1.15, ease: EASE.editorial },
    )
      .fromTo(
        photo,
        { scale: 1.16 },
        { scale: 1, duration: 1.6, ease: EASE.editorial },
        0,
      )
      .to(
        lines,
        {
          yPercent: 0,
          duration: DUR.editorial,
          ease: EASE.editorial,
          stagger: 0.09,
        },
        0.15,
      )
      .to(
        body,
        {
          opacity: 1,
          y: 0,
          duration: DUR.enter,
          ease: EASE.enter,
          stagger: 0.07,
        },
        0.55,
      );

    return () => {
      tl.kill();
    };
  });

  const word = disciplines[index] ?? disciplines[0] ?? "rooms";

  return (
    <section
      ref={sectionRef}
      id="about-statement"
      aria-labelledby="about-statement-heading"
      className="relative h-[100svh] min-h-[34rem] overflow-hidden bg-enzo-dark text-enzo-cream scroll-mt-24"
    >
      {/* ── The portrait ──
          Below lg it is the ground the type sits on; from lg it is the right
          slice of the screen. One element either way, so the photograph is
          never loaded twice. */}
      <div
        data-statement-plate
        className="absolute inset-0 overflow-hidden lg:left-auto lg:w-[42%]"
        style={{ clipPath: "inset(0 0 100% 0)" }}
      >
        <ImageWithFallback
          src={portrait}
          alt="The Enzo Interiors workshop"
          data-statement-photo
          className="absolute inset-0 h-full w-full object-cover will-change-transform"
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-enzo-dark/75 lg:bg-enzo-dark/15"
        />
      </div>

      <div className="relative shell flex h-full flex-col justify-center pb-16 pt-24">
        <div className="w-full lg:max-w-[58%] lg:pr-14">
          <span
            data-statement-body
            className="font-display block text-[10.5px] font-semibold uppercase tracking-[0.3em] text-enzo-sand opacity-0"
            style={{ transform: "translateY(8px)" }}
          >
            01 — Studio
          </span>

          <h1
            id="about-statement-heading"
            className="mt-6 font-title font-semibold leading-[0.95] tracking-[-0.05em] md:mt-8"
            style={{ fontSize: "clamp(2.6rem, min(7vw, 11.5svh), 6.4rem)" }}
          >
            <span className="block overflow-hidden pb-[0.08em] -mb-[0.08em]">
              <span
                data-statement-line
                className="block"
                style={{ transform: "translateY(100%)" }}
              >
                We make
              </span>
            </span>

            <span className="block overflow-hidden pb-[0.08em] -mb-[0.08em]">
              <span
                data-statement-line
                className="block"
                style={{ transform: "translateY(100%)" }}
              >
                {/* A span, not a control. See the note at the top of the file. */}
                <span
                  ref={slotRef}
                  aria-hidden="true"
                  className="relative inline-block whitespace-nowrap align-baseline leading-[0.95] text-enzo-sand"
                >
                  <span data-word className="block">
                    {word}
                  </span>
                </span>
                {/* What a screen reader gets is all four, not whichever one the
                  timer happens to be showing. */}
                <span className="sr-only">{disciplines.join(", ")}</span>
              </span>
            </span>

            <span className="block overflow-hidden pb-[0.08em] -mb-[0.08em]">
              <span
                data-statement-line
                className="block"
                style={{ transform: "translateY(100%)" }}
              >
                that fit.
              </span>
            </span>
          </h1>

          {/* Off-screen twin, purely for measurement. */}
          <span
            ref={measureRef}
            aria-hidden="true"
            className="pointer-events-none invisible absolute left-0 top-0 whitespace-nowrap font-title font-semibold leading-[0.95] tracking-[-0.05em]"
            style={{ fontSize: "clamp(2.6rem, min(7vw, 11.5svh), 6.4rem)" }}
          >
            {word}
          </span>

          <p
            data-statement-body
            className="mt-7 max-w-[44ch] text-[14.5px] leading-[1.75] text-enzo-cream/70 opacity-0 md:mt-9 md:text-[15px]"
            style={{ transform: "translateY(14px)" }}
          >
            A small Leicester workshop. We measure your room ourselves, draw it
            ourselves, build it ourselves and fit it ourselves — which is the
            only way we know of being sure it fits.
          </p>
        </div>
      </div>

      {/* Scroll cue, on the bottom edge of the screen the section owns. */}
      <span
        data-statement-body
        aria-hidden="true"
        className="absolute bottom-6 left-5 flex items-center gap-3 opacity-0 sm:left-6 md:bottom-8 md:left-12"
        style={{ transform: "translateY(14px)" }}
      >
        <span className="font-display text-[9.5px] font-semibold uppercase tracking-[0.28em] text-enzo-cream/65">
          Scroll
        </span>
        <span className="block h-px w-10 bg-enzo-cream/25" />
      </span>
    </section>
  );
}
