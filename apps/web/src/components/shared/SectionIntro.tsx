"use client";

// The homepage's signature structural device: a *measuring rule*.
//
// Enzo makes fitted furniture — every job is defined by millimetres taken
// off a real wall — so the section headings are built out of a draughting
// rule with tick marks that draws itself left-to-right as the section
// arrives, carrying an index, a label, and a real datum about the section
// (a count, a duration, a place). The datum is the point: these headings
// carry information rather than decorating the page with a generic
// centred eyebrow.
//
// Every landing section uses this component, which is what makes six very
// differently-laid-out sections read as one page.
import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@/hooks/useGSAP";
import { DUR, EASE, REVEAL_START } from "@/lib/motion";
import { cn } from "@/lib/utils";

gsap.registerPlugin(ScrollTrigger);

// Initial states live in inline `style` rather than Tailwind's translate-* /
// scale-* utilities on purpose. Tailwind v4 compiles those to the standalone
// `translate` and `scale` CSS properties, which compose *on top of*
// `transform` — so a GSAP tween writing `transform` can never cancel them and
// the element sits at its hidden offset forever. Writing the same property
// GSAP animates keeps ownership of it in one place.
const HIDDEN_UP = { transform: "translateY(8px)" } as const;
const HIDDEN_UP_LEDE = { transform: "translateY(12px)" } as const;

export interface SectionIntroProps {
  /** Zero-padded section index, e.g. "01". Omit for sections outside the run. */
  index?: string;
  /** Short section name — the rule's left-hand caption. */
  label: string;
  /** A true fact about the section (a count, a duration, a place). */
  datum?: string;
  /** Headline, one array entry per visual line so each can mask up on its own. */
  lines: ReactNode[];
  lede?: ReactNode;
  /** `dark` inverts the palette for sections on forest/near-black grounds. */
  tone?: "light" | "dark";
  className?: string;
  /** Extra classes for the <h2> — mostly to override the clamped font size. */
  titleClassName?: string;
  /**
   * `stacked` (default) runs heading then lede down the page. `split` sets
   * them side by side from `lg` up, for full-width sections where a stacked
   * intro leaves half the row empty.
   */
  layout?: "stacked" | "split";
}

