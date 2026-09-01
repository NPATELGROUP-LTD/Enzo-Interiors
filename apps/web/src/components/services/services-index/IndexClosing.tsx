"use client";

// /services §05 — the close.
//
// Third attempt, and the reasoning for each discard is worth keeping:
//   · a centred slab (statement, sentence, button, facts) — generic; could
//     have ended any page on any site
//   · an ask beside a three-stage explainer — better, but still a block of
//     prose you read *about* booking rather than anything you could act on
//
// This one does the booking. The three questions we would ask on the phone
// are on the page as chips, the answers build a real /booking URL, and the
// button carries them through — so the section is the first step of the
// form rather than an advertisement for it.
//
// ── What actually carries today ──
// `service` is consumed by app/booking/page.tsx and genuinely pre-selects
// step 1 of the wizard. `timing` and `scope` ride along on the query string
// but nothing reads them yet — the wizard has no field for either. The copy
// below is written to that reality rather than to the intention: it
// promises the discipline is pre-selected and says the rest comes through
// with the enquiry, which is true. If the wizard later grows those fields,
// widen the promise then — do not widen it before.
//
// Everything is optional: skip the chips and the button still books, which
// is why they are chips and not required fields.
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { useGSAP } from "@/hooks/useGSAP";
import { DUR, EASE, REVEAL_START } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { ServiceDetail } from "@/lib/content";

const PHONE_DISPLAY = "0116 XXX XXXX";
const PHONE_HREF = "tel:0116XXXXXXX";

const TIMINGS = [
  { id: "asap", label: "As soon as possible" },
  { id: "3-months", label: "Next few months" },
  { id: "planning", label: "Just planning" },
];

const ROOMS = [
  { id: "one", label: "One room" },
  { id: "several", label: "Several rooms" },
  { id: "whole", label: "Whole house" },
];

interface IndexClosingProps {
  services: ServiceDetail[];
}

/**
 * One question and its chips.
 *
 * Declared at module scope, not inside IndexClosing. A component defined in
 * a render body is a brand-new type on every render, so React unmounts and
 * remounts the whole fieldset each time any answer changes — which would
 * throw keyboard focus off the chip the visitor just pressed, mid-form.
 */
