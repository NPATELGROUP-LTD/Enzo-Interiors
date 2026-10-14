// The four plates that sit beside /services §03.
//
// Each promise in IndexConstants is abstract — "one team", "surveyed first",
// "drawn in 3D", "guaranteed" — and four stacked paragraphs of abstraction
// read as boilerplate however well they are set. These give each one
// something to look at.
//
// ── Second version. What was wrong with the first ──
// The drawings were too small, too thin, and too abstract to survive at the
// size they were shown: the survey one in particular was a rectangle with a
// smaller rectangle in it and a line underneath, which read as a television,
// not as a measured wall. They also floated inside a dashed box that looked
// like a placeholder rather than a frame.
//
// So each is now a *plate*: a real bordered panel on a slightly lifted
// ground, captioned in its top-left corner the way the hero's room plan is,
// filling half the row instead of a 15rem corner of it. The drawings inside
// are heavier, larger, annotated where an annotation is what makes them
// legible, and each carries one sand-filled accent so the eye has somewhere
// to land. They are drawing-office objects — a title block, a dimensioned
// corner, an axonometric, a stamp — not an icon set.
//
// Drawn, not faded in. Every stroke carries `pathLength={1}`, which
// renormalises the path's length to 1 whatever its real geometry, so a single
// `strokeDasharray: 1` / `strokeDashoffset: 1 → 0` transition inks any shape
// in. No measuring, and no per-path constants to keep in step with the
// coordinates. Things that cannot be drawn — text, fills, dashed hidden
// edges — fade instead, via `Ink`.

import { cn } from "@/lib/utils";
import type { ServicesPageContent } from "@/lib/content";

const DRAW_MS = 760;
const CREAM = "#F2F0EB";
const SAND = "#D4C9B5";

/**
 * Every word inside these drawings — the corner captions, the title block's
 * three rows, the number on the stamp — comes from the page's copy, because
 * the guarantee the stamp prints is the same fact §03's fourth promise states
 * in words and it must not be possible for the two to disagree.
 */
type MarksContent = ServicesPageContent["constants"]["marks"];

interface StrokeProps extends React.SVGProps<SVGPathElement> {
  /** Ink this stroke in, or hold it un-drawn. */
  on: boolean;
  /** Order within the drawing, in units of 70ms. */
  step?: number;
  /** Part of the static ghost layer: complete from the start, never animated. */
  ghost?: boolean;
}

/** One hairline of a drawing, drawn in when `on`. */
function Stroke({ on, step = 0, ghost, style, ...rest }: StrokeProps) {
  return (
    <path
      pathLength={1}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={
        ghost
          ? style
          : {
              strokeDasharray: 1,
              strokeDashoffset: on ? 0 : 1,
              transition: `stroke-dashoffset ${DRAW_MS}ms cubic-bezier(0.22,1,0.36,1) ${step * 70}ms`,
              ...style,
            }
      }
      {...rest}
    />
  );
}

/**
 * Anything that cannot be *drawn* — annotation text, a solid fill, a dashed
 * hidden edge. A dash pattern and a draw-in dash pattern are the same CSS
 * property, so these two treatments cannot be combined on one element.
 */
function Ink({
  on,
  step = 0,
  ghost,
  children,
}: {
  on: boolean;
  step?: number;
  ghost?: boolean;
  children: React.ReactNode;
}) {
  if (ghost) return <g>{children}</g>;
  return (
    <g
      style={{
        opacity: on ? 1 : 0,
        transition: `opacity 460ms ease-out ${step * 70}ms`,
      }}
    >
      {children}
    </g>
  );
}

interface ConstantMarkProps {
  /** Which promise this belongs to — matches the copy's item order. */
  index: number;
  /** The marker has reached this promise, or a pointer is on it. */
  on: boolean;
  content: MarksContent;
  className?: string;
}

export function ConstantMark({ index, on, content, className }: ConstantMarkProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative overflow-hidden border transition-colors duration-700 ease-out",
        className,
      )}
      style={{
        borderColor: on ? "rgba(212,201,181,0.34)" : "rgba(242,240,235,0.12)",
        backgroundColor: on
          ? "rgba(242,240,235,0.045)"
          : "rgba(242,240,235,0.02)",
      }}
    >
      <span
        className="font-display absolute left-4 top-4 text-[9.5px] font-semibold uppercase tracking-[0.24em] transition-colors duration-700"
        // 1.0 / 0.65 rather than 0.85 / 0.4: sand at 40% measured 2.18:1
        // here, and the un-reached plates are most of the run.
        style={{ color: on ? "rgba(212,201,181,1)" : "rgba(212,201,181,0.65)" }}
      >
        {content.captions[index]}
      </span>

      <svg viewBox="0 0 260 156" className="block w-full">
        {/* Twice: a complete, very faint ghost underneath, and the animated
            drawing over it. An un-reached plate is then a sheet with the
            layout pencilled on, which the ink lands on as you arrive —
            rather than an empty bordered box that reads as a broken image
            for every promise the marker has not got to yet. */}
        <g
          style={{
            opacity: on ? 0 : 0.17,
            transition: "opacity 420ms ease-out",
          }}
        >
          <Drawing index={index} on ghost content={content} />
        </g>
        <Drawing index={index} on={on} content={content} />
      </svg>
    </div>
  );
}

