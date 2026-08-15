"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { ScrollReveal } from "@/components/shared/ScrollReveal";
import { Button } from "@/components/ui/Button";

gsap.registerPlugin(ScrollTrigger);

const CTA_BG =
  "https://images.unsplash.com/photo-1765434669956-afcd50058d69?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBiZWRyb29tJTIwaW50ZXJpb3IlMjB3YXJtfGVufDF8fHx8MTc3MjM5ODIzZF8w&ixlib=rb-4.1.0&q=80&w=1080";

export function BookingCTA() {
  const sectionRef = useRef<HTMLElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const bg = bgRef.current;
    if (!section || !bg) return;

    const tween = gsap.fromTo(
      bg,
      { yPercent: -8 },
      {
        yPercent: 8,
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top bottom",
          end: "bottom top",
          scrub: 0.6,
        },
      },
    );

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, []);

  return (
    <section ref={sectionRef} className="relative overflow-hidden py-32 md:py-40">
      <div className="absolute inset-0">
        <div ref={bgRef} className="absolute inset-[-10%]">
          <ImageWithFallback src={CTA_BG} alt="Interior" className="h-full w-full object-cover" />
        </div>
        <div className="absolute inset-0 bg-black/65" />
      </div>
      <div className="relative z-10 px-6 text-center">
        <ScrollReveal>
          <h2 className="text-enzo-cream" style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)" }}>
            Ready to transform your space?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[16px] text-enzo-cream/70 md:text-[18px]">
            Book a free consultation — no pressure, no obligation
          </p>
          <div className="mt-10">
            <Button asChild variant="secondary" size="lg" className="border-2">
              <Link href="/booking">Book a Slot &rarr;</Link>
            </Button>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