function QuestionRow({
  index,
  question,
  options,
  value,
  onPick,
}: {
  index: number;
  question: string;
  options: { id: string; label: string }[];
  value: string | null;
  onPick: (id: string | null) => void;
}) {
  return (
    <fieldset
      data-close-row
      className="border-t border-enzo-cream/12 py-6 opacity-0"
      style={{ transform: "translateY(16px)" }}
    >
      <legend className="flex items-baseline gap-4">
        <span className="font-display text-[10.5px] font-semibold tabular-nums tracking-[0.2em] text-enzo-sand">
          {String(index).padStart(2, "0")}
        </span>
        <span className="text-[15px] text-enzo-cream/85">{question}</span>
      </legend>
      <div className="mt-4 flex flex-wrap gap-2">
        {options.map((option) => {
          const on = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              // Pressing the selected chip clears it — the questions are
              // optional and there must be a way back to "not answered".
              onClick={() => onPick(on ? null : option.id)}
              aria-pressed={on}
              className={cn(
                "rounded-full border px-5 py-2.5 text-[13.5px] transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-2 focus-visible:ring-offset-enzo-dark",
                on
                  ? "border-enzo-sand bg-enzo-sand text-enzo-forest"
                  : "border-enzo-cream/20 text-enzo-cream/65 hover:border-enzo-cream/50 hover:text-enzo-cream",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function IndexClosing({ services }: IndexClosingProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [service, setService] = useState<string | null>(null);
  const [timing, setTiming] = useState<string | null>(null);
  const [scope, setScope] = useState<string | null>(null);

  const href = useMemo(() => {
    const params = new URLSearchParams();
    if (service) params.set("service", service);
    if (timing) params.set("timing", timing);
    if (scope) params.set("scope", scope);
    const query = params.toString();
    return query ? `/booking?${query}` : "/booking";
  }, [service, timing, scope]);

  const answered = [service, timing, scope].filter(Boolean).length;

  useGSAP(sectionRef, (section, reduced) => {
    const lines = gsap.utils.toArray<HTMLElement>("[data-close-line]", section);
    const body = gsap.utils.toArray<HTMLElement>("[data-close-body]", section);
    const rows = gsap.utils.toArray<HTMLElement>("[data-close-row]", section);

    if (reduced) {
      gsap.set([...body, ...rows], { opacity: 1, y: 0 });
      gsap.set(lines, { yPercent: 0 });
      return;
    }

    gsap.set(lines, { yPercent: 100, y: 0 });

    const tl = gsap.timeline({
      scrollTrigger: { trigger: section, start: REVEAL_START, once: true },
    });

    tl.to(lines, {
      yPercent: 0,
      duration: DUR.editorial,
      ease: EASE.editorial,
      stagger: 0.08,
    })
      .to(body, { opacity: 1, y: 0, duration: DUR.enter, ease: EASE.enter, stagger: 0.08 }, 0.26)
      .to(rows, { opacity: 1, y: 0, duration: DUR.enter, ease: EASE.enter, stagger: 0.1 }, 0.36);

    return () => {
      tl.kill();
    };
  });

  return (
    <section
      ref={sectionRef}
      id="services-closing"
      aria-labelledby="services-closing-heading"
      className="relative bg-enzo-dark scroll-mt-28"
    >
      <div className="mx-auto max-w-[1500px] px-5 py-24 sm:px-6 md:px-12 md:py-32">
        <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] lg:gap-20">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <h2
              id="services-closing-heading"
              className="font-title font-semibold leading-[1.0] tracking-[-0.045em] text-enzo-cream"
              style={{ fontSize: "clamp(2.2rem, 5vw, 4rem)" }}
            >
              {["Three questions,", "then we come", "and measure."].map((line) => (
                <span key={line} className="block overflow-hidden pb-[0.1em] -mb-[0.1em]">
                  <span
                    data-close-line
                    className="block"
                    style={{ transform: "translateY(100%)" }}
                  >
                    {line}
                  </span>
                </span>
              ))}
            </h2>

            <p
              data-close-body
              className="mt-7 max-w-[42ch] text-[15px] leading-[1.7] text-enzo-cream/60 opacity-0"
              style={{ transform: "translateY(14px)" }}
            >
              The same three we would ask on the phone. Pick a discipline and
              the booking form opens with it already selected; the rest comes
              through with your enquiry. Or skip them and just book.
            </p>

            <p
              data-close-body
              className="mt-8 text-[13px] text-enzo-cream/45 opacity-0"
              style={{ transform: "translateY(14px)" }}
            >
              Rather talk?{" "}
              <a
                href={PHONE_HREF}
                className="tabular-nums text-enzo-cream/80 underline decoration-enzo-cream/25 decoration-1 underline-offset-[6px] transition-colors duration-300 hover:text-enzo-cream hover:decoration-enzo-sand"
              >
                {PHONE_DISPLAY}
              </a>
            </p>
          </div>

          {/* ── The three questions ── */}
          <div>
            <QuestionRow
              index={1}
              question="Which discipline are you thinking about?"
              options={services.map((entry) => ({
                id: entry.slug,
                label: entry.title,
              }))}
              value={service}
              onPick={setService}
            />
            <QuestionRow
              index={2}
              question="When would you want it done?"
              options={TIMINGS}
              value={timing}
              onPick={setTiming}
            />
            <QuestionRow
              index={3}
              question="How much are we looking at?"
              options={ROOMS}
              value={scope}
              onPick={setScope}
            />

            <div
              data-close-row
              className="border-t border-enzo-cream/12 pt-8 opacity-0"
              style={{ transform: "translateY(16px)" }}
            >
              <Link
                href={href}
                className="group relative block overflow-hidden rounded-full bg-enzo-cream px-9 py-4 text-center text-[14.5px] font-medium text-enzo-forest transition-colors duration-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-4 focus-visible:ring-offset-enzo-dark"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-0 origin-bottom scale-y-0 bg-enzo-sand transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-y-100"
                />
                <span className="relative">Book a free survey</span>
              </Link>
              <p className="mt-3 text-center text-[12px] text-enzo-cream/40">
                {answered === 0
                  ? "No obligation, nothing to sign — and none of the above is required."
                  : `${answered} of 3 answered.`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
