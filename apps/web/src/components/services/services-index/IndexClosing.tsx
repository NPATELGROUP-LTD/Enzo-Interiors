"use client";

// /services §05 — the close.
//
// Fifth attempt. The discarded ones, so none of them comes back:
//   · a centred slab (statement, sentence, button, facts) — generic; could
//     have ended any page on any site
//   · an ask beside a three-stage explainer — prose you read *about* booking
//     rather than anything you could act on
//   · the three questions as pill-shaped chips — pills are sized by their
//     own labels, so four service names wrapped into a ragged 3 + 1 and
//     nothing lined up with anything
//   · the same three questions as a ruled worksheet — properly aligned at
//     last, but still a three-field form standing between the visitor and
//     the one button they came for
//
// ── What it is now ──
// The page has spent five sections in a drawing office: a measuring rule
// under every heading, a plan of the room in the hero, a title block and a
// dimensioned corner in §03. So it ends on the sheet itself. One bordered
// plate with registration ticks at its corners, the ask set in the body of
// the sheet, and a real title block ruled across the bottom — facts in the
// narrow cells, the action in the wide one, exactly where a drawing puts its
// approval box.
//
// ── One question, not three ──
// The old version asked for discipline, timing and scope. Only the first has
// ever done anything: `service` is read by app/booking/page.tsx and
// genuinely pre-selects step 1 of the wizard, while `timing` and `scope`
// rode along on the query string and nothing has ever read them. Asking two
// questions we throw away costs the visitor real effort and buys nothing, so
// they are gone. If the wizard grows those fields, add them back here then —
// not before.
//
// Answering is still optional: pick nothing and the button books anyway.
//
// ── Below md: the room picker is gone, not shrunk ──
// The picker is explicitly optional, and on a phone it stood between the
// description and the one button the section exists for: four full-width
// rows plus three stacked fact cells, roughly 300px of scrolling for a
// refinement most visitors would skip anyway. The meaning does not change —
// you can still say which room on the booking page itself (step 1 reads the
// same `service` query param this section would have set), or from the
// button on the service's own page — so nothing is lost, only reached
// sooner. md and up is unchanged: the picker is still there, still optional.
// The three facts survive below md too, just as one row instead of three
// stacked blocks — no content removed, only laid out tighter.
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@/hooks/useGSAP";
import { DUR, EASE, REVEAL_START } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { fill, type Company, type ServiceDetail, type ServicesPageContent } from "@/lib/content";

interface IndexClosingProps {
  services: ServiceDetail[];
  content: ServicesPageContent["closing"];
  /** The studio's one number. This section used to carry its own placeholder
   *  copy of it, which is how three pages came to quote three numbers. */
  company: Company;
}

/** Registration tick — the corner marks a drawing sheet is trimmed to. */
function CornerTick({ at }: { at: "tl" | "tr" | "bl" | "br" }) {
  const vertical = at[0] === "t" ? "top-0" : "bottom-0";
  const horizontal = at[1] === "l" ? "left-0" : "right-0";
  return (
    <>
      <span
        aria-hidden="true"
        className={cn("absolute h-[18px] w-px bg-enzo-sand/70", vertical, horizontal)}
      />
      <span
        aria-hidden="true"
        className={cn("absolute h-px w-[18px] bg-enzo-sand/70", vertical, horizontal)}
      />
    </>
  );
}

