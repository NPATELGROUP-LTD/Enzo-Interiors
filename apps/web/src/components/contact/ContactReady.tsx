"use client";

// §C4 — you are more ready than you think.
//
// ── What this replaces, and why ──
// Two versions before this. A four-column schedule of what happens after you
// press send, which was the third statement of a sequence C1 and every
// service page already carry. Then a list of six refusals — "we will not send
// a salesperson", "we will not price a room we have not measured" — set with
// a rule struck through each one. Good copy, and the wrong last word: six
// consecutive sentences beginning "we will not" end the page on defence, and
// a page whose job is to get somebody to write should not close by listing
// the ways other people behave badly.
//
// The thing that actually stops enquiries is not distrust. It is people
// deciding they are not ready yet — no measurements, no budget worked out, no
// idea what they want, "I'll do it once I've had a proper think". They wait,
// and the think never happens.
//
// ── The layout is the argument ──
// So the section is a two-column ledger with the columns deliberately
// unbalanced: a short list of things that genuinely help if you happen to
// have them, against a longer list of things people believe are required and
// are not. Reading across, the right column visibly outweighs the left — the
// point is made by the shape of the thing before a word of it is read, which
// is the only reason to set it as two columns rather than as prose.
//
// The left column's items carry a tick; the right column's carry nothing at
// all, because a cross would read as "wrong" when the whole message is "this
// does not matter". The absence is the mark.
//
// Then the two ways to reach a person, which close the page as they did
// before — that part was never the problem.
//
// Ground: warm grey. Light enough to follow the forest band above it, and
// distinct from both the cream masthead and the near-white sheet, so the four
// sections read as four steps rather than two pairs.
import { useRef } from "react";
import gsap from "gsap";
import { Check } from "lucide-react";
import { revealOnScroll, useGSAP } from "@/hooks/useGSAP";
import { EASE, REVEAL_START } from "@/lib/motion";
import type { Company, ContactPageContent } from "@/lib/content";

// Both lists — the short one of things that genuinely help and the deliberately
// longer one of things people wait for and never needed — are authored in
// src/data/pages/contact.json. The imbalance between them is the argument this
// section makes, so their lengths are an editorial decision, not a layout one.

export function ContactReady({
  content,
  company,
}: {
  content: ContactPageContent["ready"];
  company: Company;
}) {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(sectionRef, (section, reduced) => {
    const lead = gsap.utils.toArray<HTMLElement>("[data-lead]", section);
    const helpful = gsap.utils.toArray<HTMLElement>("[data-helpful]", section);
    const spare = gsap.utils.toArray<HTMLElement>("[data-spare]", section);
    const close = gsap.utils.toArray<HTMLElement>("[data-close]", section);

    if (reduced) {
      gsap.set([...lead, ...helpful, ...spare, ...close], { opacity: 1, y: 0, x: 0 });
      return;
    }

    revealOnScroll(
      section,
      (timeline) => {
        timeline
          .from(lead, { opacity: 0, y: 20, duration: 0.7, ease: EASE.enter, stagger: 0.08 })
          .from(
            helpful,
            { opacity: 0, y: 18, duration: 0.6, ease: EASE.enter, stagger: 0.09 },
            0.15,
          )
          // The long column arrives faster and tighter than the short one, so
          // it reads as a list being crossed off rather than as eight
          // separate points being made.
          .from(
            spare,
            { opacity: 0, x: -12, duration: 0.45, ease: EASE.enter, stagger: 0.045 },
            0.3,
          )
          .from(close, { opacity: 0, y: 18, duration: 0.6, ease: EASE.enter }, 0.6);
      },
      { start: REVEAL_START },
    );
  });

  return (
    <section
      ref={sectionRef}
      id={content.id}
      aria-labelledby="ready-heading"
      className="relative bg-muted scroll-mt-24"
    >
      <div className="shell py-20 md:py-28">
        <div className="grid gap-5 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:items-end lg:gap-16">
          <div>
            <span
              data-lead
              className="font-display flex items-baseline gap-3 text-[10.5px] font-semibold uppercase tracking-[0.28em] text-enzo-forest-light"
            >
              <span>{content.index}</span>
              <span className="text-primary/80">{content.label}</span>
            </span>

            <h2
              id="ready-heading"
              data-lead
              className="mt-5 max-w-[17ch] font-title font-semibold leading-[1.02] tracking-[-0.04em] text-primary sm:mt-6"
              style={{ fontSize: "clamp(2rem, 4.6vw, 3.4rem)" }}
            >
              {content.heading}
            </h2>
          </div>

          <p
            data-lead
            className="text-[14.5px] leading-[1.7] text-foreground/70 sm:text-[15px] lg:pb-2"
          >
            {content.lede}
          </p>
        </div>

        {/* Unbalanced on purpose: the right column is visibly the longer one,
            and that is the argument. */}
        <div className="mt-12 grid gap-x-16 gap-y-12 md:mt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* ── Useful ── */}
          <div>
            <h3 className="font-display border-t border-primary/25 pt-5 text-[10px] font-semibold uppercase tracking-[0.24em] text-enzo-forest-light">
              {content.helpfulLabel}
            </h3>
            <ul className="mt-6">
              {content.helpful.map((entry) => (
                <li
                  key={entry.item}
                  data-helpful
                  className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3 border-b border-border/70 py-5 first:border-t"
                >
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  <span>
                    <span className="block text-[16px] font-semibold leading-[1.3] tracking-[-0.02em] text-primary">
                      {entry.item}
                    </span>
                    <span className="mt-1.5 block max-w-[46ch] text-[13.5px] leading-[1.65] text-muted-foreground">
                      {entry.note}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Not needed ──
              No mark against these. A cross would say "wrong"; the point is
              that they simply do not count. */}
          <div>
            <h3 className="font-display border-t border-primary/25 pt-5 text-[10px] font-semibold uppercase tracking-[0.24em] text-enzo-forest-light">
              {content.unnecessaryLabel}
            </h3>
            <ul className="mt-6">
              {content.unnecessary.map((item) => (
                <li
                  key={item}
                  data-spare
                  className="border-b border-border/70 py-3.5 text-[15px] leading-[1.45] text-foreground/55 first:border-t"
                >
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-5 max-w-[44ch] text-[13px] leading-[1.7] text-muted-foreground">
              {content.unnecessaryNote}
            </p>
          </div>
        </div>

        {/* Talk to a person instead. */}
        <div
          data-close
          className="mt-14 flex flex-col gap-3 border-t border-primary/25 pt-8 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 md:mt-20"
        >
          <span className="text-[13.5px] text-muted-foreground sm:mr-2">
            {content.closeLine}
          </span>
          <a
            href={company.phone.href}
            className="block rounded-full bg-primary px-7 py-3.5 text-center text-[14px] tabular-nums text-primary-foreground transition-colors duration-300 hover:bg-enzo-forest-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:inline-block"
          >
            {company.phone.display}
          </a>
          <a
            href={company.emailHref}
            className="block rounded-full border border-border px-7 py-3.5 text-center text-[14px] text-primary transition-colors duration-300 hover:border-primary hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:inline-block"
          >
            {company.email}
          </a>
        </div>
      </div>
    </section>
  );
}
