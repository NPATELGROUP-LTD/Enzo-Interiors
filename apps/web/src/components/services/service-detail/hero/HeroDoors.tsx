"use client";

// Detail hero — variant 4 of 4: THE DOORS.  (Fitted Wardrobes)
//
// The one hero that inverts the whole set's reading order. The other three
// name the service and then show it; this one opens on the picture, full
// bleed and hard against the top of the page, and sets the masthead
// underneath it. You arrive inside the room and are told what it is
// afterwards.
//
// ── The reveal ──
// Every other page uncovers its photograph with a clip-path. This one puts
// two solid panels over the picture and slides them apart, because that is
// what a fitted wardrobe does: the doors are the product, so the product is
// the mechanism. They carry a hairline edge and a sand handle each, so for
// the half-second before they move the fold genuinely reads as a closed
// run of wardrobes rather than as an image with two rectangles on it.
//
// Panels move on `xPercent`, not on width or clip — a transform is composited
// off the main thread, and a 50%-of-viewport panel animating its width would
// relayout the whole fold every frame.
//
// Ground: warm grey, the fourth distinct ground in the set.
import { useRef } from "react";
import gsap from "gsap";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { scrollTimeline, useGSAP } from "@/hooks/useGSAP";
import { DUR, EASE } from "@/lib/motion";
import type { ServiceDetail } from "@/lib/content";
import { getHeroFacts } from "./heroFacts";
import { HeroActions, HeroFacts, HeroRule, HeroTitleLine } from "./heroParts";

