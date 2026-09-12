"use client";

// /about §04 — what we will not do.
//
// ── Three designs discarded here. The lesson is in why ──
// 1. Photo panels that flex-grew on hover — the landing page's "four doors"
//    mechanic, so the site's two biggest sections opened the same way.
// 2. A ledger with a hatched "void" plate on the left and a photograph on the
//    right, each revealed by its own separate clip-path. Two unrelated
//    mechanics either side of one row cannot help drifting apart: the left
//    was settled by t≈0.94 while the right had not finished until t≈1.25.
//    The left looked alive, the right looked late.
// 3. One full-bleed photograph per promise with the type printed on it — the
//    noun bottom-left, the answer in the opposite top-right corner, the
//    explanation below the frame. It solved the motion problem and created a
//    worse one: four text zones in three places, read diagonally, led by a
//    single cryptic word ("Guess") that you had to decode before the
//    sentence under it made sense.
//
// Each of those was a more interesting mechanism than the one before, and
// each was harder to read. So this version stops reaching for a mechanism.
//
// ── One promise per row, read straight down ──
// A ruled row per refusal. The heading is the whole promise as a plain
// sentence — "We will not price a room we have not measured." — because a
// sentence needs no decoding and the one-word version did. Under it, the
// explanation. Under that, the answer, in the one block of forest colour the
// section owns. A photograph sits quietly beside it, carrying no type at all.
//
// Reading order is top to bottom, once, with nothing to hunt for. The verb
// that used to be the display word is now just part of the row's label, where
// it reads as a name for the promise rather than a riddle.
//
// ── One tween per row ──
// The whole row arrives as a single fade-and-rise, with the photograph's
// scale settling on the same beat. Not two mechanics, not a stagger across
// halves — one motion, so there is nothing left that can arrive late.
import { useRef } from "react";
import gsap from "gsap";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { revealOnScroll, useGSAP } from "@/hooks/useGSAP";
import { EASE } from "@/lib/motion";
import { fill, type AboutPageContent } from "@/lib/content";

export interface AboutValue {
  /** The verb being refused — names the row: "Guess", "Subcontract", "Cut". */
  title: string;
  /** The refusal as a complete sentence. This is the row's heading. */
  promise: string;
  body: string;
  /** What happens in its place. One line, in the forest block. */
  instead: string;
  image: string;
}

export function AboutValues({
  values,
  content,
}: {
  values: AboutValue[];
  content: AboutPageContent["values"];
}) {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(sectionRef, (section, reduced) => {
    const rows = gsap.utils.toArray<HTMLElement>("[data-value-row]", section);
    if (!rows.length) return;

    if (reduced) {
      gsap.set(rows, { opacity: 1, y: 0 });
      gsap.set(section.querySelectorAll("[data-photo]"), { scale: 1 });
      return;
    }

    // One timeline per row — they are a screen apart, so a shared stagger
    // would be firing rows still well below the fold.
    const timelines = rows.map((row) =>
      revealOnScroll(
        row,
        (tl) => {
          const photo = row.querySelector<HTMLElement>("[data-photo]");
          tl.to(row, { opacity: 1, y: 0, duration: 0.8, ease: EASE.enter }, 0);
          if (photo) {
            // Same start, so the picture settles as part of the row's own
            // arrival rather than as a second event after it.
            tl.fromTo(
              photo,
              { scale: 1.07 },
              { scale: 1, duration: 1.2, ease: EASE.editorial },
              0,
            );
          }
        },
        { start: "top 80%" },
      ),
    );

    return () => {
      for (const tl of timelines) tl.kill();
    };
  });

  if (!values.length) return null;

  return (
    <section
      ref={sectionRef}
      id="about-values"
      aria-labelledby="about-values-heading"
      className="relative overflow-hidden bg-background text-primary scroll-mt-24"
    >
      <div className="shell py-20 md:py-28">
        <h2 id="about-values-heading" className="sr-only">
          {content.srHeading}
        </h2>

        <SectionIntro
          layout="split"
          index={content.index}
          label={content.label}
          datum={fill(content.datum, { count: values.length })}
          lines={content.lines}
          lede={content.lede}
        />

        <ol className="mt-12 md:mt-16">
          {values.map((value, index) => (
            <li
              key={value.title}
              data-value-row
              className="border-t border-[rgba(16,46,45,0.16)] py-10 opacity-0 md:py-14 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-x-14"
              style={{ transform: "translateY(20px)" }}
            >
              {/* ── The promise, read straight down ── */}
              <div>
                <p className="font-display flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-enzo-forest/80">
                  <span className="tabular-nums">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span aria-hidden="true" className="block h-px w-6 bg-enzo-forest/25" />
                  {value.title}
                </p>

                <h3
                  className="mt-5 max-w-[24ch] font-title font-semibold leading-[1.08] tracking-[-0.035em] text-enzo-forest"
                  style={{ fontSize: "clamp(1.5rem, 2.9vw, 2.35rem)" }}
                >
                  {value.promise}
                </h3>

                <p className="mt-5 max-w-[58ch] text-[15px] leading-[1.8] text-foreground/80">
                  {value.body}
                </p>

                {/* ── The answer ──
                    The section's one block of colour, landing three times in
                    the same place down the page. */}
                <div className="mt-7 max-w-[46ch] bg-enzo-forest px-5 py-4">
                  <span className="font-display block text-[9.5px] font-semibold uppercase tracking-[0.28em] text-enzo-sand">
                    {content.insteadLabel}
                  </span>
                  <p className="mt-1.5 font-title text-[15px] font-semibold leading-[1.35] text-enzo-cream md:text-[16px]">
                    {value.instead}
                  </p>
                </div>
              </div>

              {/* A photograph, carrying no type. It is here to show the work,
                  not to be read.

                  From lg it fills the row's own height rather than declaring
                  one of its own: a fixed portrait aspect here was 150px
                  taller than the text beside it, which left a band of empty
                  cream under the copy. Stretching means the text always sets
                  the row height and the gap cannot come back if the copy
                  changes length. */}
              <div className="mt-8 lg:mt-0">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[3px] bg-enzo-forest/10 lg:aspect-auto lg:h-full lg:min-h-[19rem]">
                  <ImageWithFallback
                    src={value.image}
                    alt=""
                    aria-hidden="true"
                    data-photo
                    className="absolute inset-0 h-full w-full object-cover will-change-transform"
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
