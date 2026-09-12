"use client";

// The closing ask on every service page.
//
// ── Second design ──
// The first was type only, centred in a 46rem column on a near-black
// ground: statement, sentence, button, phone, a rule of facts. Nothing was
// wrong with any one part of it, and that was the problem — a centred column
// of type is what every page on the internet ends with, and it was the one
// section of a service page you could have lifted onto any other site
// without anybody noticing.
//
// This one is a full-bleed split. The room the visitor has spent five
// sections reading about takes one half of the screen, edge to edge and
// drifting on scroll; the ask takes the other, hard left in its own column
// with the survey set out as three numbered stages underneath it. So the
// page ends on the thing being sold rather than on a paragraph about it, and
// the ask sits beside the room instead of floating in the middle of a dark
// band.
//
// The three stages are the site's existing promises, not new ones: measure
// every wall, photograph the space, talk it through, drawings and an honest
// figure before anything is cut. The only number is the survey length, which
// the hero and §03 of /services both already carry.
//
// Below lg the picture becomes a band above the ask, because a half-and-half
// split at phone width gives both halves too little.
import { useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { scrollTimeline, useGSAP } from "@/hooks/useGSAP";
import { DUR, EASE, REVEAL_START } from "@/lib/motion";
import type { Company, SharedContent } from "@/lib/content";

interface BookSurveyCtaProps {
  /** Headline lines — one array entry per visual line. */
  lines: string[];
  lede: string;
  ctaLabel: string;
  ctaHref: string;
  /** Small facts under the actions, e.g. lead time and guarantee. */
  facts?: string[];
  /** The room, bled down one half of the section. */
  image?: string;
  /** Alt text for that image — the service title reads best. */
  imageAlt?: string;
  id?: string;
  /** The three survey stages and the browse line — the same on every service
   *  page, so they live in src/data/pages/shared.json rather than per page. */
  content: SharedContent["bookSurveyCta"];
  /** The studio's one number. This section carried its own placeholder copy
   *  of it until the company record became the single source. */
  company: Company;
}

export function BookSurveyCta({
  lines,
  lede,
  ctaLabel,
  ctaHref,
  facts = [],
  image,
  imageAlt,
  id,
  content,
  company,
}: BookSurveyCtaProps) {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(sectionRef, (section, reduced) => {
    const titleLines = gsap.utils.toArray<HTMLElement>("[data-cta-line]", section);
    const body = gsap.utils.toArray<HTMLElement>("[data-cta-body]", section);
    const plate = section.querySelector<HTMLElement>("[data-cta-plate]");
    const photo = section.querySelector<HTMLElement>("[data-cta-photo]");

    if (reduced) {
      gsap.set(body, { opacity: 1, y: 0 });
      // `y: 0` as well as `yPercent: 0` — GSAP has already resolved the
      // markup's `translateY(100%)` to pixels on the computed matrix, so
      // `yPercent: 0` alone leaves the headline parked inside its own mask.
      gsap.set(titleLines, { yPercent: 0, y: 0 });
      if (plate) gsap.set(plate, { clipPath: "inset(0 0 0 0)" });
      if (photo) gsap.set(photo, { scale: 1 });
      return;
    }

    gsap.set(titleLines, { yPercent: 100, y: 0 });

    const tl = gsap.timeline({ paused: true });

    tl.fromTo(
      plate,
      { clipPath: "inset(0 0 100% 0)" },
      { clipPath: "inset(0 0 0% 0)", duration: 1.1, ease: EASE.editorial },
    )
      .fromTo(photo, { scale: 1.18 }, { scale: 1, duration: 1.5, ease: EASE.editorial }, 0)
      .to(
        titleLines,
        { yPercent: 0, duration: DUR.editorial, ease: EASE.editorial, stagger: 0.09 },
        0.18,
      )
      .to(
        body,
        { opacity: 1, y: 0, duration: DUR.enter, ease: EASE.enter, stagger: 0.07 },
        0.42,
      );

    if (photo) {
      scrollTimeline(
        (timeline) =>
          timeline.to(photo, {
            yPercent: 7,
            ease: EASE.linear,
          }),
        {
          trigger: section,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      );
    }

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
      ref={sectionRef}
      id={id}
      aria-labelledby={`${id ?? "service"}-cta-heading`}
      className="relative overflow-hidden bg-enzo-dark scroll-mt-28"
    >
      <div className="grid lg:grid-cols-2">
        {/* ── The room ── */}
        {image && (
          <div
            data-cta-plate
            className="relative order-1 h-[38svh] min-h-[16rem] overflow-hidden bg-enzo-forest lg:h-auto lg:min-h-[44rem]"
            style={{ clipPath: "inset(0 0 100% 0)" }}
          >
            <ImageWithFallback
              src={image}
              alt={imageAlt ?? ""}
              data-cta-photo
              className="absolute inset-0 h-full w-full object-cover will-change-transform"
            />
            {/* Just enough wash that the near-black column beside it does
                not read as a different page. */}
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-enzo-dark/25"
            />
          </div>
        )}

        {/* ── The ask ── */}
        <div className="order-2 flex flex-col justify-center px-5 py-20 sm:px-6 md:px-12 md:py-24 lg:px-14 xl:px-20">
          <div className="mx-auto w-full max-w-[38rem] lg:mx-0">
            <span
              data-cta-body
              className="font-display block text-[10.5px] font-semibold uppercase tracking-[0.3em] text-enzo-sand opacity-0"
              style={{ transform: "translateY(10px)" }}
            >
              {content.eyebrow}
            </span>

            <h2
              id={`${id ?? "service"}-cta-heading`}
              className="mt-6 font-title font-semibold leading-[1.0] tracking-[-0.045em] text-enzo-cream"
              style={{ fontSize: "clamp(2.1rem, 4.2vw, 3.4rem)" }}
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
              className="mt-6 max-w-[46ch] text-[15px] leading-[1.7] text-enzo-cream/70 opacity-0"
              style={{ transform: "translateY(14px)" }}
            >
              {lede}
            </p>

            {/* What the visit is, as three ruled stages. */}
            <ol
              data-cta-body
              className="mt-10 opacity-0"
              style={{ transform: "translateY(14px)" }}
            >
              {content.stages.map((stage, index) => (
                <li
                  key={stage.title}
                  className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-2 border-t border-enzo-cream/12 py-4 last:border-b"
                >
                  <span className="font-display pt-[0.2em] text-[11px] font-semibold tabular-nums tracking-[0.16em] text-enzo-sand">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>
                    <span className="block text-[15px] font-medium text-enzo-cream">
                      {stage.title}
                    </span>
                    <span className="mt-1 block max-w-[44ch] text-[13.5px] leading-[1.6] text-enzo-cream/70">
                      {stage.body}
                    </span>
                  </span>
                </li>
              ))}
            </ol>

            {/* Below `sm` the two actions stack full width — a content-sized
                pill with the phone number orphaned beneath it left the
                column ragged, and a phone link is a tap target on the one
                device that can actually dial it. From `sm` they sit on one
                line as before. */}
            <div
              data-cta-body
              className="mt-10 flex flex-col gap-3 opacity-0 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-8 sm:gap-y-5"
              style={{ transform: "translateY(14px)" }}
            >
              {/* Fill sweeps up from the bottom edge on hover — the whole
                  affordance, with nothing drawn inside the button. */}
              <Link
                href={ctaHref}
                className="group relative block overflow-hidden rounded-full bg-enzo-cream px-9 py-4 text-center text-[14.5px] font-medium text-enzo-forest transition-colors duration-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-4 focus-visible:ring-offset-enzo-dark sm:inline-block"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-0 origin-bottom scale-y-0 bg-enzo-sand transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-y-100"
                />
                <span className="relative">{ctaLabel}</span>
              </Link>

              <a
                href={company.phone.href}
                className="block rounded-full border border-enzo-cream/20 px-9 py-4 text-center text-[14.5px] tabular-nums text-enzo-cream/70 transition-colors duration-300 hover:border-enzo-cream/50 hover:text-enzo-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-4 focus-visible:ring-offset-enzo-dark sm:inline sm:rounded-none sm:border-0 sm:p-0 sm:underline sm:decoration-enzo-cream/25 sm:decoration-1 sm:underline-offset-[6px] sm:hover:decoration-enzo-sand"
              >
                {company.phone.display}
              </a>
            </div>

            {facts.length > 0 && (
              /* Two even columns on a phone, one ruled line from `sm`. The
                 inline version put a hairline *before* every fact but the
                 first, which is correct on one line and wrong the moment it
                 wraps: the separator leads the new line with nothing to its
                 left. A grid needs no separators at all. */
              <ul
                data-cta-body
                className="mt-8 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-enzo-cream/12 pt-6 opacity-0 sm:mt-10 sm:flex sm:flex-wrap sm:items-center sm:gap-x-5"
                style={{ transform: "translateY(14px)" }}
              >
                {facts.map((fact, index) => (
                  <li
                    key={fact}
                    className="flex items-center text-[12.5px] leading-[1.45] text-enzo-cream/65 sm:gap-5"
                  >
                    {index > 0 && (
                      <span
                        aria-hidden="true"
                        className="hidden h-3 w-px bg-enzo-cream/15 sm:block"
                      />
                    )}
                    {fact}
                  </li>
                ))}
              </ul>
            )}

            <p
              data-cta-body
              className="mt-6 text-[12.5px] text-enzo-cream/65 opacity-0"
              style={{ transform: "translateY(14px)" }}
            >
              {content.browsePrefix}{" "}
              <Link
                href={content.browseHref}
                className="underline decoration-enzo-cream/25 decoration-1 underline-offset-4 transition-colors duration-300 hover:text-enzo-sand hover:decoration-enzo-sand"
              >
                {content.browseLabel}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
