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
import { useGSAP, scrollTimeline } from "@/hooks/useGSAP";
import { DUR, EASE, REVEAL_START } from "@/lib/motion";
import { cn } from "@/lib/utils";

// Initial states live in inline `style` rather than Tailwind's translate-* /
// scale-* utilities on purpose. Tailwind v4 compiles those to the standalone
// `translate` and `scale` CSS properties, which compose *on top of*
// `transform` — so a GSAP tween writing `transform` can never cancel them and
// the element sits at its hidden offset forever. Writing the same property
// GSAP animates keeps ownership of it in one place.
const HIDDEN_UP = { transform: "translateY(8px)" } as const;
const HIDDEN_UP_LEDE = { transform: "translateY(12px)" } as const;

interface SectionIntroProps {
  /** Zero-padded section index, e.g. "01". Omit for sections outside the run. */
  index?: string;
  /** Short section name — the rule's left-hand caption. */
  label: string;
  /** A true fact about the section (a count, a duration, a place). */
  datum?: string;
  /** Headline, one array entry per visual line so each can mask up on its own. */
  lines: ReactNode[];
  lede?: ReactNode;
  /**
   * A shorter lede for narrow screens. When given, it replaces `lede` below
   * `sm` — long intro paragraphs are readable beside a headline on desktop
   * and a wall of text above the fold on a phone. Both are rendered and one
   * is hidden by breakpoint rather than measured in JS, so the swap survives
   * SSR with no layout flash.
   */
  ledeShort?: ReactNode;
  /**
   * Which palette the heading is set in.
   *
   *   light  forest type — for cream, white and warm-grey grounds
   *   dark   cream type  — for forest and near-black grounds
   */
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
  /**
   * Overrides the `split` layout's column template, for a section that wants
   * its heading and lede to land on the *same* grid as the content beneath
   * them rather than on the intro's own proportions.
   *
   * Without it a split intro divides the row 0.8fr / 1fr and ranges the lede
   * right, which is correct for a section whose content below is a full-width
   * list — the lede then sits against the same right edge everything else
   * does. It is wrong for a section built on an asymmetric two-column grid:
   * the lede lands at the page edge while the column it ought to head up
   * starts hundreds of pixels short of it, and the two read as unrelated.
   *
   * Passing the content grid's own template lines the two rows up into a
   * single spine, and the lede ranges left because it is now heading a
   * column rather than closing a row.
   */
  splitTemplate?: string;
  /**
   * Rendered at the right end of the metadata rule, e.g. a "see all" link.
   * Lives inside this component's own box (rather than as an external
   * sibling the caller places beside it) so the rule reaches it and the
   * lede below — sharing the same right edge — actually lines up with it
   * instead of stopping short to leave room for a sibling outside this box.
   */
  actions?: ReactNode;
}

export function SectionIntro({
  index,
  label,
  datum,
  lines,
  lede,
  ledeShort,
  tone = "light",
  className,
  titleClassName,
  layout = "stacked",
  splitTemplate,
  actions,
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

    scrollTimeline(
      (tl) => {
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
      },
      { trigger: root, start: REVEAL_START, once: true },
    );
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
              color: dark ? "rgba(212,201,181,0.55)" : "rgba(16,46,45,0.35)",
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

        {actions && <span data-intro-meta className="ml-auto shrink-0 opacity-0" style={HIDDEN_UP}>{actions}</span>}
      </div>

      {/* `split` sets the headline and the lede side by side instead of
          stacked. Stacked leaves a wide section with a tall narrow column of
          type down the left and a large hole to its right; putting the lede in
          the second column fills that hole, and lets the headline hold two
          lines instead of wrapping onto three. */}
      <div
        className={cn(
          "mt-6",
          split && "grid gap-y-4 lg:items-end",
          split && "gap-x-12",
          split && !splitTemplate && "lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]",
          // Through a custom property rather than a plain inline style: an
          // inline `grid-template-columns` applies at every width, which would
          // force a phone into two 20rem-ish columns. The variable lets the
          // template be scoped to `lg` like every other column rule here.
          split && splitTemplate && "lg:[grid-template-columns:var(--intro-split)]",
        )}
        style={
          split && splitTemplate
            ? ({ "--intro-split": splitTemplate } as React.CSSProperties)
            : undefined
        }
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
              "text-[15px] leading-[1.7] opacity-0",
              // Only where a short form exists: a lede written for both
              // widths keeps the section's normal 15px everywhere, and the
              // ones that opted in read as a caption on a phone rather than
              // a second paragraph.
              ledeShort && "max-sm:text-[13.5px] max-sm:leading-[1.6]",
              split && !splitTemplate && "lg:pb-1.5 lg:text-right",
              split && splitTemplate && "lg:pb-1.5 max-w-[42ch]",
              !split && "max-w-[46ch] mt-5",
              dark ? "text-enzo-cream/70" : "text-foreground/80",
            )}
            style={HIDDEN_UP_LEDE}
          >
            {ledeShort ? (
              <>
                <span className="sm:hidden">{ledeShort}</span>
                <span className="max-sm:hidden">{lede}</span>
              </>
            ) : (
              lede
            )}
          </p>
        )}
      </div>
    </div>
  );
}
