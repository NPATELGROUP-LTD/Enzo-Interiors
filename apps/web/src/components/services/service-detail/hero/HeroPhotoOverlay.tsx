"use client";

// Detail hero — variant 2 of 4: THE FULL BLEED.
//
// No split and no columns: the photograph fills the entire fold and the
// type sits on it, anchored to the bottom-left with the facts ruled along
// the very bottom edge. Where variant 1 gives the room half the screen and
// keeps the type on its own ground, this one commits completely — the room
// *is* the page and the words are captions on it.
//
// The photograph drifts up and scales down very slowly for the whole time
// the fold is on screen, so a still image never sits completely dead.
// Legibility comes from a single bottom-weighted scrim rather than a flat
// wash, which keeps the top two thirds of the photograph untouched.
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
    const photo = section.querySelector<HTMLElement>("[data-hero-photo]");
    const scrim = section.querySelector<HTMLElement>("[data-hero-scrim]");

    if (reduced) {
      gsap.set([...meta, ...body], { opacity: 1, y: 0 });
      gsap.set(lines, { yPercent: 0 });
      if (photo) gsap.set(photo, { scale: 1, opacity: 1 });
      if (scrim) gsap.set(scrim, { opacity: 1 });
      return;
    }

    gsap.set(lines, { yPercent: 100, y: 0 });

    const tl = gsap.timeline({ delay: 0.1 });

    // Photograph first and alone for a beat, then the words arrive on it.
    tl.fromTo(
      photo,
      { scale: 1.22, opacity: 0 },
      { scale: 1.06, opacity: 1, duration: 1.6, ease: EASE.editorial },
    )
      .fromTo(scrim, { opacity: 0 }, { opacity: 1, duration: 1, ease: EASE.enter }, 0.4)
      .to(meta, { opacity: 1, y: 0, duration: DUR.enter, ease: EASE.enter, stagger: 0.05 }, 0.6)
      .to(
        lines,
        { yPercent: 0, duration: DUR.editorial, ease: EASE.editorial, stagger: 0.08 },
        0.66,
      )
      .to(body, { opacity: 1, y: 0, duration: DUR.enter, ease: EASE.enter, stagger: 0.07 }, 0.95);

    // Continues the entrance rather than restarting it: the scale carries
    // on downward from where the intro left it.
    if (photo) {
      gsap.to(photo, {
        scale: 1,
        yPercent: 6,
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
      className="relative min-h-[100svh] overflow-hidden bg-enzo-dark text-enzo-cream"
    >
      <ImageWithFallback
        src={service.image}
        alt={service.title}
        data-hero-photo
        className="absolute inset-0 h-full w-full object-cover will-change-transform"
      />
      {/* Two scrims, not one. The bottom-weighted gradient alone was tuned
          against a dark photograph and failed the moment a bright one was
          published — and the photographs are client-uploaded, so the type
          has to stay legible over anything. The second, left-weighted
          gradient guarantees a dark column under the headline whatever the
          image behind it does, while leaving the right-hand two thirds of
          the picture almost untouched. */}
      <div
        aria-hidden="true"
        data-hero-scrim
        className="absolute inset-0"
        style={{
          background: [
            "linear-gradient(to top, rgba(20,20,19,0.96) 0%, rgba(20,20,19,0.90) 30%, rgba(20,20,19,0.45) 62%, rgba(20,20,19,0.18) 100%)",
            "linear-gradient(to right, rgba(20,20,19,0.88) 0%, rgba(20,20,19,0.55) 38%, rgba(20,20,19,0) 72%)",
          ].join(", "),
        }}
      />

      <div className="relative flex min-h-[100svh] flex-col justify-end">
        <div className="mx-auto w-full max-w-[1500px] px-5 pb-10 pt-32 sm:px-6 md:px-12">
          <p
            data-hero-meta
            className="font-display text-[10.5px] font-semibold uppercase tracking-[0.3em] text-enzo-sand opacity-0"
            style={{ transform: "translateY(8px)" }}
          >
            {service.category}
          </p>

          <h1
            id="service-hero-heading"
            className="mt-5 font-title font-semibold leading-[0.94] tracking-[-0.05em]"
            style={{ fontSize: "clamp(2.6rem, 7.4vw, 6.4rem)" }}
          >
            {titleLines(service.title).map((line) => (
              <span key={line} className="block overflow-hidden pb-[0.08em] -mb-[0.08em]">
                <span data-hero-line className="block" style={{ transform: "translateY(100%)" }}>
                  {line}
                </span>
              </span>
            ))}
          </h1>

          <div className="mt-7 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <p
              data-hero-body
              className="max-w-[44ch] text-[15px] leading-[1.7] text-enzo-cream/70 opacity-0"
              style={{ transform: "translateY(14px)" }}
            >
              {service.heroDesc}
            </p>

            <div
              data-hero-body
              className="flex flex-wrap items-center gap-3 opacity-0"
              style={{ transform: "translateY(14px)" }}
            >
              {quoteCta}
              <Link
                href={`/booking?service=${service.slug}`}
                className="rounded-full border border-enzo-cream/25 px-7 py-3.5 text-[14px] text-enzo-cream transition-colors duration-300 hover:border-enzo-sand hover:text-enzo-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-2 focus-visible:ring-offset-enzo-dark"
              >
                Book a consultation
              </Link>
            </div>
          </div>
        </div>

        {/* Facts ruled along the bottom edge of the frame — the caption
            strip under a photograph, not a card floating on it. */}
        <div className="mx-auto w-full max-w-[1500px] px-5 pb-10 sm:px-6 md:px-12">
          <dl
            data-hero-body
            className="flex flex-wrap gap-x-10 gap-y-4 border-t border-enzo-cream/15 pt-5 opacity-0"
            style={{ transform: "translateY(14px)" }}
          >
            {facts.map((fact) => (
              <div key={fact.label} className="flex items-baseline gap-2.5">
                <dt className="text-[10.5px] uppercase tracking-[0.22em] text-enzo-cream/40">
                  {fact.label}
                </dt>
                <dd className="text-[13.5px] tabular-nums text-enzo-cream/85">
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
