"use client";

import { useRef } from "react";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { InstagramIcon } from "@/components/shared/icons";
import { useStaggerReveal } from "@/hooks/useStaggerReveal";
import type { PortfolioItem } from "@/lib/content";

interface InstagramGridProps {
  items: PortfolioItem[];
}

export function InstagramGrid({ items }: InstagramGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  useStaggerReveal(gridRef);

  const images = items.slice(0, 6);

  return (
    <section className="bg-background py-20">
      <div className="mx-auto max-w-[1400px] px-6 md:px-12">
        <h2
          className="text-center text-primary"
          style={{ fontSize: "clamp(1.5rem, 3vw, 2.2rem)" }}
        >
          Follow Our Journey
        </h2>
        <p className="mt-2 text-center text-[14px] text-secondary">@enzo.interiors</p>

        <div ref={gridRef} className="mt-10 grid grid-cols-3 gap-2 md:grid-cols-6">
          {images.map((item) => (
            <a
              key={item.id}
              href="https://instagram.com/enzo.interiors"
              target="_blank"
              rel="noopener noreferrer"
              data-cursor="view"
              className="group relative block aspect-square cursor-pointer overflow-hidden rounded-lg"
            >
              <ImageWithFallback
                src={item.image}
                alt={item.title}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-enzo-forest/0 transition-all duration-300 group-hover:bg-enzo-forest/60">
                <InstagramIcon
                  size={24}
                  className="text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                />
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
