"use client";

// /about §02 — the studio, in figures.
//
// Four numbers on one ruled row: how many rooms, how many people the job
// passes through, how long the guarantee runs, how much a survey costs.
// Two of them are deliberately zero and one is free — the interesting facts
// about a small workshop are the ones a big one cannot claim.
//
// The figures count themselves once, on their own timer, and stay. They are
// explicitly *not* scrubbed: a number driven by the scrollbar shows whatever
// the scroll position says it is, which on a page about being trustworthy is
// the worst possible place to put a number that lies while you read it.
//
// The project count is derived from the published records, so it is right on
// the day the client publishes the tenth one.
import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { useGSAP } from "@/hooks/useGSAP";
import { EASE, REVEAL_START } from "@/lib/motion";

export interface AboutFigure {
  /** Counted to, when numeric. */
  value: number | null;
  /** Rendered instead of a count when `value` is null, e.g. "Free". */
  text?: string;
  suffix?: string;
  label: string;
  note: string;
}

export function AboutNumbers({ figures }: { figures: AboutFigure[] }) {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(sectionRef, (section, reduced) => {
    const cells = gsap.utils.toArray<HTMLElement>("[data-figure-cell]", section);
    const counters = gsap.utils.toArray<HTMLElement>("[data-count-to]", section);
    if (!cells.length) return;

    const settle = () => {
      counters.forEach((el) => {
        el.textContent = el.dataset.countTo ?? el.textContent;
      });
    };

    if (reduced) {
      gsap.set(cells, { opacity: 1, y: 0 });
      settle();
      return;
    }

    const tl = gsap.timeline({ paused: true });

    tl.from(cells, {
      opacity: 0,
      y: 22,
      duration: 0.7,
      ease: EASE.enter,
      stagger: 0.08,
    });

    counters.forEach((el, i) => {
      const to = Number(el.dataset.countTo);
      if (!Number.isFinite(to)) return;
      const proxy = { value: 0 };
      tl.to(
        proxy,
        {
          value: to,
          duration: 0.9,
          ease: "power2.out",
          onUpdate: () => {
            el.textContent = String(Math.round(proxy.value));
          },
          onComplete: () => {
            el.textContent = String(to);
          },
        },
        0.1 + i * 0.08,
      );
    });

    // Attached only once the timeline is populated — see revealOnScroll
    // in hooks/useGSAP.ts for why the order matters.
    ScrollTrigger.create({
      trigger: section,
      start: REVEAL_START,
      once: true,
      animation: tl,
    });

    return () => {
      tl.kill();
    };
  });

  return (
    <section
      id="about-numbers"
      aria-labelledby="about-numbers-heading"
      ref={sectionRef}
      className="relative overflow-hidden bg-background text-primary scroll-mt-24"
    >
      <div className="mx-auto max-w-[1500px] px-5 py-20 sm:px-6 md:px-12 md:py-28">
        <h2 id="about-numbers-heading" className="sr-only">
          The studio in figures
        </h2>

        <SectionIntro
          layout="split"
          index="02"
          label="Figures"
          datum="all true"
          lines={["A small shop,", "on purpose."]}
          lede="The numbers worth knowing about a workshop this size are mostly the ones a bigger one could not print."
        />

        {/* Cells carry their own rules and the row is pulled a pixel left
            under an overflow clip, so the outermost rule is trimmed rather
            than hanging off the first cell. */}
        <div className="mt-12 overflow-hidden border-t border-border/70 md:mt-16">
          <dl className="-ml-px grid grid-cols-2 lg:grid-cols-4">
            {figures.map((figure) => (
              <div
                key={figure.label}
                data-figure-cell
                className="border-b border-l border-border/70 px-5 py-8 md:px-8 md:py-10 lg:border-b-0"
              >
                <dd
                  className="font-title font-semibold leading-[0.9] tabular-nums tracking-[-0.05em] text-primary"
                  style={{ fontSize: "clamp(2.6rem, 5.2vw, 4.4rem)" }}
                >
                  {figure.value === null ? (
                    figure.text
                  ) : (
                    <>
                      <span data-count-to={figure.value}>0</span>
                      {figure.suffix}
                    </>
                  )}
                </dd>
                <dt className="font-display mt-4 text-[10px] font-semibold uppercase tracking-[0.26em] text-enzo-forest-light">
                  {figure.label}
                </dt>
                <p className="mt-2.5 max-w-[26ch] text-[13px] leading-[1.6] text-muted-foreground">
                  {figure.note}
                </p>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
