"use client";

// Detail hero — variant 2 of 4: THE OVERLAP.
//
// The only hero where two elements share the same space. A tall portrait
// plate sits low and left; the title starts over it and runs off its right
// edge into clear ground, so the type is half on the photograph and half on
// the page. Nothing else on the site layers like this, which is the point —
// the previous version of this hero was a right-hand picture with type
// beside it, i.e. the same arrangement as the masthead page with the parts
// swapped.
//
// The overlap only exists from lg up. Below that it unstacks completely,
// because type over a photograph at phone width is a legibility problem
// with no upside.
//
// Ground: near-black — the only hero that keeps it.
import { useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { useGSAP } from "@/hooks/useGSAP";
import { DUR, EASE } from "@/lib/motion";
import type { ServiceDetail } from "@/lib/content";
import { QuoteTriggerButton } from "../../shared/QuoteRequestModal";
import { getHeroFacts, titleLines } from "./heroFacts";

export function HeroOverlap({
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
    const plate = section.querySelector<HTMLElement>("[data-hero-plate]");
    const photo = section.querySelector<HTMLElement>("[data-hero-photo]");

    if (reduced) {
      gsap.set([...meta, ...body], { opacity: 1, y: 0, x: 0 });
      gsap.set(lines, { yPercent: 0 });
      if (plate) gsap.set(plate, { clipPath: "inset(0 0 0 0)" });
      if (photo) gsap.set(photo, { scale: 1 });
      return;
    }

    gsap.set(lines, { yPercent: 100, y: 0 });

    const tl = gsap.timeline({ delay: 0.12 });

    // The plate lands first and the title is then laid across it, which is
    // the order that makes the overlap legible as a deliberate layering
    // rather than as two things that happen to collide.
    tl.fromTo(
      plate,
      { clipPath: "inset(0 0 100% 0)" },
      { clipPath: "inset(0 0 0% 0)", duration: 1.15, ease: EASE.editorial },
    )
      .fromTo(photo, { scale: 1.18 }, { scale: 1, duration: 1.6, ease: EASE.editorial }, 0)
      .to(meta, { opacity: 1, y: 0, duration: DUR.enter, ease: EASE.enter, stagger: 0.05 }, 0.4)
      .to(
        lines,
        { yPercent: 0, duration: DUR.editorial, ease: EASE.editorial, stagger: 0.09 },
        0.5,
      )
      .to(body, { opacity: 1, x: 0, y: 0, duration: DUR.enter, ease: EASE.enter, stagger: 0.08 }, 0.85);

    if (photo) {
      gsap.to(photo, {
        yPercent: 9,
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
      className="relative overflow-hidden bg-enzo-dark text-enzo-cream"
    >
      <div className="mx-auto min-h-[100svh] max-w-[1500px] px-5 pb-16 pt-[7.5rem] sm:px-6 md:px-12 md:pt-[8.5rem]">
        <p
          data-hero-meta
          className="font-display text-[10.5px] font-semibold uppercase tracking-[0.3em] text-enzo-sand opacity-0"
          style={{ transform: "translateY(8px)" }}
        >
          {service.category}
        </p>

        <div className="relative mt-8 lg:mt-12">
          {/* Plate — low and left, portrait. */}
          <div
            data-hero-plate
            className="relative aspect-[4/5] w-full overflow-hidden bg-enzo-forest sm:aspect-[3/4] lg:aspect-auto lg:h-[62vh] lg:w-[52%]"
            style={{ clipPath: "inset(0 0 100% 0)" }}
          >
            <ImageWithFallback
              src={service.image}
              alt={service.title}
              data-hero-photo
              className="absolute inset-0 h-full w-full scale-110 object-cover will-change-transform"
            />
            {/* Scrim over the overlap zone only.
                The title crosses the plate's right-hand third; a
                client-uploaded photograph can be bright exactly there (this
                bedroom is), and cream type on a pale wardrobe door fails
                contrast. Darkening the whole plate would have been the easy
                fix and the wrong one — it would dim the two thirds of the
                picture nothing is written on. */}
            <div
              aria-hidden="true"
              className="absolute inset-0 hidden lg:block"
              style={{
                background:
                  "linear-gradient(to right, rgba(20,20,19,0) 0%, rgba(20,20,19,0) 42%, rgba(20,20,19,0.62) 78%, rgba(20,20,19,0.78) 100%)",
              }}
            />
          </div>

          {/* Title — starts over the plate and runs off its right edge.
              `mix-blend` is deliberately NOT used: it would tint the type
              against whatever the client uploaded and make contrast
              unpredictable. A solid cream over a darkened plate is the
              legible version. */}
          <h1
            id="service-hero-heading"
            className="relative z-10 mt-8 font-title font-semibold leading-[0.9] tracking-[-0.055em] lg:absolute lg:left-[34%] lg:top-1/2 lg:mt-0 lg:w-[66%] lg:-translate-y-1/2"
            style={{ fontSize: "clamp(2.6rem, 8vw, 6.6rem)" }}
          >
            {titleLines(service.title).map((line) => (
              <span key={line} className="block overflow-hidden pb-[0.07em] -mb-[0.07em]">
                <span
                  data-hero-line
                  className="block"
                  style={{
                    transform: "translateY(100%)",
                    textShadow: "0 2px 30px rgba(20,20,19,0.55)",
                  }}
                >
                  {line}
                </span>
              </span>
            ))}
          </h1>
        </div>

        {/* Everything else sits under the collage, right-aligned, so the
            fold's weight runs bottom-left to top-right. */}
        <div className="mt-10 grid gap-8 lg:mt-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-end">
          <dl
            data-hero-body
            className="flex flex-wrap gap-x-10 gap-y-4 border-t border-enzo-cream/12 pt-6 opacity-0"
            style={{ transform: "translateX(-16px)" }}
          >
            {facts.map((fact) => (
              <div key={fact.label} className="flex items-baseline gap-2.5">
                <dt className="text-[10.5px] uppercase tracking-[0.22em] text-enzo-cream/35">
                  {fact.label}
                </dt>
                <dd className="text-[13.5px] tabular-nums text-enzo-cream/85">
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>

          <div
            data-hero-body
            className="opacity-0"
            style={{ transform: "translateX(-16px)" }}
          >
            <p className="max-w-[36ch] text-[15px] leading-[1.7] text-enzo-cream/60">
              {service.heroDesc}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <QuoteTriggerButton className="rounded-full bg-enzo-cream px-7 py-3.5 text-[14px] font-medium text-enzo-forest transition-colors duration-300 hover:bg-enzo-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-2 focus-visible:ring-offset-enzo-dark">
                Get a free quote
              </QuoteTriggerButton>
              <Link
                href={`/booking?service=${service.slug}`}
                className="rounded-full border border-enzo-cream/20 px-7 py-3.5 text-[14px] text-enzo-cream transition-colors duration-300 hover:border-enzo-sand hover:text-enzo-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-2 focus-visible:ring-offset-enzo-dark"
              >
                Book a consultation
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
