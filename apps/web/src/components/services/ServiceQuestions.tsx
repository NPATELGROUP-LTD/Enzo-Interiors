"use client";

// The questions section, shared by /services and /services/[category].
//
// Replaces the old shared/FAQAccordion for these two routes. Three things
// were wrong with that one: the answer was mounted/unmounted rather than
// animated, so opening one snapped; the "+" was the only affordance; and it
// was a plain stack with no relationship to the rest of the page.
//
// Here the questions sit in the right-hand column against a heading that
// stays put while you read them, each row is numbered like a schedule item,
// and opening one animates a grid row from 0fr to 1fr — the height-agnostic
// way to animate to "whatever this content needs", with no measuring and no
// max-height guess to get wrong when the client writes a longer answer than
// anyone expected.
//
// Single-open by default, because two long answers open at once pushes the
// one you are reading off the screen.
import { useRef, useState } from "react";
import gsap from "gsap";
import { Plus } from "lucide-react";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { useGSAP } from "@/hooks/useGSAP";
import { DUR, EASE, REVEAL_START } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { FAQEntry } from "@/lib/content";

interface ServiceQuestionsProps {
  faqs: FAQEntry[];
  /** Section index in the page's run, e.g. "04". */
  index?: string;
  lines: string[];
  lede?: string;
  tone?: "light" | "dark";
  /** Anchor id, so the detail page's sheet rail can jump here. */
  id?: string;
  className?: string;
}

export function ServiceQuestions({
  faqs,
  index,
  lines,
  lede,
  tone = "light",
  id,
  className,
}: ServiceQuestionsProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState<number | null>(0);
  const dark = tone === "dark";

  useGSAP(sectionRef, (section, reduced) => {
    const rows = gsap.utils.toArray<HTMLElement>("[data-faq-row]", section);
    if (!rows.length) return;

    if (reduced) {
      gsap.set(rows, { opacity: 1, y: 0 });
      return;
    }

    gsap.from(rows, {
      opacity: 0,
      y: 24,
      duration: DUR.enter,
      ease: EASE.enter,
      stagger: 0.06,
      scrollTrigger: { trigger: rows[0], start: REVEAL_START, once: true },
    });
  });

  if (!faqs.length) return null;

  return (
    <section
      ref={sectionRef}
      id={id}
      aria-labelledby={`${id ?? "service"}-questions-heading`}
      className={cn(
        "relative scroll-mt-28",
        dark ? "bg-enzo-forest" : "bg-card",
        className,
      )}
    >
      <div className="mx-auto max-w-[1500px] px-5 py-20 sm:px-6 md:px-12 md:py-28">
        <h2 id={`${id ?? "service"}-questions-heading`} className="sr-only">
          Questions
        </h2>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-20">
          {/* The heading stays with you while the list scrolls past it —
              the list is the long column, so it is the one that should move. */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionIntro
              index={index}
              label="Questions"
              tone={tone}
              datum={`${faqs.length} answered`}
              lines={lines}
              lede={lede}
              titleClassName="!text-[clamp(1.7rem,3vw,2.4rem)]"
            />
          </div>

          <div>
            {faqs.map((faq, i) => {
              const isOpen = open === i;
              return (
                <div
                  key={faq.q}
                  data-faq-row
                  className={cn(
                    "border-t last:border-b",
                    dark ? "border-enzo-cream/12" : "border-border/70",
                  )}
                >
                  <h3>
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : i)}
                      aria-expanded={isOpen}
                      aria-controls={`faq-panel-${id ?? "s"}-${i}`}
                      className={cn(
                        "group flex w-full items-start gap-4 py-6 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 md:gap-6",
                        dark
                          ? "focus-visible:ring-enzo-sand focus-visible:ring-offset-enzo-forest"
                          : "focus-visible:ring-ring focus-visible:ring-offset-card",
                      )}
                    >
                      <span
                        className={cn(
                          "font-display mt-1 shrink-0 text-[11px] font-semibold tabular-nums transition-colors duration-300",
                          dark
                            ? isOpen
                              ? "text-enzo-sand"
                              : "text-enzo-cream/35"
                            : isOpen
                              ? "text-enzo-forest-light"
                              : "text-muted-foreground",
                        )}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>

                      <span
                        className={cn(
                          "flex-1 text-[16px] font-medium leading-[1.45] tracking-[-0.015em] transition-colors duration-300 md:text-[17.5px]",
                          dark
                            ? isOpen
                              ? "text-enzo-cream"
                              : "text-enzo-cream/75 group-hover:text-enzo-cream"
                            : isOpen
                              ? "text-primary"
                              : "text-foreground/80 group-hover:text-primary",
                        )}
                      >
                        {faq.q}
                      </span>

                      <span
                        aria-hidden="true"
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                          dark
                            ? "border-enzo-cream/25 text-enzo-cream group-hover:border-enzo-sand"
                            : "border-border text-primary group-hover:border-primary",
                        )}
                        style={{
                          transform: isOpen ? "rotate(135deg)" : "rotate(0deg)",
                          backgroundColor: isOpen
                            ? dark
                              ? "#D4C9B5"
                              : "#1C4A3A"
                            : "transparent",
                          color: isOpen
                            ? dark
                              ? "#1C4A3A"
                              : "#F2F0EB"
                            : undefined,
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </span>
                    </button>
                  </h3>

                  {/* 0fr → 1fr animates to the content's natural height with
                      no measurement, so a long answer opens correctly. */}
                  <div
                    id={`faq-panel-${id ?? "s"}-${i}`}
                    role="region"
                    className="grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                    style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                  >
                    <div className="overflow-hidden">
                      <p
                        className={cn(
                          "max-w-[62ch] pb-7 pl-[calc(0.75rem+11px)] text-[14.5px] leading-[1.75] transition-opacity duration-500 md:pl-[calc(1.5rem+11px)]",
                          dark ? "text-enzo-cream/65" : "text-muted-foreground",
                        )}
                        style={{ opacity: isOpen ? 1 : 0 }}
                      >
                        {faq.a}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
