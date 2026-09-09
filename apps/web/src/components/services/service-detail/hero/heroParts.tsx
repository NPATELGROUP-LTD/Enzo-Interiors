// The chrome every service hero shares.
//
// The four heroes are four genuinely different compositions, but they are
// four pages of one publication, so the furniture around the picture has to
// be identical: the same sheet rule at the top, the same facts in the same
// order, the same pair of actions. Only the *geometry* and the *reveal*
// change from page to page.
//
// Layout stays with the hero — every part below takes a `className` and
// makes no assumption about how it is arranged — while colour is driven by
// one `tone`, because that is the thing that must not be re-decided per file
// (a cream pill is invisible on the cream masthead, which is the bug this
// solves once).
import gsap from "gsap";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { QuoteTriggerButton } from "../../shared/QuoteRequestModal";
import type { HeroFact } from "./heroFacts";

/** `light` = cream / warm grey grounds. `dark` = near-black / forest. */
type HeroTone = "light" | "dark";

/**
 * The sheet rule: sheet index, service name, and a hairline that draws
 * itself. Every section of a service page opens on one of these, so the
 * hero's is the first of six and carries "A1".
 *
 * The rule used to end in "Leicester & Leicestershire". It is gone: the
 * footer says it, the hero copy says it, and a third statement of the same
 * fact was the only thing stopping the hairline from running clean out to
 * the sheet edge.
 */
export function HeroRule({
  category,
  tone,
  className,
}: {
  category: string;
  tone: HeroTone;
  className?: string;
}) {
  const dark = tone === "dark";
  return (
    <div className={cn("flex items-center gap-3 sm:gap-4", className)}>
      <span
        data-hero-meta
        className={cn(
          "font-display shrink-0 text-[10.5px] font-semibold uppercase tracking-[0.3em] opacity-0",
          dark ? "text-enzo-sand" : "text-enzo-forest-light",
        )}
        style={{ transform: "translateY(8px)" }}
      >
        A1
      </span>
      <span
        data-hero-meta
        className={cn(
          "font-display shrink-0 text-[10.5px] font-semibold uppercase tracking-[0.3em] opacity-0",
          dark ? "text-enzo-cream/70" : "text-primary/80",
        )}
        style={{ transform: "translateY(8px)" }}
      >
        {category}
      </span>

      <span aria-hidden="true" className="relative h-px flex-1 overflow-hidden">
        <span
          data-hero-rule
          className={cn(
            "absolute inset-0 block origin-left",
            dark ? "bg-enzo-cream/25" : "bg-primary/25",
          )}
          style={{ transform: "scaleX(0)" }}
        />
      </span>
    </div>
  );
}

/**
 * The four facts, in one order, on every page. The hero supplies the grid —
 * a footer column here, a caption under each panel there — so this only
 * owns the pairing and the colour.
 */
export function HeroFacts({
  facts,
  tone,
  className,
  itemClassName,
}: {
  facts: HeroFact[];
  tone: HeroTone;
  className?: string;
  itemClassName?: string;
}) {
  const dark = tone === "dark";
  return (
    <dl className={className}>
      {facts.map((fact) => (
        <div key={fact.label} className={itemClassName}>
          <dt
            className={cn(
              "font-display text-[10px] font-semibold uppercase tracking-[0.24em]",
              dark ? "text-enzo-cream/65" : "text-muted-foreground",
            )}
          >
            {fact.label}
          </dt>
          <dd
            className={cn(
              "mt-2 text-[15px] tabular-nums",
              dark ? "text-enzo-cream" : "text-primary",
            )}
          >
            {fact.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The two actions. Quote first because it is the cheaper commitment, and
 * both sized past the 44px touch minimum on every ground.
 *
 * "Book a survey" rather than "Book a consultation": the pair sits in one
 * equal-width row below `sm`, and a 19-character label beside a 16-character
 * one either wraps or forces both pills down to a type size neither can
 * carry. It is also the truer word — the site calls this a free home survey
 * everywhere else it is mentioned.
 */
export function HeroActions({
  slug,
  tone,
  className,
}: {
  slug: string;
  tone: HeroTone;
  className?: string;
}) {
  const dark = tone === "dark";
  return (
    // Below `sm`, an equal-width grid — not a wrapping flex row — because
    // "Book a consultation" is long enough that a flex row wraps it onto
    // its own line at phone widths, leaving two pills of different sizes
    // stacked instead of a matched pair. `sm:` and up reverts to the
    // original content-sized flex row.
    <div className={cn("grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-start", className)}>
      <QuoteTriggerButton
        className={cn(
          "rounded-full px-4 py-3.5 text-center text-[13.5px] font-medium whitespace-nowrap transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:px-7 sm:text-[14px]",
          dark
            ? "bg-enzo-cream text-enzo-forest hover:bg-enzo-sand focus-visible:ring-enzo-sand focus-visible:ring-offset-transparent"
            : "bg-primary text-primary-foreground hover:bg-enzo-forest-light focus-visible:ring-ring focus-visible:ring-offset-transparent",
        )}
      >
        Get a free quote
      </QuoteTriggerButton>
      <Link
        href={`/booking?service=${slug}`}
        className={cn(
          "rounded-full border px-4 py-3.5 text-center text-[13.5px] whitespace-nowrap transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:px-7 sm:text-[14px]",
          dark
            ? "border-enzo-cream/30 text-enzo-cream hover:border-enzo-cream focus-visible:ring-enzo-sand focus-visible:ring-offset-transparent"
            : "border-border text-primary hover:border-primary focus-visible:ring-ring focus-visible:ring-offset-transparent",
        )}
      >
        Book a survey
      </Link>
    </div>
  );
}

/**
 * One masked line of a hero title.
 *
 * The mask box and the moving line are separate elements on purpose: the box
 * clips, the inner span is what GSAP moves. `pb/-mb` gives descenders room
 * inside the clip so they are not shaved off mid-reveal.
 *
 * `opacity-0` alongside the `translateY(100%)` mask isn't redundant: the
 * transform alone hides the line at rest, but the reveal tween crosses a
 * point where the *top* of the letters has cleared the mask while the rest
 * hasn't — a bare sliver of type flashing in ahead of the rest of the word.
 * Fading it in over the same span the transform runs keeps that sliver
 * below visibility until there is enough of the line uncovered to read.
 * Each hero's timeline animates this line's opacity alongside its yPercent.
 */
export function HeroTitleLine({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("block overflow-hidden pb-[0.08em] -mb-[0.08em]", className)}>
      <span
        data-hero-line
        className="block opacity-0"
        style={{ transform: "translateY(100%)" }}
      >
        {children}
      </span>
    </span>
  );
}

/**
 * The four elements every hero's reveal drives, however differently it
 * drives them. Each variant queries its own mechanism parts (shutters,
 * doors, panels, band) on top of these.
 */
export function heroCommonParts(section: HTMLElement) {
  return {
    meta: gsap.utils.toArray<HTMLElement>("[data-hero-meta]", section),
    lines: gsap.utils.toArray<HTMLElement>("[data-hero-line]", section),
    body: gsap.utils.toArray<HTMLElement>("[data-hero-body]", section),
    rule: section.querySelector<HTMLElement>("[data-hero-rule]"),
  };
}

/** The shared reduced-motion end state: type and rule simply already there. */
export function heroRestMotion(parts: ReturnType<typeof heroCommonParts>) {
  gsap.set([...parts.meta, ...parts.body], { opacity: 1, y: 0 });
  gsap.set(parts.lines, { opacity: 1, yPercent: 0, y: 0 });
  if (parts.rule) gsap.set(parts.rule, { scaleX: 1 });
}
