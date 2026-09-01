"use client";

// Detail hero — variant 3 of 4: THE DRAWING.
//
// No photograph on the fold at all — or rather, the only photograph is the
// one living inside the plan's footprint (RoomPlanDrawing). Where variants
// 1 and 2 lead with the finished room, this one leads with the drawing of
// it, which is the honest order for a studio whose product starts as a
// measured plan.
//
// It also gives the detail page a hero that is unmistakably *not* the
// /services fold: the drawing sits right and low with the type wrapping
// above and beside it, and the facts run as a numbered column rather than
// a row, so the two pages never read as the same template twice.
import { useRef, type ReactNode } from "react";
import Link from "next/link";
import gsap from "gsap";
import { useGSAP } from "@/hooks/useGSAP";
import { DUR, EASE } from "@/lib/motion";
import type { ServiceDetail } from "@/lib/content";
import { RoomPlanDrawing } from "../../shared/RoomPlanDrawing";
import { getHeroFacts, titleLines } from "./heroFacts";

interface HeroDrawingLedProps {
  service: ServiceDetail;
  quoteCta: ReactNode;
  id: string;
}

export function HeroDrawingLed({ service, quoteCta, id }: HeroDrawingLedProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const facts = getHeroFacts(service);

  useGSAP(sectionRef, (section, reduced) => {
    const meta = gsap.utils.toArray<HTMLElement>("[data-hero-meta]", section);
    const lines = gsap.utils.toArray<HTMLElement>("[data-hero-line]", section);
    const body = gsap.utils.toArray<HTMLElement>("[data-hero-body]", section);
    const rows = gsap.utils.toArray<HTMLElement>("[data-hero-fact]", section);
    const stage = section.querySelector<HTMLElement>("[data-hero-stage]");

    if (reduced) {
      gsap.set([...meta, ...body, ...rows, stage].filter(Boolean), { opacity: 1, y: 0, x: 0 });
      gsap.set(lines, { yPercent: 0 });
      return;
    }

    gsap.set(lines, { yPercent: 100, y: 0 });

    const tl = gsap.timeline({ delay: 0.15 });

    tl.to(meta, { opacity: 1, y: 0, duration: DUR.enter, ease: EASE.enter, stagger: 0.05 })
      .to(lines, { yPercent: 0, duration: DUR.editorial, ease: EASE.editorial, stagger: 0.08 }, 0.06)
      // The drawing arrives from the edge it bleeds off; the plan then inks
      // itself in on its own timeline inside RoomPlanDrawing.
      .fromTo(
        stage,
        { opacity: 0, x: 46 },
        { opacity: 1, x: 0, duration: 1.1, ease: EASE.editorial },
        0.2,
      )
      .to(body, { opacity: 1, y: 0, duration: DUR.enter, ease: EASE.enter, stagger: 0.07 }, 0.5)
      .to(rows, { opacity: 1, y: 0, duration: 0.6, ease: EASE.enter, stagger: 0.07 }, 0.66);

    return () => {
      tl.kill();
    };
  });

  return (
    <section
      ref={sectionRef}
      id={id}
      aria-labelledby="service-hero-heading"
      className="relative flex min-h-[100svh] flex-col overflow-hidden bg-enzo-dark text-enzo-cream"
    >
      <div className="relative mx-auto flex w-full max-w-[1500px] flex-1 flex-col px-5 pb-12 pt-[7rem] sm:px-6 md:px-12 md:pt-[8.5rem]">
        <p
          data-hero-meta
          className="font-display text-[10.5px] font-semibold uppercase tracking-[0.3em] text-enzo-sand opacity-0"
          style={{ transform: "translateY(8px)" }}
        >
          {service.category}
        </p>

        <div className="mt-6 flex min-h-0 flex-1 flex-col gap-10 lg:flex-row lg:items-center lg:gap-16">
          <div className="lg:w-[42%]">
            <h1
              id="service-hero-heading"
              className="font-title font-semibold leading-[0.96] tracking-[-0.05em]"
              style={{ fontSize: "clamp(2.4rem, 5vw, 4.4rem)" }}
            >
              {titleLines(service.title).map((line) => (
                <span key={line} className="block overflow-hidden pb-[0.08em] -mb-[0.08em]">
                  <span data-hero-line className="block" style={{ transform: "translateY(100%)" }}>
                    {line}
                  </span>
                </span>
              ))}
            </h1>

            <p
              data-hero-body
              className="mt-6 max-w-[40ch] text-[15px] leading-[1.7] text-enzo-cream/60 opacity-0"
              style={{ transform: "translateY(14px)" }}
            >
              {service.heroDesc}
            </p>

            <div
              data-hero-body
              className="mt-8 flex flex-wrap items-center gap-3 opacity-0"
              style={{ transform: "translateY(14px)" }}
            >
              {quoteCta}
              <Link
                href={`/booking?service=${service.slug}`}
                className="rounded-full border border-enzo-cream/20 px-7 py-3.5 text-[14px] text-enzo-cream transition-colors duration-300 hover:border-enzo-sand hover:text-enzo-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-2 focus-visible:ring-offset-enzo-dark"
              >
                Book a consultation
              </Link>
            </div>

            {/* Facts as a ruled column — a schedule down the side of a
                drawing, which is where they belong on a sheet like this. */}
            <dl className="mt-11 max-w-sm">
              {facts.map((fact) => (
                <div
                  key={fact.label}
                  data-hero-fact
                  className="flex items-baseline justify-between gap-6 border-t border-enzo-cream/12 py-3 opacity-0"
                  style={{ transform: "translateY(12px)" }}
                >
                  <dt className="text-[10.5px] uppercase tracking-[0.22em] text-enzo-cream/35">
                    {fact.label}
                  </dt>
                  <dd className="text-[13.5px] tabular-nums text-enzo-cream/85">
                    {fact.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div
            data-hero-stage
            className="min-h-0 flex-1 opacity-0"
            style={{ transform: "translateX(46px)" }}
          >
            <div className="relative aspect-[4/3] w-full lg:h-full lg:max-h-[58vh]">
              <RoomPlanDrawing
                slug={service.slug}
                image={service.image}
                caption={service.category}
                // The chimney-breast footprint: this variant belongs to the
                // third published service, and a breast wall with alcoves
                // either side is the shape that discipline is usually
                // fitted around.
                pattern={2}
                className="absolute inset-0"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