interface DrawingProps {
  on: boolean;
  ghost?: boolean;
}

/** Picks the drawing for a promise. Rendered twice per plate — see above. */
function Drawing({
  index,
  on,
  ghost,
  content,
}: DrawingProps & { index: number; content: MarksContent }) {
  if (index === 0) return <TitleBlock on={on} ghost={ghost} rows={content.titleBlockRows} />;
  if (index === 1) return <SurveyedCorner on={on} ghost={ghost} />;
  if (index === 2) return <IsoCarcass on={on} ghost={ghost} />;
  return (
    <GuaranteeStamp
      on={on}
      ghost={ghost}
      value={content.stampValue}
      label={content.stampLabel}
    />
  );
}

const LABEL = {
  fontSize: 8,
  letterSpacing: "0.2em",
  textTransform: "uppercase",
} as const;

/**
 * 01 · One team — a drawing's title block, the panel that records who
 * measured, who drew and who fitted. Three rows, and the same signatory
 * against all three, bracketed into one name.
 */
function TitleBlock({ on, ghost, rows }: DrawingProps & { rows: string[] }) {
  return (
    <g>
      {/* The block, and its two internal rules. */}
      <Stroke ghost={ghost} on={on} d="M34 48 H226 V138 H34 Z" stroke={CREAM} strokeWidth="1.9" />
      <Stroke ghost={ghost} on={on} step={2} d="M34 78 H226" stroke={CREAM} strokeWidth="1" opacity="0.5" />
      <Stroke ghost={ghost} on={on} step={3} d="M34 108 H226" stroke={CREAM} strokeWidth="1" opacity="0.5" />
      <Stroke ghost={ghost} on={on} step={4} d="M140 48 V138" stroke={CREAM} strokeWidth="1" opacity="0.5" />

      {rows.map((row, i) => (
        <Ink key={row} ghost={ghost} on={on} step={5 + i}>
          <text x="46" y={68 + i * 30} fill={CREAM} fillOpacity="0.75" className="font-display" style={LABEL}>
            {row}
          </text>
          {/* The same mark in every row: one team signed off all three. */}
          <circle cx="163" cy={63 + i * 30} r="3.4" fill={SAND} />
        </Ink>
      ))}

      {/* Brace tying the three rows to a single name. */}
      <Stroke ghost={ghost} on={on} step={8} d="M182 58 H190 V128 H182" stroke={SAND} strokeWidth="1.2" />
      <Stroke ghost={ghost} on={on} step={9} d="M190 93 H202" stroke={SAND} strokeWidth="1.2" />
      <Ink ghost={ghost} on={on} step={10}>
        <circle cx="208" cy="93" r="4.5" fill={SAND} />
      </Ink>
    </g>
  );
}

/**
 * 02 · Surveyed before it is quoted — a corner of a real room, dimensioned
 * on both walls. An L, not a rectangle: the previous version was a box with
 * a box in it, which read as a television rather than a wall.
 *
 * The figure boxes on both dimension lines are deliberately empty. There is
 * no number until someone has stood in the room.
 */
function SurveyedCorner({ on, ghost }: DrawingProps) {
  return (
    <g>
      {/* The two walls, heavy, meeting at the datum corner. */}
      <Stroke ghost={ghost} on={on} d="M74 44 V116 H214" stroke={CREAM} strokeWidth="3.4" />
      <Ink ghost={ghost} on={on} step={2}>
        <circle cx="74" cy="116" r="4" fill={SAND} />
      </Ink>

      {/* Horizontal dimension, under the long wall. */}
      <Stroke ghost={ghost} on={on} step={3} d="M74 122 V142" stroke={SAND} strokeWidth="0.8" opacity="0.6" />
      <Stroke ghost={ghost} on={on} step={3} d="M214 122 V142" stroke={SAND} strokeWidth="0.8" opacity="0.6" />
      <Stroke ghost={ghost} on={on} step={4} d="M74 136 H214" stroke={SAND} strokeWidth="1" />
      <Stroke ghost={ghost} on={on} step={5} d="M69 131 L79 141" stroke={SAND} strokeWidth="1.2" />
      <Stroke ghost={ghost} on={on} step={5} d="M209 131 L219 141" stroke={SAND} strokeWidth="1.2" />
      <Stroke ghost={ghost} on={on} step={6} d="M132 128 H156 V144 H132 Z" stroke={SAND} strokeWidth="0.9" opacity="0.75" />

      {/* Vertical dimension, left of the return wall. */}
      <Stroke ghost={ghost} on={on} step={3} d="M68 44 H48" stroke={SAND} strokeWidth="0.8" opacity="0.6" />
      <Stroke ghost={ghost} on={on} step={3} d="M68 116 H48" stroke={SAND} strokeWidth="0.8" opacity="0.6" />
      <Stroke ghost={ghost} on={on} step={4} d="M54 44 V116" stroke={SAND} strokeWidth="1" />
      <Stroke ghost={ghost} on={on} step={5} d="M49 39 L59 49" stroke={SAND} strokeWidth="1.2" />
      <Stroke ghost={ghost} on={on} step={5} d="M49 111 L59 121" stroke={SAND} strokeWidth="1.2" />
      <Stroke ghost={ghost} on={on} step={6} d="M42 68 H66 V84 H42 Z" stroke={SAND} strokeWidth="0.9" opacity="0.75" />

      {/* Skirting, so the L reads as a room rather than a graph axis. */}
      <Stroke ghost={ghost} on={on} step={7} d="M82 44 V108 H214" stroke={CREAM} strokeWidth="0.9" opacity="0.4" />
    </g>
  );
}

