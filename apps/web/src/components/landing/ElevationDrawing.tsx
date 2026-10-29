"use client";

// The page's signature moment: a shop drawing that draws itself.
//
// One wardrobe, six sheets. Each stage of the process owns one
// `<g data-stage="n">` of permanent linework — the room as surveyed, the
// carcass, its internals, the doors, the hardware, the finished room — and
// scrolling advances `active`, inking in every group up to it and un-inking
// the ones after, because each is a reversible GSAP timeline rather than a
// one-way reveal. Linework is not piled up, either: scaffolding that has done
// its job (the survey dimensions, bays the doors now hide) carries
// `data-until="n"`, the last stage it stays for. On a change, whatever must go
// inks out first, quickly, and only then does the new stage start drawing.
//
// Each stage also owns a `<g data-note>`: numbered balloons on the drawing, a
// small inset in the empty slot beside the window (3D view, cut layout, finish
// swatches, spirit level, guarantee), and a legend along the foot of the sheet
// that says in a line each what the balloons mark. Notes belong to the
// *current* stage only — they ink in when it arrives and out when the next one
// does — which is what lets every stage reuse the same slot and legend row.
//
// Two element kinds, tagged in the markup:
//   [data-draw]  strokes — animated with the stroke-dashoffset technique
//   [data-fade]  text and fills — animated with opacity
//
// Every stroke is given `pathLength="1"` at runtime, which renormalises its
// length to 1 whatever its real geometry, so a single dasharray/offset pair
// inks in any shape and the geometry below can be edited freely without
// hand-maintaining dash values.
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@/hooks/useGSAP";
import { EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { fill, type HomeContent } from "@/lib/content";

interface ElevationDrawingProps {
  /** Index of the furthest stage that should be inked in (0-based; -1 for none). */
  active: number;
  /**
   * The figures and labels lettered onto the sheet. They are copy, not
   * geometry — the coordinates below are the drawing; these are what it says.
   */
  content: HomeContent["process"]["drawing"];
  /** How many stages the process has, for "SHEET 3 / 6". */
  stageCount: number;
  /**
   * Balloons, insets and the legend. Off for the phone drawing, where the sheet
   * is ~340px wide and 13-unit lettering would be 4px tall — the numbered list
   * under it says the same thing at a size that reads.
   */
  annotate?: boolean;
  className?: string;
}

const STROKE = {
  hair: 0.9,
  thin: 1.2,
  medium: 1.6,
  heavy: 2.2,
} as const;
type Weight = keyof typeof STROKE | number;
const weight = (w: Weight) => (typeof w === "number" ? w : STROKE[w]);

/**
 * Balloon positions per stage: [balloon x, y, target x, y]. A balloon whose
 * target is its own centre sits straight on the drawing, with no leader.
 */
const PINS: number[][][] = [
  [[214, 230, 96, 230], [672, 128, 706, 140], [846, 96, 864, 70]],
  [[852, 284, 840, 296], [260, 86, 260, 100], [470, 200, 432, 214]],
  [[852, 282, 836, 296], [222, 166, 222, 192], [570, 300, 560, 330]],
  [[224, 230, 224, 230], [374, 230, 374, 230], [524, 230, 524, 230]],
  [[210, 186, 164, 164], [624, 190, 604, 190], [852, 330, 830, 316]],
  [[224, 250, 224, 250], [374, 250, 374, 250], [852, 316, 808, 316]],
];

/** Where the three legend entries start along the foot of the sheet. */
const LEGEND_X = [96, 376, 656];

/** A timeline of linework that is on show from stage `from` to stage `until`, inclusive. */
interface Unit {
  tl: gsap.core.Timeline;
  from: number;
  until: number;
}

/** How much faster a mark inks out than it inked in, and the longest the next stage waits for it. */
const UNDRAW_SPEED = 3;
const MAX_WAIT = 0.8;

export function ElevationDrawing({ active, content, stageCount, annotate = true, className }: ElevationDrawingProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const unitsRef = useRef<Unit[]>([]);
  const pendingRef = useRef<gsap.core.Tween[]>([]);
  const reducedRef = useRef(false);
  // Read inside the GSAP setup, which re-runs on a media-query change and
  // needs the current stage rather than the one from first mount. Seeded with
  // the mount value and kept in step in the effect below — updating a ref
  // during render is read-your-own-writes on a value React does not track.
  const activeRef = useRef(active);

  useGSAP(rootRef, (root, reduced) => {
    reducedRef.current = reduced;

    const groups = gsap.utils.toArray<SVGGElement>("[data-stage]", root);
    const inNote = (el: Element) => !!el.closest("[data-note]");

    // Normalised, not measured. ProcessLedger mounts this drawing twice —
    // desktop and mobile — so one copy is always `display: none`, and
    // getTotalLength() on a non-rendered element throws InvalidStateError
    // in current Chromium, which escaped the layout effect and took the
    // whole page down. `pathLength: 1` needs no layout at all.
    const build = (strokes: Element[], fades: Element[]) => {
      for (const stroke of strokes) stroke.setAttribute("pathLength", "1");
      // "1.5 3", not "1": with a bare 1 the gap ends exactly where the stroke does, and a round
      // cap turns that zero-length dash into a dot on every undrawn shape. non-scaling-stroke
      // measures dashes in screen px against a pathLength in user units, so the extra length
      // keeps the stroke whole until the sheet is shown 1.5x larger than its 960-unit viewBox.
      if (strokes.length) gsap.set(strokes, { strokeDasharray: "1.5 3", strokeDashoffset: 1.5 });
      if (fades.length) gsap.set(fades, { opacity: 0 });

      const tl = gsap.timeline({ paused: true });
      if (strokes.length) {
        tl.to(strokes, { strokeDashoffset: 0, duration: 0.75, ease: EASE.enter, stagger: 0.035 });
      }
      if (fades.length) {
        tl.to(fades, { opacity: 1, duration: 0.45, ease: EASE.enter, stagger: 0.05 }, 0.25);
      }
      return tl;
    };

    // One timeline per (stage, lifetime) bucket: most linework stays to the end,
    // scaffolding has a `data-until`, and notes live for their own stage only.
    const units: Unit[] = [];
    groups.forEach((group, stage) => {
      const buckets = new Map<string, { strokes: Element[]; fades: Element[] }>();
      const add = (el: Element, kind: "strokes" | "fades") => {
        const key = inNote(el) ? "note" : (el.closest("[data-until]")?.getAttribute("data-until") ?? "Infinity");
        const bucket = buckets.get(key) ?? { strokes: [], fades: [] };
        bucket[kind].push(el);
        buckets.set(key, bucket);
      };
      group.querySelectorAll("[data-draw]").forEach((el) => add(el, "strokes"));
      group.querySelectorAll("[data-fade]").forEach((el) => add(el, "fades"));
      buckets.forEach((bucket, key) =>
        units.push({ tl: build(bucket.strokes, bucket.fades), from: stage, until: key === "note" ? stage : Number(key) }),
      );
    });
    unitsRef.current = units;

    applyStage(units, activeRef.current, reduced, pendingRef);
  });

  useEffect(() => {
    activeRef.current = active;
    applyStage(unitsRef.current, active, reducedRef.current, pendingRef);
  }, [active]);

  const notes = (stage: number, inset?: React.ReactNode) =>
    annotate ? (
      <g data-note className="text-primary">
        {inset}
        {(PINS[stage] ?? []).map(([x, y, tx, ty], i) => (
          <Balloon key={i} n={i + 1} x={x} y={y} tx={tx} ty={ty} />
        ))}
        {(content.notes?.[stage] ?? []).slice(0, 3).map((text, i) => (
          <g key={i}>
            <circle data-fade cx={LEGEND_X[i] + 8} cy="510" r="8" fill="currentColor" />
            <text data-fade x={LEGEND_X[i] + 8} y="514" textAnchor="middle" fill="var(--card)" className="font-display" fontSize="11" fontWeight="600">{i + 1}</text>
            <text data-fade x={LEGEND_X[i] + 24} y="514.5" fill="currentColor" fontSize="12.5">{text}</text>
          </g>
        ))}
      </g>
    ) : null;

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
        aria-label={content.ariaLabel}
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
        {/* ── Title block: always on the sheet, only the sheet number moves ── */}
        <g className="text-enzo-forest-light">
          <text x="96" y="36" fill="currentColor" className="font-display" fontSize="12" letterSpacing="2.4">{content.sheetTitle}</text>
          <text x="864" y="36" textAnchor="end" fill="currentColor" className="font-display" fontSize="12" letterSpacing="2.4">
            {fill(content.sheetLabel, { current: Math.max(active, 0) + 1, total: stageCount })}
          </text>
          <line x1="96" y1="46" x2="864" y2="46" stroke="currentColor" strokeWidth={STROKE.hair} opacity="0.4" vectorEffect="non-scaling-stroke" />
        </g>

        {/* ── 00 Consultation — the room as found, measured ── */}
        <g data-stage="0" className="text-enzo-forest-light">
          {/* Room envelope */}
          <L x1={60} y1={452} x2={900} y2={452} w="medium" />
          <L x1={96} y1={70} x2={96} y2={452} />
          <L x1={864} y1={70} x2={864} y2={452} />
          <L x1={96} y1={70} x2={864} y2={70} />
          <L x1={96} y1={438} x2={864} y2={438} w="hair" o={0.65} />

          {/* Window on the right wall, with its sill — gives the elevation a real room */}
          <R x={706} y={118} width={120} height={132} />
          <L x1={766} y1={118} x2={766} y2={250} w="hair" />
          <L x1={706} y1={184} x2={826} y2={184} w="hair" />
          <L x1={698} y1={256} x2={834} y2={256} />

          {/* Radiator under it — the kind of thing a wardrobe has to clear */}
          <R x={724} y={382} width={84} height={54} rx={4} />
          {[745, 766, 787].map((x) => (
            <L key={x} x1={x} y1={386} x2={x} y2={432} w="hair" />
          ))}

          <g data-until="0">
            {/* Overall width dimension */}
            <L x1={96} y1={482} x2={864} y2={482} w="hair" />
            <L x1={96} y1={474} x2={96} y2={490} w="hair" />
            <L x1={864} y1={474} x2={864} y2={490} w="hair" />
            <rect data-fade x="440" y="469" width="80" height="26" rx="4" fill="var(--card)" />
            <text data-fade x="480" y="487" textAnchor="middle" fill="currentColor" className="font-display" fontSize="15" letterSpacing="1.4">{content.dimensions.roomWidth}</text>

            {/* Overall height dimension */}
            <L x1={52} y1={70} x2={52} y2={452} w="hair" />
            <L x1={44} y1={70} x2={60} y2={70} w="hair" />
            <L x1={44} y1={452} x2={60} y2={452} w="hair" />
            <rect data-fade x="38" y="248" width="28" height="76" rx="4" fill="var(--card)" />
            <text data-fade transform="translate(52 286) rotate(-90)" textAnchor="middle" fill="currentColor" className="font-display" fontSize="15" letterSpacing="1.4">{content.dimensions.roomHeight}</text>

            {/* Figure for scale — 1.75 m against a 2.44 m ceiling */}
            <circle data-draw cx="656" cy="190" r="14" stroke="currentColor" strokeWidth={STROKE.thin} vectorEffect="non-scaling-stroke" />
            <L x1={656} y1={204} x2={656} y2={322} />
            <L x1={656} y1={226} x2={630} y2={288} />
            <L x1={656} y1={226} x2={682} y2={288} />
            <L x1={656} y1={322} x2={638} y2={452} />
            <L x1={656} y1={322} x2={674} y2={452} />
          </g>

          {notes(0)}
        </g>

        {/* ── 01 Design — the carcass lands in the surveyed room ── */}
        <g data-stage="1" className="text-primary">
          <R x={148} y={118} width={448} height={334} w="heavy" />
          <L x1={148} y1={140} x2={596} y2={140} />
          <L x1={148} y1={430} x2={596} y2={430} />
          <g data-until="1">
            {/* Centre line — dash pattern is static, so it fades rather than draws */}
            <line data-fade x1="372" y1="96" x2="372" y2="474" stroke="currentColor" strokeWidth={STROKE.hair} strokeDasharray="16 5 3 5" opacity="0.4" vectorEffect="non-scaling-stroke" />
            {/* Carcass width dimension, inside the room dimension */}
            <L x1={148} y1={100} x2={596} y2={100} w="hair" o={0.7} />
            <L x1={148} y1={94} x2={148} y2={106} w="hair" o={0.7} />
            <L x1={596} y1={94} x2={596} y2={106} w="hair" o={0.7} />
            <rect data-fade x="332" y="87" width="80" height="26" rx="4" fill="var(--card)" />
            <text data-fade x="372" y="105" textAnchor="middle" fill="currentColor" className="font-display" fontSize="15" letterSpacing="1.4">{content.dimensions.carcassWidth}</text>
            {/* Carcass height dimension, between the wall and the carcass */}
            <L x1={122} y1={118} x2={122} y2={452} w="hair" o={0.7} />
            <L x1={116} y1={118} x2={128} y2={118} w="hair" o={0.7} />
            <L x1={116} y1={452} x2={128} y2={452} w="hair" o={0.7} />
            <rect data-fade x="108" y="250" width="28" height="84" rx="4" fill="var(--card)" />
            <text data-fade transform="translate(122 292) rotate(-90)" textAnchor="middle" fill="currentColor" className="font-display" fontSize="15" letterSpacing="1.4">{content.dimensions.carcassHeight}</text>
          </g>

          {notes(
            1,
            <>
              {/* The 3D visual, as a thumbnail in the slot */}
              <R x={700} y={268} width={140} height={98} rx={8} w="hair" o={0.6} />
              <text data-fade x="712" y="284" fill="currentColor" className="font-display" fontSize="11" letterSpacing="2">{content.visualLabel}</text>
              <Pa d="M770 284 L806 300 L770 316 L734 300 Z" />
              <Pa d="M734 300 L734 340 L770 356 L770 316" />
              <Pa d="M770 316 L770 356 L806 340 L806 300" />
              <L x1={752} y1={308} x2={752} y2={348} w="hair" />
              <L x1={788} y1={308} x2={788} y2={348} w="hair" />
              {/* The itemised quote, on the empty carcass */}
              <R x={312} y={176} width={120} height={168} rx={4} />
              <L x1={328} y1={196} x2={376} y2={196} w="heavy" />
              {[222, 244, 266, 288].map((y) => (
                <g key={y}>
                  <L x1={328} y1={y} x2={382} y2={y} w="hair" />
                  <L x1={400} y1={y} x2={416} y2={y} w="hair" />
                </g>
              ))}
              <L x1={328} y1={314} x2={416} y2={314} w="hair" />
              <L x1={388} y1={328} x2={416} y2={328} w="heavy" />
            </>,
          )}
        </g>

        {/* ── 02 Making — bays, shelves, rail, drawer box ── */}
        <g data-stage="2" className="text-primary/80">
          <g data-until="2">
            <L x1={297} y1={140} x2={297} y2={430} w="medium" />
            <L x1={447} y1={140} x2={447} y2={430} w="medium" />

            {/* Left bay — shelf stack, each shelf dowelled at both ends */}
            {[192, 244, 296, 348].map((y) => (
              <g key={y}>
                <L x1={148} y1={y} x2={297} y2={y} />
                <circle data-fade cx="156" cy={y} r="2.4" fill="currentColor" />
                <circle data-fade cx="289" cy={y} r="2.4" fill="currentColor" />
              </g>
            ))}

            {/* Middle bay — hanging rail with hangers */}
            <L x1={305} y1={180} x2={439} y2={180} w="heavy" />
            {[322, 342, 362, 382, 402, 422].map((x, i) => (
              <L key={x} x1={x} y1={180} x2={x} y2={224 + (i % 2) * 12} w="hair" />
            ))}

            {/* Right bay — shelves over a drawer box */}
            <L x1={447} y1={206} x2={596} y2={206} />
            <L x1={447} y1={266} x2={596} y2={266} />
            {[330, 378, 426].map((y) => (
              <L key={y} x1={447} y1={y} x2={596} y2={y} w="medium" />
            ))}
            {[354, 402].map((y) => (
              <L key={y} x1={497} y1={y} x2={547} y2={y} w={3.4} />
            ))}
          </g>

          {notes(
            2,
            <>
              {/* The board, nested so the parts waste as little as possible */}
              <R x={704} y={272} width={132} height={84} rx={3} />
              <R x={708} y={276} width={52} height={76} w="hair" />
              <R x={764} y={276} width={68} height={40} w="hair" />
              <R x={764} y={320} width={32} height={32} w="hair" />
              <R x={800} y={320} width={32} height={32} w="hair" />
              <text data-fade x="770" y="368" textAnchor="middle" fill="currentColor" className="font-display" fontSize="11" letterSpacing="2">{content.nestLabel}</text>
            </>,
          )}
        </g>

        {/* ── 03 Production — doors built, finished and checked ── */}
        <g data-stage="3" className="text-primary">
          {[154, 304, 454].map((x) => (
            <g key={x}>
              <R x={x} y={146} width={140} height={280} />
              {/* Shaker panel inset */}
              <R x={x + 18} y={164} width={104} height={244} w="hair" o={0.8} />
            </g>
          ))}

          {notes(
            3,
            <>
              {/* Finish samples and the sign-off stamp */}
              {[
                [712, "var(--enzo-sage)", 0.5],
                [758, "var(--enzo-sand)", 1],
                [804, "var(--enzo-forest)", 1],
              ].map(([x, color, o]) => (
                <g key={x as number}>
                  <rect data-fade x={x as number} y="284" width="30" height="44" rx="3" fill={color as string} opacity={o as number} />
                  <R x={x as number} y={284} width={30} height={44} rx={3} w="hair" />
                </g>
              ))}
              <R x={722} y={338} width={96} height={24} rx={12} />
              <Pa d="M734 351 L739 356 L748 345" />
              <text data-fade x="786" y="354" textAnchor="middle" fill="currentColor" className="font-display" fontSize="11" letterSpacing="2">{content.checkedLabel}</text>
            </>,
          )}
        </g>

        {/* ── 04 Fitting — hinges, handles, scribes, ground, level ── */}
        <g data-stage="4" className="text-primary">
          {[154, 304, 454].map((x) => (
            <g key={x}>
              <R x={x + 2} y={156} width={8} height={16} rx={2} w="hair" />
              <R x={x + 2} y={400} width={8} height={16} rx={2} w="hair" />
              <L x1={x + 128} y1={250} x2={x + 128} y2={310} w={4.4} />
            </g>
          ))}

          <g data-until="4">
            {/* Scribes against walls that are never straight */}
            <L x1={140} y1={118} x2={140} y2={452} w="hair" o={0.7} />
            <L x1={604} y1={118} x2={604} y2={452} w="hair" o={0.7} />

            {/* Ground hatch */}
            {[160, 220, 280, 340, 400, 460, 520, 580].map((x) => (
              <L key={x} x1={x} y1={452} x2={x - 20} y2={474} w="hair" o={0.4} />
            ))}
          </g>

          {notes(
            4,
            <>
              {/* The fitter's tell: a spirit level, bubble dead centre */}
              <R x={706} y={292} width={128} height={24} rx={6} />
              <R x={758} y={298} width={24} height={12} rx={6} w="hair" />
              <circle data-draw cx="770" cy="304" r="4.6" stroke="currentColor" strokeWidth={STROKE.hair} vectorEffect="non-scaling-stroke" />
              <L x1={746} y1={296} x2={746} y2={312} w="hair" />
              <L x1={794} y1={296} x2={794} y2={312} w="hair" />
              <text data-fade x="770" y="342" textAnchor="middle" fill="currentColor" className="font-display" fontSize="13" letterSpacing="1.6">±1 mm</text>
            </>,
          )}
        </g>

        {/* ── 05 Handover — it stops being a drawing ── */}
        <g data-stage="5">
          {[154, 304, 454].map((x) => (
            <rect key={x} data-fade x={x} y="146" width="140" height="280" fill="var(--enzo-sage)" opacity="0.22" />
          ))}
          <rect data-fade x="148" y="430" width="448" height="22" fill="var(--enzo-forest)" opacity="0.2" />
          {[282, 432, 582].map((x) => (
            <rect key={x} data-fade x={x - 3} y="250" width="6" height="60" rx="3" fill="var(--enzo-sand)" />
          ))}

          {/* A lived-in room: rug, lamp, plant */}
          <g className="text-enzo-forest-light">
            <ellipse data-fade cx="700" cy="452" rx="120" ry="10" fill="var(--enzo-sand)" opacity="0.45" />
            <L x1={842} y1={452} x2={842} y2={372} />
            <Pa d="M822 372 L862 372 L852 344 L832 344 Z" />
            <Pa d="M616 452 L616 414 Q616 386 638 380" />
            <Pa d="M616 414 Q616 388 594 382" />
          </g>

          <g transform="translate(654 108) rotate(-7)" className="text-primary">
            <rect data-fade x="-50" y="-17" width="100" height="34" rx="17" stroke="currentColor" strokeWidth={STROKE.thin} fill="var(--card)" vectorEffect="non-scaling-stroke" />
            <text data-fade x="0" y="4" textAnchor="middle" fill="currentColor" className="font-display" fontSize="12" letterSpacing="2.6">{content.handoverLabel}</text>
          </g>

          {notes(
            5,
            <>
              {/* The five-year guarantee, as a seal */}
              <circle data-draw cx="770" cy="314" r="38" stroke="currentColor" strokeWidth={STROKE.medium} vectorEffect="non-scaling-stroke" />
              <circle data-draw cx="770" cy="314" r="32" stroke="currentColor" strokeWidth={STROKE.hair} vectorEffect="non-scaling-stroke" />
              <text data-fade x="770" y="327" textAnchor="middle" fill="currentColor" className="font-display" fontSize="36" fontWeight="600">5</text>
              <text data-fade x="770" y="366" textAnchor="middle" fill="currentColor" className="font-display" fontSize="11" letterSpacing="1">{content.guaranteeLabel}</text>
            </>,
          )}
        </g>
      </svg>
    </div>
  );
}

