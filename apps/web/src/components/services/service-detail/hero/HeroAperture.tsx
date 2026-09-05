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
// ── The mechanism is unchanged, because it was the good part ──
// A media wall is a screen in a room, so the picture arrives the way a
// screen does: a hairline of light strikes across the middle of the frame,
// widens to the full width, and then opens vertically into a cinema-format
// aperture. Three clip-path stages on one element —
//
//     inset(50% 50% 50% 50%)   nothing, a point at the centre
//   → inset(50%  0%  50%  0%)  a slit, full width, no height
//   → inset( 0%  0%   0%  0%)  the whole frame
//
// — with the photograph easing out of its over-scale across all three, so
// the image is already settling by the time there is enough of it to see.
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
import { HeroActions, HeroRule, HeroTitleLine } from "./heroParts";

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
    const meta = gsap.utils.toArray<HTMLElement>("[data-hero-meta]", section);
    const lines = gsap.utils.toArray<HTMLElement>("[data-hero-line]", section);
    const body = gsap.utils.toArray<HTMLElement>("[data-hero-body]", section);
    const aperture = section.querySelector<HTMLElement>("[data-hero-aperture]");
    const photo = section.querySelector<HTMLElement>("[data-hero-photo]");
    const strike = section.querySelector<HTMLElement>("[data-hero-strike]");
    const rule = section.querySelector<HTMLElement>("[data-hero-rule]");

    if (reduced) {
      gsap.set([...meta, ...body], { opacity: 1, y: 0 });
      gsap.set(lines, { opacity: 1, yPercent: 0, y: 0 });
      if (aperture) gsap.set(aperture, { clipPath: "inset(0% 0% 0% 0%)" });
      if (photo) gsap.set(photo, { scale: 1 });
      if (strike) gsap.set(strike, { opacity: 0 });
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

    // ── Switching on ──
    // The strike is a real element rather than part of the clip, because a
    // clip cannot glow. It scales out along the centre line under the
    // widening slit and goes out as the frame opens.
    tl.set(aperture, { clipPath: "inset(50% 50% 50% 50%)" }, 0.4)
      .fromTo(
        strike,
        { scaleX: 0, opacity: 1 },
        { scaleX: 1, duration: 0.55, ease: "power3.out" },
        0.4,
      )
      .to(
        aperture,
        { clipPath: "inset(50% 0% 50% 0%)", duration: 0.55, ease: "power3.out" },
        0.4,
      )
      .to(
        aperture,
        { clipPath: "inset(0% 0% 0% 0%)", duration: 0.95, ease: EASE.editorial },
        0.98,
      )
      .to(strike, { opacity: 0, duration: 0.45, ease: EASE.exit }, 0.98)
      .fromTo(
        photo,
        { scale: 1.24 },
        { scale: 1, duration: 1.7, ease: EASE.editorial },
        0.4,
      )
      .to(body, { opacity: 1, y: 0, duration: DUR.enter, ease: EASE.enter, stagger: 0.07 }, 1.35);

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
      <div className="mx-auto max-w-[1500px] px-5 pb-16 pt-[7.5rem] sm:px-6 md:px-12 md:pb-20 md:pt-[9rem]">
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
              <div
                data-hero-aperture
                className="relative aspect-[4/3] w-full overflow-hidden rounded-[6px] bg-enzo-dark sm:aspect-[16/9] lg:aspect-[5/4] xl:aspect-[16/11]"
                style={{ clipPath: "inset(50% 50% 50% 50%)" }}
              >
                <ImageWithFallback
                  src={service.image}
                  alt={service.title}
                  className="absolute inset-0 h-full w-full object-cover will-change-transform"
                  data-hero-photo
                />
              </div>

              {/* The strike of light along the centre line. Outside the
                  clipped element so it is not clipped away with it. */}
              <span
                data-hero-strike
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-enzo-sand"
                style={{ transform: "translateY(-50%) scaleX(0)", opacity: 0 }}
              />
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
