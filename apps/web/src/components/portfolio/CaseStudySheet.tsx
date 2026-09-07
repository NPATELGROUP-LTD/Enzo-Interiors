"use client";

// The case study, opened from anywhere on /portfolio.
//
// One sheet, two callers: the register on the fold and the wall below it
// both open this, so a project reads identically however you reached it and
// there is one place to change what a case study says.
//
// It is a sheet rather than a lightbox. A lightbox shows a bigger
// photograph; every one of these projects has a client, a place, a duration
// and a materials list, and that schedule is the part a visitor deciding
// whether to call actually wants. So the photograph takes one half and the
// specification takes the other, ruled like every other schedule on the
// site.
//
// A native <dialog> opened with showModal(), which is where Escape, the Tab
// trap, `inert` on the page behind, and focus restore to whatever opened the
// sheet all come from — none of that is hand-written here. Only two things
// are: the page scroll lock (<dialog> does not lock it) and the arrow keys
// that step to the next and previous project without closing.
import { useCallback, useEffect, useRef } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import gsap from "gsap";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { EASE } from "@/lib/motion";
import type { PortfolioItem } from "@/lib/content";

interface CaseStudySheetProps {
  item: PortfolioItem | null;
  /** Position in the full set, for the "03 / 09" readout. */
  index: number;
  total: number;
  onClose: () => void;
  onStep: (delta: number) => void;
}

