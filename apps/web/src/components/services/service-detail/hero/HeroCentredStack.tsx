"use client";

// Detail hero — variant 4 of 4: THE STACK.
//
// The only centred hero of the four, and the only one that reads top to
// bottom rather than left to right: title, sentence, buttons, then a wide
// letterbox band of the room beneath them that opens from the centre
// outward. Facts sit under the band on a rule.
//
// Centring is used exactly once across the four variants on purpose — it
// is the most conventional arrangement, so it earns its place only by
// being the odd one out, and by being paired with a crop (21:9) none of
// the others use.
import { useRef, type ReactNode } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { useGSAP } from "@/hooks/useGSAP";
import { DUR, EASE } from "@/lib/motion";
import type { ServiceDetail } from "@/lib/content";
import { getHeroFacts, titleLines } from "./heroFacts";

interface HeroCentredStackProps {
  service: ServiceDetail;
  quoteCta: ReactNode;
  id: string;
}

export function HeroCentredStack({ service, quoteCta, id }: HeroCentredStackProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const facts = getHeroFacts(service);

  useGSAP(sectionRef, (section, reduced) => {
    const meta = gsap.utils.toArray<HTMLElement>("[data-hero-meta]", section);
    const lines = gsap.utils.toArray<HTMLElement>("[data-hero-line]", section);
    const body = gsap.utils.toArray<HTMLElement>("[data-hero-body]", section);
    const band = section.querySelector<HTMLElement>("[data-hero-band]");
    const photo = section.querySelector<HTMLElement>("[data-hero-photo]");

    if (reduced) {
      gsap.set([...meta, ...body], { opacity: 1, y: 0 });
      gsap.set(lines, { yPercent: 0 });
      if (band) gsap.set(band, { clipPath: "inset(0 0% 0 0%)" });
      if (photo) gsap.set(photo, { scale: 1 });
      return;
    }

    gsap.set(lines, { yPercent: 100, y: 0 });

    const tl = gsap.timeline({ delay: 0.15 });

    tl.to(meta, { opacity: 1, y: 0, duration: DUR.enter, ease: EASE.enter, stagger: 0.05 })
      .to(lines, { yPercent: 0, duration: DUR.editorial, ease: EASE.editorial, stagger: 0.08 }, 0.06)
      .to(body, { opacity: 1, y: 0, duration: DUR.enter, ease: EASE.enter, stagger: 0.07 }, 0.36)
      // Band opens from its centre line outward — a shutter, matching the
      // symmetry of the type above it.
      .fromTo(
        band,
        { clipPath: "inset(0 50% 0 50%)" },
        { clipPath: "inset(0 0% 0 0%)", duration: 1.2, ease: EASE.editorial },
        0.5,
      )
      .fromTo(photo, { scale: 1.2 }, { scale: 1, duration: 1.6, ease: EASE.editorial }, 0.5);

    if (photo) {
      gsap.to(photo, {
        yPercent: 8,
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
      className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden bg-enzo-dark text-enzo-cream"
    >
      <div className="mx-auto w-full max-w-[1500px] px-5 pb-12 pt-[7.5rem] text-center sm:px-6 md:px-12 md:pt-[9rem]">
        <p
          data-hero-meta
          className="font-display text-[10.5px] font-semibold uppercase tracking-[0.3em] text-enzo-sand opacity-0"
          style={{ transform: "translateY(8px)" }}
        >
          {service.category}
        </p>

        <h1
          id="service-hero-heading"
          className="mx-auto mt-6 max-w-[16ch] font-title font-semibold leading-[0.95] tracking-[-0.05em]"
          style={{ fontSize: "clamp(2.5rem, 6.4vw, 5.4rem)" }}
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
          className="mx-auto mt-6 max-w-[46ch] text-[15px] leading-[1.7] text-enzo-cream/60 opacity-0"
          style={{ transform: "translateY(14px)" }}
        >
          {service.heroDesc}
        </p>

        <div
          data-hero-body
          className="mt-8 flex flex-wrap items-center justify-center gap-3 opacity-0"
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
      </div>

      {/* Letterbox band, full width of the content column. */}
      <div className="mx-auto w-full max-w-[1500px] px-5 sm:px-6 md:px-12">
        <div
          data-hero-band
          className="relative aspect-[16/9] w-full overflow-hidden bg-enzo-forest sm:aspect-[21/9]"
          style={{ clipPath: "inset(0 50% 0 50%)" }}
        >
          <ImageWithFallback
            src={service.image}
            alt={service.title}
            data-hero-photo
            className="absolute inset-0 h-full w-full scale-110 object-cover will-change-transform"
          />
        </div>

        <dl
          data-hero-body
          className="mt-5 flex flex-wrap justify-center gap-x-10 gap-y-4 pb-12 opacity-0"
          style={{ transform: "translateY(14px)" }}
        >
          {facts.map((fact) => (
            <div key={fact.label} className="flex items-baseline gap-2.5">
              <dt className="text-[10.5px] uppercase tracking-[0.22em] text-enzo-cream/35">
                {fact.label}
              </dt>
              <dd className="text-[13.5px] tabular-nums text-enzo-cream/85">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
