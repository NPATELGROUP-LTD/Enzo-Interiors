"use client";

// §A2 — the scope, drawn as the quotation itself.
//
// ── What this replaces, and why the four layouts went with it ──
// A2 used to be "What's included", and it existed in four genuinely different
// designs — a ruled ledger, a drawn spine, a wall read in section, a run of
// bays — one per service page. The layouts were the good part. The section
// was saying something untrue.
//
// "Ten things included as standard" describes a *package*: a specification
// that comes at a price, the same for everyone who buys it. Enzo does not
// sell one. There are no tiers to pick between, nothing is bundled, and every
// job is priced after somebody has stood in the room with a tape measure. So
// the whole section was quietly promising a product that does not exist, and
// four beautiful arrangements of a false claim are still a false claim.
//
// ── What it is now ──
// A quotation sheet with the total left blank.
//
// That single move says the thing plainly and without a paragraph of
// explanation: here is the document you are going to receive, here is what is
// on it, and here is the one line we cannot fill in until we have seen your
// room. The two blocks are the honest division — the handful of things that
// are on every quote we write whatever the job, and beneath them the
// authored scope for this service, every line of it marked as priced per
// room rather than included.
//
// It is also the most on-brand object this site could end up with. Every
// other section is a drawing, a schedule or a setting-out line; this one is
// the paperwork those things arrive with.
//
// ── Why one design and not four ──
// Four service pages still must not read as one template, so the *ground*
// alternates with the variant index — the same device §A6 already uses for
// exactly this reason. What must not vary is the claim: "your quote is
// assembled from your room" is either true on all four pages or it is
// marketing on all four.
//
// Everything below is variable-length, because the client authors the scope
// list in the Content Manager: three lines and fourteen both set correctly,
// and a service with none simply shows the fixed block.
import { useRef } from "react";
import gsap from "gsap";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { revealOnScroll, useGSAP } from "@/hooks/useGSAP";
import { EASE, REVEAL_START } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { fill, type ServiceDetail, type ServiceDetailContent } from "@/lib/content";
import { variantIndex } from "../variant";
import { QuoteTriggerButton } from "../../shared/QuoteRequestModal";

// The "on every quote" block is the site's own standing claims — made on the
// landing page, on /services and on every service hero — collected onto the
// document that would carry them. They are authored in
// src/data/pages/service-detail.json, so the promise this section prints and
// the promise the rest of the site makes are one text.

/** Ground per variant, so four pages do not open A2 on the same colour. */
const GROUNDS = ["bg-background", "bg-card", "bg-background", "bg-muted"];

