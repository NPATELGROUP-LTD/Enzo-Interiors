"use client";

// The questions section, shared by /services and /services/[category].
//
// ── It is not an accordion any more, and that is the point ──
// Two accordions were built here and both were rejected. The first had a
// sticky heading beside a narrow column and a hairline that grew as the
// state indicator — you could not tell an open row from a shut one except
// mid-transition. The second went full width and opened the answer beside
// its question with a square-to-diamond marker, which fixed the indicator
// and the measure but was still, structurally, the same object.
//
// The thing being redesigned was never the marker. Six short questions with
// two-sentence answers do not need to be hidden: the whole set sets in about
// the height of one open accordion, an accordion makes the visitor click
// six times to read what they came for, and every answer costs a state
// change to see. So the answers are simply on the page.
//
// What replaces it is the *general notes* block off a drawing sheet — the
// numbered list of things that hold true across the whole job, set in two
// real typeset columns. CSS multi-column does the work: notes flow down
// column one and continue in column two, every note stays whole
// (`break-inside-avoid`), and a client publishing a seventh question needs
// no layout change and no measuring code. No other section on either page
// uses multi-column, which is what keeps this one distinct now that it has
// no mechanic of its own.
//
// Nothing here is interactive, so nothing here needs an aria-expanded, a
// panel id, a focus ring or a keyboard contract. That is a feature.
//
// ── `mobileAccordion`, opt-in, and why this file argues with itself below lg ──
// The reasoning above is sound for a two-column typeset sheet — but that
// sheet does not exist below `lg`: it is six full questions and six full
// answers stacked in one column with nothing to shorten it, which measured
// 1,796px on a 375×812 screen for /services alone. The argument "an
// accordion costs a click" is a fair trade against a sheet you can scan in
// one glance; it is a much worse trade against two-and-a-bit screens of
// scrolling on a phone, where the six-click cost is one tap each and the
// reward is reaching the rest of the page.
//
// So `mobileAccordion` (default `false`, so /services/[category] is
// unchanged) switches the below-lg layout only, to the same closed-by-
// default, one-open-at-a-time accordion `ServicesDoors.tsx` already uses for
// its own four-item mobile list — same `Plus`/`Minus` toggle, same
// `grid-template-rows` collapse, so a visitor who has already met that
// pattern once on the landing page reads it here without re-learning
// anything. `lg` and up is untouched either way: the two-column sheet, every
// answer on the page, exactly as designed above.
import { useRef, useState } from "react";
import gsap from "gsap";
import { Minus, Plus } from "lucide-react";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { fromOnScroll, useGSAP } from "@/hooks/useGSAP";
import { DUR, EASE, REVEAL_START } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { FAQEntry } from "@/lib/content";

interface QuestionsNotesProps {
  faqs: FAQEntry[];
  /** Section index in the page's run, e.g. "04". */
  index?: string;
  lines: string[];
  lede?: string;
  tone?: "light" | "dark";
  /** Anchor id, so the detail page's sheet rail can jump here. */
  id?: string;
  className?: string;
  /** Below lg, render as a closed-by-default accordion instead of the full
   *  typeset sheet. Default `false` — see the file-header note. */
  mobileAccordion?: boolean;
}

