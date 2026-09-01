"use client";

// The closing ask, shared by /services and /services/[category].
//
// Deliberately not the landing page's StudioInvite: no marquee, no photo
// wall. By the time a visitor reaches the bottom of a services page they
// have seen the work — what they need is the one instruction that moves
// this forward, on a ground clear enough that it is the only thing to look
// at.
//
// It used to carry a soft light that followed the pointer across the slab.
// Removed: on a near-black ground a radial glow reads as a gradient
// artefact rather than as light, and it was the only thing on the section
// competing with the one instruction. The registration marks at the corners
// are the whole decoration now.
import { useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { Phone } from "lucide-react";
import { MagneticButton } from "@/components/shared/MagneticButton";
import { useGSAP } from "@/hooks/useGSAP";
import { DUR, EASE, REVEAL_START } from "@/lib/motion";

interface ServiceInviteCtaProps {
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

export function ServiceInviteCta({
  lines,
  lede,
  ctaLabel,
  ctaHref,
  facts = [],
  id,
}: ServiceInviteCtaProps) {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(sectionRef, (section, reduced) => {
    const marks = gsap.utils.toArray<HTMLElement>("[data-cta-mark]", section);
    const titleLines = gsap.utils.toArray<HTMLElement>("[data-cta-line]", section);
    const body = gsap.utils.toArray<HTMLElement>("[data-cta-body]", section);

    if (reduced) {
      gsap.set([...marks, ...body], { opacity: 1, y: 0, scale: 1 });
      gsap.set(titleLines, { yPercent: 0 });
      return;
    }

    gsap.set(titleLines, { yPercent: 100, y: 0 });

    const tl = gsap.timeline({
      paused: true,
      scrollTrigger: { trigger: section, start: REVEAL_START, once: true },
    });

    tl.to(marks, { opacity: 1, scale: 1, duration: 0.7, ease: EASE.editorial, stagger: 0.06 })
      .to(
        titleLines,
        { yPercent: 0, duration: DUR.editorial, ease: EASE.editorial, stagger: 0.08 },
        0.1,
      )
      .to(body, { opacity: 1, y: 0, duration: DUR.enter, ease: EASE.enter, stagger: 0.08 }, 0.4);
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
      className="relative overflow-hidden bg-enzo-dark scroll-mt-28"
    >
      <div className="relative mx-auto max-w-[1500px] px-5 py-24 sm:px-6 md:px-12 md:py-32">
        {/* Registration marks — the corner crosses on a printed drawing
            sheet. They set the slab out as a sheet rather than a band. */}
        {[
          "left-0 top-0",
          "right-0 top-0",
          "left-0 bottom-0",
          "right-0 bottom-0",
        ].map((position) => (
          <span
            key={position}
            aria-hidden="true"
            data-cta-mark
            className={`pointer-events-none absolute ${position} h-5 w-5 opacity-0`}
            style={{ transform: "scale(0.6)" }}
          >
            <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-enzo-sand/45" />
            <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-enzo-sand/45" />
          </span>
        ))}

        <div className="mx-auto max-w-[52rem] text-center">
          <h2
            id={`${id ?? "service"}-cta-heading`}
            className="font-title font-semibold leading-[1.02] tracking-[-0.045em] text-enzo-cream"
            style={{ fontSize: "clamp(2.1rem, 5.4vw, 4.2rem)" }}
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
            className="mx-auto mt-6 max-w-[48ch] text-[15px] leading-[1.7] text-enzo-cream/65 opacity-0"
            style={{ transform: "translateY(14px)" }}
          >
            {lede}
          </p>

          <div
            data-cta-body
            className="mt-8 flex flex-col items-center justify-center gap-2 opacity-0 sm:flex-row sm:gap-4"
            style={{ transform: "translateY(14px)" }}
          >
            <MagneticButton href={ctaHref}>{ctaLabel}</MagneticButton>
            <a
              href={PHONE_HREF}
              className="group inline-flex items-center gap-2.5 rounded-full border border-enzo-cream/25 px-7 py-3.5 text-[14px] text-enzo-cream transition-colors duration-300 hover:border-enzo-sand hover:text-enzo-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-2 focus-visible:ring-offset-enzo-dark"
            >
              <Phone className="h-4 w-4 transition-transform duration-300 group-hover:-rotate-12" />
              {PHONE_DISPLAY}
            </a>
          </div>

          {facts.length > 0 && (
            <ul
              data-cta-body
              className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 opacity-0"
              style={{ transform: "translateY(14px)" }}
            >
              {facts.map((fact) => (
                <li
                  key={fact}
                  className="flex items-center gap-2.5 text-[12.5px] text-enzo-cream/50"
                >
                  <span aria-hidden="true" className="h-px w-5 bg-enzo-sand/60" />
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
              className="border-b border-enzo-cream/25 pb-0.5 transition-colors duration-300 hover:border-enzo-sand hover:text-enzo-sand"
            >
              See finished rooms
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
