"use client";

// Detail hero — variant 1 of 4: THE MASTHEAD.  (Bespoke Kitchens)
//
// This is the design the other three are now written against: an oversized
// masthead, one word per line, with a single wide band of the room
// unrolling beneath it and bleeding past the type to the sheet edges.
//
// ── What changed in this pass, and why ──
// The reveal was one clip-path wipe with the photograph scaling down inside
// it. Fine, but the mask and the picture were travelling the same way, so it
// read as a picture appearing rather than as something being uncovered.
//
//   · the band now bleeds past the type column to the sheet edges, so the
//     picture is measurably wider than the words that introduce it
//   · the wipe and the photograph move *against* each other — the mask opens
//     downward while the image drifts up into it and settles out of its
//     over-scale. Counter-motion is the whole difference between "a picture
//     faded in" and "a curtain came off it"
//   · a sand hairline rides the opening edge of the wipe, so the reveal has
//     a leading edge you can actually see
//   · the caption plate on the band arrives after the wipe has passed it
//   · the words no longer run the full width. Two short words at 12.5vw
//     left the entire right half of the fold empty, which is a hole rather
//     than negative space; the lede, the facts and the actions moved up out
//     of a footer to fill it, on the title's own last baseline
//
// The other three heroes each take one of these ideas and rebuild it around
// their own geometry: three vertical panels wiping in sequence (Bedrooms),
// an aperture opening from a slit (Media Walls), two doors sliding apart
// (Wardrobes). Same family, four different mechanisms.
import { useRef } from "react";
import gsap from "gsap";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { scrollTimeline, useGSAP } from "@/hooks/useGSAP";
import { DUR, EASE } from "@/lib/motion";
import type { ServiceDetail } from "@/lib/content";
import { getHeroFacts } from "./heroFacts";
import { heroCommonParts, heroRestMotion, HeroActions, HeroFacts, HeroRule, HeroTitleLine } from "./heroParts";

