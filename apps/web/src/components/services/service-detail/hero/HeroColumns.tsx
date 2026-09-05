"use client";

// Detail hero — variant 2 of 4: THE COLUMNS.  (Fitted Bedrooms)
//
// Same family as the masthead, opposite geometry. Where that page runs one
// wide band under a left-set title, this one sets the title hard right, puts
// the supporting copy under it on the left, and breaks the photograph into
// three tall panels that wipe open left to right — a run of wardrobe bays,
// which is what a fitted bedroom actually is.
//
// ── How three panels stay one photograph ──
// Each panel is a window onto the *same* image: the image is laid out three
// panels wide inside every one of them and shifted left by that panel's
// index, so panel 2 shows the middle third and panel 3 the last. Close the
// hairline gaps and you would have one uncut picture. That is what stops it
// reading as three stock photos in a row.
//
// The reveal is the masthead's curtain, run three times: the mask opens
// sideways while the image inside drifts against it, staggered so the bays
// uncover in order. Each panel then carries one fact beneath it, so the
// picture grid and the specification grid share a column structure — nothing
// on this page is centred, and nothing is beside a picture.
//
// Ground: near-black, the darkest of the four.
import { useRef } from "react";
import gsap from "gsap";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { scrollTimeline, useGSAP } from "@/hooks/useGSAP";
import { DUR, EASE } from "@/lib/motion";
import type { ServiceDetail } from "@/lib/content";
import { getHeroFacts } from "./heroFacts";
import { HeroActions, HeroRule, HeroTitleLine } from "./heroParts";

/** Panels the photograph is cut into. Three reads as a run of bays; two
 *  reads as an accident and four makes each panel a letterbox slot. */
const PANELS = 3;

export function HeroColumns({
  service,
  id,
}: {
  service: ServiceDetail;
  id: string;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const facts = getHeroFacts(service).slice(0, PANELS);

  useGSAP(sectionRef, (section, reduced) => {
    const meta = gsap.utils.toArray<HTMLElement>("[data-hero-meta]", section);
    const lines = gsap.utils.toArray<HTMLElement>("[data-hero-line]", section);
    const body = gsap.utils.toArray<HTMLElement>("[data-hero-body]", section);
    const panels = gsap.utils.toArray<HTMLElement>("[data-hero-panel]", section);
    const photos = gsap.utils.toArray<HTMLElement>("[data-hero-photo]", section);
    const rule = section.querySelector<HTMLElement>("[data-hero-rule]");

    if (reduced) {
      gsap.set([...meta, ...body], { opacity: 1, y: 0 });
      gsap.set(lines, { opacity: 1, yPercent: 0, y: 0 });
      gsap.set(panels, { clipPath: "inset(0 0 0 0)" });
      gsap.set(photos, { scale: 1, xPercent: 0 });
      if (rule) gsap.set(rule, { scaleX: 1 });
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

    // The curtain, sideways and three times over. The mask opens to the
    // right; the picture inside slides in from the right to meet it, so the
    // two are always travelling against each other.
    const UNCOVER = 1.05;
    tl.fromTo(
      panels,
      { clipPath: "inset(0 100% 0 0)" },
      {
        clipPath: "inset(0 0% 0 0)",
        duration: UNCOVER,
        ease: EASE.editorial,
        stagger: 0.13,
      },
      0.4,
    )
      .fromTo(
        photos,
        { scale: 1.16, xPercent: 5 },
        {
          scale: 1,
          xPercent: 0,
          duration: UNCOVER + 0.3,
          ease: EASE.editorial,
          stagger: 0.13,
        },
        0.4,
      )
      .to(body, { opacity: 1, y: 0, duration: DUR.enter, ease: EASE.enter, stagger: 0.07 }, 0.9);

    if (photos.length) {
      scrollTimeline(
        (timeline) =>
          timeline.to(photos, {
            yPercent: -6,
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
      className="relative overflow-hidden bg-enzo-dark text-enzo-cream"
    >
      <div className="mx-auto max-w-[1500px] px-5 pb-16 pt-[7.5rem] sm:px-6 md:px-12 md:pt-[9rem]">
        <HeroRule category={service.category} tone="dark" />

        {/* Title hard right, support hard left, on one baseline. */}
        <div className="mt-8 grid gap-10 md:mt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,auto)] lg:items-end lg:gap-16">
          <div className="order-2 lg:order-1">
            <p
              data-hero-body
              className="max-w-[40ch] text-[15px] leading-[1.7] text-enzo-cream/70 opacity-0"
              style={{ transform: "translateY(14px)" }}
            >
              {service.heroDesc}
            </p>
            <div
              data-hero-body
              className="mt-8 opacity-0"
              style={{ transform: "translateY(14px)" }}
            >
              <HeroActions slug={service.slug} tone="dark" />
            </div>
          </div>

          <h1
            id="service-hero-heading"
            className="order-1 font-title font-semibold leading-[0.88] tracking-[-0.055em] lg:order-2"
            style={{ fontSize: "clamp(2.8rem, 8.5vw, 7rem)" }}
          >
            {/* Alternating sides rather than both words hard right — the
                zig-zag reads as one deliberate line rather than two
                right-ranged words stacked on each other. */}
            {service.title.split(" ").map((word, i) => (
              <HeroTitleLine key={word} className={i % 2 === 1 ? "text-right" : undefined}>
                {word}
              </HeroTitleLine>
            ))}
          </h1>
        </div>

        {/* The run of bays. Gaps are a hairline of the ground showing
            through, which is what makes three panels read as one picture
            behind a shopfront rather than three pictures. */}
        <div className="mt-12 grid grid-cols-3 gap-x-[3px] md:mt-14 md:gap-x-1">
          {Array.from({ length: PANELS }, (_, i) => (
            <div key={i}>
              <div
                data-hero-panel
                className="relative aspect-[9/16] w-full overflow-hidden bg-enzo-forest sm:aspect-[3/4] lg:aspect-[4/5]"
                style={{ clipPath: "inset(0 100% 0 0)" }}
              >
                {/* One photograph across all three: laid out PANELS-wide
                    inside each window and shifted by this panel's index. */}
                <div
                  className="absolute inset-y-0"
                  style={{ width: `${PANELS * 100}%`, left: `${-i * 100}%` }}
                >
                  <ImageWithFallback
                    src={service.image}
                    alt={i === 0 ? service.title : ""}
                    aria-hidden={i === 0 ? undefined : true}
                    data-hero-photo
                    className="h-full w-full object-cover will-change-transform"
                  />
                </div>
              </div>

              {/* One fact under each bay — the picture grid and the
                  specification grid on the same columns. */}
              {facts[i] && (
                <div
                  data-hero-body
                  className="mt-4 border-t border-enzo-cream/15 pt-4 opacity-0 md:mt-5 md:pt-5"
                  style={{ transform: "translateY(14px)" }}
                >
                  <span className="font-display block text-[9.5px] font-semibold uppercase tracking-[0.22em] text-enzo-cream/65 sm:text-[10px]">
                    {facts[i].label}
                  </span>
                  <span className="mt-2 block text-[13px] tabular-nums text-enzo-cream sm:text-[15px]">
                    {facts[i].value}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
