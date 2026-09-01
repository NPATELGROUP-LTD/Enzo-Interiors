"use client";

// "What's included" — layout 4 of 4: THE MANIFEST.
//
// One column, one item per line, set very large. No grid, no cards, no
// second column to glance at. Each line slides in from its own depth as it
// arrives, so the list has a rhythm without any of them being decorated.
//
// This is the loudest of the four "included" layouts on purpose: the other
// three are documents (a ledger, a spine, a shelving wall) and this one is
// a statement. It carries the item count as a running figure down the right
// margin so the length is legible without numbering every line twice.
//
// Ground: cream, closing a light run before the finishes go dark.
import { useRef } from "react";
import gsap from "gsap";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { useGSAP } from "@/hooks/useGSAP";
import { EASE } from "@/lib/motion";
import type { ServiceDetail } from "@/lib/content";

export function IncludedManifest({
  service,
  id,
}: {
  service: ServiceDetail;
  id: string;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const total = service.features.length;

  useGSAP(sectionRef, (section, reduced) => {
    const rows = gsap.utils.toArray<HTMLElement>("[data-line]", section);
    if (!rows.length) return;

    if (reduced) {
      gsap.set(rows, { opacity: 1, x: 0 });
      return;
    }

    // Alternating entry direction gives the column a sway that a uniform
    // fade-up cannot, without any element ending up off its own baseline.
    rows.forEach((row, index) => {
      gsap.from(row, {
        opacity: 0,
        x: index % 2 === 0 ? -28 : 28,
        duration: 0.8,
        ease: EASE.editorial,
        scrollTrigger: { trigger: row, start: "top 88%", once: true },
      });
    });
  });

  return (
    <section
      ref={sectionRef}
      id={id}
      aria-labelledby="included-heading"
      className="relative overflow-hidden bg-background scroll-mt-24"
    >
      <div className="mx-auto max-w-[1500px] px-5 py-20 sm:px-6 md:px-12 md:py-28">
        <h2 id="included-heading" className="sr-only">
          What is included
        </h2>

        <SectionIntro
          layout="split"
          index="A2"
          label="Manifest"
          datum={`${total} as standard`}
          lines={["All of it,", "in the price."]}
          lede={service.overview}
        />

        <ul className="mt-14 md:mt-20">
          {service.features.map((feature, index) => (
            <li
              key={feature}
              data-line
              className="group flex items-baseline gap-5 border-t border-border/50 py-5 last:border-b md:gap-8 md:py-7"
            >
              <span
                className="font-title shrink-0 font-semibold leading-none tracking-[-0.05em] text-primary/15 transition-colors duration-400 group-hover:text-primary/30"
                style={{ fontSize: "clamp(1.6rem, 3vw, 2.6rem)" }}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <span
                className="flex-1 font-title font-semibold leading-[1.1] tracking-[-0.035em] text-primary"
                style={{ fontSize: "clamp(1.2rem, 3.1vw, 2.4rem)" }}
              >
                {feature}
              </span>
              <span className="hidden shrink-0 text-[11px] tabular-nums text-muted-foreground sm:block">
                {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
