"use client";

// The closing ask, shared by /services and /services/[category].
//
// Type only. No icons, no corner registration marks, no glow, no arrows —
// each of those was a small decoration competing with the single
// instruction the section exists to give, and together they turned the
// quietest moment on the page into the busiest.
//
// What is left: a statement, a sentence, one button, the phone number as
// plain text, and a line of facts. The only motion is the headline masking
// up and a fill that sweeps across the button on hover, which is enough to
// make it feel alive without adding a shape to look at.
import { useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { useGSAP } from "@/hooks/useGSAP";
import { DUR, EASE, REVEAL_START } from "@/lib/motion";

interface BookSurveyCtaProps {
  /** Headline lines — one array entry per visual line. */
  lines: string[];
  lede: string;
  ctaLabel: string;
  ctaHref: string;
  /** Small facts under the buttons, e.g. lead time and guarantee. */
  facts?: string[];
  id?: string;
}

const PHONE_DISPLAY = "0116 XXX XXXX";
const PHONE_HREF = "tel:0116XXXXXXX";

export function BookSurveyCta({
  lines,
  lede,
  ctaLabel,
  ctaHref,
  facts = [],
  id,
}: BookSurveyCtaProps) {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(sectionRef, (section, reduced) => {
    const titleLines = gsap.utils.toArray<HTMLElement>("[data-cta-line]", section);
    const body = gsap.utils.toArray<HTMLElement>("[data-cta-body]", section);

    if (reduced) {
      gsap.set(body, { opacity: 1, y: 0 });
      gsap.set(titleLines, { yPercent: 0 });
      return;
    }

    gsap.set(titleLines, { yPercent: 100, y: 0 });

    const tl = gsap.timeline({
      paused: true,
      scrollTrigger: { trigger: section, start: REVEAL_START, once: true },
    });

    tl.to(titleLines, {
      yPercent: 0,
      duration: DUR.editorial,
      ease: EASE.editorial,
      stagger: 0.08,
    }).to(
      body,
      { opacity: 1, y: 0, duration: DUR.enter, ease: EASE.enter, stagger: 0.08 },
      0.3,
    );
    tl.play(0);

    return () => {
      tl.kill();
    };
  });

  return (
    <section
      ref={sectionRef}
      id={id}
      aria-labelledby={`${id ?? "service"}-cta-heading`}
      className="relative bg-enzo-dark scroll-mt-28"
    >
      <div className="mx-auto max-w-[1500px] px-5 py-24 sm:px-6 md:px-12 md:py-32">
        <div className="mx-auto max-w-[46rem] text-center">
          <h2
            id={`${id ?? "service"}-cta-heading`}
            className="font-title font-semibold leading-[1.02] tracking-[-0.045em] text-enzo-cream"
            style={{ fontSize: "clamp(2.1rem, 5.2vw, 4rem)" }}
          >
            {lines.map((line) => (
              <span key={line} className="block overflow-hidden pb-[0.1em] -mb-[0.1em]">
                <span
                  data-cta-line
                  className="block"
                  style={{ transform: "translateY(100%)" }}
                >
                  {line}
                </span>
              </span>
            ))}
          </h2>

          <p
            data-cta-body
            className="mx-auto mt-6 max-w-[46ch] text-[15px] leading-[1.7] text-enzo-cream/60 opacity-0"
            style={{ transform: "translateY(14px)" }}
          >
            {lede}
          </p>

          <div
            data-cta-body
            className="mt-10 flex flex-col items-center justify-center gap-5 opacity-0 sm:flex-row sm:gap-8"
            style={{ transform: "translateY(14px)" }}
          >
            {/* Fill sweeps up from the bottom edge on hover — the whole
                affordance, with nothing drawn inside the button. */}
            <Link
              href={ctaHref}
              className="group relative overflow-hidden rounded-full bg-enzo-cream px-9 py-4 text-[14.5px] font-medium text-enzo-forest transition-colors duration-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-4 focus-visible:ring-offset-enzo-dark"
            >
              <span
                aria-hidden="true"
                className="absolute inset-0 origin-bottom scale-y-0 bg-enzo-sand transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-y-100"
              />
              <span className="relative">{ctaLabel}</span>
            </Link>

            <a
              href={PHONE_HREF}
              className="text-[14.5px] tabular-nums text-enzo-cream/70 underline decoration-enzo-cream/25 decoration-1 underline-offset-[6px] transition-colors duration-300 hover:text-enzo-cream hover:decoration-enzo-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-4 focus-visible:ring-offset-enzo-dark"
            >
              {PHONE_DISPLAY}
            </a>
          </div>

          {facts.length > 0 && (
            <ul
              data-cta-body
              className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 border-t border-enzo-cream/12 pt-6 opacity-0"
              style={{ transform: "translateY(14px)" }}
            >
              {facts.map((fact, index) => (
                <li
                  key={fact}
                  className="flex items-center gap-6 text-[12.5px] text-enzo-cream/45"
                >
                  {/* Hairline separators between facts rather than a bullet
                      or dash in front of each one. */}
                  {index > 0 && (
                    <span aria-hidden="true" className="h-3 w-px bg-enzo-cream/15" />
                  )}
                  {fact}
                </li>
              ))}
            </ul>
          )}

          <p
            data-cta-body
            className="mt-8 text-[12.5px] text-enzo-cream/40 opacity-0"
            style={{ transform: "translateY(14px)" }}
          >
            Prefer to browse first?{" "}
            <Link
              href="/portfolio"
              className="underline decoration-enzo-cream/25 decoration-1 underline-offset-4 transition-colors duration-300 hover:text-enzo-sand hover:decoration-enzo-sand"
            >
              See finished rooms
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
