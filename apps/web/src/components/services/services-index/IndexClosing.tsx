"use client";

// /services §05 — the close.
//
// The previous version was a centred slab: a statement, a sentence, a
// button, a row of facts. It was tidy and it was nothing — a generic CTA
// that could have ended any page on any site, and it asked for a booking
// without telling anyone what booking one actually involves.
//
// This answers the question a visitor has at the bottom of a services page:
// *what happens if I do this?* The left column makes the ask; the right
// column is the survey itself, three stages with their real durations, so
// pressing the button is a known quantity rather than a leap. That is also
// why it is asymmetric rather than centred — the ask and the explanation
// are two different things and should not be stacked into one column.
//
// Deliberately not the same component the service pages close with: this is
// the index, so it explains the *studio's* process; those close on the job
// in front of them.
import { useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { useGSAP } from "@/hooks/useGSAP";
import { DUR, EASE, REVEAL_START } from "@/lib/motion";

const PHONE_DISPLAY = "0116 XXX XXXX";
const PHONE_HREF = "tel:0116XXXXXXX";

/** What a survey actually is, with real durations. */
const STAGES = [
  {
    datum: "60–90 min",
    title: "We come to you",
    body: "We measure every wall, photograph the space and ask how you actually use the room. No sales pitch, and nothing to sign.",
  },
  {
    datum: "5–7 days",
    title: "We draw it",
    body: "You get a 3D design of your own room with real finishes on it, plus an itemised price. Included, whether or not you go ahead.",
  },
  {
    datum: "Your call",
    title: "You decide",
    body: "Change it, sit on it, or say no. We only order materials once you have signed the drawing off.",
  },
];

export function IndexClosing() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(sectionRef, (section, reduced) => {
    const lines = gsap.utils.toArray<HTMLElement>("[data-close-line]", section);
    const body = gsap.utils.toArray<HTMLElement>("[data-close-body]", section);
    const stages = gsap.utils.toArray<HTMLElement>("[data-close-stage]", section);

    if (reduced) {
      gsap.set([...body, ...stages], { opacity: 1, y: 0 });
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
      .to(body, { opacity: 1, y: 0, duration: DUR.enter, ease: EASE.enter, stagger: 0.08 }, 0.28)
      .to(
        stages,
        { opacity: 1, y: 0, duration: DUR.enter, ease: EASE.enter, stagger: 0.1 },
        0.42,
      );

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
        <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:gap-20">
          {/* ── The ask ── */}
          <div>
            <h2
              id="services-closing-heading"
              className="font-title font-semibold leading-[1.0] tracking-[-0.045em] text-enzo-cream"
              style={{ fontSize: "clamp(2.2rem, 5vw, 4.2rem)" }}
            >
              {["It starts with", "someone measuring", "your room."].map((line) => (
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
              className="mt-7 max-w-[44ch] text-[15px] leading-[1.7] text-enzo-cream/60 opacity-0"
              style={{ transform: "translateY(14px)" }}
            >
              Free, in your home, with nothing to sign at the end of it. Most
              people book one before they have decided what they want — that is
              rather the point.
            </p>

            <div
              data-close-body
              className="mt-10 flex flex-col items-start gap-5 opacity-0 sm:flex-row sm:items-center sm:gap-8"
              style={{ transform: "translateY(14px)" }}
            >
              <Link
                href="/booking"
                className="group relative overflow-hidden rounded-full bg-enzo-cream px-9 py-4 text-[14.5px] font-medium text-enzo-forest transition-colors duration-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-4 focus-visible:ring-offset-enzo-dark"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-0 origin-bottom scale-y-0 bg-enzo-sand transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-y-100"
                />
                <span className="relative">Book a free survey</span>
              </Link>

              <a
                href={PHONE_HREF}
                className="text-[14.5px] tabular-nums text-enzo-cream/70 underline decoration-enzo-cream/25 decoration-1 underline-offset-[6px] transition-colors duration-300 hover:text-enzo-cream hover:decoration-enzo-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-4 focus-visible:ring-offset-enzo-dark"
              >
                {PHONE_DISPLAY}
              </a>
            </div>
          </div>

          {/* ── What actually happens ── */}
          <ol className="lg:pt-3">
            {STAGES.map((stage, index) => (
              <li
                key={stage.title}
                data-close-stage
                className="border-t border-enzo-cream/12 py-6 opacity-0 last:border-b"
                style={{ transform: "translateY(16px)" }}
              >
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-display text-[10.5px] font-semibold tabular-nums tracking-[0.2em] text-enzo-sand">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.2em] text-enzo-cream/40">
                    {stage.datum}
                  </span>
                </div>
                <h3 className="mt-2.5 font-title text-[1.15rem] font-semibold leading-[1.2] tracking-[-0.025em] text-enzo-cream">
                  {stage.title}
                </h3>
                <p className="mt-2 text-[13.5px] leading-[1.65] text-enzo-cream/55">
                  {stage.body}
                </p>
              </li>
            ))}
          </ol>
        </div>

        <p
          data-close-body
          className="mt-12 text-[12.5px] text-enzo-cream/40 opacity-0"
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
    </section>
  );
}
