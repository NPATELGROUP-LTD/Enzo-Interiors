"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { ScrollReveal } from "@/components/shared/ScrollReveal";
import { SectionLabel } from "@/components/shared/SectionLabel";
import { Button } from "@/components/ui/Button";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { PortfolioItem } from "@/lib/content";

gsap.registerPlugin(ScrollTrigger);

const TILE_HEIGHTS = ["350px", "280px", "320px"];

interface PortfolioMasonryProps {
  items: PortfolioItem[];
}

export function PortfolioMasonry({ items }: PortfolioMasonryProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  // Parallax scrub only on tablet/desktop — mobile keeps a plain fade-in
  // stack since scroll-linked transforms tend to fight native touch scroll.
  const isDesktop = useMediaQuery("(min-width: 768px)");

  useEffect(() => {
    if (!isDesktop) return;
    const grid = gridRef.current;
    if (!grid) return;

    const tweens = Array.from(grid.querySelectorAll<HTMLElement>("[data-parallax-img]")).map(
      (el, i) => {
        const rate = 20 + (i % 3) * 12;
        return gsap.fromTo(
          el,
          { yPercent: -rate },
          {
            yPercent: rate,
            ease: "none",
            scrollTrigger: {
              trigger: el.closest("[data-parallax-item]") ?? el,
              start: "top bottom",
              end: "bottom top",
              scrub: 0.6,
            },
          },
        );
      },
    );

    return () => {
      tweens.forEach((t) => {
        t.scrollTrigger?.kill();
        t.kill();
      });
    };
  }, [isDesktop]);

  return (
    <section className="bg-background py-24 md:py-32">
      <div className="mx-auto max-w-[1400px] px-6 md:px-12">
        <ScrollReveal>
          <SectionLabel text="Our Work" />
          <h2
            className="mt-4 text-center text-primary"
            style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)" }}
          >
            Spaces We&apos;ve Transformed.
          </h2>
        </ScrollReveal>

        <div ref={gridRef} className="mt-12 columns-1 gap-4 md:columns-2 lg:columns-3">
          {items.map((item, i) => (
            <ScrollReveal key={item.id} delay={i * 0.05} className="mb-4 break-inside-avoid">
              <div
                data-parallax-item
                className="group relative cursor-pointer overflow-hidden rounded-xl"
                data-cursor="view"
                style={{ height: TILE_HEIGHTS[i % TILE_HEIGHTS.length] }}
              >
                <ImageWithFallback
                  data-parallax-img
                  src={item.image}
                  alt={item.title}
                  className="h-[130%] w-full object-cover"
                  style={{ marginTop: isDesktop ? "-15%" : undefined }}
                />
                <div className="absolute inset-0 flex items-end bg-enzo-forest/0 p-6 transition-all duration-500 group-hover:bg-enzo-forest/60">
                  <span className="translate-y-4 text-[15px] text-enzo-cream opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                    {item.title} &rarr;
                  </span>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal className="mt-12 text-center">
          <Button asChild variant="outline">
            <Link href="/portfolio">View All Projects &rarr;</Link>
          </Button>
        </ScrollReveal>
      </div>
    </section>
  );
}
