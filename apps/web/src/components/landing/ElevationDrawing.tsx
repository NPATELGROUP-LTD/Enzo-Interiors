"use client";

// The page's signature moment: a shop drawing that draws itself.
//
// Each stage of the process owns one `<g data-stage="n">` in a single
// elevation. Scrolling the ledger beside it advances `active`, and the
// matching group inks in — survey marks first, then the carcass, then the
// internals, the doors, and finally the finished fills and the sign-off
// stamp. Scrolling back un-inks it, because every stage is a reversible
// GSAP timeline rather than a one-way reveal.
//
// Two element kinds, tagged in the markup:
//   [data-draw]  strokes — animated with the stroke-dashoffset technique
//   [data-fade]  text and fills — animated with opacity
//
// Path lengths are measured at runtime via getTotalLength() so the geometry
// below can be edited freely without hand-maintaining dash values.
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@/hooks/useGSAP";
import { EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";

export const ELEVATION_STAGE_COUNT = 5;

interface ElevationDrawingProps {
  /** Index of the furthest stage that should be inked in (0-based). */
  active: number;
  /** Caption shown in the drawing's title block. */
  caption: string;
  className?: string;
}

export function ElevationDrawing({ active, caption, className }: ElevationDrawingProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const timelinesRef = useRef<gsap.core.Timeline[]>([]);
  const reducedRef = useRef(false);
  // Read inside the GSAP setup, which re-runs on a media-query change and
  // needs the current stage rather than the one from first mount. Seeded
  // with the mount value and kept in step below, in an effect — updating it
  // during render would be read-your-own-writes on a value React does not
  // track.
  const activeRef = useRef(active);

  useGSAP(rootRef, (root, reduced) => {
    reducedRef.current = reduced;

    const groups = gsap.utils.toArray<SVGGElement>("[data-stage]", root);

    timelinesRef.current = groups.map((group) => {
      const strokes = gsap.utils.toArray<SVGGeometryElement>("[data-draw]", group);
      const fades = gsap.utils.toArray<SVGElement>("[data-fade]", group);

      strokes.forEach((el) => {
        // Some browsers report 0 for a not-yet-laid-out element; the
        // fallback keeps such a stroke visible rather than permanently
        // hidden behind an offset it can never animate away from.
        const length = el.getTotalLength() || 0;
        gsap.set(el, {
          strokeDasharray: length || "none",
          strokeDashoffset: length,
        });
      });
      gsap.set(fades, { opacity: 0 });

      const tl = gsap.timeline({ paused: true });
      tl.to(strokes, {
        strokeDashoffset: 0,
        duration: 0.7,
        ease: EASE.enter,
        stagger: 0.045,
      }).to(fades, { opacity: 1, duration: 0.4, ease: EASE.enter, stagger: 0.06 }, 0.2);

      return tl;
    });

    applyStage(timelinesRef.current, activeRef.current, reduced);
  });

  useEffect(() => {
    activeRef.current = active;
    applyStage(timelinesRef.current, active, reducedRef.current);
  }, [active]);

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative overflow-hidden rounded-[22px] border border-border/70 bg-card",
        className,
      )}
    >
      {/* Drawing-sheet grid. Kept very low contrast so it reads as paper
          tooth rather than as a visible graph. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.55]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to right, rgba(28,74,58,0.07) 0 1px, transparent 1px 22px), repeating-linear-gradient(to bottom, rgba(28,74,58,0.07) 0 1px, transparent 1px 22px)",
        }}
      />

      <svg
        viewBox="0 0 440 500"
        role="img"
        aria-label={`Wardrobe elevation drawing, ${caption} stage`}
        className="relative block h-auto w-full"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* 00 — Survey. Room envelope, overall dimensions, and a figure for
            human scale: what actually happens on the first visit. */}
        <g data-stage="0" className="text-enzo-forest-light">
          <line data-draw x1="30" y1="430" x2="410" y2="430" stroke="currentColor" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
          <line data-draw x1="40" y1="60" x2="40" y2="430" stroke="currentColor" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
          <line data-draw x1="400" y1="60" x2="400" y2="430" stroke="currentColor" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
          <line data-draw x1="40" y1="60" x2="400" y2="60" stroke="currentColor" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />

          <line data-draw x1="40" y1="462" x2="400" y2="462" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <line data-draw x1="40" y1="456" x2="40" y2="468" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <line data-draw x1="400" y1="456" x2="400" y2="468" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <text data-fade x="220" y="484" textAnchor="middle" fill="currentColor" className="font-display" fontSize="11" letterSpacing="1.6">
            3600
          </text>

          <line data-draw x1="20" y1="60" x2="20" y2="430" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <line data-draw x1="14" y1="60" x2="26" y2="60" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <line data-draw x1="14" y1="430" x2="26" y2="430" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <text data-fade transform="translate(13 245) rotate(-90)" textAnchor="middle" fill="currentColor" className="font-display" fontSize="11" letterSpacing="1.6">
            2440
          </text>

          <circle data-draw cx="365" cy="185" r="9" stroke="currentColor" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
          <line data-draw x1="365" y1="194" x2="365" y2="330" stroke="currentColor" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
          <line data-draw x1="365" y1="215" x2="348" y2="262" stroke="currentColor" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
          <line data-draw x1="365" y1="215" x2="382" y2="262" stroke="currentColor" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
          <line data-draw x1="365" y1="330" x2="352" y2="430" stroke="currentColor" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
          <line data-draw x1="365" y1="330" x2="378" y2="430" stroke="currentColor" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
        </g>

        {/* 01 — Design. The carcass lands inside the surveyed room. */}
        <g data-stage="1" className="text-primary">
          <rect data-draw x="80" y="110" width="250" height="320" stroke="currentColor" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
          <line data-draw x1="80" y1="128" x2="330" y2="128" stroke="currentColor" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
          <line data-draw x1="80" y1="415" x2="330" y2="415" stroke="currentColor" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
          <line data-fade x1="205" y1="94" x2="205" y2="446" stroke="currentColor" strokeWidth="1" strokeDasharray="12 4 2 4" opacity="0.45" vectorEffect="non-scaling-stroke" />
        </g>

        {/* 02 — Making. Internals: bays, shelves, hanging rail, drawer bank. */}
        <g data-stage="2" className="text-primary/75">
          <line data-draw x1="163" y1="128" x2="163" y2="415" stroke="currentColor" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
          <line data-draw x1="247" y1="128" x2="247" y2="415" stroke="currentColor" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />

          <line data-draw x1="80" y1="185" x2="163" y2="185" stroke="currentColor" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
          <line data-draw x1="80" y1="243" x2="163" y2="243" stroke="currentColor" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
          <line data-draw x1="80" y1="301" x2="163" y2="301" stroke="currentColor" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
          <line data-draw x1="80" y1="359" x2="163" y2="359" stroke="currentColor" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />

          <line data-draw x1="167" y1="160" x2="243" y2="160" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <line data-draw x1="180" y1="160" x2="180" y2="212" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <line data-draw x1="196" y1="160" x2="196" y2="206" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <line data-draw x1="212" y1="160" x2="212" y2="214" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <line data-draw x1="228" y1="160" x2="228" y2="204" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />

          <line data-draw x1="247" y1="200" x2="330" y2="200" stroke="currentColor" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
          <line data-draw x1="247" y1="255" x2="330" y2="255" stroke="currentColor" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
          <line data-draw x1="247" y1="310" x2="330" y2="310" stroke="currentColor" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
          <line data-draw x1="247" y1="355" x2="330" y2="355" stroke="currentColor" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
          <line data-draw x1="278" y1="332" x2="300" y2="332" stroke="currentColor" strokeWidth="2.4" vectorEffect="non-scaling-stroke" />
          <line data-draw x1="278" y1="385" x2="300" y2="385" stroke="currentColor" strokeWidth="2.4" vectorEffect="non-scaling-stroke" />
        </g>

        {/* 03 — Fitting. Door leaves, handles, and the scribes that make a
            box built in a workshop sit tight against a wall that is never
            actually straight. */}
        <g data-stage="3" className="text-primary">
          <rect data-draw x="84" y="132" width="75" height="279" stroke="currentColor" strokeWidth="1.3" vectorEffect="non-scaling-stroke" />
          <rect data-draw x="167" y="132" width="76" height="279" stroke="currentColor" strokeWidth="1.3" vectorEffect="non-scaling-stroke" />
          <rect data-draw x="251" y="132" width="75" height="279" stroke="currentColor" strokeWidth="1.3" vectorEffect="non-scaling-stroke" />

          <line data-draw x1="152" y1="252" x2="152" y2="300" stroke="currentColor" strokeWidth="3.2" vectorEffect="non-scaling-stroke" />
          <line data-draw x1="236" y1="252" x2="236" y2="300" stroke="currentColor" strokeWidth="3.2" vectorEffect="non-scaling-stroke" />
          <line data-draw x1="319" y1="252" x2="319" y2="300" stroke="currentColor" strokeWidth="3.2" vectorEffect="non-scaling-stroke" />

          <line data-draw x1="76" y1="110" x2="76" y2="430" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <line data-draw x1="334" y1="110" x2="334" y2="430" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />

          <line data-draw x1="80" y1="430" x2="66" y2="444" stroke="currentColor" strokeWidth="1" opacity="0.5" vectorEffect="non-scaling-stroke" />
          <line data-draw x1="130" y1="430" x2="116" y2="444" stroke="currentColor" strokeWidth="1" opacity="0.5" vectorEffect="non-scaling-stroke" />
          <line data-draw x1="180" y1="430" x2="166" y2="444" stroke="currentColor" strokeWidth="1" opacity="0.5" vectorEffect="non-scaling-stroke" />
          <line data-draw x1="230" y1="430" x2="216" y2="444" stroke="currentColor" strokeWidth="1" opacity="0.5" vectorEffect="non-scaling-stroke" />
          <line data-draw x1="280" y1="430" x2="266" y2="444" stroke="currentColor" strokeWidth="1" opacity="0.5" vectorEffect="non-scaling-stroke" />
          <line data-draw x1="330" y1="430" x2="316" y2="444" stroke="currentColor" strokeWidth="1" opacity="0.5" vectorEffect="non-scaling-stroke" />
        </g>

        {/* 04 — Handover. The drawing stops being a drawing: panels take
            their finish, and the sign-off stamp lands. */}
        <g data-stage="4">
          <rect data-fade x="84" y="132" width="75" height="279" fill="var(--enzo-sage)" opacity="0.16" />
          <rect data-fade x="167" y="132" width="76" height="279" fill="var(--enzo-sage)" opacity="0.16" />
          <rect data-fade x="251" y="132" width="75" height="279" fill="var(--enzo-sage)" opacity="0.16" />
          <rect data-fade x="80" y="415" width="250" height="15" fill="var(--enzo-forest)" opacity="0.18" />
          <g transform="translate(298 84) rotate(-6)" className="text-enzo-forest-light">
            <rect data-fade x="-58" y="-17" width="116" height="34" rx="17" stroke="currentColor" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
            <text data-fade x="0" y="4" textAnchor="middle" fill="currentColor" className="font-display" fontSize="10" letterSpacing="2.4">
              HANDOVER
            </text>
          </g>
        </g>
      </svg>

      {/* Title block — where a real drawing carries its metadata, and where
          the live stage caption belongs. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border/70 px-5 py-3">
        <span className="font-display text-[10px] font-semibold uppercase tracking-[0.24em] text-enzo-forest-light">
          Elevation &middot; 1:20
        </span>
        <span className="text-[11px] uppercase tracking-[0.2em] text-primary">{caption}</span>
      </div>
    </div>
  );
}

function applyStage(timelines: gsap.core.Timeline[], active: number, reduced: boolean) {
  timelines.forEach((tl, index) => {
    const shouldShow = index <= active;
    if (reduced) {
      // Same end state, no travel — the drawing still tracks the ledger,
      // it just cuts between states instead of inking across them.
      tl.progress(shouldShow ? 1 : 0).pause();
      return;
    }
    if (shouldShow) tl.play();
    else tl.reverse();
  });
}