export function QuestionsNotes({
  faqs,
  index,
  lines,
  lede,
  tone = "light",
  id,
  className,
  mobileAccordion = false,
}: QuestionsNotesProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState<number | null>(null);
  const dark = tone === "dark";

  useGSAP(sectionRef, (section, reduced) => {
    const notes = gsap.utils.toArray<HTMLElement>("[data-note]", section);
    const rows = gsap.utils.toArray<HTMLElement>("[data-note-row]", section);
    if (!notes.length && !rows.length) return;

    if (reduced) {
      gsap.set([...notes, ...rows], { opacity: 1, y: 0 });
      return;
    }

    if (notes.length) {
      fromOnScroll(
        notes,
        {
          opacity: 0,
          y: 22,
          duration: DUR.enter,
          ease: EASE.enter,
          stagger: 0.05,
        },
        { trigger: notes[0], start: REVEAL_START },
      );
    }
    if (rows.length) {
      fromOnScroll(
        rows,
        {
          opacity: 0,
          y: 22,
          duration: DUR.enter,
          ease: EASE.enter,
          stagger: 0.05,
        },
        { trigger: rows[0], start: REVEAL_START },
      );
    }
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

        <SectionIntro
          layout="split"
          index={index}
          label="Notes"
          tone={tone}
          datum={`${faqs.length} answered`}
          lines={lines}
          lede={lede}
        />

        {/* Two typeset columns. `columns` rather than a grid because the
            notes are different lengths: a grid would leave every row as tall
            as its tallest cell, while a column flow simply continues.

            `lg` and up always; below `lg` too, when the caller has not opted
            into the accordion. */}
        <div
          className={cn(
            "mt-14 md:mt-20 lg:columns-2 lg:gap-x-20 xl:gap-x-28",
            mobileAccordion && "hidden lg:block",
          )}
        >
          {faqs.map((faq, i) => (
            <article
              key={faq.q}
              data-note
              className="break-inside-avoid pb-11 md:pb-14"
            >
              {/* Short sand rule over each note — the same mark the hero
                  puts over the active discipline, one size down. */}
              <span
                aria-hidden="true"
                className={cn(
                  "block h-px w-10",
                  dark ? "bg-enzo-sand" : "bg-enzo-forest-light",
                )}
              />

              <div className="mt-5 grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-2 md:grid-cols-[2.75rem_minmax(0,1fr)]">
                {/* Hanging index, so the questions and answers keep one
                    left edge all the way down the column. */}
                <span
                  className={cn(
                    "font-display pt-[0.3em] text-[11.5px] font-semibold tabular-nums tracking-[0.16em]",
                    dark ? "text-enzo-sand" : "text-enzo-forest-light",
                  )}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>

                <div>
                  <h3
                    className={cn(
                      "font-title font-semibold leading-[1.22] tracking-[-0.025em]",
                      dark ? "text-enzo-cream" : "text-primary",
                    )}
                    style={{ fontSize: "clamp(1.15rem, 1.55vw, 1.45rem)" }}
                  >
                    {faq.q}
                  </h3>
                  <p
                    className={cn(
                      "mt-3.5 text-[15px] leading-[1.75]",
                      dark ? "text-enzo-cream/65" : "text-muted-foreground",
                    )}
                  >
                    {faq.a}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* ── Below lg, opt-in only: the same six notes as a closed-by-
            default accordion — ServicesDoors' own mobile pattern, so the
            interaction is not a new one for a returning visitor. */}
        {mobileAccordion && (
          <div className="mt-14 lg:hidden">
            {faqs.map((faq, i) => {
              const isOpen = open === i;
              return (
                <div
                  key={faq.q}
                  data-note-row
                  className={cn(
                    "border-t",
                    dark ? "border-enzo-cream/15" : "border-border/70",
                    i === faqs.length - 1 && (dark ? "border-b border-enzo-cream/15" : "border-b border-border/70"),
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${id ?? "service"}-${i}`}
                    className={cn(
                      "flex w-full items-center gap-4 py-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                      dark
                        ? "focus-visible:ring-enzo-sand focus-visible:ring-offset-enzo-forest"
                        : "focus-visible:ring-ring",
                    )}
                  >
                    <span
                      className={cn(
                        "font-display shrink-0 text-[11px] font-semibold tabular-nums tracking-[0.16em]",
                        dark ? "text-enzo-sand" : "text-enzo-forest-light",
                      )}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={cn(
                        "flex-1 text-[1.02rem] font-semibold leading-[1.25] tracking-[-0.02em]",
                        dark ? "text-enzo-cream" : "text-primary",
                      )}
                    >
                      {faq.q}
                    </span>
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors duration-300",
                        dark
                          ? "border-enzo-cream/25 text-enzo-cream data-[on=true]:border-enzo-sand data-[on=true]:bg-enzo-sand data-[on=true]:text-enzo-forest"
                          : "border-border text-primary data-[on=true]:border-primary data-[on=true]:bg-primary data-[on=true]:text-primary-foreground",
                      )}
                      data-on={isOpen}
                    >
                      {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    </span>
                  </button>

                  <div
                    id={`faq-panel-${id ?? "service"}-${i}`}
                    className="grid transition-[grid-template-rows] duration-500 ease-out"
                    style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                  >
                    <div className="overflow-hidden">
                      <p
                        className={cn(
                          "max-w-[60ch] pb-6 pl-[2.75rem] text-[14.5px] leading-[1.75]",
                          dark ? "text-enzo-cream/65" : "text-muted-foreground",
                        )}
                      >
                        {faq.a}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
