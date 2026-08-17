"use client";

// Bespoke, standalone CTA section that follows the Hero v3 sequence once its
// scroll trap releases. Not tied to the room narrative — new copy, new
// visual — but built with a 3-layer parallax (background image slowest,
// oversized watermark word mid-speed, foreground content fastest +
// fade/scale entrance) following the same GSAP ScrollTrigger scrub
// technique BookingCTA.tsx already uses for its single background layer,
// extended for the layered depth effect referenced in the brief.
import Link from "next/link";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { Button } from "@/components/ui/Button";

let scrollTriggerRegistered = false;

const CTA_BG =
  "https://images.unsplash.com/photo-1765434669956-afcd50058d69?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBiZWRyb29tJTIwaW50ZXJpb3IlMjB3YXJtfGVufDF8fHx8MTc3MjM5ODIzZF8w&ixlib=rb-4.1.0&q=80&w=1080";

export function HeroParallaxCTA() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const bgRef = useRef<HTMLDivElement | null>(null);
  const watermarkRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const bg = bgRef.current;
    const watermark = watermarkRef.current;
    const content = contentRef.current;
    if (!section || !bg || !watermark || !content) return;

    if (!scrollTriggerRegistered) {
      gsap.registerPlugin(ScrollTrigger);
      scrollTriggerRegistered = true;
    }

    const ctx = gsap.context(() => {
      // Layer 1 — background image, slowest drift.
      gsap.fromTo(
        bg,
        { yPercent: -10 },
        {
          yPercent: 10,
          ease: "none",
          scrollTrigger: { trigger: section, start: "top bottom", end: "bottom top", scrub: 0.6 },
        },
      );

      // Layer 2 — oversized watermark word, medium drift + slight scale.
      gsap.fromTo(
        watermark,
        { yPercent: 22, scale: 0.94 },
        {
          yPercent: -22,
          scale: 1.02,
          ease: "none",
          scrollTrigger: { trigger: section, start: "top bottom", end: "bottom top", scrub: 0.6 },
        },
      );

      // Layer 3 — foreground content: fastest drift + fade/scale entrance.
      gsap.fromTo(
        content,
        { yPercent: 14 },
        {
          yPercent: -14,
          ease: "none",
          scrollTrigger: { trigger: section, start: "top bottom", end: "bottom top", scrub: 0.6 },
        },
      );
      gsap.fromTo(
        content,
        { opacity: 0, y: 40, scale: 0.97 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: { trigger: section, start: "top 75%", once: true },
        },
      );
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden py-32 md:py-40"
    >
      <div className="absolute inset-0">
        <div ref={bgRef} className="absolute inset-[-10%]">
          <ImageWithFallback src={CTA_BG} alt="" className="h-full w-full object-cover" />
        </div>
        <div className="absolute inset-0 bg-enzo-dark/80" />
      </div>

      <div
        ref={watermarkRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 select-none text-center font-serif leading-none text-enzo-cream/[0.06]"
        style={{ fontSize: "clamp(6rem, 22vw, 20rem)" }}
      >
        Enzo
      </div>

      <div ref={contentRef} className="relative z-10 px-6 text-center opacity-0">
        <span className="mb-5 block text-[12px] uppercase tracking-[0.3em] text-enzo-sage">
          Start Your Project
        </span>
        <h2
          className="mx-auto max-w-3xl text-enzo-cream"
          style={{ fontSize: "clamp(2.25rem, 5.5vw, 4rem)" }}
        >
          Let&apos;s Build Something Beautiful, Together
        </h2>
        <p className="mx-auto mt-5 max-w-md text-[16px] text-enzo-cream/70 md:text-[18px]">
          A free, no-obligation design consultation — in your home, on your terms.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/booking">Book a Free Consultation</Link>
          </Button>
          <Button asChild variant="secondary" size="lg" className="border-2">
            <Link href="/portfolio">View Our Work</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
