"use client";

import { useEffect } from "react";
import type { HomeContent, MediaItem } from "@/lib/content";
import { HeroCtaButton } from "./HeroCtaButton";
import { HeroRotatingImage } from "./HeroRotatingImage";
import { RotatingBadge } from "./RotatingBadge";

// The desktop hero once the scrubbed intro has been seen (or with reduced motion):
// the intro's closing "Stop Dreaming. Start Building." scene, still and complete.
// Keep it the same as the CTA layer in HeroSequence, which animates it in.
export function HeroCtaStatic({
  cta,
  card,
  showcase,
}: {
  cta: HomeContent["hero"]["cta"];
  card: MediaItem;
  showcase: MediaItem[];
}) {
  // Navbar starts hidden and reveals on this flag; HeroSequence sets it while scrubbing.
  useEffect(() => {
    document.body.dataset.heroChrome = "visible";
    return () => {
      delete document.body.dataset.heroChrome;
    };
  }, []);

  return (
    <section className="relative flex min-h-dvh w-full items-center overflow-hidden bg-enzo-dark">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 55% at 10% 15%, rgba(138,158,140,0.16), transparent 60%), radial-gradient(55% 45% at 92% 90%, rgba(212,201,181,0.08), transparent 60%)",
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-[1200px] px-7 sm:px-10 lg:px-0">
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-[500px_480px] lg:justify-center lg:gap-24">
          <div className="flex flex-col items-start">
            <h1
              className="font-display font-semibold leading-[0.98] tracking-[-0.055em] text-enzo-cream"
              style={{ fontSize: "clamp(3.15rem, 4.8vw, 4.25rem)" }}
            >
              {cta.lines.map((line) => (
                <span key={line.accent} className="block whitespace-nowrap">
                  {line.lead} <em className="text-enzo-sage not-italic">{line.accent}</em>
                  {line.tail}
                </span>
              ))}
            </h1>

            <p className="font-sans mt-5 line-clamp-2 max-w-[44ch] text-[15px] font-normal leading-[1.7] text-enzo-cream/70">
              {cta.sub}
            </p>

            <div className="mt-9">
              <HeroCtaButton href={cta.buttonHref} label={cta.buttonLabel} />
            </div>

            <div className="mt-14 flex items-start gap-10">
              <div className="w-[260px] shrink-0">
                <div className="overflow-hidden rounded-2xl">
                  <img
                    src={card.src}
                    alt={card.alt}
                    title={card.title ?? card.alt}
                    className="block aspect-[3/2] w-full object-cover"
                  />
                </div>
                <p className="font-display mt-3 text-[13px] font-semibold text-enzo-cream">
                  {cta.card.title}
                </p>
                <p className="font-sans text-[12px] text-enzo-cream/70">{cta.card.sub}</p>
              </div>

              <div className="relative z-10 -mt-10 flex h-[150px] items-center">
                <RotatingBadge label={cta.badge.label} href={cta.badge.href} size={150} />
              </div>
            </div>
          </div>

          <div className="w-full max-w-[480px]">
            <HeroRotatingImage
              className="max-w-[480px]"
              images={showcase}
              notchRadius={0}
              notchFeather={0}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
