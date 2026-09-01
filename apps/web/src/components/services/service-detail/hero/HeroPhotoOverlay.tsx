"use client";

// Detail hero — variant 2 of 4: THE APERTURE.
//
// This was a full-bleed photograph with the type laid over its bottom
// corner. Two problems with that: it is the single most common hero on the
// internet, and it forced a heavy scrim over the photograph to keep the
// words legible — so the picture was both the whole design *and* half
// hidden by the thing sitting on it.
//
// Here the photograph is a tall aperture cut into the ground, offset to the
// right and running past both the top and bottom edges of the fold, with
// the type in clear space beside it. Nothing overlaps, so neither the
// picture nor the words are compromised, and the vertical crop is a shape
// no other hero in the set uses.
//
// The aperture opens from its own centre line and the photograph inside it
// counter-scrolls slightly, which gives the fold depth without pinning
// anything.
import { useRef, type ReactNode } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { useGSAP } from "@/hooks/useGSAP";
import { DUR, EASE } from "@/lib/motion";
import type { ServiceDetail } from "@/lib/content";
import { getHeroFacts, titleLines } from "./heroFacts";

interface HeroPhotoOverlayProps {
  service: ServiceDetail;
  quoteCta: ReactNode;
  id: string;
}

export function HeroPhotoOverlay({ service, quoteCta, id }: HeroPhotoOverlayProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const facts = getHeroFacts(service);

  useGSAP(sectionRef, (section, reduced) => {
    const meta = gsap.utils.toArray<HTMLElement>("[data-hero-meta]", section);
    const lines = gsap.utils.toArray<HTMLElement>("[data-hero-line]", section);
    const body = gsap.utils.toArray<HTMLElement>("[data-hero-body]", section);
    const aperture = section.querySelector<HTMLElement>("[data-aperture]");
    const photo = section.querySelector<HTMLElement>("[data-hero-photo]");
    const rule = section.querySelector<HTMLElement>("[data-hero-rule]");

    if (reduced) {
      gsap.set([...meta, ...body], { opacity: 1, y: 0 });
      gsap.set(lines, { yPercent: 0 });
      if (aperture) gsap.set(aperture, { clipPath: "inset(0 0 0 0)" });
      if (photo) gsap.set(photo, { scale: 1 });
      if (rule) gsap.set(rule, { scaleY: 1 });
      return;
    }

    gsap.set(lines, { yPercent: 100, y: 0 });

    const tl = gsap.timeline({ delay: 0.15 });

    tl.fromTo(
      aperture,
      { clipPath: "inset(50% 0 50% 0)" },
      { clipPath: "inset(0% 0 0% 0)", duration: 1.2, ease: EASE.editorial },
    )
      .fromTo(photo, { scale: 1.16 }, { scale: 1, duration: 1.6, ease: EASE.editorial }, 0)
      .to(rule, { scaleY: 1, duration: 0.9, ease: EASE.editorial }, 0.2)
      .to(meta, { opacity: 1, y: 0, duration: DUR.enter, ease: EASE.enter, stagger: 0.05 }, 0.25)
      .to(
        lines,
        { yPercent: 0, duration: DUR.editorial, ease: EASE.editorial, stagger: 0.08 },
        0.32,
      )
      .to(body, { opacity: 1, y: 0, duration: DUR.enter, ease: EASE.enter, stagger: 0.07 }, 0.6);

    if (photo) {
      gsap.to(photo, {
        yPercent: -8,
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
      <div className="mx-auto grid min-h-[100svh] max-w-[1500px] items-center gap-10 px-5 pb-16 pt-[7.5rem] sm:px-6 md:px-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,32rem)] lg:gap-20 lg:pb-0 lg:pt-0">
        {/* ── Type, in clear space ── */}
        <div className="order-2 lg:order-1">
          <div className="flex items-center gap-5">
            <span
              aria-hidden="true"
              className="block h-10 w-px overflow-hidden"
            >
              <span
                data-hero-rule
                className="block h-full w-px origin-top bg-enzo-sand"
                style={{ transform: "scaleY(0)" }}
              />
            </span>
            <p
              data-hero-meta
              className="font-display text-[10.5px] font-semibold uppercase tracking-[0.3em] text-enzo-sand opacity-0"
              style={{ transform: "translateY(8px)" }}
            >
              {service.category}
            </p>
          </div>

          <h1
            id="service-hero-heading"
            className="mt-7 font-title font-semibold leading-[0.94] tracking-[-0.05em]"
            style={{ fontSize: "clamp(2.5rem, 5.6vw, 5rem)" }}
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
            className="mt-7 max-w-[40ch] text-[15px] leading-[1.7] text-enzo-cream/60 opacity-0"
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
            className="mt-12 grid max-w-lg grid-cols-2 gap-x-8 gap-y-5 border-t border-enzo-cream/12 pt-6 opacity-0 sm:grid-cols-4"
            style={{ transform: "translateY(14px)" }}
          >
            {facts.map((fact) => (
              <div key={fact.label}>
                <dt className="text-[10.5px] uppercase tracking-[0.22em] text-enzo-cream/35">
                  {fact.label}
                </dt>
                <dd className="mt-1.5 text-[13.5px] tabular-nums text-enzo-cream/85">
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* ── The aperture ──
            Taller than the fold and bleeding past it top and bottom, so the
            photograph reads as a slot cut through the page rather than a
            picture placed on it. */}
        <div
          data-aperture
          className="relative order-1 h-[42svh] overflow-hidden bg-enzo-forest lg:order-2 lg:h-[112svh]"
          style={{ clipPath: "inset(50% 0 50% 0)" }}
        >
          <ImageWithFallback
            src={service.image}
            alt={service.title}
            data-hero-photo
            className="absolute inset-0 h-full w-full scale-110 object-cover will-change-transform"
          />
        </div>
      </div>
    </section>
  );
}
