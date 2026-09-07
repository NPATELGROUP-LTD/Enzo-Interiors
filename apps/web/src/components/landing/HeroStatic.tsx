"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { HeroCtaButton } from "./HeroCtaButton";
import { HeroRotatingImage } from "./HeroRotatingImage";

// Mobile / prefers-reduced-motion hero. Not a squashed copy of the desktop
// sequence — a different set of components for a different job.
//
// The desktop hero spends ~9,000px of scroll establishing atmosphere before it
// asks for anything. On a phone that budget does not exist: the visitor is
// standing up, on data, and deciding within one screen whether this company is
// real. So this leads with the offer, proves the company with three concrete
// facts, and puts the four things Enzo actually makes one tap away — none of
// which the desktop hero carries, because there it would be noise.
//
// Sets body[data-hero-chrome] itself because Navbar starts the logo/dock
// hidden and only reveals them once this flag flips to "visible" — that reveal
// is otherwise driven by HeroSequence's scroll sequence, which never mounts
// here.
const TRUST = [
  { value: "Leicester", label: "Own workshop" },
  { value: "Free", label: "Consultation" },
];

export function HeroStatic() {
  useEffect(() => {
    document.body.dataset.heroChrome = "visible";
    return () => {
      delete document.body.dataset.heroChrome;
    };
  }, []);

  return (
    <section className="relative flex min-h-dvh w-full flex-col justify-start gap-8 overflow-hidden bg-enzo-dark px-5 pb-10 pt-28 sm:px-10 sm:pt-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 45% at 15% 0%, rgba(138,158,140,0.16), transparent 60%), radial-gradient(60% 40% at 100% 100%, rgba(212,201,181,0.08), transparent 60%)",
        }}
      />

      <div className="relative z-[1] flex flex-col items-start">
        {/* No eyebrow line here — this hero already opens with the offer,
            and a wrapping headline was doing worse with even less width
            once a strapline sat above it. */}
        <h1
          className="font-title font-semibold leading-[0.98] tracking-[-0.045em] text-enzo-cream"
          style={{ fontSize: "clamp(2.4rem, 11vw, 3.4rem)" }}
        >
          Fitted furniture,
          <br />
          <span className="text-enzo-sage">made to measure.</span>
        </h1>

        <p className="mt-4 max-w-[32ch] text-[15px] leading-[1.65] text-enzo-cream/70">
          Kitchens, wardrobes and media walls, built in our workshop and
          fitted by the same team.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <HeroCtaButton href="/booking" label="Book Consultation" />
          <Link
            href="/portfolio"
            className="touch-target inline-flex items-center rounded-full border border-enzo-cream/25 px-6 py-3.5 text-[13px] font-semibold tracking-wide text-enzo-cream transition-colors duration-300 active:bg-enzo-cream/10"
          >
            Our Work
          </Link>
        </div>
      </div>

      <div className="relative z-[1] w-full">
        <HeroRotatingImage
          aspect="landscape"
          images={[
            {
              src: "/fireplaceMediawall.jpeg",
              alt: "Bespoke media wall interior by Enzo Interiors",
              title: "Bespoke Media Wall",
            },
            {
              src: "/centeredKitchen.jpeg",
              alt: "Bespoke kitchen interior by Enzo Interiors",
              title: "Bespoke Kitchen",
            },
            {
              src: "/Bedroom.jpeg",
              alt: "Bespoke bedroom interior by Enzo Interiors",
              title: "Bespoke Bedroom",
            },
          ]}
          radius={20}
          notchRadius={0}
          notchFeather={0}
        />
      </div>

      {/* Two facts, not three adjectives — the fastest way to read as a real
          company on a small screen. */}
      <dl className="relative z-[1] flex items-stretch gap-6 border-y border-enzo-cream/12 py-5">
        {TRUST.map((item, index) => (
          <div key={item.label} className="flex min-w-0 flex-1 items-center gap-6">
            <div className="min-w-0">
              <dt className="sr-only">{item.label}</dt>
              <dd className="truncate text-[17px] font-semibold tracking-[-0.02em] text-enzo-cream">
                {item.value}
              </dd>
              <dd className="mt-1 truncate text-[10.5px] uppercase tracking-[0.16em] text-enzo-cream/70">
                {item.label}
              </dd>
            </div>
            {index < TRUST.length - 1 && (
              <span aria-hidden="true" className="ml-auto h-9 w-px shrink-0 bg-enzo-cream/12" />
            )}
          </div>
        ))}
      </dl>

      <div
        aria-hidden="true"
        className="relative z-[1] mt-auto flex items-center justify-center gap-2 pt-2 text-[10px] uppercase tracking-[0.3em] text-enzo-cream/65"
      >
        See how we work
        <ChevronDown className="h-3.5 w-3.5 animate-bounce" />
      </div>
    </section>
  );
}
