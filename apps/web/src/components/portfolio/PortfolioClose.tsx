"use client";

// /portfolio §04 — the close, as three questions.
//
// ── What this replaces, and why ──
// Two versions failed here for the same underlying reason: the close kept
// borrowing something the page already had.
//
// The first was the next number in the register, counting up to itself. The
// second borrowed the landing hero's grammar wholesale — dark room, two-tone
// headline, filled pill with the arrow in its own disc, a photograph carrying
// a caption card — and set four counted figures under it. Both problems at
// once: the composition was the homepage's opening shot repeated at the
// bottom of a different page, and the figures (rooms, towns, years) were the
// *same four figures* §01 of this page already prints in its masthead. A
// visitor scrolled the whole archive to arrive back at where they came in.
//
// So this one deliberately owns nothing the page has already used. No
// photograph — §02 is a wall of them and §03 is one large one. No counted
// figures — §01 has those. No two-tone masthead headline — the landing hero
// has that.
//
// ── What it is instead ──
// The page has spent four screens telling. The close asks. It is the three
// questions the survey actually opens with, set at the scale the answers
// deserve, with the reason we ask underneath each one — so it reads as the
// beginning of a conversation rather than the end of a brochure. The only
// interactive thing on it is the control that starts that conversation.
//
// It is also the one section on this site that is *about the reader* rather
// than about us, which is the right note for the last thing on an archive.
//
// Ground: sand. Neither of the two near-blacks above it, nor §03's cream, and
// warm enough to read as an invitation rather than another sheet. It steps
// down to the footer's dark without either of them looking like the other.
import { useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ArrowUpRight } from "lucide-react";
import { revealOnScroll, useGSAP } from "@/hooks/useGSAP";
import { EASE, REVEAL_START } from "@/lib/motion";
import { fill, type PortfolioItem, type PortfolioPageContent } from "@/lib/content";

// The three questions are the ones the survey actually opens with — they live
// beside the rest of this page's copy in src/data/pages/portfolio.json, so the
// questions here and the questions the form asks are edited in one place.

export function PortfolioClose({
  items,
  content,
}: {
  items: PortfolioItem[];
  content: PortfolioPageContent["close"];
}) {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(sectionRef, (section, reduced) => {
    const rows = gsap.utils.toArray<HTMLElement>("[data-ask]", section);
    const lead = gsap.utils.toArray<HTMLElement>("[data-close-lead]", section);
    const rules = gsap.utils.toArray<HTMLElement>("[data-ask-rule]", section);

    if (reduced) {
      gsap.set([...rows, ...lead], { opacity: 1, y: 0 });
      gsap.set(rules, { scaleX: 1 });
      return;
    }

    revealOnScroll(
      section,
      (timeline) => {
        timeline
          .from(lead, {
            opacity: 0,
            y: 22,
            duration: 0.7,
            ease: EASE.enter,
            stagger: 0.08,
          })
          // Each question's rule draws before the question lands on it — the
          // same "measure first, then name the thing" order every heading on
          // this site uses.
          .from(
            rules,
            {
              scaleX: 0,
              transformOrigin: "0% 50%",
              duration: 0.7,
              ease: EASE.editorial,
              stagger: 0.14,
            },
            0.15,
          )
          .from(
            rows,
            { opacity: 0, y: 26, duration: 0.75, ease: EASE.editorial, stagger: 0.14 },
            0.25,
          );
      },
      { start: REVEAL_START },
    );
  });

  return (
    <section
      ref={sectionRef}
      id="portfolio-next"
      aria-labelledby="portfolio-close-heading"
      className="relative overflow-hidden bg-enzo-sand text-enzo-forest scroll-mt-24"
    >
      <div className="shell py-24 md:py-32">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,32rem)] lg:items-end lg:gap-16">
          <div>
            <span
              data-close-lead
              className="font-display flex items-center gap-3 text-[10.5px] font-semibold uppercase tracking-[0.3em] text-enzo-forest/70"
            >
              {content.index}
              <span aria-hidden="true" className="h-px w-10 bg-enzo-forest/30" />
              <span>{content.label}</span>
            </span>

            <h2
              id="portfolio-close-heading"
              data-close-lead
              className="mt-6 max-w-[16ch] font-title font-semibold leading-[1.0] tracking-[-0.045em]"
              style={{ fontSize: "clamp(2.2rem, 5vw, 3.8rem)" }}
            >
              {items.length
                ? fill(content.heading, { count: items.length })
                : (content.emptyHeading ?? "Our latest rooms are being photographed.")}
            </h2>
          </div>

          <p
            data-close-lead
            className="max-w-[52ch] text-[15.5px] leading-[1.75] text-enzo-forest/75 lg:pb-2"
          >
            {content.lede}
          </p>
        </div>

        {/* ── The three questions ──
            Set at heading scale, one per band, with the reason underneath.
            The number sits in a hairline-ruled gutter rather than a badge: it
            is an order, not a score. */}
        <ol className="mt-16 md:mt-24">
          {content.questions.map((question, index) => (
            <li key={question.ask} className="relative pt-7 md:pt-9">
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 block h-px overflow-hidden"
              >
                <span
                  data-ask-rule
                  className="block h-px w-full origin-left bg-enzo-forest/25"
                  style={{ transform: "scaleX(0)" }}
                />
              </span>

              <div
                data-ask
                className="grid gap-x-8 gap-y-3 pb-9 md:grid-cols-[3rem_minmax(0,1.1fr)_minmax(0,1fr)] md:pb-12"
              >
                <span className="font-display text-[11px] font-semibold tabular-nums tracking-[0.2em] text-enzo-forest/55 md:pt-3">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <h3
                  className="font-title font-semibold leading-[1.05] tracking-[-0.04em]"
                  style={{ fontSize: "clamp(1.6rem, 3.4vw, 2.7rem)" }}
                >
                  {question.ask}
                </h3>

                <p className="max-w-[48ch] text-[14.5px] leading-[1.75] text-enzo-forest/70 md:pt-2">
                  {question.why}
                </p>
              </div>
            </li>
          ))}
        </ol>

        {/* One control. The page has already shown the work; there is nothing
            left to offer but the conversation. */}
        <div
          data-close-lead
          className="flex flex-col gap-5 border-t border-enzo-forest/25 pt-9 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="max-w-[44ch] text-[14px] leading-[1.7] text-enzo-forest/70">
            {content.footerNote}
          </p>
          <Link
            href={content.ctaHref}
            className="group inline-flex shrink-0 items-center gap-3 rounded-full bg-enzo-forest py-2.5 pl-7 pr-2.5 text-[15px] font-medium text-enzo-cream transition-colors duration-300 hover:bg-enzo-forest-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-forest focus-visible:ring-offset-4 focus-visible:ring-offset-enzo-sand"
          >
            {content.ctaLabel}
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-enzo-sand text-enzo-forest transition-transform duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:rotate-45">
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