export function ServiceIncluded({
  service,
  position,
  id,
  content,
}: {
  service: ServiceDetail;
  position: number;
  id: string;
  content: ServiceDetailContent["included"];
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const scope = service.features;
  const variant = variantIndex(position, GROUNDS.length, service.heroVariant);

  useGSAP(sectionRef, (section, reduced) => {
    const rows = gsap.utils.toArray<HTMLElement>("[data-quote-row]", section);
    const rules = gsap.utils.toArray<HTMLElement>("[data-quote-rule]", section);
    const total = section.querySelector<HTMLElement>("[data-quote-total]");
    if (!rows.length) return;

    if (reduced) {
      gsap.set(rows, { opacity: 1, y: 0 });
      gsap.set(rules, { scaleX: 1 });
      if (total) gsap.set(total, { opacity: 1, y: 0 });
      return;
    }

    revealOnScroll(
      section,
      (timeline) => {
        // The sheet rules itself first, then the lines are typed onto it, and
        // the blank total lands last — the order a quotation is actually
        // produced, and the reason the empty line reads as deliberate rather
        // than as something that failed to load.
        timeline
          .from(rules, {
            scaleX: 0,
            transformOrigin: "0% 50%",
            duration: 0.8,
            ease: EASE.editorial,
            stagger: 0.08,
          })
          .from(
            rows,
            { opacity: 0, y: 14, duration: 0.5, ease: EASE.enter, stagger: 0.035 },
            0.2,
          )
          .from(
            total,
            { opacity: 0, y: 18, duration: 0.7, ease: EASE.editorial },
            "-=0.15",
          );
      },
      { start: REVEAL_START },
    );
  });

  return (
    <section
      ref={sectionRef}
      id={id}
      aria-labelledby="included-heading"
      className={cn("relative overflow-hidden scroll-mt-24", GROUNDS[variant])}
    >
      <div className="shell py-20 md:py-28">
        <h2 id="included-heading" className="sr-only">
          {content.srHeading}
        </h2>

        <SectionIntro
          layout="split"
          index={content.index}
          label={content.label}
          datum={fill(content.datum, {
            fixed: content.always.length,
            scope: scope.length,
          })}
          lines={content.lines}
          lede={service.overview}
          ledeShort={service.overviewShort}
        />

        {/* ── The sheet ──
            A bordered document rather than a section of the page, because the
            argument is "this is the piece of paper you will be handed". */}
        <div className="mt-12 overflow-hidden rounded-[16px] border border-primary/20 bg-card md:mt-16">
          {/* Docket head */}
          <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 border-b border-primary/20 px-5 py-4 md:px-8 md:py-5">
            <span className="font-display text-[10px] font-semibold uppercase tracking-[0.24em] text-enzo-forest-light">
              {fill(content.docketLabel, { category: service.category })}
            </span>
            <span className="font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {content.preparedLabel}
            </span>
          </div>

          {/* ── Block one: on every quote ── */}
          <div className="px-5 pt-6 md:px-8 md:pt-8">
            <div className="flex items-baseline gap-4">
              <h3 className="font-display shrink-0 text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">
                {content.alwaysLabel}
              </h3>
              <span aria-hidden="true" className="relative h-px flex-1 overflow-hidden">
                <span
                  data-quote-rule
                  className="absolute inset-0 block origin-left bg-primary/25"
                  style={{ transform: "scaleX(0)" }}
                />
              </span>
            </div>

            <ul className="mt-4">
              {content.always.map((entry) => (
                <li
                  key={entry.item}
                  data-quote-row
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 gap-y-1 border-b border-border/60 py-4 last:border-b-0"
                >
                  <span>
                    <span className="block text-[15.5px] font-medium leading-[1.35] tracking-[-0.015em] text-primary">
                      {entry.item}
                    </span>
                    <span className="mt-1 block max-w-[62ch] text-[13px] leading-[1.6] text-muted-foreground">
                      {entry.note}
                    </span>
                  </span>
                  <span className="font-display shrink-0 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.18em] text-enzo-forest-light">
                    {content.alwaysTag}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Block two: the authored scope ── */}
          {scope.length > 0 && (
            <div className="px-5 pt-8 md:px-8 md:pt-10">
              <div className="flex items-baseline gap-4">
                <h3 className="font-display shrink-0 text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">
                  {content.scopeLabel}
                </h3>
                <span aria-hidden="true" className="relative h-px flex-1 overflow-hidden">
                  <span
                    data-quote-rule
                    className="absolute inset-0 block origin-left bg-primary/25"
                    style={{ transform: "scaleX(0)" }}
                  />
                </span>
              </div>

              {/* Two columns from `sm`: this list runs to fourteen items on
                  some services, and fourteen ruled rows under five is a
                  ladder rather than a schedule. */}
              <ul className="mt-4 grid gap-x-12 sm:grid-cols-2">
                {scope.map((item, index) => (
                  <li
                    key={item}
                    data-quote-row
                    className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-baseline gap-x-3 border-b border-border/60 py-3.5"
                  >
                    <span className="font-display text-[10px] font-semibold tabular-nums tracking-[0.16em] text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="text-[14.5px] leading-[1.4] text-primary">
                      {item}
                    </span>
                    <span
                      aria-hidden="true"
                      className="h-px w-4 shrink-0 translate-y-[-0.35em] bg-enzo-sand"
                    />
                    <span className="sr-only">{content.scopeTag}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── The blank total ──
              The whole point of the section. A ruled line where a figure
              would be, with the reason it is empty written where the figure
              would have gone. */}
          <div
            data-quote-total
            className="mt-8 border-t border-primary/20 bg-background px-5 py-7 md:mt-10 md:px-8 md:py-9"
          >
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <span className="font-display block text-[10px] font-semibold uppercase tracking-[0.24em] text-enzo-forest-light">
                  {content.total.label}
                </span>
                <p
                  className="mt-2 font-title font-semibold leading-[1.05] tracking-[-0.04em] text-primary"
                  style={{ fontSize: "clamp(1.5rem, 3.4vw, 2.5rem)" }}
                >
                  <span
                    aria-hidden="true"
                    className="mr-3 inline-block h-[0.08em] w-[2.2em] translate-y-[-0.28em] bg-primary/30"
                  />
                  {content.total.headline}
                </p>
                <p className="mt-4 max-w-[58ch] text-[14px] leading-[1.7] text-muted-foreground">
                  {fill(content.total.body, {
                    categoryLower: service.category.toLowerCase(),
                  })}
                </p>
              </div>

              <QuoteTriggerButton
                className="shrink-0 rounded-full bg-primary px-8 py-3.5 text-[14px] font-medium text-primary-foreground transition-colors duration-300 hover:bg-enzo-forest-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {content.total.ctaLabel}
              </QuoteTriggerButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
