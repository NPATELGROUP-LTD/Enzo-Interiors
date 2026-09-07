"use client";

// Detail hero — variant 3 of 4: THE APERTURE.  (Media Walls)
//
// ── Second composition, same mechanism ──
// The first one centred everything: title on the axis, one 21:9 plate under
// it, four facts in a strip, two buttons in the middle. It was tidy and it
// was a poster — a stack of centred blocks with a lot of empty forest either
// side of a 5-word headline, and the photograph arrived a third of the way
// down the page after two paragraphs of nothing.
//
// It is now built the way the product is: the screen is the object and
// everything else is set against it. The title holds the left third at the
// plate's own vertical centre, so the two share one band of the page instead
// of queueing down it — and the plate can be much larger, because it is no
// longer waiting for a headline to finish above it. The type deliberately
// stops short of the frame rather than crossing it: a media wall photograph
// is a picture of a lit room, and a word laid over the bright half of one is
// a word nobody can read, whatever shadow you put behind it.
//
// The last word of the title takes sand while the rest stays cream — the
// same two-tone headline the landing hero uses, which is the one piece of
// type on this site people remember.
//
// ── The reveal: panels, not an aperture ──
// This used to switch on like a screen — a hairline of light struck across
// the middle, widened to a slit, then opened vertically into a 21:9
// letterbox. It was a good idea about the wrong noun. What is being sold is
// not a television; it is the wall the television is set into, and a cinema
// letterbox opening said "film" so loudly that the joinery underneath it read
// as the packaging. It also fought the composition it now sits in: an
// aperture wants to be centred and symmetrical, and this hero is neither.
//
// A media wall is panels. So the photograph arrives behind a run of them: the
// plate starts covered by SHUTTERS full-height slats in the section's own
// forest, and they lift off one at a time from the left, each slightly
// overlapping the last, until the room behind is uncovered. The picture eases
// out of a small over-scale across the whole run, so it is still settling as
// the last slat clears.
//
// Three things that makes it worth the swap. It is the product's own
// geometry, so it needs no explanation. It is the same idea §A2 opens with
// one section later — a wall read as its layers — so the page argues one
// thing twice instead of two things once. And a vertical slat lifting off a
// photograph is a mechanic no other hero in the set uses: the kitchen page
// wipes a curtain down, the bedroom page runs three side wipes, the wardrobe
// page slides two doors apart.
//
// Ground: forest — the deepest of the four, because a screen wants a dark
// room around it.
import { useRef } from "react";
import gsap from "gsap";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { scrollTimeline, useGSAP } from "@/hooks/useGSAP";
import { DUR, EASE } from "@/lib/motion";
import type { ServiceDetail } from "@/lib/content";
import { getHeroFacts } from "./heroFacts";
import { heroCommonParts, heroRestMotion, HeroActions, HeroRule, HeroTitleLine } from "./heroParts";

/**
 * How many slats the plate is covered by. Five reads as a run of panels; any
 * fewer reads as a wipe, any more as a loading bar.
 */
const SHUTTERS = 5;

