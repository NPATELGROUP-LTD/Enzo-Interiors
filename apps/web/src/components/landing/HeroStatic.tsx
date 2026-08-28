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
  { value: "5 yr", label: "Guarantee" },
  { value: "Free", label: "Consultation" },
];

const QUICK_LINKS = [
  { label: "Kitchens", slug: "kitchens" },
  { label: "Bedrooms", slug: "bedrooms" },
  { label: "Media walls", slug: "media-walls" },
  { label: "Wardrobes", slug: "wardrobes" },
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
        <span className="mb-3.5 whitespace-nowrap text-[9.5px] font-semibold uppercase tracking-[0.22em] text-enzo-sand">
          Leicestershire&apos;s bespoke specialists
        </span>

        <h1
          className="font-title font-semibold leading-[0.98] tracking-[-0.045em] text-enzo-cream"
          style={{ fontSize: "clamp(2.4rem, 11vw, 3.4rem)" }}
        >
          Fitted furniture,
          <br />
          <span className="text-enzo-sage">made for your walls.</span>
        </h1>

        <p className="mt-4 max-w-[38ch] text-[14.5px] leading-[1.65] text-enzo-cream/70">
          Kitchens, wardrobes and media walls — drawn, built in our workshop and
          fitted by the same team.
        </p>

        <HeroCtaButton href="/booking" label="Book a free consultation" className="mt-6" />
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

      {/* Three facts, not three adjectives — the fastest way to read as a real
          company on a small screen. */}
      <dl className="relative z-[1] grid grid-cols-3 gap-2 border-y border-enzo-cream/12 py-4">
        {TRUST.map((item) => (
          <div key={item.label} className="min-w-0">
            <dt className="sr-only">{item.label}</dt>
            <dd className="truncate text-[15px] font-semibold tracking-[-0.02em] text-enzo-cream">
              {item.value}
            </dd>
            <dd className="mt-0.5 truncate text-[10.5px] uppercase tracking-[0.16em] text-enzo-cream/60">
              {item.label}
            </dd>
          </div>
        ))}
      </dl>

      {/* Straight into the four disciplines. Desktop reaches these by scrolling
          through section 01; on a phone they are worth one tap. */}
      <nav aria-label="Services" className="relative z-[1] -mx-5 sm:-mx-10">
        <ul className="flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain px-5 pb-1 sm:px-10">
          {QUICK_LINKS.map((link) => (
            <li key={link.slug} className="shrink-0 snap-start">
              <Link
                href={`/services/${link.slug}`}
                className="inline-flex min-h-11 items-center rounded-full border border-enzo-cream/25 px-4 text-[13px] text-enzo-cream/85 transition-colors duration-300 hover:border-enzo-sand hover:text-enzo-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-2 focus-visible:ring-offset-enzo-dark"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div
        aria-hidden="true"
        className="relative z-[1] mt-auto flex items-center justify-center gap-2 pt-2 text-[10px] uppercase tracking-[0.3em] text-enzo-cream/45"
      >
        See how we work
        <ChevronDown className="h-3.5 w-3.5 animate-bounce" />
      </div>
    </section>
  );
}
