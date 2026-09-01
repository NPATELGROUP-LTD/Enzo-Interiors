"use client";

// Detail hero — variant 1 of 4: THE MASTHEAD.
//
// The four heroes used to differ only in geometry: all four sat on the same
// near-black ground, ran the same sequence (eyebrow, title, lede, two
// buttons, facts), and three of them were type-left / picture-right. Four
// different arrangements of identical ingredients on identical paper read
// as one hero, which is exactly what they looked like.
//
// So the four now differ in *ground*, *axis* and *what is on them*. This
// one is the only light hero with a full-width masthead: the title runs
// edge to edge across the top at magazine scale, a single wide letterbox
// band of the room sits under it, and everything else is a three-column
// footer beneath that. Nothing is beside anything — it reads top to bottom.
import { useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { useGSAP } from "@/hooks/useGSAP";
import { DUR, EASE } from "@/lib/motion";
import type { ServiceDetail } from "@/lib/content";
import { QuoteTriggerButton } from "../../shared/QuoteRequestModal";
import { getHeroFacts } from "./heroFacts";

export function HeroMasthead({
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
    const band = section.querySelector<HTMLElement>("[data-hero-band]");
    const photo = section.querySelector<HTMLElement>("[data-hero-photo]");
    const rule = section.querySelector<HTMLElement>("[data-hero-rule]");

    if (reduced) {
      gsap.set([...meta, ...body], { opacity: 1, y: 0 });
      gsap.set(lines, { yPercent: 0 });
      if (band) gsap.set(band, { clipPath: "inset(0 0 0 0)" });
      if (photo) gsap.set(photo, { scale: 1 });
      if (rule) gsap.set(rule, { scaleX: 1 });
      return;
    }

    gsap.set(lines, { yPercent: 100, y: 0 });

    const tl = gsap.timeline({ delay: 0.12 });

    tl.to(meta, { opacity: 1, y: 0, duration: DUR.enter, ease: EASE.enter, stagger: 0.05 })
      .to(rule, { scaleX: 1, duration: 0.9, ease: EASE.editorial }, 0.05)
      .to(
        lines,
        { yPercent: 0, duration: DUR.editorial, ease: EASE.editorial, stagger: 0.09 },
        0.1,
      )
      // The band opens downward from the masthead, like a plate being run
      // under a headline on press.
      .fromTo(
        band,
        { clipPath: "inset(0 0 100% 0)" },
        { clipPath: "inset(0 0 0% 0)", duration: 1.15, ease: EASE.editorial },
        0.4,
      )
      .fromTo(photo, { scale: 1.16 }, { scale: 1, duration: 1.5, ease: EASE.editorial }, 0.4)
      .to(body, { opacity: 1, y: 0, duration: DUR.enter, ease: EASE.enter, stagger: 0.07 }, 0.75);

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
      className="relative bg-background text-primary"
    >
      <div className="mx-auto max-w-[1500px] px-5 pb-16 pt-[7.5rem] sm:px-6 md:px-12 md:pt-[9rem]">
        {/* Masthead rule */}
        <div className="flex items-center gap-4">
          <span
            data-hero-meta
            className="font-display shrink-0 text-[10.5px] font-semibold uppercase tracking-[0.3em] text-enzo-forest-light opacity-0"
            style={{ transform: "translateY(8px)" }}
          >
            {service.category}
          </span>
          <span aria-hidden="true" className="relative h-px flex-1 overflow-hidden">
            <span
              data-hero-rule
              className="absolute inset-0 block origin-left bg-primary/25"
              style={{ transform: "scaleX(0)" }}
            />
          </span>
          <span
            data-hero-meta
            className="shrink-0 text-[11px] tracking-[0.02em] text-muted-foreground opacity-0"
            style={{ transform: "translateY(8px)" }}
          >
            Leicester &amp; Leicestershire
          </span>
        </div>

        {/* The masthead itself — full width, one word per line. */}
        <h1
          id="service-hero-heading"
          className="mt-6 font-title font-semibold leading-[0.86] tracking-[-0.06em]"
          style={{ fontSize: "clamp(3rem, 12.5vw, 10rem)" }}
        >
          {service.title.split(" ").map((word) => (
            <span key={word} className="block overflow-hidden pb-[0.06em] -mb-[0.06em]">
              <span data-hero-line className="block" style={{ transform: "translateY(100%)" }}>
                {word}
              </span>
            </span>
          ))}
        </h1>

        {/* One wide band. */}
        <div
          data-hero-band
          className="relative mt-10 aspect-[16/9] w-full overflow-hidden rounded-[4px] bg-enzo-forest sm:aspect-[21/8]"
          style={{ clipPath: "inset(0 0 100% 0)" }}
        >
          <ImageWithFallback
            src={service.image}
            alt={service.title}
            data-hero-photo
            className="absolute inset-0 h-full w-full scale-110 object-cover will-change-transform"
          />
        </div>

        {/* Footer: three columns under the band, nothing beside the title. */}
        <div className="mt-10 grid gap-10 border-t border-border/70 pt-8 md:grid-cols-3 md:gap-14">
          <p
            data-hero-body
            className="max-w-[38ch] text-[15px] leading-[1.7] text-muted-foreground opacity-0"
            style={{ transform: "translateY(14px)" }}
          >
            {service.heroDesc}
          </p>

          <dl
            data-hero-body
            className="grid grid-cols-2 gap-x-6 gap-y-4 opacity-0"
            style={{ transform: "translateY(14px)" }}
          >
            {facts.map((fact) => (
              <div key={fact.label}>
                <dt className="text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
                  {fact.label}
                </dt>
                <dd className="mt-1.5 text-[14px] tabular-nums text-primary">
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>

          <div
            data-hero-body
            className="flex flex-wrap items-start gap-3 opacity-0 md:justify-end"
            style={{ transform: "translateY(14px)" }}
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
          </div>
        </div>
      </div>
    </section>
  );
}
