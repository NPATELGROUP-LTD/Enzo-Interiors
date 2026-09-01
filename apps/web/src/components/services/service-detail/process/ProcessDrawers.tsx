"use client";

// Process — layout 4 of 4: THE DRAWER BANK (wardrobes).
//
// Replaces an offset grid of cards, which was the least distinctive layout
// in the set — a grid of boxes with numbers on them.
//
// Here the stages are drawer fronts in a stack. Opening one slides it out
// and reveals its description in the carcass behind; the others stay shut.
// It is the product's own mechanism used as the interface, and it means the
// section is a fixed, compact height whatever the stage count instead of
// growing into a wall of text.
//
// Ground: warm grey.
import { useRef, useState } from "react";
import gsap from "gsap";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { useGSAP } from "@/hooks/useGSAP";
import { EASE, REVEAL_START } from "@/lib/motion";
import { spellCount } from "@/lib/service-metrics";
import { cn } from "@/lib/utils";
import type { ProcessStep } from "@/lib/content";

export function ProcessDrawers({
  steps,
  id,
}: {
  steps: ProcessStep[];
  id: string;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(0);

  useGSAP(sectionRef, (section, reduced) => {
    const drawers = gsap.utils.toArray<HTMLElement>("[data-drawer]", section);
    if (!drawers.length) return;

    if (reduced) {
      gsap.set(drawers, { opacity: 1, y: 0 });
      return;
    }

    gsap.from(drawers, {
      opacity: 0,
      y: 20,
      duration: 0.6,
      ease: EASE.enter,
      stagger: 0.07,
      scrollTrigger: { trigger: drawers[0], start: REVEAL_START, once: true },
    });
  });

  if (!steps.length) return null;

  return (
    <section
      ref={sectionRef}
      id={id}
      aria-labelledby="process-heading"
      className="relative bg-muted scroll-mt-24"
    >
      <div className="mx-auto max-w-[1500px] px-5 py-20 sm:px-6 md:px-12 md:py-28">
        <h2 id="process-heading" className="sr-only">
          How it is built
        </h2>

        <SectionIntro
          layout="split"
          index="A4"
          label="Sequence"
          datum={`${steps.length} stages`}
          lines={[`${spellCount(steps.length)} stages,`, "one drawer at a time."]}
          lede="Pull one open to read it. One team throughout — nothing here is subcontracted."
        />

        <div className="mx-auto mt-14 max-w-4xl overflow-hidden rounded-[18px] border border-border/70 bg-background md:mt-16">
          {steps.map((step, index) => {
            const isOpen = index === open;
            return (
              <div
                key={step.step}
                data-drawer
                className={cn(
                  "border-b border-border/70 last:border-b-0",
                  isOpen && "bg-card",
                )}
              >
                <h3>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? -1 : index)}
                    aria-expanded={isOpen}
                    aria-controls={`stage-${index}`}
                    className="group flex w-full items-center gap-5 px-6 py-6 text-left transition-[padding] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:px-8"
                    style={{ paddingLeft: isOpen ? "2.75rem" : undefined }}
                  >
                    <span className="font-display shrink-0 text-[10.5px] font-semibold tabular-nums tracking-[0.2em] text-enzo-forest-light">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={cn(
                        "flex-1 font-title font-semibold leading-[1.15] tracking-[-0.03em] transition-colors duration-300",
                        isOpen ? "text-primary" : "text-foreground/75 group-hover:text-primary",
                      )}
                      style={{ fontSize: "clamp(1.1rem, 2vw, 1.5rem)" }}
                    >
                      {step.step}
                    </span>
                    {/* Drawer pull — the handle, and the only indicator. */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "h-[5px] shrink-0 rounded-full transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                        isOpen ? "w-16 bg-primary" : "w-10 bg-border group-hover:bg-primary/50",
                      )}
                    />
                  </button>
                </h3>

                <div
                  id={`stage-${index}`}
                  className="grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                  style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                >
                  <div className="overflow-hidden">
                    <p
                      className="max-w-[58ch] pb-7 pl-[2.75rem] pr-8 text-[14.5px] leading-[1.7] text-muted-foreground transition-opacity duration-500 md:pl-[4.75rem]"
                      style={{ opacity: isOpen ? 1 : 0 }}
                    >
                      {step.desc}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
