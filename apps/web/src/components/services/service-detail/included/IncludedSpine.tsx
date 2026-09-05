"use client";

// "What's included" — layout 2 of 4: THE SPINE.
//
// Items alternate either side of a single vertical rule that draws itself
// down the section as you scroll. Nothing is in a card and nothing is in a
// column: the eye zig-zags down the centre line, which slows reading to
// roughly one item at a time — the opposite of a two-column ledger you can
// skim in one pass.
//
// The rule's height is tied to scroll position (read from the live bounding
// box on gsap.ticker, per the note in components/landing/ProcessLedger.tsx),
// so it is genuinely drawing as you descend rather than playing a canned
// animation once.
//
// Ground: off-white. Sits between a full-bleed photographic hero and a
// near-black finishes section.
import { useRef, useState } from "react";
import gsap from "gsap";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { useGSAP } from "@/hooks/useGSAP";
import { cn } from "@/lib/utils";
import type { ServiceDetail } from "@/lib/content";

export function IncludedSpine({
  service,
  id,
}: {
  service: ServiceDetail;
  id: string;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const [reached, setReached] = useState(0);
  const total = service.features.length;

  useGSAP(sectionRef, (section, reduced) => {
    const list = section.querySelector<HTMLElement>("[data-spine-list]");
    const rule = section.querySelector<HTMLElement>("[data-spine-rule]");
    if (!list) return;

    if (reduced) {
      setReached(total);
      if (rule) gsap.set(rule, { scaleY: 1 });
      return;
    }

    const track = () => {
      const rect = list.getBoundingClientRect();
      const readLine = window.innerHeight * 0.66;
      const progress = gsap.utils.clamp(0, 1, (readLine - rect.top) / rect.height);
      if (rule) gsap.set(rule, { scaleY: progress });
      const index = Math.min(total, Math.ceil(progress * total));
      setReached((current) => (current === index ? current : index));
    };

    gsap.ticker.add(track);
    track();

    return () => {
      gsap.ticker.remove(track);
    };
  });

  return (
    <section
      ref={sectionRef}
      id={id}
      aria-labelledby="included-heading"
      className="relative bg-card scroll-mt-24"
    >
      <div className="mx-auto max-w-[1500px] px-5 py-20 sm:px-6 md:px-12 md:py-28">
        <h2 id="included-heading" className="sr-only">
          What is included
        </h2>

        {/* `split`, not the default stack. Stacked, SectionIntro caps itself
            at 60ch, so a three-line title and a long overview sat in a
            column down the left of a 1500px sheet with the whole right half
            empty. Every other section on these pages splits; this one was
            the only one that did not. */}
        <SectionIntro
          layout="split"
          index="A2"
          label="Included"
          datum={`${total} as standard`}
          lines={["Everything on", "this list is", "in the price."]}
          lede={service.overview}
          ledeShort={service.overviewShort}
        />

        <div data-spine-list className="relative mx-auto mt-16 max-w-4xl md:mt-20">
          {/* The spine, and the part of it already drawn. */}
          <span
            aria-hidden="true"
            className="absolute left-[7px] top-0 h-full w-px bg-border md:left-1/2"
          />
          <span
            aria-hidden="true"
            data-spine-rule
            className="absolute left-[7px] top-0 h-full w-px origin-top bg-primary md:left-1/2"
            style={{ transform: "scaleY(0)" }}
          />

          {service.features.map((feature, index) => {
            const done = index < reached;
            const right = index % 2 === 1;
            return (
              <div
                key={feature}
                className={cn(
                  "relative py-5 pl-10 md:w-1/2 md:py-6",
                  right ? "md:ml-auto md:pl-12 md:text-left" : "md:pl-0 md:pr-12 md:text-right",
                )}
              >
                {/* Node on the spine. */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-[1.65rem] h-[9px] w-[9px] rounded-full transition-all duration-500 md:top-[2rem]",
                    right ? "left-[3px] md:-left-[4px]" : "left-[3px] md:-right-[4px] md:left-auto",
                  )}
                  style={{
                    backgroundColor: done ? "var(--enzo-forest)" : "var(--border)",
                    transform: done ? "scale(1.25)" : "scale(1)",
                  }}
                />

                <span
                  className="font-display block text-[10.5px] font-semibold tabular-nums tracking-[0.16em] transition-colors duration-500"
                  style={{
                    color: done ? "var(--enzo-forest-light)" : "var(--muted-foreground)",
                  }}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span
                  className="mt-1.5 block font-title font-semibold leading-[1.25] tracking-[-0.025em] transition-colors duration-500"
                  style={{
                    fontSize: "clamp(1.05rem, 1.7vw, 1.4rem)",
                    color: done ? "var(--enzo-forest)" : "color-mix(in srgb, var(--foreground) 32%, transparent)",
                  }}
                >
                  {feature}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