export function HeroDoors({
  service,
  id,
}: {
  service: ServiceDetail;
  id: string;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const facts = getHeroFacts(service);

  useGSAP(sectionRef, (section, reduced) => {
    const meta = gsap.utils.toArray<HTMLElement>("[data-hero-meta]", section);
    const lines = gsap.utils.toArray<HTMLElement>("[data-hero-line]", section);
    const body = gsap.utils.toArray<HTMLElement>("[data-hero-body]", section);
    const left = section.querySelector<HTMLElement>("[data-hero-door='left']");
    const right = section.querySelector<HTMLElement>("[data-hero-door='right']");
    const photo = section.querySelector<HTMLElement>("[data-hero-photo]");
    const rule = section.querySelector<HTMLElement>("[data-hero-rule]");

    if (reduced) {
      gsap.set([...meta, ...body], { opacity: 1, y: 0 });
      gsap.set(lines, { opacity: 1, yPercent: 0, y: 0 });
      // Doors simply are not there — an instant jump of two full-width
      // panels is exactly the motion someone asking for less of it wants
      // least. `autoAlpha` rather than `opacity` so they are taken out of
      // hit-testing too, not left as two invisible sheets over the picture.
      gsap.set([left, right].filter(Boolean), { autoAlpha: 0 });
      if (photo) gsap.set(photo, { scale: 1 });
      if (rule) gsap.set(rule, { scaleX: 1 });
      return;
    }

    gsap.set(lines, { yPercent: 100, y: 0 });

    const tl = gsap.timeline({ delay: 0.25 });

    // A beat of stillness first: the doors have to be *seen* shut for the
    // opening to mean anything.
    const OPEN = 1.35;
    tl.to(left, { xPercent: -100, duration: OPEN, ease: EASE.editorial }, 0.25)
      .to(right, { xPercent: 100, duration: OPEN, ease: EASE.editorial }, 0.25)
      // The room settles out of its over-scale as the doors clear it, so
      // the picture is still moving after the panels have gone.
      .fromTo(
        photo,
        { scale: 1.2 },
        { scale: 1, duration: OPEN + 0.5, ease: EASE.editorial },
        0.25,
      )
      .to(meta, { opacity: 1, y: 0, duration: DUR.enter, ease: EASE.enter, stagger: 0.05 }, 0.95)
      .to(rule, { scaleX: 1, duration: 0.9, ease: EASE.editorial }, 1)
      .to(
        lines,
        { yPercent: 0, opacity: 1, duration: DUR.editorial, ease: EASE.editorial, stagger: 0.085 },
        1.05,
      )
      .to(body, { opacity: 1, y: 0, duration: DUR.enter, ease: EASE.enter, stagger: 0.07 }, 1.35);

    if (photo) {
      scrollTimeline(
        (timeline) =>
          timeline.to(photo, {
            yPercent: 8,
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
      className="relative overflow-hidden bg-muted text-primary"
    >
      {/* ── The run, hard against the top of the page ── */}
      <div className="relative h-[58svh] min-h-[22rem] w-full overflow-hidden bg-enzo-forest md:h-[64svh]">
        <ImageWithFallback
          src={service.image}
          alt={service.title}
          data-hero-photo
          className="absolute inset-0 h-full w-full object-cover will-change-transform"
        />

        {/* The two doors. `left-0`/`right-0` with 50% width and a hairline
            of overlap, so no seam of photograph shows between them before
            they move. */}
        <div
          data-hero-door="left"
          aria-hidden="true"
          className="absolute inset-y-0 left-0 z-10 w-[50.5%] bg-enzo-forest will-change-transform"
        >
          <span className="absolute inset-y-0 right-0 w-px bg-enzo-sand/30" />
          {/* Handle, set in from the meeting edge the way a real one is. */}
          <span className="absolute right-6 top-1/2 h-24 w-[3px] -translate-y-1/2 rounded-full bg-enzo-sand/70 md:right-9 md:h-32" />
        </div>
        <div
          data-hero-door="right"
          aria-hidden="true"
          className="absolute inset-y-0 right-0 z-10 w-[50.5%] bg-enzo-forest will-change-transform"
        >
          <span className="absolute inset-y-0 left-0 w-px bg-enzo-sand/30" />
          <span className="absolute left-6 top-1/2 h-24 w-[3px] -translate-y-1/2 rounded-full bg-enzo-sand/70 md:left-9 md:h-32" />
        </div>
      </div>

      {/* ── The masthead, underneath ── */}
      <div className="shell pb-16 pt-10 md:pb-20 md:pt-14">
        <HeroRule category={service.category} tone="light" />

        {/* The title took a `1fr` column and the lede a 30rem one, so a
            two-word masthead sat beside a single line of type and about
            500px of nothing. The lede and the actions now stack in a column
            sized to them, and the title takes the room it needs — at 1920 it
            was also running past the bottom of the fold, which the smaller
            clamp below fixes. */}
        <div className="mt-8 grid gap-10 md:mt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,23rem)] lg:items-end lg:gap-14">
          <h1
            id="service-hero-heading"
            className="font-title font-semibold leading-[0.88] tracking-[-0.055em]"
            style={{ fontSize: "clamp(2.8rem, 7.5vw, 6rem)" }}
          >
            {service.title.split(" ").map((word) => (
              <HeroTitleLine key={word}>{word}</HeroTitleLine>
            ))}
          </h1>

          <div className="lg:pb-2">
            <p
              data-hero-body
              className="max-w-[40ch] text-[15px] leading-[1.7] text-muted-foreground opacity-0 lg:text-right"
              style={{ transform: "translateY(14px)" }}
            >
              {service.heroDesc}
            </p>
            <div
              data-hero-body
              className="mt-7 opacity-0"
              style={{ transform: "translateY(14px)" }}
            >
              <HeroActions slug={service.slug} tone="light" className="lg:justify-end" />
            </div>
          </div>
        </div>

        {/* Facts as one ruled row across the sheet. */}
        <div
          data-hero-body
          className="mt-12 border-t border-border/70 pt-8 opacity-0"
          style={{ transform: "translateY(14px)" }}
        >
          <HeroFacts
            facts={facts}
            tone="light"
            className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4"
          />
        </div>
      </div>
    </section>
  );
}
