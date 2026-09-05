"use client";

// §C4 — what we will not do.
//
// ── What this replaces, and why ──
// A four-column schedule of what happens after you press send: same working
// day, within 48 hours, 60–90 minutes, 3–5 working days. Useful, and it had
// become the third statement of the same sequence — C1 already puts the wait
// beside each way of contacting us, C3 now walks through the survey itself,
// and every service page carries the same run under A4. A contact page that
// says "here is our process" three times is a page with one idea.
//
// The thing nobody says out loud, and the thing that actually stops people
// enquiring with a fitted-furniture company, is the fear of what happens
// afterwards: the salesperson, the discount that expires tonight, the
// deposit taken before anything is drawn. So the last section of the page is
// a set of refusals, each paired with what we do instead.
//
// Every promise below is a restatement of something this site already claims
// somewhere else — "nothing is subcontracted" on every service page,
// "we do not price a room we have not measured" under A5, "nothing is cut
// until you have signed it" on the booking flow. Nothing new is being
// promised here; it is collected in one place, where it does the most good.
//
// ── The layout is the argument ──
// Two columns, and the left one is struck through. The refusal is set in the
// muted colour with a rule drawn through it and the answer sits beside it in
// full contrast, so the eye lands on what we *do* while the thing being
// refused stays legible enough to recognise. It is the one place on the site
// where a rule is used to cross something out rather than to measure it.
//
// The two ways of talking to a person close the page, as they did before.
//
// Ground: warm grey — light enough to follow after the forest band above it,
// and distinct from both the cream masthead and the near-white sheet, so the
// four sections read as four steps rather than two pairs.
import { useRef } from "react";
import gsap from "gsap";
import { revealOnScroll, useGSAP } from "@/hooks/useGSAP";
import { EASE, REVEAL_START } from "@/lib/motion";

export interface EnquiryTerm {
  /** The thing we will not do, set struck through. */
  never: string;
  /** What happens instead. */
  instead: string;
}

export function ContactTerms({
  id,
  terms,
  phoneDisplay,
  phoneHref,
  emailDisplay,
  emailHref,
}: {
  id?: string;
  terms: EnquiryTerm[];
  phoneDisplay: string;
  phoneHref: string;
  emailDisplay: string;
  emailHref: string;
}) {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(sectionRef, (section, reduced) => {
    const lead = gsap.utils.toArray<HTMLElement>("[data-lead]", section);
    const rows = gsap.utils.toArray<HTMLElement>("[data-term]", section);
    const strikes = gsap.utils.toArray<HTMLElement>("[data-strike]", section);
    if (!rows.length) return;

    if (reduced) {
      gsap.set([...lead, ...rows], { opacity: 1, y: 0 });
      gsap.set(strikes, { scaleX: 1 });
      return;
    }

    revealOnScroll(
      section,
      (timeline) => {
        timeline
          .from(lead, { opacity: 0, y: 20, duration: 0.7, ease: EASE.enter, stagger: 0.08 })
          .from(
            rows,
            { opacity: 0, y: 20, duration: 0.6, ease: EASE.enter, stagger: 0.08 },
            0.15,
          )
          // The rules draw through last, after the words they cross out have
          // had a moment to be read.
          .from(
            strikes,
            {
              scaleX: 0,
              transformOrigin: "0% 50%",
              duration: 0.5,
              ease: EASE.editorial,
              stagger: 0.08,
            },
            0.5,
          );
      },
      { start: REVEAL_START },
    );
  });

  if (!terms.length) return null;

  return (
    <section
      ref={sectionRef}
      id={id}
      aria-labelledby="terms-heading"
      className="relative bg-muted scroll-mt-24"
    >
      <div className="mx-auto max-w-[1500px] px-5 py-20 sm:px-6 md:px-12 md:py-28">
        <div className="grid gap-5 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:items-end lg:gap-16">
          <div>
            <span
              data-lead
              className="font-display flex items-baseline gap-3 text-[10.5px] font-semibold uppercase tracking-[0.28em] text-enzo-forest-light"
            >
              <span>C4</span>
              <span className="text-primary/80">What we will not do</span>
            </span>

            <h2
              id="terms-heading"
              data-lead
              className="mt-5 max-w-[17ch] font-title font-semibold leading-[1.02] tracking-[-0.04em] text-primary sm:mt-6"
              style={{ fontSize: "clamp(2rem, 4.6vw, 3.4rem)" }}
            >
              Nothing happens that you did not ask for.
            </h2>
          </div>

          <p
            data-lead
            className="text-[14.5px] leading-[1.7] text-foreground/70 sm:text-[15px] lg:pb-2"
          >
            Fitted furniture has a reputation, and most of it was earned by
            people selling it rather than making it. Here is the short list of
            things we do not do, and what we do instead.
          </p>
        </div>

        <ol className="mt-12 md:mt-20">
          {terms.map((term, index) => (
            <li
              key={term.never}
              data-term
              className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 border-t border-border/70 py-7 last:border-b md:grid-cols-[3rem_minmax(0,0.85fr)_minmax(0,1.15fr)] md:gap-x-10 md:py-9"
            >
              <span className="font-display pt-1 text-[10.5px] font-semibold tabular-nums tracking-[0.18em] text-enzo-forest-light">
                {String(index + 1).padStart(2, "0")}
              </span>

              {/* The refusal. The rule is a separate element rather than
                  `line-through`, so it can draw itself — and so it can be a
                  proper 2px sand rule instead of a hairline in the text's
                  own colour. */}
              <span className="relative inline-block w-fit self-start">
                <span
                  className="font-title block text-[1.15rem] font-semibold leading-[1.2] tracking-[-0.03em] text-foreground/45 md:text-[1.35rem]"
                >
                  {term.never}
                </span>
                <span
                  data-strike
                  aria-hidden="true"
                  className="absolute left-0 top-1/2 block h-[2px] w-full -translate-y-1/2 bg-enzo-sand"
                />
              </span>

              <p className="col-start-2 mt-3 text-[14.5px] leading-[1.7] text-primary md:col-start-3 md:mt-0 md:pt-1">
                {term.instead}
              </p>
            </li>
          ))}
        </ol>

        {/* Talk to a person instead. A line under the list, not a banner
            competing with the sheet two sections above. */}
        <div
          data-term
          className="mt-10 flex flex-col gap-3 border-t border-primary/25 pt-8 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 md:mt-16"
        >
          <span className="text-[13.5px] text-muted-foreground sm:mr-2">
            Would rather just talk to somebody?
          </span>
          <a
            href={phoneHref}
            className="block rounded-full bg-primary px-7 py-3.5 text-center text-[14px] tabular-nums text-primary-foreground transition-colors duration-300 hover:bg-enzo-forest-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:inline-block"
          >
            {phoneDisplay}
          </a>
          <a
            href={emailHref}
            className="block rounded-full border border-border px-7 py-3.5 text-center text-[14px] text-primary transition-colors duration-300 hover:border-primary hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:inline-block"
          >
            {emailDisplay}
          </a>
        </div>
      </div>
    </section>
  );
}