/**
 * 03 · Drawn before it is cut — an axonometric carcass on its plinth, one
 * door swung open on its shelves, the hidden back edges dashed. The only
 * thing on the page drawn in three dimensions, which is the promise.
 */
function IsoCarcass({ on, ghost }: DrawingProps) {
  return (
    <g>
      {/* Front face, top, side. */}
      <Stroke ghost={ghost} on={on} d="M104 62 H186 V130 H104 Z" stroke={CREAM} strokeWidth="2.2" />
      <Stroke ghost={ghost} on={on} step={1} d="M104 62 L128 44 H210 L186 62" stroke={CREAM} strokeWidth="2.2" />
      <Stroke ghost={ghost} on={on} step={2} d="M186 62 L210 44 V112 L186 130" stroke={CREAM} strokeWidth="2.2" />

      {/* Hidden back edges — dashed, so they cannot also be drawn in. */}
      <Ink ghost={ghost} on={on} step={3}>
        <path
          d="M128 44 V112 H210"
          fill="none"
          stroke={CREAM}
          strokeOpacity="0.35"
          strokeWidth="0.9"
          strokeDasharray="4 4"
        />
      </Ink>

      {/* Shelves. */}
      <Stroke ghost={ghost} on={on} step={4} d="M104 85 H186" stroke={CREAM} strokeWidth="1" opacity="0.55" />
      <Stroke ghost={ghost} on={on} step={5} d="M104 108 H186" stroke={CREAM} strokeWidth="1" opacity="0.55" />

      {/* Plinth. */}
      <Stroke ghost={ghost} on={on} step={6} d="M104 130 V140 H186 V130" stroke={CREAM} strokeWidth="1.4" opacity="0.7" />

      {/* The open door and its handle — the one sand accent. */}
      <Stroke ghost={ghost} on={on} step={7} d="M104 130 L66 114 V48 L104 62" stroke={CREAM} strokeWidth="1.8" />
      <Ink ghost={ghost} on={on} step={9}>
        <rect x="72" y="76" width="5" height="18" rx="2.5" fill={SAND} />
      </Ink>
    </g>
  );
}

/**
 * 04 · Five-year guarantee — an inked stamp, off-square the way a real one
 * lands. This was a circle with a tick in it, which read as a clock; the
 * promise is a specific number of years, so the plate says the number.
 */
function GuaranteeStamp({
  on,
  ghost,
  value,
  label,
}: DrawingProps & { value: string; label: string }) {
  const cx = 130;
  const cy = 94;
  const ticks = [0, 1, 2, 3, 4].map((i) => {
    const angle = (-90 + i * 72) * (Math.PI / 180);
    return {
      x1: cx + Math.cos(angle) * 47,
      y1: cy + Math.sin(angle) * 47,
      x2: cx + Math.cos(angle) * 55,
      y2: cy + Math.sin(angle) * 55,
    };
  });
  return (
    <g transform={`rotate(-7 ${cx} ${cy})`}>
      <Stroke
        on={on}
        d={`M${cx} ${cy - 47} A47 47 0 1 1 ${cx - 0.01} ${cy - 47}`}
        stroke={SAND}
        strokeWidth="2.2"
      />
      <Stroke
        on={on}
        step={1}
        d={`M${cx} ${cy - 38} A38 38 0 1 1 ${cx - 0.01} ${cy - 38}`}
        stroke={SAND}
        strokeWidth="1"
        opacity="0.6"
      />
      {/* Five rim marks — one per year. */}
      {ticks.map((tick, i) => (
        <Stroke
          key={i}
          ghost={ghost}
          on={on}
          step={3 + i}
          d={`M${tick.x1} ${tick.y1} L${tick.x2} ${tick.y2}`}
          stroke={SAND}
          strokeWidth="2"
        />
      ))}
      <Ink ghost={ghost} on={on} step={8}>
        <text
          x={cx}
          y={cy + 6}
          textAnchor="middle"
          fill={CREAM}
          className="font-title"
          style={{ fontSize: 42, fontWeight: 600, letterSpacing: "-0.04em" }}
        >
          {value}
        </text>
        <text
          x={cx}
          y={cy + 26}
          textAnchor="middle"
          fill={SAND}
          className="font-display"
          style={{ fontSize: 8.5, letterSpacing: "0.28em", textTransform: "uppercase" }}
        >
          {label}
        </text>
      </Ink>
    </g>
  );
}