export function IndexClosing({ services, content, company }: IndexClosingProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [service, setService] = useState<string | null>(null);

  const chosen = services.find((entry) => entry.slug === service) ?? null;
  const href = useMemo(
    () => (service ? `/booking?service=${service}` : "/booking"),
    [service],
  );

  useGSAP(sectionRef, (section, reduced) => {
    const lines = gsap.utils.toArray<HTMLElement>("[data-close-line]", section);
    const body = gsap.utils.toArray<HTMLElement>("[data-close-body]", section);
    const sheet = section.querySelector<HTMLElement>("[data-close-sheet]");

    if (reduced) {
      gsap.set(body, { opacity: 1, y: 0 });
      if (sheet) gsap.set(sheet, { opacity: 1, y: 0 });
      // `y: 0` as well as `yPercent: 0`, and it is load-bearing. The markup
      // ships `translateY(100%)` so the lines are hidden in the server HTML,
      // but GSAP reads existing transforms off the *computed* matrix, where
      // that percentage has already resolved to pixels — it records
      // `y: 64, yPercent: 0` and then finds `yPercent: 0` has nothing to do,
      // leaving the heading parked inside its own clipping mask. Without
      // this, a reduced-motion visitor gets a section with no headline.
      gsap.set(lines, { yPercent: 0, y: 0 });
      return;
    }

    gsap.set(lines, { yPercent: 100, y: 0 });

    const tl = gsap.timeline({ paused: true });

    // The sheet arrives first and the type is set on it afterwards, which is
    // the order the studio would do it in.
    tl.to(sheet, { opacity: 1, y: 0, duration: 1, ease: EASE.editorial })
      .to(
        lines,
        { yPercent: 0, duration: DUR.editorial, ease: EASE.editorial, stagger: 0.08 },
        0.2,
      )
      .to(
        body,
        { opacity: 1, y: 0, duration: DUR.enter, ease: EASE.enter, stagger: 0.07 },
        0.42,
      );

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
      id="services-close"
      aria-labelledby="services-closing-heading"
      className="relative bg-enzo-dark scroll-mt-24"
    >
      <div className="shell py-24 md:py-32">
        <div
          data-close-sheet
          className="relative border border-enzo-cream/18 opacity-0"
          style={{ transform: "translateY(28px)" }}
        >
          <CornerTick at="tl" />
          <CornerTick at="tr" />
          <CornerTick at="bl" />
          <CornerTick at="br" />

          <div className="px-6 pt-9 sm:px-10 md:px-14 md:pt-14">
            {/* Sheet header — index at the left, issuer at the right. */}
            <div
              data-close-body
              className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 opacity-0"
              style={{ transform: "translateY(10px)" }}
            >
              <span className="font-display text-[10.5px] font-semibold uppercase tracking-[0.3em] text-enzo-sand">
                {content.eyebrow}
              </span>
              <span className="font-display text-[10.5px] font-semibold uppercase tracking-[0.28em] text-enzo-cream/65">
                {content.issuer}
              </span>
            </div>

            <div className="mt-10 grid gap-8 md:mt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:items-end lg:gap-16">
              <h2
                id="services-closing-heading"
                className="font-title font-semibold leading-[1.0] tracking-[-0.045em] text-enzo-cream"
                style={{ fontSize: "clamp(2.2rem, 5vw, 4.4rem)" }}
              >
                {content.lines.map((line) => (
                  <span
                    key={line}
                    className="block overflow-hidden pb-[0.1em] -mb-[0.1em]"
                  >
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
                className="text-[15px] leading-[1.7] text-enzo-cream/70 opacity-0 lg:pb-2 lg:text-right"
                style={{ transform: "translateY(14px)" }}
              >
                {content.lede}
              </p>
            </div>

            {/* The one question that carries — md and up only below the
                fold; see the file-header note on why it drops out on a
                phone rather than shrinking. */}
            <fieldset
              data-close-body
              className="mt-12 hidden border-t border-enzo-cream/12 pt-8 opacity-0 md:mt-16 md:block"
              style={{ transform: "translateY(14px)" }}
            >
              <legend className="sr-only">{content.question.legend}</legend>
              {/* Flex rather than an inline span: at phone widths the label
                  wraps, and a margin-indented "optional" then starts a line
                  three units in from everything else. A wrapped flex item
                  falls flush left. */}
              <p
                aria-hidden="true"
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-display text-[10.5px] font-semibold uppercase tracking-[0.28em] text-enzo-cream/65"
              >
                <span>{content.question.legend}</span>
                <span className="normal-case tracking-normal text-enzo-cream/65">
                  {content.question.optional}
                </span>
              </p>

              {/* A column per discipline rather than a wrapping row: chips
                  sized by their own labels are what made the old version
                  ragged, and a grid cannot go ragged. */}
              <div className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
                {services.map((entry) => {
                  const on = service === entry.slug;
                  return (
                    <button
                      key={entry.slug}
                      type="button"
                      // Pressing the chosen room clears it — the question is
                      // optional and there must be a way back to unanswered.
                      onClick={() => setService(on ? null : entry.slug)}
                      aria-pressed={on}
                      className="group flex items-center gap-3 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-4 focus-visible:ring-offset-enzo-dark"
                    >
                      <span
                        aria-hidden="true"
                        className="relative block h-[13px] w-[13px] shrink-0 rounded-full border transition-colors duration-300"
                        style={{
                          borderColor: on ? "#D4C9B5" : "rgba(242,240,235,0.28)",
                        }}
                      >
                        <span
                          className="absolute inset-[3px] rounded-full bg-enzo-sand transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                          style={{ transform: `scale(${on ? 1 : 0})` }}
                        />
                      </span>
                      <span
                        className={cn(
                          "text-[14.5px] transition-colors duration-300",
                          on
                            ? "text-enzo-cream"
                            : "text-enzo-cream/70 group-hover:text-enzo-cream/85",
                        )}
                      >
                        {entry.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>

          {/* ── The title block ──
              Narrow cells carry the facts, the wide one carries the action —
              which is where a drawing sheet puts its approval box. */}
          <div
            data-close-body
            className="mt-12 grid grid-cols-3 border-t border-enzo-cream/18 opacity-0 md:mt-16 lg:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.45fr)]"
            style={{ transform: "translateY(14px)" }}
          >
            {/* Three across from the base breakpoint, not just from sm — see
                the file-header note. Same three facts, same lg+ layout,
                tighter below it: smaller padding and a smaller value size so
                "60–90 min" sits comfortably in a ~90px column instead of the
                20px-larger desktop size overflowing it. */}
            {content.facts.map((fact) => (
              <div
                key={fact.label}
                className="border-r border-enzo-cream/12 px-3 py-5 last-of-type:border-r-0 md:px-8 md:py-7 lg:last-of-type:border-r"
              >
                <span className="font-display block text-[9px] font-semibold uppercase leading-[1.3] tracking-[0.14em] text-enzo-cream/65 md:text-[10px] md:tracking-[0.28em]">
                  {fact.label}
                </span>
                <span className="mt-2 block font-title text-[1.02rem] font-semibold leading-[1.15] tracking-[-0.02em] text-enzo-cream md:mt-2.5 md:text-[1.5rem]">
                  {fact.value}
                </span>
              </div>
            ))}

            <div className="col-span-3 p-4 lg:col-span-1">
              <Link
                href={href}
                className="group relative flex h-full min-h-[4.25rem] items-center justify-center overflow-hidden rounded-full bg-enzo-cream px-8 text-center text-[14.5px] font-medium text-enzo-forest transition-colors duration-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-4 focus-visible:ring-offset-enzo-dark"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-0 origin-bottom scale-y-0 bg-enzo-sand transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-y-100"
                />
                {/* The button says what it will actually do once a room is
                    picked, which is the only feedback the choice needs. */}
                <span className="relative">
                  {chosen
                    ? fill(content.ctaChosen, { title: chosen.title })
                    : content.ctaDefault}
                </span>
              </Link>
            </div>
          </div>
        </div>

        <div
          data-close-body
          className="mt-6 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 px-1 text-[12.5px] text-enzo-cream/65 opacity-0"
          style={{ transform: "translateY(10px)" }}
        >
          <span>{content.footerNote}</span>
          <span>
            {content.talkPrefix}{" "}
            <a
              href={company.phone.href}
              className="tabular-nums text-enzo-cream/75 underline decoration-enzo-cream/25 decoration-1 underline-offset-[6px] transition-colors duration-300 hover:text-enzo-cream hover:decoration-enzo-sand"
            >
              {company.phone.display}
            </a>
          </span>
        </div>
      </div>
    </section>
  );
}
