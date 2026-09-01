"use client";

// Detail hero — variant 1 of 4: THE SPLIT.
//
// A hard vertical division of the fold: everything you read on the left,
// the room on the right, edge to edge and top to bottom with no card, no
// rounding and no gradient over it. The photograph opens with a clip wipe
// travelling in from the outer edge, as though a panel were sliding into
// place.
//
// Currently assigned to the first published service. See ./ServiceHero.tsx
// for how variants are chosen and why there are four of them.
import { useRef, type ReactNode } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { useGSAP } from "@/hooks/useGSAP";
import { DUR, EASE } from "@/lib/motion";
import type { ServiceDetail } from "@/lib/content";
import { getHeroFacts, titleLines } from "./heroFacts";

interface HeroSplitPlateProps {
  service: ServiceDetail;
  quoteCta: ReactNode;
  id: string;
}

export function HeroSplitPlate({ service, quoteCta, id }: HeroSplitPlateProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const facts = getHeroFacts(service);

  useGSAP(sectionRef, (section, reduced) => {
    const meta = gsap.utils.toArray<HTMLElement>("[data-hero-meta]", section);
    const lines = gsap.utils.toArray<HTMLElement>("[data-hero-line]", section);
    const body = gsap.utils.toArray<HTMLElement>("[data-hero-body]", section);
    const plate = section.querySelector<HTMLElement>("[data-hero-plate]");
    const photo = section.querySelector<HTMLElement>("[data-hero-photo]");

    if (reduced) {
      gsap.set([...meta, ...body], { opacity: 1, y: 0 });
      gsap.set(lines, { yPercent: 0 });
      if (plate) gsap.set(plate, { clipPath: "inset(0 0 0 0)" });
      if (photo) gsap.set(photo, { scale: 1 });
      return;
    }

    gsap.set(lines, { yPercent: 100, y: 0 });

    const tl = gsap.timeline({ delay: 0.15 });

    tl.to(meta, { opacity: 1, y: 0, duration: DUR.enter, ease: EASE.enter, stagger: 0.05 })
      .to(lines, { yPercent: 0, duration: DUR.editorial, ease: EASE.editorial, stagger: 0.08 }, 0.06)
      .fromTo(
        plate,
        { clipPath: "inset(0 0 0 100%)" },
        { clipPath: "inset(0 0 0 0%)", duration: 1.15, ease: EASE.editorial },
        0.14,
      )
      .fromTo(photo, { scale: 1.14 }, { scale: 1, duration: 1.5, ease: EASE.editorial }, 0.14)
      .to(body, { opacity: 1, y: 0, duration: DUR.enter, ease: EASE.enter, stagger: 0.07 }, 0.46);

    if (photo) {
      gsap.to(photo, {
        yPercent: 7,
        ease: "none",
        scrollTrigger: { trigger: section, start: "top top", end: "bottom top", scrub: true },
      });
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
      className="relative bg-enzo-dark text-enzo-cream"
    >
      <div className="grid min-h-[100svh] lg:grid-cols-2">
        <div
          data-hero-plate
          className="relative order-1 min-h-[42svh] overflow-hidden bg-enzo-forest lg:order-2 lg:min-h-0"
          style={{ clipPath: "inset(0 0 0 100%)" }}
        >
          <ImageWithFallback
            src={service.image}
            alt={service.title}
            data-hero-photo
            className="absolute inset-0 h-full w-full scale-110 object-cover will-change-transform"
          />
        </div>

        <div className="order-2 flex flex-col justify-center px-5 pb-14 pt-12 sm:px-6 md:px-12 lg:order-1 lg:py-24 lg:pl-[max(3rem,calc((100vw-1500px)/2+3rem))] lg:pr-14">
          <p
            data-hero-meta
            className="font-display text-[10.5px] font-semibold uppercase tracking-[0.3em] text-enzo-sand opacity-0"
            style={{ transform: "translateY(8px)" }}
          >
            {service.category}
          </p>

          <h1
            id="service-hero-heading"
            className="mt-6 font-title font-semibold leading-[0.96] tracking-[-0.045em]"
            style={{ fontSize: "clamp(2.4rem, 4.6vw, 4.2rem)" }}
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
            className="mt-6 max-w-[42ch] text-[15px] leading-[1.7] text-enzo-cream/60 opacity-0"
            style={{ transform: "translateY(14px)" }}
          >
            {service.heroDesc}
          </p>

          <div
            data-hero-body
            className="mt-9 flex flex-wrap items-center gap-3 opacity-0"
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

          <dl
            data-hero-body
            className="mt-12 flex flex-wrap gap-x-10 gap-y-5 border-t border-enzo-cream/12 pt-6 opacity-0"
            style={{ transform: "translateY(14px)" }}
          >
            {facts.map((fact) => (
              <div key={fact.label}>
                <dt className="text-[10.5px] uppercase tracking-[0.22em] text-enzo-cream/35">
                  {fact.label}
                </dt>
                <dd className="mt-1.5 text-[14px] tabular-nums tracking-[-0.01em] text-enzo-cream/85">
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