export function SectionIntro({
  index,
  label,
  datum,
  lines,
  lede,
  tone = "light",
  className,
  titleClassName,
  layout = "stacked",
}: SectionIntroProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const dark = tone === "dark";

  useGSAP(rootRef, (root, reduced) => {
    const meta = root.querySelectorAll<HTMLElement>("[data-intro-meta]");
    const rule = root.querySelector<HTMLElement>("[data-intro-rule]");
    const titleLines = root.querySelectorAll<HTMLElement>("[data-intro-line]");
    const ledeEl = root.querySelector<HTMLElement>("[data-intro-lede]");

    if (reduced) {
      gsap.set([...meta, ...titleLines, ledeEl].filter(Boolean), { opacity: 1, yPercent: 0, y: 0 });
      if (rule) gsap.set(rule, { scaleX: 1 });
      return;
    }

    // Restate the masked-line start position in GSAP's own units before
    // tweening it. The markup ships `translateY(100%)` so the lines are
    // hidden in the server HTML, but GSAP reads existing transforms from the
    // computed matrix, where that percentage has already been resolved to
    // pixels — it would record `y: 122.5, yPercent: 0` and then find the
    // `yPercent: 0` tween below has nothing to do. Setting yPercent
    // explicitly puts the same visual state into the property being animated.
    gsap.set(titleLines, { yPercent: 100, y: 0 });

    // Populate the timeline first, attach the ScrollTrigger second.
    // Passing `scrollTrigger` straight into gsap.timeline() evaluates the
    // trigger synchronously, while the timeline is still empty — so any
    // heading already inside the viewport on load "plays" a zero-length
    // timeline, finishes instantly, and then sits at progress 0 forever
    // once the tweens are appended. Only headings below the fold would ever
    // animate. Building it paused and handing it to ScrollTrigger.create
    // afterwards means the trigger always sees the finished timeline.
    const tl = gsap.timeline({ paused: true });

    tl.to(meta, { opacity: 1, y: 0, duration: DUR.enter, ease: EASE.enter, stagger: 0.05 })
      // The rule draws before the headline lands, so the heading reads as
      // "measure first, then name the thing".
      .to(rule, { scaleX: 1, duration: 0.9, ease: EASE.editorial }, 0.05)
      .to(
        titleLines,
        { yPercent: 0, duration: DUR.editorial, ease: EASE.editorial, stagger: 0.09 },
        0.18,
      )
      .to(ledeEl, { opacity: 1, y: 0, duration: DUR.enter, ease: EASE.enter }, 0.5);

    ScrollTrigger.create({
      trigger: root,
      start: REVEAL_START,
      once: true,
      animation: tl,
    });
  });

  const split = layout === "split";

  return (
    <div ref={rootRef} className={cn(split ? "w-full" : "max-w-[60ch]", className)}>
      <div
        className={cn(
          "flex items-end gap-3 sm:gap-4",
          dark ? "text-enzo-cream" : "text-primary",
        )}
      >
        {index && (
          <span
            data-intro-meta
            className="font-display text-[11px] font-semibold tabular-nums tracking-[0.18em] opacity-0"
            style={HIDDEN_UP}
          >
            {index}
          </span>
        )}
        <span
          data-intro-meta
          className={cn(
            "whitespace-nowrap text-[10.5px] font-semibold uppercase tracking-[0.3em] opacity-0",
            dark ? "text-enzo-sand" : "text-enzo-forest-light",
          )}
          style={HIDDEN_UP}
        >
          {label}
        </span>

        {/* The rule itself — baseline plus minor (12px) and major (60px)
            ticks, exactly like a metric scale bar on a shop drawing. */}
        <span
          aria-hidden="true"
          className="relative mb-[3px] h-[10px] min-w-6 flex-1 overflow-hidden"
        >
          <span
            data-intro-rule
            className="absolute inset-0 block origin-left"
            style={{
              color: dark ? "rgba(212,201,181,0.55)" : "rgba(28,74,58,0.35)",
              transform: "scaleX(0)",
            }}
          >
            <span className="absolute inset-x-0 bottom-0 block h-px bg-current" />
            <span
              className="absolute inset-x-0 bottom-0 block h-[4px]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(to right, currentColor 0 1px, transparent 1px 12px)",
              }}
            />
            <span
              className="absolute inset-x-0 bottom-0 block h-[9px]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(to right, currentColor 0 1px, transparent 1px 60px)",
              }}
            />
          </span>
        </span>

        {datum && (
          <span
            data-intro-meta
            className={cn(
              "whitespace-nowrap text-[11px] tracking-[0.02em] opacity-0",
              dark ? "text-enzo-cream/70" : "text-foreground/80",
            )}
            style={HIDDEN_UP}
          >
            {datum}
          </span>
        )}
      </div>

      {/* `split` sets the headline and the lede side by side instead of
          stacked. Stacked leaves a wide section with a tall narrow column of
          type down the left and a large hole to its right; putting the lede in
          the second column fills that hole, and lets the headline hold two
          lines instead of wrapping onto three. */}
      <div
        className={cn(
          "mt-6",
          split &&
            "grid gap-x-12 gap-y-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-end",
        )}
      >
        <h2
          className={cn(
            "font-title font-semibold leading-[1.02] tracking-[-0.04em]",
            dark ? "text-enzo-cream" : "text-primary",
            titleClassName,
          )}
          style={{ fontSize: split ? "clamp(1.9rem, 3.5vw, 3rem)" : "clamp(2rem, 4.2vw, 3.5rem)" }}
        >
          {lines.map((line, i) => (
            // pb/-mb pair gives descenders room inside the clipping box so
            // they aren't shaved off while the line is masked.
            <span key={i} className="block overflow-hidden pb-[0.12em] -mb-[0.12em]">
              <span data-intro-line className="block" style={{ transform: "translateY(100%)" }}>
                {line}
              </span>
            </span>
          ))}
        </h2>

        {lede && (
          <p
            data-intro-lede
            className={cn(
              "max-w-[46ch] text-[15px] leading-[1.7] opacity-0",
              split ? "lg:pb-1.5" : "mt-5",
              dark ? "text-enzo-cream/70" : "text-foreground/80",
            )}
            style={HIDDEN_UP_LEDE}
          >
            {lede}
          </p>
        )}
      </div>
    </div>
  );
}
