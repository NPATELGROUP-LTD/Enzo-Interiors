"use client";

import { useRef } from "react";
import { GlareCard } from "@/components/shared/GlareCard";
import { SectionLabel } from "@/components/shared/SectionLabel";
import { useStaggerReveal } from "@/hooks/useStaggerReveal";
import type { Service } from "@/lib/content";

interface ServicesBentoProps {
  services: Service[];
}

// Bento treatment for the 4 core services: the first service gets a large
// featured tile, the remaining three sit alongside it as smaller tiles.
export function ServicesBento({ services }: ServicesBentoProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  useStaggerReveal(gridRef);

  const [featured, ...rest] = services;

  return (
    <section className="bg-background py-24 md:py-32">
      <div className="mx-auto max-w-[1400px] px-6 md:px-12">
        <SectionLabel text="Our Services" />
        <h2
          className="mt-4 text-center text-primary"
          style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)" }}
        >
          Everything. Beautifully Made.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-[16px] text-muted-foreground">
          From initial concept to final installation, we handle every detail.
        </p>

        <div
          ref={gridRef}
          className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-4 md:auto-rows-[220px]"
        >
          {featured && (
            <GlareCard
              key={featured.title}
              {...featured}
              className="md:col-span-2 md:row-span-2"
              imageClassName="h-72 md:h-full"
            />
          )}
          {rest.map((service, i) => (
            <GlareCard
              key={service.title}
              {...service}
              className={i === 0 ? "md:col-span-2" : "md:col-span-1"}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