/** A numbered balloon on the drawing, with a leader to what it marks. */
function Balloon({ n, x, y, tx, ty }: { n: number; x: number; y: number; tx: number; ty: number }) {
  const d = Math.hypot(tx - x, ty - y);
  return (
    <g>
      {d > 12 && (
        <>
          <L x1={x + ((tx - x) * 10) / d} y1={y + ((ty - y) * 10) / d} x2={tx} y2={ty} w="hair" />
          <circle data-fade cx={tx} cy={ty} r="2.2" fill="currentColor" />
        </>
      )}
      {/* The card-coloured disc is a fade, not part of the stroked circle:
          a filled data-draw shape would show its fill before it inked in. */}
      <circle data-fade cx={x} cy={y} r="10" fill="var(--card)" />
      <circle data-draw cx={x} cy={y} r="10" stroke="currentColor" strokeWidth={STROKE.thin} vectorEffect="non-scaling-stroke" />
      <text data-fade x={x} y={y + 4} textAnchor="middle" fill="currentColor" className="font-display" fontSize="11" fontWeight="600">{n}</text>
    </g>
  );
}

type Box = { x: number; y: number; width: number; height: number; rx?: number; w?: Weight; o?: number };

const L = ({ w = "thin", o, ...p }: { x1: number; y1: number; x2: number; y2: number; w?: Weight; o?: number }) => (
  <line data-draw {...p} stroke="currentColor" strokeWidth={weight(w)} opacity={o} vectorEffect="non-scaling-stroke" />
);
const R = ({ w = "thin", o, ...p }: Box) => (
  <rect data-draw {...p} stroke="currentColor" strokeWidth={weight(w)} opacity={o} vectorEffect="non-scaling-stroke" />
);
const Pa = ({ d, w = "thin", o }: { d: string; w?: Weight; o?: number }) => (
  <path data-draw d={d} stroke="currentColor" strokeWidth={weight(w)} opacity={o} vectorEffect="non-scaling-stroke" />
);

function applyStage(units: Unit[], active: number, reduced: boolean, pending: { current: gsap.core.Tween[] }) {
  pending.current.forEach((call) => call.kill());
  pending.current = [];
  const shown = (u: Unit) => u.from <= active && active <= u.until;

  if (reduced) {
    // Same end state, no travel — the drawing still tracks the ledger, it
    // just cuts between states instead of inking across them.
    for (const u of units) u.tl.progress(shown(u) ? 1 : 0).pause();
    return;
  }

  // Out first, then in: what the next stage no longer needs inks out quickly,
  // and only once it is gone does the new linework start drawing, so the two
  // are never on the sheet together.
  let wait = 0;
  for (const u of units) {
    if (shown(u)) continue;
    wait = Math.max(wait, u.tl.time() / UNDRAW_SPEED);
    u.tl.timeScale(UNDRAW_SPEED).reverse();
  }
  for (const u of units) {
    if (!shown(u) || (u.tl.progress() === 1 && !u.tl.reversed())) continue;
    const draw = () => void u.tl.timeScale(1).play();
    if (wait > 0) pending.current.push(gsap.delayedCall(Math.min(wait, MAX_WAIT), draw));
    else draw();
  }
}