export function HeroMasthead({
  service,
  id,
}: {
  service: ServiceDetail;
  id: string;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const facts = getHeroFacts(service);

  useGSAP(sectionRef, (section, reduced) => {
    const parts = heroCommonParts(section);
    const { meta, lines, body, rule } = parts;
    const band = section.querySelector<HTMLElement>("[data-hero-band]");
    const photo = section.querySelector<HTMLElement>("[data-hero-photo]");
    const edge = section.querySelector<HTMLElement>("[data-hero-edge]");

    if (reduced) {
      heroRestMotion(parts);
      if (band) gsap.set(band, { clipPath: "inset(0 0 0 0)" });
      if (photo) gsap.set(photo, { scale: 1, yPercent: 0 });
      if (edge) gsap.set(edge, { opacity: 0 });
      return;
    }

    gsap.set(lines, { yPercent: 100, y: 0 });

    const tl = gsap.timeline({ delay: 0.12 });

    tl.to(meta, { opacity: 1, y: 0, duration: DUR.enter, ease: EASE.enter, stagger: 0.05 })
      .to(rule, { scaleX: 1, duration: 0.9, ease: EASE.editorial }, 0.05)
      .to(
        lines,
        { yPercent: 0, opacity: 1, duration: DUR.editorial, ease: EASE.editorial, stagger: 0.085 },
        0.1,
      );

    // ── The curtain ──
    // Mask down, picture up. One `duration` for both so the photograph is
    // travelling for exactly as long as the edge that uncovers it.
    const UNCOVER = 1.25;
    tl.fromTo(
      band,
      { clipPath: "inset(0 0 100% 0)" },
      { clipPath: "inset(0 0 0% 0)", duration: UNCOVER, ease: EASE.editorial },
      0.42,
    )
      .fromTo(
        photo,
        { scale: 1.22, yPercent: 7 },
        { scale: 1, yPercent: 0, duration: UNCOVER + 0.35, ease: EASE.editorial },
        0.42,
      )
      // The leading edge rides down with the mask, then goes out. `top` in
      // percent tracks the same line the clip is on.
      .fromTo(
        edge,
        { top: "0%", opacity: 1 },
        { top: "100%", duration: UNCOVER, ease: EASE.editorial },
        0.42,
      )
      .to(edge, { opacity: 0, duration: 0.3, ease: EASE.exit }, 0.42 + UNCOVER - 0.1)
      .to(body, { opacity: 1, y: 0, duration: DUR.enter, ease: EASE.enter, stagger: 0.07 }, 0.95);

    if (photo) {
      scrollTimeline(
        (timeline) =>
          timeline.to(photo, {
            yPercent: 9,
            ease: EASE.linear,
          }),
        {
          trigger: section,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      );
    }

    return () => {
      tl.kill();
    };
  });

  return (
    <section
      ref={sectionRef}
      id={id}
      aria-labelledby="service-hero-heading"
      className="relative overflow-hidden bg-background text-primary"
    >
      <div className="shell pb-16 pt-[7.5rem] md:pt-[9rem]">
        <HeroRule category={service.category} tone="light" />

        {/* ── The masthead, and the column that pays for it ──
            The title used to run the full width with one word per line,
            which left the entire right half of the fold empty beside two
            short words — a hole, not negative space. The words now take the
            column they actually need and everything that used to sit in a
            three-column footer under the band moves up beside them, set on
            the title's own last baseline. Same masthead, no hole, and the
            band below gets to be the last thing on the fold. */}
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-end lg:gap-14 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
          <h1
            id="service-hero-heading"
            className="font-title font-semibold leading-[0.86] tracking-[-0.06em]"
            style={{ fontSize: "clamp(3rem, 10vw, 8.5rem)" }}
          >
            {/* Two words, two rows, alternating sides — the second line
                sets against the right edge of the title's own column
                rather than stacking flush under the first. */}
            {service.title.split(" ").map((word, i) => (
              <HeroTitleLine key={word} className={i % 2 === 1 ? "text-right" : undefined}>
                {word}
              </HeroTitleLine>
            ))}
          </h1>

          <div className="lg:pb-3">
            <p
              data-hero-body
              className="max-w-[42ch] text-[15px] leading-[1.7] text-muted-foreground opacity-0 lg:text-right"
              style={{ transform: "translateY(14px)" }}
            >
              {service.heroDesc}
            </p>

            <div
              data-hero-body
              className="mt-8 border-t border-border/70 pt-6 opacity-0"
              style={{ transform: "translateY(14px)" }}
            >
              <HeroFacts
                facts={facts}
                tone="light"
                className="grid grid-cols-2 gap-x-6 gap-y-5"
              />
            </div>

            <div
              data-hero-body
              className="mt-7 opacity-0"
              style={{ transform: "translateY(14px)" }}
            >
              <HeroActions slug={service.slug} tone="light" />
            </div>
          </div>
        </div>

        {/* One band, bled past the type column to the sheet's own edges.
            Negative margins rather than `w-screen`: this stops at the
            1500px sheet on a wide monitor instead of stretching a 21:8
            photograph across a 2560px desktop, and it cannot produce the
            horizontal scrollbar `100vw` does once a scrollbar exists. */}
        <div
          data-hero-band
          className="relative mt-12 aspect-[16/9] w-auto overflow-hidden bg-enzo-forest -mx-5 sm:-mx-6 sm:aspect-[21/8] md:-mx-12 md:mt-14"
          style={{ clipPath: "inset(0 0 100% 0)" }}
        >
          <ImageWithFallback
            src={service.image}
            alt={service.title}
            data-hero-photo
            className="absolute inset-0 h-full w-full object-cover will-change-transform"
          />

          {/* The leading edge of the wipe. */}
          <span
            data-hero-edge
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 z-10 h-px bg-enzo-sand"
            style={{ top: "0%", opacity: 0 }}
          />

          {/* Caption plate, bottom-left on the picture. */}
          <span
            data-hero-body
            className="absolute bottom-0 left-0 z-10 flex items-baseline gap-3 bg-background px-5 pr-6 pt-3 opacity-0 sm:px-6 md:px-12 md:pt-4"
            style={{ transform: "translateY(14px)" }}
          >
            <span className="font-display text-[10px] font-semibold uppercase tracking-[0.26em] text-enzo-forest-light">
              Fig. 01
            </span>
            <span className="text-[12px] text-muted-foreground">
              {service.category} — Leicester
            </span>
          </span>
        </div>

      </div>
    </section>
  );
}
