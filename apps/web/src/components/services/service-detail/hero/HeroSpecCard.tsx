"use client";

// Detail hero — variant 4 of 4: THE SPEC CARD.
//
// The only hero where the content sits inside a drawn container, and the
// only one where the facts are a ruled table rather than a row of
// label/value pairs. It reads as a specification card pinned next to a
// photograph — documentary rather than editorial, which is the opposite
// register to the masthead page.
//
// The photograph is a narrow full-height strip bleeding off the right-hand
// edge of the viewport: present, but subordinate to the card. Every other
// hero in the set gives the image at least half the fold.
//
// Ground: warm grey — the fourth distinct ground in the set (light /
// near-black / forest / warm grey).
import { useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { useGSAP } from "@/hooks/useGSAP";
import { DUR, EASE } from "@/lib/motion";
import type { ServiceDetail } from "@/lib/content";
import { QuoteTriggerButton } from "../../shared/QuoteRequestModal";
import { getHeroFacts, titleLines } from "./heroFacts";

export function HeroSpecCard({
  service,
  id,
}: {
  service: ServiceDetail;
  id: string;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const facts = getHeroFacts(service);

  useGSAP(sectionRef, (section, reduced) => {
    const lines = gsap.utils.toArray<HTMLElement>("[data-hero-line]", section);
    const rows = gsap.utils.toArray<HTMLElement>("[data-hero-row]", section);
    const card = section.querySelector<HTMLElement>("[data-hero-card]");
    const strip = section.querySelector<HTMLElement>("[data-hero-strip]");
    const photo = section.querySelector<HTMLElement>("[data-hero-photo]");

    if (reduced) {
      gsap.set([...rows, card].filter(Boolean), { opacity: 1, y: 0 });
      gsap.set(lines, { yPercent: 0 });
      if (strip) gsap.set(strip, { clipPath: "inset(0 0 0 0)" });
      if (photo) gsap.set(photo, { scale: 1 });
      return;
    }

    gsap.set(lines, { yPercent: 100, y: 0 });

    const tl = gsap.timeline({ delay: 0.12 });

    tl.fromTo(
      card,
      { opacity: 0, y: 26 },
      { opacity: 1, y: 0, duration: 0.9, ease: EASE.editorial },
    )
      .fromTo(
        strip,
        { clipPath: "inset(0 0 0 100%)" },
        { clipPath: "inset(0 0 0 0%)", duration: 1.15, ease: EASE.editorial },
        0.1,
      )
      .fromTo(photo, { scale: 1.16 }, { scale: 1, duration: 1.5, ease: EASE.editorial }, 0.1)
      .to(
        lines,
        { yPercent: 0, duration: DUR.editorial, ease: EASE.editorial, stagger: 0.09 },
        0.3,
      )
      // Table rows rule themselves in one at a time, like a form being
      // filled — the card's own idiom.
      .to(rows, { opacity: 1, y: 0, duration: 0.55, ease: EASE.enter, stagger: 0.06 }, 0.6);

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
      className="relative overflow-hidden bg-muted text-primary"
    >
      <div className="grid min-h-[100svh] items-center lg:grid-cols-[minmax(0,1fr)_minmax(0,30%)]">
        {/* ── The card ── */}
        <div className="px-5 pb-14 pt-[7.5rem] sm:px-6 md:px-12 lg:py-24 lg:pl-[max(3rem,calc((100vw-1500px)/2+3rem))] lg:pr-14">
          <article
            data-hero-card
            className="max-w-2xl rounded-[4px] border border-primary/20 bg-background opacity-0"
          >
            <header className="flex items-baseline justify-between gap-4 border-b border-primary/15 px-6 py-4 md:px-8">
              <span className="font-display text-[10.5px] font-semibold uppercase tracking-[0.28em] text-enzo-forest-light">
                {service.category}
              </span>
              <span className="font-display text-[10.5px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Specification
              </span>
            </header>

            <div className="px-6 py-8 md:px-8 md:py-10">
              <h1
                id="service-hero-heading"
                className="font-title font-semibold leading-[0.94] tracking-[-0.05em]"
                style={{ fontSize: "clamp(2.2rem, 4.6vw, 3.8rem)" }}
              >
                {titleLines(service.title).map((line) => (
                  <span key={line} className="block overflow-hidden pb-[0.07em] -mb-[0.07em]">
                    <span
                      data-hero-line
                      className="block"
                      style={{ transform: "translateY(100%)" }}
                    >
                      {line}
                    </span>
                  </span>
                ))}
              </h1>

              <p
                data-hero-row
                className="mt-5 max-w-[44ch] text-[15px] leading-[1.7] text-muted-foreground opacity-0"
                style={{ transform: "translateY(12px)" }}
              >
                {service.heroDesc}
              </p>
            </div>

            {/* Facts as ruled table rows — the card's distinguishing mark. */}
            <dl className="border-t border-primary/15">
              {facts.map((fact) => (
                <div
                  key={fact.label}
                  data-hero-row
                  className="flex items-baseline justify-between gap-6 border-b border-primary/10 px-6 py-3.5 opacity-0 last:border-b-0 md:px-8"
                  style={{ transform: "translateY(12px)" }}
                >
                  <dt className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    {fact.label}
                  </dt>
                  <dd className="text-[14px] tabular-nums text-primary">{fact.value}</dd>
                </div>
              ))}
            </dl>

            <footer
              data-hero-row
              className="flex flex-wrap gap-3 border-t border-primary/15 px-6 py-6 opacity-0 md:px-8"
              style={{ transform: "translateY(12px)" }}
            >
              <QuoteTriggerButton className="rounded-full bg-primary px-7 py-3.5 text-[14px] font-medium text-primary-foreground transition-colors duration-300 hover:bg-enzo-forest-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                Get a free quote
              </QuoteTriggerButton>
              <Link
                href={`/booking?service=${service.slug}`}
                className="rounded-full border border-border px-7 py-3.5 text-[14px] text-primary transition-colors duration-300 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Book a consultation
              </Link>
            </footer>
          </article>
        </div>

        {/* ── The strip ── */}
        <div
          data-hero-strip
          className="relative order-first h-[34svh] overflow-hidden bg-enzo-forest lg:order-none lg:h-[100svh]"
          style={{ clipPath: "inset(0 0 0 100%)" }}
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