export function CaseStudySheet({
  item,
  index,
  total,
  onClose,
  onStep,
}: CaseStudySheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const open = item !== null;

  // Closed through the element, not just through React state: it is
  // `dialog.close()` that returns focus to the row or tile the visitor
  // opened the sheet from. Escape goes down the same path via onCancel.
  const close = useCallback(() => {
    dialogRef.current?.close();
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();

    // The one part <dialog> does not do: it makes the page inert, not still.
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        onStep(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        onStep(-1);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onStep]);

  // Enter. Exit is a plain unmount: an exit animation on a modal delays the
  // one thing the visitor has just asked for, and the guidance is explicit
  // that departures should be shorter than arrivals — here that is zero.
  useEffect(() => {
    if (!open || reduced) return;
    const panel = panelRef.current;
    const scrim = scrimRef.current;
    if (!panel || !scrim) return;

    const tl = gsap.timeline();
    tl.fromTo(scrim, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: EASE.enter })
      .fromTo(
        panel,
        { yPercent: 4, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 0.55, ease: EASE.editorial },
        0.05,
      )
      .fromTo(
        panel.querySelectorAll("[data-sheet-plate]"),
        { clipPath: "inset(0 0 100% 0)" },
        { clipPath: "inset(0 0 0% 0)", duration: 0.8, ease: EASE.editorial },
        0.12,
      )
      .fromTo(
        panel.querySelectorAll("[data-sheet-row]"),
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.5, ease: EASE.enter, stagger: 0.045 },
        0.3,
      );

    return () => {
      tl.kill();
    };
    // Keyed on the project id as well as `open`, so stepping to the next
    // project replays the reveal rather than swapping the content silently.
  }, [open, reduced, item?.id]);

  if (!item) return null;

  const spec = [
    { label: "Client", value: item.client },
    { label: "Location", value: item.location },
    { label: "On site", value: item.duration },
    { label: "Completed", value: item.year },
  ];

  return (
    <dialog
      ref={dialogRef}
      onCancel={onClose}
      aria-labelledby="case-study-title"
      // Everything after `z-[80]` neutralises the UA dialog styles (fitted
      // width/height, 1em padding, solid border, canvas background, capped
      // max-width/height, its own scroll box and its backdrop) so the sheet
      // lays out exactly as the plain overlay it replaced.
      className="fixed inset-0 z-[80] m-0 flex h-full max-h-none w-full max-w-none items-stretch justify-center overflow-visible border-0 bg-transparent p-0 [&::backdrop]:bg-transparent"
    >
      <div
        ref={scrimRef}
        aria-hidden="true"
        onClick={close}
        className="absolute inset-0 bg-enzo-dark/90 backdrop-blur-[2px]"
      />

      <div
        ref={panelRef}
        className="relative m-auto flex max-h-[94svh] w-full max-w-[1400px] flex-col overflow-y-auto bg-enzo-dark text-enzo-cream md:max-h-[90svh] md:flex-row"
      >
        {/* ── The photograph ── */}
        <div
          data-sheet-plate
          className="relative h-[38svh] shrink-0 overflow-hidden bg-enzo-forest md:h-auto md:w-[52%]"
        >
          <ImageWithFallback
            src={item.image}
            alt={item.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <span className="font-display absolute bottom-4 left-5 text-[10px] font-semibold uppercase tracking-[0.26em] text-enzo-cream/70">
            {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
        </div>

        {/* ── The schedule ── */}
        <div className="flex min-w-0 flex-1 flex-col px-6 py-8 sm:px-10 md:px-12 md:py-12">
          <div data-sheet-row className="flex items-start justify-between gap-6">
            <span className="font-display text-[10.5px] font-semibold uppercase tracking-[0.28em] text-enzo-sand">
              {item.category}
            </span>
            <button
              type="button"
              onClick={close}
              aria-label="Close case study"
              className="-mr-1 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-enzo-cream/25 text-enzo-cream/70 transition-colors duration-300 hover:border-enzo-sand hover:text-enzo-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand"
            >
              <X size={17} aria-hidden="true" />
            </button>
          </div>

          <h2
            id="case-study-title"
            data-sheet-row
            className="mt-5 font-title font-semibold leading-[1.02] tracking-[-0.04em]"
            style={{ fontSize: "clamp(1.9rem, 3.4vw, 3rem)" }}
          >
            {item.title}
          </h2>

          <p
            data-sheet-row
            className="mt-5 max-w-[54ch] text-[15px] leading-[1.75] text-enzo-cream/65"
          >
            {item.desc}
          </p>

          <dl
            data-sheet-row
            className="mt-9 grid grid-cols-2 border-t border-enzo-cream/15 sm:grid-cols-4"
          >
            {spec.map((entry) => (
              <div
                key={entry.label}
                className="border-b border-r border-enzo-cream/15 py-4 pr-4 last:border-r-0 sm:border-b-0"
              >
                <dt className="font-display text-[9.5px] font-semibold uppercase tracking-[0.22em] text-enzo-cream/65">
                  {entry.label}
                </dt>
                <dd className="mt-2 text-[14px] text-enzo-cream">{entry.value}</dd>
              </div>
            ))}
          </dl>

          <div data-sheet-row className="mt-8">
            <span className="font-display text-[9.5px] font-semibold uppercase tracking-[0.22em] text-enzo-cream/65">
              Specified
            </span>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
              {item.materials.map((material) => (
                <li
                  key={material}
                  className="flex items-center gap-2.5 text-[13.5px] text-enzo-cream/75"
                >
                  <span aria-hidden="true" className="h-px w-3 shrink-0 bg-enzo-sand" />
                  {material}
                </li>
              ))}
            </ul>
          </div>

          {/* ── Step through the set ── */}
          <div
            data-sheet-row
            className="mt-auto flex items-center justify-between gap-4 border-t border-enzo-cream/15 pt-7"
          >
            <button
              type="button"
              onClick={() => onStep(-1)}
              className="group flex items-center gap-3 text-[13.5px] text-enzo-cream/65 transition-colors duration-300 hover:text-enzo-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand"
            >
              <ArrowLeft
                size={16}
                aria-hidden="true"
                className="transition-transform duration-300 group-hover:-translate-x-1"
              />
              Previous
            </button>
            <span className="font-display text-[10px] uppercase tracking-[0.22em] text-enzo-cream/65">
              ← → to step
            </span>
            <button
              type="button"
              onClick={() => onStep(1)}
              className="group flex items-center gap-3 text-[13.5px] text-enzo-cream/65 transition-colors duration-300 hover:text-enzo-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand"
            >
              Next
              <ArrowRight
                size={16}
                aria-hidden="true"
                className="transition-transform duration-300 group-hover:translate-x-1"
              />
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
