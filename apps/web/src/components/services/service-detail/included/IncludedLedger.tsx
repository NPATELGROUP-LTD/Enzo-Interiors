"use client";

// "What's included" — layout 1 of 4: THE BILL OF QUANTITIES.
//
// A joiner's ledger: two ruled columns, every item numbered, a leader line
// running from the item to the right-hand rule. It reads as the schedule
// attached to a quotation, which is exactly what it is.
//
// Rows ink in left to right — the leader draws, then the item lands — so
// the section writes itself out rather than fading up as a block.
//
// Ground: cream. This is the first light section after a dark hero.
import { useRef } from "react";
import gsap from "gsap";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { useGSAP } from "@/hooks/useGSAP";
import { EASE, REVEAL_START } from "@/lib/motion";
import type { ServiceDetail } from "@/lib/content";

export function IncludedLedger({
  service,
  id,
}: {
  service: ServiceDetail;
  id: string;
}) {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(sectionRef, (section, reduced) => {
    const rows = gsap.utils.toArray<HTMLElement>("[data-row]", section);
    const leaders = gsap.utils.toArray<HTMLElement>("[data-leader]", section);
    if (!rows.length) return;

    if (reduced) {
      gsap.set(rows, { opacity: 1, x: 0 });
      gsap.set(leaders, { scaleX: 1 });
      return;
    }

    const tl = gsap.timeline({
      scrollTrigger: { trigger: rows[0], start: REVEAL_START, once: true },
    });

    tl.from(rows, {
      opacity: 0,
      x: -14,
      duration: 0.5,
      ease: EASE.enter,
      stagger: 0.04,
    }).from(
      leaders,
      { scaleX: 0, duration: 0.6, ease: EASE.editorial, stagger: 0.04 },
      0.1,
    );

    return () => {
      tl.kill();
    };
  });

  return (
    <section
      ref={sectionRef}
      id={id}
      aria-labelledby="included-heading"
      className="relative bg-background scroll-mt-24"
    >
      <div className="mx-auto max-w-[1500px] px-5 py-20 sm:px-6 md:px-12 md:py-28">
        <h2 id="included-heading" className="sr-only">
          What is included
        </h2>

        <SectionIntro
          layout="split"
          index="A2"
          label="Schedule"
          datum={`${service.features.length} line items`}
          lines={["Specified", "line by line."]}
          lede={service.overview}
        />

        <div className="mt-14 grid gap-x-16 md:grid-cols-2">
          {service.features.map((feature, index) => (
            <div
              key={feature}
              data-row
              className="group flex items-baseline gap-4 border-b border-border/60 py-4"
            >
              <span className="font-display w-7 shrink-0 text-[10.5px] font-semibold tabular-nums tracking-[0.14em] text-muted-foreground">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="shrink-0 text-[14.5px] leading-[1.5] tracking-[-0.01em] text-foreground transition-colors duration-300 group-hover:text-primary">
                {feature}
              </span>
              {/* Leader line to the right-hand rule, exactly as a printed
                  schedule sets its items against their column. */}
              <span
                aria-hidden="true"
                data-leader
                className="mb-1 h-px flex-1 origin-left"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(to right, color-mix(in srgb, var(--foreground) 28%, transparent) 0 1px, transparent 1px 5px)",
                }}
              />
              <span className="shrink-0 text-[11px] uppercase tracking-[0.18em] text-enzo-forest-light">
                Incl.
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
