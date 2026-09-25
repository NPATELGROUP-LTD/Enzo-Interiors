// The shared frame for the three legal pages.
//
// ── Why they are not styled like the rest of the site ──
// Every other page here is a designed object: masked headlines, scroll-driven
// reveals, plates that arrive. A privacy policy is a document, and dressing a
// document up as a landing page makes it *harder* to use — you cannot skim a
// notice whose paragraphs fade in as you reach them, and the UK GDPR's Art.
// 12 requirement is "concise, transparent, intelligible and easily
// accessible", which is a legibility standard, not a decorative one.
//
// So these pages borrow the site's typography, its sheet rule and its measure
// — and nothing else. No animation, no reveal, no scroll dependency: the
// whole document is present in the first paint, and it prints correctly. The
// one designed element is the contents rail, which exists because a person
// looking for "how long do you keep my data" should not have to read the
// eight clauses before it.
//
// It stays a Server Component. There is nothing interactive on these pages,
// which is the point.
//
// All three documents — their clauses, their intros and the date they were last
// reviewed — are authored in src/data/pages/legal.json. A notice whose text
// lives in a .tsx file is one a non-developer cannot correct, and these are
// exactly the pages that get corrected by somebody who is not a developer.
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { fill, type LegalPageContent } from "@/lib/content";

export interface LegalClause {
  /** Anchor id, used by the contents rail. */
  id: string;
  heading: string;
  /** Each entry is a paragraph; a nested array becomes a bulleted list. */
  body: (string | string[])[];
}

export function LegalSheet({
  index,
  eyebrow,
  title,
  intro,
  updated,
  clauses,
  contact,
  labels,
}: {
  /** Sheet index, in the site's own lettering — legal pages take "L". */
  index: string;
  eyebrow: string;
  title: string;
  intro: string;
  /** Human date, e.g. "5 September 2026". */
  updated: string;
  clauses: LegalClause[];
  contact: { label: string; href: string }[];
  /** The frame's own words, shared by all three documents. */
  labels: LegalPageContent["sheet"];
}) {
  return (
    <article className="bg-background text-primary">
      <div className="shell pb-24 pt-[7.5rem] md:pb-32 md:pt-[9rem]">
        {/* The same sheet rule every other page in the site opens on, so a
            legal page still reads as part of this site rather than as a
            template somebody pasted in. */}
        <div className="flex items-center gap-3 sm:gap-4">
          <span className="font-display shrink-0 text-[10.5px] font-semibold uppercase tracking-[0.3em] text-enzo-forest-light">
            {index}
          </span>
          <span className="font-display shrink-0 text-[10.5px] font-semibold uppercase tracking-[0.3em] text-primary/80">
            {eyebrow}
          </span>
          <span aria-hidden="true" className="h-px flex-1 bg-primary/25" />
          <span className="whitespace-nowrap text-[11px] text-foreground/70">
            {fill(labels.updatedLabel, { updated })}
          </span>
        </div>

        <div className="mt-10 grid gap-x-16 gap-y-10 md:mt-14 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
          {/* ── Contents ── */}
          <nav aria-label={labels.contentsNavLabel} className="lg:sticky lg:top-28 lg:self-start">
            <h2 className="font-display text-[9.5px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              {labels.contentsLabel}
            </h2>
            <ol className="mt-4">
              {clauses.map((clause, i) => (
                <li key={clause.id}>
                  <a
                    href={`#${clause.id}`}
                    className="flex items-baseline gap-3 border-t border-border/70 py-2.5 text-[13.5px] leading-[1.4] text-foreground/80 transition-colors duration-200 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="font-display text-[10px] tabular-nums text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {clause.heading}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          {/* ── The document ── */}
          <div>
            <h1
              className="font-title font-semibold leading-[1.02] tracking-[-0.04em]"
              style={{ fontSize: "clamp(2.2rem, 5vw, 3.6rem)" }}
            >
              {title}
            </h1>
            <p className="mt-6 max-w-[62ch] text-[16px] leading-[1.75] text-foreground/80">
              {intro}
            </p>

            {clauses.map((clause, i) => (
              <section key={clause.id} id={clause.id} className="mt-12 scroll-mt-28">
                <h2 className="flex items-baseline gap-3 border-t border-primary/20 pt-5 font-title text-[1.35rem] font-semibold tracking-[-0.03em] md:text-[1.55rem]">
                  <span className="font-display text-[11px] tabular-nums tracking-[0.16em] text-enzo-forest-light">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {clause.heading}
                </h2>
                {clause.body.map((block, j) =>
                  Array.isArray(block) ? (
                    <ul key={j} className="mt-4 max-w-[62ch]">
                      {block.map((item) => (
                        <li
                          key={item}
                          className="flex gap-3 py-1.5 text-[15px] leading-[1.7] text-foreground/80"
                        >
                          <span
                            aria-hidden="true"
                            className="mt-[0.72em] h-px w-3 shrink-0 bg-enzo-sand"
                          />
                          <span>{fill(item, { updated })}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p
                      key={j}
                      className="mt-4 max-w-[62ch] text-[15px] leading-[1.75] text-foreground/80"
                    >
                      {/* A clause may cite the review date — see the `changes`
                          clause of the privacy notice — so the date is stated
                          once, at the top of the document's own record. */}
                      {fill(block, { updated })}
                    </p>
                  ),
                )}
              </section>
            ))}

            <div className="mt-14 border-t border-primary/20 pt-7">
              <h2 className="font-display text-[9.5px] font-semibold uppercase tracking-[0.22em] text-enzo-forest-light">
                {labels.questionsLabel}
              </h2>
              <ul className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
                {contact.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="touch-target group inline-flex items-center gap-1.5 border-b border-primary/25 pb-1 text-[14.5px] text-primary transition-colors duration-300 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
                    >
                      {item.label}
                      <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
