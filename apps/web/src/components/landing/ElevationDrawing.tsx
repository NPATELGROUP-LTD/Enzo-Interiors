"use client";

// The page's signature moment: a shop drawing that draws itself.
//
// Landscape now, and considerably more drawing than before — it is the whole
// stage of section 02 rather than a panel beside a list, so it carries the
// room, the dimensions, a figure for scale, the carcass, its internals, the
// doors, and finally the finish. Each stage of the process owns one
// `<g data-stage="n">`; scrolling advances `active` and that group inks in,
// scrolling back un-inks it, because every stage is a reversible GSAP
// timeline rather than a one-way reveal.
//
// Two element kinds, tagged in the markup:
//   [data-draw]  strokes — animated with the stroke-dashoffset technique
//   [data-fade]  text and fills — animated with opacity
//
// Path lengths are measured at runtime via getTotalLength(), so the geometry
// below can be edited freely without hand-maintaining dash values.
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@/hooks/useGSAP";
import { EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface ElevationDrawingProps {
  /** Index of the furthest stage that should be inked in (0-based). */
  active: number;
  className?: string;
}

const STROKE = {
  hair: 0.9,
  thin: 1.2,
  medium: 1.6,
  heavy: 2.2,
} as const;

export function ElevationDrawing({ active, className }: ElevationDrawingProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const timelinesRef = useRef<gsap.core.Timeline[]>([]);
  const reducedRef = useRef(false);
  // Read inside the GSAP setup, which re-runs on a media-query change and
  // needs the current stage rather than the one from first mount. Seeded with
  // the mount value and kept in step in the effect below — updating a ref
  // during render is read-your-own-writes on a value React does not track.
  const activeRef = useRef(active);

  useGSAP(rootRef, (root, reduced) => {
    reducedRef.current = reduced;

    const groups = gsap.utils.toArray<SVGGElement>("[data-stage]", root);

    timelinesRef.current = groups.map((group) => {
      const strokes = gsap.utils.toArray<SVGGeometryElement>("[data-draw]", group);
      const fades = gsap.utils.toArray<SVGElement>("[data-fade]", group);

      strokes.forEach((el) => {
        // Some browsers report 0 for a not-yet-laid-out element; the fallback
        // keeps such a stroke visible rather than permanently hidden behind
        // an offset it can never animate away from.
        const length = el.getTotalLength() || 0;
        gsap.set(el, { strokeDasharray: length || "none", strokeDashoffset: length });
      });
      if (fades.length) {
        gsap.set(fades, { opacity: 0 });
      }

      const tl = gsap.timeline({ paused: true });
      tl.to(strokes, {
        strokeDashoffset: 0,
        duration: 0.75,
        ease: EASE.enter,
        stagger: 0.035,
      });
      if (fades.length) {
        tl.to(fades, { opacity: 1, duration: 0.45, ease: EASE.enter, stagger: 0.05 }, 0.25);
      }

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
        "relative overflow-hidden rounded-[20px] border border-border/70 bg-card",
        className,
      )}
    >
      {/* Drawing-sheet tooth. Low contrast so it reads as paper, not a graph. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to right, rgba(16,46,45,0.06) 0 1px, transparent 1px 24px), repeating-linear-gradient(to bottom, rgba(16,46,45,0.06) 0 1px, transparent 1px 24px)",
        }}
      />

      <svg
        viewBox="0 0 960 540"
        role="img"
        aria-label="Wardrobe elevation drawing, inking in stage by stage as the process advances"
        // `h-full w-full` + `preserveAspectRatio` rather than `h-auto
        // w-full`: the auto height made the drawing's size a pure function of
        // the column it sat in, so on a wide screen it grew past the viewport
        // and pushed the section's own heading off the top. Filling the box in
        // both axes lets a parent constrain it by *height* — which is the only
        // constraint that can guarantee it fits a 100vh frame — while
        // preserveAspectRatio keeps the geometry square.
        preserveAspectRatio="xMidYMid meet"
        className="relative block h-full w-full"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* ── 00 Consultation — the room as found, measured ── */}
        <g data-stage="0" className="text-enzo-forest-light">
          {/* Room envelope */}
          <line data-draw x1="60" y1="452" x2="900" y2="452" stroke="currentColor" strokeWidth={STROKE.medium} vectorEffect="non-scaling-stroke" />
          <line data-draw x1="96" y1="70" x2="96" y2="452" stroke="currentColor" strokeWidth={STROKE.thin} vectorEffect="non-scaling-stroke" />
          <line data-draw x1="864" y1="70" x2="864" y2="452" stroke="currentColor" strokeWidth={STROKE.thin} vectorEffect="non-scaling-stroke" />
          <line data-draw x1="96" y1="70" x2="864" y2="70" stroke="currentColor" strokeWidth={STROKE.thin} vectorEffect="non-scaling-stroke" />
          {/* Skirting */}
          <line data-draw x1="96" y1="438" x2="864" y2="438" stroke="currentColor" strokeWidth={STROKE.hair} opacity="0.65" vectorEffect="non-scaling-stroke" />

          {/* Window on the right wall — gives the elevation a real room */}
          <rect data-draw x="700" y="150" width="130" height="170" stroke="currentColor" strokeWidth={STROKE.thin} vectorEffect="non-scaling-stroke" />
          <line data-draw x1="765" y1="150" x2="765" y2="320" stroke="currentColor" strokeWidth={STROKE.hair} vectorEffect="non-scaling-stroke" />
          <line data-draw x1="700" y1="235" x2="830" y2="235" stroke="currentColor" strokeWidth={STROKE.hair} vectorEffect="non-scaling-stroke" />

          {/* Overall width dimension */}
          <line data-draw x1="96" y1="492" x2="864" y2="492" stroke="currentColor" strokeWidth={STROKE.hair} vectorEffect="non-scaling-stroke" />
          <line data-draw x1="96" y1="484" x2="96" y2="500" stroke="currentColor" strokeWidth={STROKE.hair} vectorEffect="non-scaling-stroke" />
          <line data-draw x1="864" y1="484" x2="864" y2="500" stroke="currentColor" strokeWidth={STROKE.hair} vectorEffect="non-scaling-stroke" />
          <rect data-fade x="440" y="479" width="80" height="26" rx="4" fill="var(--card)" />
          <text data-fade x="480" y="497" textAnchor="middle" fill="currentColor" className="font-display" fontSize="15" letterSpacing="1.4">3600</text>

          {/* Overall height dimension */}
          <line data-draw x1="52" y1="70" x2="52" y2="452" stroke="currentColor" strokeWidth={STROKE.hair} vectorEffect="non-scaling-stroke" />
          <line data-draw x1="44" y1="70" x2="60" y2="70" stroke="currentColor" strokeWidth={STROKE.hair} vectorEffect="non-scaling-stroke" />
          <line data-draw x1="44" y1="452" x2="60" y2="452" stroke="currentColor" strokeWidth={STROKE.hair} vectorEffect="non-scaling-stroke" />
          <rect data-fade x="38" y="248" width="28" height="76" rx="4" fill="var(--card)" />
          <text data-fade transform="translate(52 286) rotate(-90)" textAnchor="middle" fill="currentColor" className="font-display" fontSize="15" letterSpacing="1.4">2440</text>

          {/* Figure for scale — 1.75 m against a 2.44 m ceiling */}
          <circle data-draw cx="640" cy="222" r="15" stroke="currentColor" strokeWidth={STROKE.thin} vectorEffect="non-scaling-stroke" />
          <line data-draw x1="640" y1="237" x2="640" y2="350" stroke="currentColor" strokeWidth={STROKE.thin} vectorEffect="non-scaling-stroke" />
          <line data-draw x1="640" y1="262" x2="614" y2="316" stroke="currentColor" strokeWidth={STROKE.thin} vectorEffect="non-scaling-stroke" />
          <line data-draw x1="640" y1="262" x2="666" y2="316" stroke="currentColor" strokeWidth={STROKE.thin} vectorEffect="non-scaling-stroke" />
          <line data-draw x1="640" y1="350" x2="620" y2="452" stroke="currentColor" strokeWidth={STROKE.thin} vectorEffect="non-scaling-stroke" />
          <line data-draw x1="640" y1="350" x2="660" y2="452" stroke="currentColor" strokeWidth={STROKE.thin} vectorEffect="non-scaling-stroke" />
        </g>

        {/* ── 01 Design — the carcass lands in the surveyed room ── */}
        <g data-stage="1" className="text-primary">
          <rect data-draw x="132" y="118" width="420" height="334" stroke="currentColor" strokeWidth={STROKE.heavy} vectorEffect="non-scaling-stroke" />
          <line data-draw x1="132" y1="146" x2="552" y2="146" stroke="currentColor" strokeWidth={STROKE.thin} vectorEffect="non-scaling-stroke" />
          <line data-draw x1="132" y1="426" x2="552" y2="426" stroke="currentColor" strokeWidth={STROKE.thin} vectorEffect="non-scaling-stroke" />
          {/* Centre line — dash pattern is static, so it fades rather than draws */}
          <line data-fade x1="342" y1="96" x2="342" y2="474" stroke="currentColor" strokeWidth={STROKE.hair} strokeDasharray="16 5 3 5" opacity="0.4" vectorEffect="non-scaling-stroke" />
          {/* Carcass width dimension, inside the room dimension */}
          <line data-draw x1="132" y1="92" x2="552" y2="92" stroke="currentColor" strokeWidth={STROKE.hair} opacity="0.7" vectorEffect="non-scaling-stroke" />
          <rect data-fade x="302" y="79" width="80" height="26" rx="4" fill="var(--card)" />
          <text data-fade x="342" y="97" textAnchor="middle" fill="currentColor" className="font-display" fontSize="15" letterSpacing="1.4">2100</text>
        </g>

        {/* ── 02 Making — bays, shelves, rail, drawer box ── */}
        <g data-stage="2" className="text-primary/80">
          <line data-draw x1="272" y1="146" x2="272" y2="426" stroke="currentColor" strokeWidth={STROKE.medium} vectorEffect="non-scaling-stroke" />
          <line data-draw x1="412" y1="146" x2="412" y2="426" stroke="currentColor" strokeWidth={STROKE.medium} vectorEffect="non-scaling-stroke" />

          {/* Left bay — shelf stack */}
          {[196, 252, 308, 364].map((y) => (
            <line key={y} data-draw x1="132" y1={y} x2="272" y2={y} stroke="currentColor" strokeWidth={STROKE.thin} vectorEffect="non-scaling-stroke" />
          ))}

          {/* Middle bay — hanging rail with hangers */}
          <line data-draw x1="280" y1="182" x2="404" y2="182" stroke="currentColor" strokeWidth={STROKE.heavy} vectorEffect="non-scaling-stroke" />
          {[298, 318, 338, 358, 378].map((x, i) => (
            <line key={x} data-draw x1={x} y1="182" x2={x} y2={228 + (i % 2) * 10} stroke="currentColor" strokeWidth={STROKE.hair} vectorEffect="non-scaling-stroke" />
          ))}

          {/* Right bay — shelves over a drawer box */}
          <line data-draw x1="412" y1="210" x2="552" y2="210" stroke="currentColor" strokeWidth={STROKE.thin} vectorEffect="non-scaling-stroke" />
          <line data-draw x1="412" y1="272" x2="552" y2="272" stroke="currentColor" strokeWidth={STROKE.thin} vectorEffect="non-scaling-stroke" />
          {[330, 380, 430].map((y) => (
            <line key={y} data-draw x1="412" y1={y} x2="552" y2={y} stroke="currentColor" strokeWidth={STROKE.medium} vectorEffect="non-scaling-stroke" />
          ))}
          {[355, 405].map((y) => (
            <line key={y} data-draw x1="462" y1={y} x2="502" y2={y} stroke="currentColor" strokeWidth="3.4" vectorEffect="non-scaling-stroke" />
          ))}

          {/* Cut list, off to the side — what "making" actually looks like */}
          <g className="text-enzo-forest-light">
            <line data-draw x1="600" y1="392" x2="700" y2="392" stroke="currentColor" strokeWidth={STROKE.hair} opacity="0.8" vectorEffect="non-scaling-stroke" />
            <line data-draw x1="600" y1="410" x2="676" y2="410" stroke="currentColor" strokeWidth={STROKE.hair} opacity="0.8" vectorEffect="non-scaling-stroke" />
            <line data-draw x1="600" y1="428" x2="712" y2="428" stroke="currentColor" strokeWidth={STROKE.hair} opacity="0.8" vectorEffect="non-scaling-stroke" />
            <text data-fade x="600" y="376" fill="currentColor" className="font-display" fontSize="13" letterSpacing="2">CUT LIST</text>
          </g>
        </g>

        {/* ── 03 Fitting — doors, handles, scribes, ground ── */}
        <g data-stage="3" className="text-primary">
          <rect data-draw x="137" y="151" width="130" height="270" stroke="currentColor" strokeWidth={STROKE.thin} vectorEffect="non-scaling-stroke" />
          <rect data-draw x="277" y="151" width="130" height="270" stroke="currentColor" strokeWidth={STROKE.thin} vectorEffect="non-scaling-stroke" />
          <rect data-draw x="417" y="151" width="130" height="270" stroke="currentColor" strokeWidth={STROKE.thin} vectorEffect="non-scaling-stroke" />

          {/* Handles */}
          {[254, 394, 534].map((x) => (
            <line key={x} data-draw x1={x} y1="256" x2={x} y2="316" stroke="currentColor" strokeWidth="4.4" vectorEffect="non-scaling-stroke" />
          ))}

          {/* Scribes against walls that are never straight */}
          <line data-draw x1="126" y1="118" x2="126" y2="452" stroke="currentColor" strokeWidth={STROKE.hair} opacity="0.7" vectorEffect="non-scaling-stroke" />
          <line data-draw x1="558" y1="118" x2="558" y2="452" stroke="currentColor" strokeWidth={STROKE.hair} opacity="0.7" vectorEffect="non-scaling-stroke" />

          {/* Ground hatch */}
          {[150, 210, 270, 330, 390, 450, 510].map((x) => (
            <line key={x} data-draw x1={x} y1="452" x2={x - 22} y2="474" stroke="currentColor" strokeWidth={STROKE.hair} opacity="0.4" vectorEffect="non-scaling-stroke" />
          ))}

          {/* Spirit level sat on the top — the fitter's tell */}
          <g className="text-enzo-forest-light">
            <rect data-draw x="250" y="98" width="96" height="18" rx="4" stroke="currentColor" strokeWidth={STROKE.hair} vectorEffect="non-scaling-stroke" />
            <circle data-draw cx="298" cy="107" r="5" stroke="currentColor" strokeWidth={STROKE.hair} vectorEffect="non-scaling-stroke" />
          </g>
        </g>

        {/* ── 04 Handover — it stops being a drawing ── */}
        <g data-stage="4">
          <rect data-fade x="137" y="151" width="130" height="270" fill="var(--enzo-sage)" opacity="0.22" />
          <rect data-fade x="277" y="151" width="130" height="270" fill="var(--enzo-sage)" opacity="0.22" />
          <rect data-fade x="417" y="151" width="130" height="270" fill="var(--enzo-sage)" opacity="0.22" />
          <rect data-fade x="132" y="426" width="420" height="26" fill="var(--enzo-forest)" opacity="0.2" />
          {[254, 394, 534].map((x) => (
            <rect key={x} data-fade x={x - 3} y="256" width="6" height="60" rx="3" fill="var(--enzo-sand)" />
          ))}

          {/* A lived-in room: rug, lamp, plant */}
          <g className="text-enzo-forest-light">
            <ellipse data-fade cx="700" cy="452" rx="120" ry="10" fill="var(--enzo-sand)" opacity="0.45" />
            <line data-draw x1="800" y1="452" x2="800" y2="372" stroke="currentColor" strokeWidth={STROKE.thin} vectorEffect="non-scaling-stroke" />
            <path data-draw d="M778 372 L822 372 L812 344 L788 344 Z" stroke="currentColor" strokeWidth={STROKE.thin} vectorEffect="non-scaling-stroke" />
            <path data-draw d="M612 452 L612 414 Q612 386 634 380" stroke="currentColor" strokeWidth={STROKE.thin} vectorEffect="non-scaling-stroke" />
            <path data-draw d="M612 414 Q612 388 590 382" stroke="currentColor" strokeWidth={STROKE.thin} vectorEffect="non-scaling-stroke" />
          </g>

          <g transform="translate(760 118) rotate(-7)" className="text-primary">
            <rect data-fade x="-84" y="-24" width="168" height="48" rx="24" stroke="currentColor" strokeWidth={STROKE.thin} fill="var(--card)" vectorEffect="non-scaling-stroke" />
            <text data-fade x="0" y="6" textAnchor="middle" fill="currentColor" className="font-display" fontSize="14" letterSpacing="3">HANDOVER</text>
          </g>
        </g>
      </svg>
    </div>
  );
}

function applyStage(timelines: gsap.core.Timeline[], active: number, reduced: boolean) {
  timelines.forEach((tl, index) => {
    const shouldShow = index <= active;
    if (reduced) {
      // Same end state, no travel — the drawing still tracks the ledger, it
      // just cuts between states instead of inking across them.
      tl.progress(shouldShow ? 1 : 0).pause();
      return;
    }
    if (shouldShow) tl.play();
    else tl.reverse();
  });
}
