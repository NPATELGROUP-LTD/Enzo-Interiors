"use client";

import { useEffect } from "react";
import { HeroCtaButton } from "./HeroCtaButton";
import { HeroRotatingImage } from "./HeroRotatingImage";

// Mobile / prefers-reduced-motion fallback for Hero — a static (non-pinned,
// non-scroll-jacked) hero screen using the same design language as the
// desktop CTA finale (HeroSequence): headline + pill CTA, then a large
// notched-corner image that auto-cycles through 3 finished rooms. No canvas, no
// 144-frame preloading, no scroll trapping.
//
// Trimmed vs. the desktop layout: no separate thumbnail card, inline badge,
// or desktop-only trust row — the image stays the focus on a narrow screen.
//
// Sets body[data-hero-chrome] itself because Navbar starts the logo/dock
// hidden and only reveals them once this flag flips to "visible" — that
// reveal used to be driven exclusively by HeroSequence's scroll sequence,
// which never mounts here, so without this the logo stayed invisible for
// the entire mobile session (visible for one frame before the initial
// gsap.set hid it, then never revealed).
export function HeroStatic() {
  useEffect(() => {
    document.body.dataset.heroChrome = "visible";
    return () => {
      delete document.body.dataset.heroChrome;
    };
  }, []);

  return (
    <section className="relative flex min-h-dvh w-full flex-col justify-start gap-12 overflow-hidden bg-enzo-dark px-6 pb-6 pt-32 sm:px-10 sm:pt-36">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 45% at 15% 0%, rgba(138,158,140,0.16), transparent 60%), radial-gradient(60% 40% at 100% 100%, rgba(212,201,181,0.08), transparent 60%)",
        }}
      />

      <div className="relative z-[1] flex flex-col items-start">
        <span className="mb-4 whitespace-nowrap font-sans text-[9px] font-semibold uppercase tracking-[0.22em] text-enzo-sage sm:text-[10px]">
          Leicestershire&apos;s Bespoke Specialists
        </span>

        <h1
          className="font-display font-semibold leading-[1.02] tracking-[-0.055em] text-enzo-cream"
          style={{ fontSize: "clamp(2.1rem, 9vw, 3.2rem)" }}
        >
          Stop <em className="text-enzo-sage not-italic">Dreaming</em>.
          <br />
          Start <em className="text-enzo-sage not-italic">Building</em>.
        </h1>

        <p className="font-sans mt-4 line-clamp-2 max-w-[44ch] text-[14px] leading-[1.7] text-enzo-cream/60">
          One free consultation. Zero pressure. Built for you.
        </p>

        <HeroCtaButton href="/booking" label="Book Free Consultation" className="mt-7" />
      </div>

      <div className="relative z-[1] mx-auto w-full max-w-[560px]">
        <HeroRotatingImage
          aspect="landscape"
          images={[
            {
              src: "/Bedroom.jpeg",
              alt: "Bespoke bedroom interior by Enzo Interiors",
              title: "Bespoke Bedroom",
            },
            {
              src: "/centeredKitchen.jpeg",
              alt: "Bespoke kitchen interior by Enzo Interiors",
              title: "Bespoke Kitchen",
            },
            {
              src: "/fireplaceMediawall.jpeg",
              alt: "Bespoke media wall interior by Enzo Interiors",
              title: "Bespoke Media Wall",
            },
          ]}
          radius={22}
          notchRadius={0}
          notchFeather={0}
        />
      </div>
    </section>
  );
}