export function HeroAperture({
  service,
  id,
}: {
  service: ServiceDetail;
  id: string;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const facts = getHeroFacts(service);

  // The last word takes the accent. Splitting on the last space rather than
  // on a fixed index means "Media Walls", "Walls" and "Home Cinema Walls"
  // all colour correctly — the client authors these titles.
  const words = service.title.trim().split(/\s+/);
  const accentIndex = words.length - 1;

  useGSAP(sectionRef, (section, reduced) => {
    const parts = heroCommonParts(section);
    const { meta, lines, body, rule } = parts;
    const photo = section.querySelector<HTMLElement>("[data-hero-photo]");
    const shutters = gsap.utils.toArray<HTMLElement>("[data-hero-shutter]", section);
    const seams = gsap.utils.toArray<HTMLElement>("[data-hero-seam]", section);

    if (reduced) {
      heroRestMotion(parts);
      // The panels are simply already off, rather than animating off.
      gsap.set(shutters, { yPercent: -100 });
      gsap.set(seams, { opacity: 0 });
      if (photo) gsap.set(photo, { scale: 1 });
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

    // ── The panels lifting ──
    // Each slat travels its own full height upward, so it clears the plate
    // entirely rather than shrinking away in place. `stagger` from the left
    // with a negative overlap in the ease makes the run read as one gesture
    // rather than five separate ones.
    tl.fromTo(
      shutters,
      { yPercent: 0 },
      {
        yPercent: -100,
        duration: 0.95,
        ease: "power3.inOut",
        stagger: 0.085,
      },
      0.35,
    )
      // The joint between two slats catches a line of light as it goes —
      // the one flourish, and it is what stops five rectangles reading as a
      // loading screen.
      .fromTo(
        seams,
        { opacity: 0.9 },
        { opacity: 0, duration: 0.5, ease: EASE.exit, stagger: 0.085 },
        0.55,
      )
      .fromTo(
        photo,
        { scale: 1.14 },
        { scale: 1, duration: 1.9, ease: EASE.editorial },
        0.35,
      )
      .to(body, { opacity: 1, y: 0, duration: DUR.enter, ease: EASE.enter, stagger: 0.07 }, 1.2);

    if (photo) {
      scrollTimeline(
        (timeline) =>
          timeline.to(photo, {
            yPercent: 7,
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
      className="relative overflow-hidden bg-enzo-forest text-enzo-cream"
    >
      <div className="shell pb-16 pt-[7.5rem] md:pb-20 md:pt-[9rem]">
        <HeroRule category={service.category} tone="dark" />

        {/* ── The plate, and the title beside it ──
            One relative box from `lg` up: the aperture is inset by a third
            so the headline has a column of its own to sit in, centred on the
            picture rather than stacked above it. Below `lg` the two un-stack
            into title-then-picture, because at phone width there is no left
            third to hold anything. */}
        <div className="relative mt-10 md:mt-14 lg:mt-16">
          <div className="lg:pl-[34%]">
            <div className="relative">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[6px] bg-enzo-dark sm:aspect-[16/9] lg:aspect-[5/4] xl:aspect-[16/11]">
                <ImageWithFallback
                  src={service.image}
                  alt={service.title}
                  className="absolute inset-0 h-full w-full object-cover will-change-transform"
                  data-hero-photo
                />

                {/* ── The panels ──
                    Sized in percentages off SHUTTERS so the run always covers
                    the plate exactly, whatever the count. Each is its own
                    element rather than one clipped mask because they have to
                    leave at different times, and a clip-path cannot stagger.
                    `pointer-events-none` throughout: once they are off screen
                    they are still in the DOM, above the picture. */}
                <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                  {Array.from({ length: SHUTTERS }, (_, index) => (
                    <span
                      key={index}
                      data-hero-shutter
                      className="absolute top-0 block h-full bg-enzo-forest will-change-transform"
                      style={{
                        left: `${(index / SHUTTERS) * 100}%`,
                        // A hair over its share, so sub-pixel rounding can
                        // never leave a bright seam of photograph showing
                        // between two panels at rest.
                        width: `calc(${100 / SHUTTERS}% + 1px)`,
                      }}
                    >
                      <span
                        data-hero-seam
                        className="absolute bottom-0 right-0 block h-full w-px bg-enzo-sand"
                      />
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* The headline. Absolutely placed from `lg` so it can centre
              itself on the plate whatever height the plate resolves to; in
              normal flow below that. The soft shadow is not for legibility
              over the picture (it does not reach it) — it is what stops
              cream type dissolving into a forest ground at 7rem, where the
              stroke is wide enough for the two colours to start averaging. */}
          <h1
            id="service-hero-heading"
            className="mt-8 font-title font-semibold leading-[0.86] tracking-[-0.05em] lg:absolute lg:left-0 lg:top-1/2 lg:z-10 lg:mt-0 lg:max-w-[9ch] lg:-translate-y-1/2"
            style={{
              fontSize: "clamp(2.9rem, 8.5vw, 7rem)",
              textShadow: "0 2px 40px rgba(16,26,22,0.55)",
            }}
          >
            {words.map((word, index) => (
              <HeroTitleLine
                key={`${word}-${index}`}
                className={index === accentIndex ? "text-enzo-sand" : undefined}
              >
                {word}
              </HeroTitleLine>
            ))}
          </h1>
        </div>

        {/* ── Under the plate ──
            The line, the actions and the specification on one row: statement
            left, numbers right. The facts used to be a four-across strip of
            bordered cells the full width of the page, which is a table
            pretending to be a hero. As a two-column ruled list against the
            right edge they read as the plate's spec sheet, and they leave
            the left half for the sentence and the buttons. */}
        <div className="mt-10 grid gap-10 md:mt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-16">
          <div>
            <p
              data-hero-body
              className="max-w-[46ch] text-[16px] leading-[1.65] text-enzo-cream/75 opacity-0 md:text-[17px]"
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

          <dl
            data-hero-body
            className="opacity-0"
            style={{ transform: "translateY(14px)" }}
          >
            {facts.map((fact) => (
              <div
                key={fact.label}
                className="flex items-baseline justify-between gap-6 border-t border-enzo-cream/15 py-3.5 last:border-b"
              >
                <dt className="font-display text-[10px] font-semibold uppercase tracking-[0.24em] text-enzo-cream/65">
                  {fact.label}
                </dt>
                <dd className="text-right text-[14.5px] tabular-nums text-enzo-cream">
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
