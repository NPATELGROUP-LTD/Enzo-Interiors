"use client";

// Detail hero — variant 3 of 4: THE PLAN, CENTRED.
//
// The only symmetrical hero, the only one on forest green, and the only one
// with no photograph on it at all — the sole image is the one clipped
// inside the plan drawing's own footprint (RoomPlanDrawing).
//
// It was previously type-left / drawing-right, which made it the third
// hero in a row with the same axis. Centring it and moving it off the
// near-black ground is what actually separates it: axis, ground and
// subject all differ from the other three now, not just the geometry.
//
// The drawing is the widest element and everything else is narrower and
// centred on it, so the fold reads as a single object with captions rather
// than as two columns.
import { useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { useGSAP } from "@/hooks/useGSAP";
import { DUR, EASE } from "@/lib/motion";
import type { ServiceDetail } from "@/lib/content";
import { RoomPlanDrawing } from "../../shared/RoomPlanDrawing";
import { QuoteTriggerButton } from "../../shared/QuoteRequestModal";
import { getHeroFacts, titleLines } from "./heroFacts";

export function HeroPlanCentre({
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
    const stage = section.querySelector<HTMLElement>("[data-hero-stage]");

    if (reduced) {
      gsap.set([...meta, ...body, stage].filter(Boolean), { opacity: 1, y: 0 });
      gsap.set(lines, { yPercent: 0 });
      return;
    }

    gsap.set(lines, { yPercent: 100, y: 0 });

    const tl = gsap.timeline({ delay: 0.12 });

    tl.to(meta, { opacity: 1, y: 0, duration: DUR.enter, ease: EASE.enter, stagger: 0.05 })
      .to(
        lines,
        { yPercent: 0, duration: DUR.editorial, ease: EASE.editorial, stagger: 0.09 },
        0.06,
      )
      // Rises rather than sliding in from an edge: a symmetrical fold
      // should not have a direction.
      .to(stage, { opacity: 1, y: 0, duration: 1.05, ease: EASE.editorial }, 0.28)
      .to(body, { opacity: 1, y: 0, duration: DUR.enter, ease: EASE.enter, stagger: 0.08 }, 0.55);

    return () => {
      tl.kill();
    };
  });

  return (
    <section
      ref={sectionRef}
      id={id}
      aria-labelledby="service-hero-heading"
      className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden bg-enzo-forest text-enzo-cream"
    >
      <div className="mx-auto w-full max-w-[1500px] px-5 pb-12 pt-[7.5rem] text-center sm:px-6 md:px-12 md:pt-[8.5rem]">
        <p
          data-hero-meta
          className="font-display text-[10.5px] font-semibold uppercase tracking-[0.3em] text-enzo-sand opacity-0"
          style={{ transform: "translateY(8px)" }}
        >
          {service.category}
        </p>

        <h1
          id="service-hero-heading"
          className="mx-auto mt-5 max-w-[18ch] font-title font-semibold leading-[0.94] tracking-[-0.05em]"
          style={{ fontSize: "clamp(2.3rem, 5.2vw, 4.4rem)" }}
        >
          {titleLines(service.title).map((line) => (
            <span key={line} className="block overflow-hidden pb-[0.07em] -mb-[0.07em]">
              <span data-hero-line className="block" style={{ transform: "translateY(100%)" }}>
                {line}
              </span>
            </span>
          ))}
        </h1>

        <p
          data-hero-meta
          className="mx-auto mt-4 max-w-[46ch] text-[15px] leading-[1.7] text-enzo-cream/60 opacity-0"
          style={{ transform: "translateY(8px)" }}
        >
          {service.heroDesc}
        </p>

        {/* The drawing — the widest thing on the fold.
            Sized from its HEIGHT, not its width. At `max-w-3xl` the 4:3 box
            resolved to ~576px tall and pushed the facts and buttons off the
            bottom of a 900px viewport; deriving the width from a vh height
            keeps the whole fold inside one screen at any window size. */}
        <div
          data-hero-stage
          className="mt-6 flex w-full justify-center opacity-0"
          style={{ transform: "translateY(26px)" }}
        >
          {/* A flex item, not a block. `width: auto` on a block-level box
              fills its parent, so aspect-ratio then derives the *height*
              from that full width — which is how this box ended up 992px
              tall and pushed the buttons a screen and a half down. As a
              flex item it shrink-wraps, so the aspect ratio derives the
              width from the height instead, and the height is what is
              actually constrained. */}
          <div
            className="relative aspect-[4/3] max-w-full"
            style={{ height: "clamp(11rem, 33vh, 21rem)" }}
          >
            <RoomPlanDrawing
              slug={service.slug}
              image={service.image}
              caption={service.category}
              // The chimney-breast footprint — the shape this discipline is
              // most often fitted around.
              pattern={2}
              className="absolute inset-0"
            />
          </div>
        </div>

        {/* Facts on one centred rule, then the actions. */}
        <dl
          data-hero-body
          className="mx-auto mt-7 flex max-w-3xl flex-wrap items-center justify-center gap-x-8 gap-y-3 border-t border-enzo-cream/12 pt-5 opacity-0"
          style={{ transform: "translateY(14px)" }}
        >
          {facts.map((fact) => (
            <div key={fact.label} className="flex items-baseline gap-2.5">
              <dt className="text-[10.5px] uppercase tracking-[0.22em] text-enzo-cream/40">
                {fact.label}
              </dt>
              <dd className="text-[13.5px] tabular-nums text-enzo-cream/85">{fact.value}</dd>
            </div>
          ))}
        </dl>

        <div
          data-hero-body
          className="mt-7 flex flex-wrap items-center justify-center gap-3 opacity-0"
          style={{ transform: "translateY(14px)" }}
        >
          <QuoteTriggerButton className="rounded-full bg-enzo-cream px-7 py-3.5 text-[14px] font-medium text-enzo-forest transition-colors duration-300 hover:bg-enzo-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-2 focus-visible:ring-offset-enzo-forest">
            Get a free quote
          </QuoteTriggerButton>
          <Link
            href={`/booking?service=${service.slug}`}
            className="rounded-full border border-enzo-cream/25 px-7 py-3.5 text-[14px] text-enzo-cream transition-colors duration-300 hover:border-enzo-sand hover:text-enzo-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-2 focus-visible:ring-offset-enzo-forest"
          >
            Book a consultation
          </Link>
        </div>
      </div>
    </section>
  );
}
