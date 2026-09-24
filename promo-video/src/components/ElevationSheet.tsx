// A shop drawing that draws itself — the video's take on the homepage's
// ElevationDrawing (apps/web/src/components/landing/ElevationDrawing.tsx).
//
// Same idea, same stages, redrawn square so it sits in a portrait frame: a
// fitted wardrobe on a real wall, inking in the way the job actually runs.
//
//   0  Consultation — the room as found, measured, with a figure for scale
//   1  Design       — the carcass lands in the surveyed room
//   2  Making       — bays, shelves, hanging rail, drawer boxes
//   3  Fitting      — doors, handles, scribes against the walls, the floor
//   4  Handover     — it stops being a drawing: finishes and the stamp
//
// Strokes draw with the dash-offset technique. Every stroke is given
// pathLength=1, so no lengths need measuring — which is also what keeps this
// safe to render off-screen.
import type { ReactElement } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { font } from "../brand/fonts";
import { color, EASE, sec } from "../brand/tokens";

const STROKE = { hair: 2, thin: 2.6, medium: 3.4, heavy: 5 } as const;
type Weight = keyof typeof STROKE | number;

/** Per-stroke draw and the offset between consecutive strokes, in frames. */
const DRAW = sec(0.75);
const STROKE_STAGGER = 0.9;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const width = (w: Weight) => (typeof w === "number" ? w : STROKE[w]);

/**
 * Hands out a staggered progress to each element of one stage, in the order
 * they are declared — the order a draughtsman would put them down.
 */
function stageInk(frame: number, start: number) {
  let strokeIndex = 0;
  let fadeIndex = 0;
  let key = 0;

  const drawn = () => {
    const at = start + strokeIndex++ * STROKE_STAGGER;
    return interpolate(frame, [at, at + DRAW], [0, 1], { ...clamp, easing: EASE.enter });
  };
  const faded = () => {
    const at = start + sec(0.25) + fadeIndex++ * 1.5;
    return interpolate(frame, [at, at + sec(0.45)], [0, 1], { ...clamp, easing: EASE.enter });
  };
  const ink = (t: number) => ({
    pathLength: 1,
    strokeDasharray: 1,
    strokeDashoffset: 1 - t,
    // A fully offset dash can still leave a round cap's dot at the start.
    visibility: t <= 0 ? ("hidden" as const) : undefined,
    stroke: "currentColor",
  });

  return {
    line: (x1: number, y1: number, x2: number, y2: number, w: Weight = "thin", opacity = 1): ReactElement => (
      <line key={key++} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={width(w)} opacity={opacity} {...ink(drawn())} />
    ),
    rect: (x: number, y: number, w: number, h: number, weight: Weight = "thin", rx = 0): ReactElement => (
      <rect key={key++} x={x} y={y} width={w} height={h} rx={rx} strokeWidth={width(weight)} {...ink(drawn())} />
    ),
    circle: (cx: number, cy: number, r: number, weight: Weight = "thin"): ReactElement => (
      <circle key={key++} cx={cx} cy={cy} r={r} strokeWidth={width(weight)} {...ink(drawn())} />
    ),
    /** A figure lettered on a paper-coloured knockout, like a dimension on a drawing. */
    label: (x: number, y: number, text: string, rotate = 0): ReactElement => {
      const o = faded();
      const w = text.length * 15 + 26;
      return (
        <g key={key++} opacity={o} transform={`translate(${x} ${y}) rotate(${rotate})`}>
          <rect x={-w / 2} y={-17} width={w} height={34} rx={5} fill={color.white} />
          <text
            y={8}
            textAnchor="middle"
            fill="currentColor"
            fontFamily={font.display}
            fontWeight={500}
            fontSize={23}
            letterSpacing={2.2}
          >
            {text}
          </text>
        </g>
      );
    },
    text: (x: number, y: number, text: string): ReactElement => (
      <text
        key={key++}
        x={x}
        y={y}
        opacity={faded()}
        fill="currentColor"
        fontFamily={font.display}
        fontWeight={500}
        fontSize={19}
        letterSpacing={2.6}
      >
        {text}
      </text>
    ),
    /** Fills, and anything else that should fade rather than draw. */
    fade: (el: ReactElement<{ opacity?: number }>, opacity = 1): ReactElement => (
      <g key={key++} opacity={faded() * opacity}>
        {el}
      </g>
    ),
  };
}

export interface ElevationProps {
  /**
   * The frame each stage starts inking at, in order. A stage with no entry
   * (or `undefined`) is never drawn.
   */
  stages: readonly (number | undefined)[];
  dimensions?: { roomWidth: string; roomHeight: string; carcassWidth: string };
}

const DEFAULT_DIMENSIONS = { roomWidth: "2900", roomHeight: "2440", carcassWidth: "2100" };

// Doors, shared by the fitting and handover stages.
const DOORS = [
  { x: 145, w: 149, handle: 282 },
  { x: 304, w: 150, handle: 442 },
  { x: 464, w: 149, handle: 601 },
] as const;

export function ElevationSheet({ stages, dimensions = DEFAULT_DIMENSIONS }: ElevationProps) {
  const frame = useCurrentFrame();
  const on = (i: number) => stages[i] !== undefined && frame >= (stages[i] as number) - 1;

  return (
    <svg
      viewBox="0 0 900 900"
      preserveAspectRatio="xMidYMid meet"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {on(0) &&
        (() => {
          const d = stageInk(frame, stages[0] as number);
          return (
            <g style={{ color: color.forestLight }}>
              {/* The room as found: floor, walls, ceiling, skirting. */}
              {d.line(60, 750, 840, 750, "medium")}
              {d.line(120, 190, 120, 750)}
              {d.line(780, 190, 780, 750)}
              {d.line(120, 190, 780, 190)}
              {d.line(120, 734, 780, 734, "hair", 0.65)}
              {/* Overall height */}
              {d.line(80, 190, 80, 750, "hair")}
              {d.line(68, 190, 92, 190, "hair")}
              {d.line(68, 750, 92, 750, "hair")}
              {/* Overall width */}
              {d.line(120, 806, 780, 806, "hair")}
              {d.line(120, 794, 120, 818, "hair")}
              {d.line(780, 794, 780, 818, "hair")}
              {/* A figure for scale — 1.75 m against a 2.44 m ceiling. */}
              {d.circle(690, 371, 19)}
              {d.line(690, 390, 690, 560)}
              {d.line(690, 412, 666, 500)}
              {d.line(690, 412, 714, 500)}
              {d.line(690, 560, 672, 750)}
              {d.line(690, 560, 708, 750)}
              {d.label(80, 470, dimensions.roomHeight, -90)}
              {d.label(450, 806, dimensions.roomWidth)}
            </g>
          );
        })()}

      {on(1) &&
        (() => {
          const d = stageInk(frame, stages[1] as number);
          return (
            <g style={{ color: color.forest }}>
              {d.rect(140, 196, 478, 554, "heavy")}
              {d.line(140, 226, 618, 226)}
              {d.line(140, 724, 618, 724)}
              {/* Centre line — its dash pattern is fixed, so it fades rather than draws. */}
              {d.fade(
                <line x1={379} y1={168} x2={379} y2={778} stroke="currentColor" strokeWidth={STROKE.hair} strokeDasharray="22 7 4 7" />,
                0.4,
              )}
              {d.line(140, 156, 618, 156, "hair", 0.7)}
              {d.line(140, 144, 140, 168, "hair", 0.7)}
              {d.line(618, 144, 618, 168, "hair", 0.7)}
              {d.label(379, 156, dimensions.carcassWidth)}
            </g>
          );
        })()}

      {on(2) &&
        (() => {
          const d = stageInk(frame, stages[2] as number);
          return (
            <g style={{ color: color.forest }} opacity={0.82}>
              {d.line(299, 226, 299, 724, "medium")}
              {d.line(459, 226, 459, 724, "medium")}
              {/* Left bay — shelf stack */}
              {[310, 395, 480, 565, 650].map((y) => d.line(140, y, 299, y))}
              {/* Middle bay — hanging rail and hangers */}
              {d.line(307, 262, 451, 262, "heavy")}
              {[322, 344, 366, 388, 410, 432].map((x, i) => d.line(x, 262, x, 312 + (i % 2) * 14, "hair"))}
              {/* Right bay — shelves over a drawer stack */}
              {[300, 380].map((y) => d.line(459, y, 618, y))}
              {[520, 588, 656].map((y) => d.line(459, y, 618, y, "medium"))}
              {[554, 622, 690].map((y) => d.line(518, y, 560, y, 6))}
              {/* The cut list, off to the side — what "making" looks like on paper. */}
              <g style={{ color: color.forestLight }}>
                {d.text(650, 122, "CUT LIST")}
                {d.line(650, 138, 770, 138, "hair", 0.8)}
                {d.line(650, 152, 738, 152, "hair", 0.8)}
                {d.line(650, 166, 782, 166, "hair", 0.8)}
              </g>
            </g>
          );
        })()}

      {on(3) &&
        (() => {
          const d = stageInk(frame, stages[3] as number);
          return (
            <g style={{ color: color.forest }}>
              {DOORS.map((door) => d.rect(door.x, 231, door.w, 488))}
              {DOORS.map((door) => d.line(door.handle, 440, door.handle, 520, 7))}
              {/* Scribes against walls that are never straight */}
              {d.line(132, 196, 132, 750, "hair", 0.7)}
              {d.line(626, 196, 626, 750, "hair", 0.7)}
              {[170, 225, 280, 335, 390, 445, 500, 555, 610].map((x) => d.line(x, 750, x - 22, 772, "hair", 0.4))}
            </g>
          );
        })()}

      {on(4) &&
        (() => {
          const d = stageInk(frame, stages[4] as number);
          return (
            <g>
              {DOORS.map((door) => d.fade(<rect x={door.x} y={231} width={door.w} height={488} fill={color.sage} />, 0.24))}
              {d.fade(<rect x={140} y={724} width={478} height={26} fill={color.forest} />, 0.2)}
              {DOORS.map((door) =>
                d.fade(<rect x={door.handle - 3.5} y={440} width={7} height={80} rx={3.5} fill={color.sand} />),
              )}
              {d.fade(<ellipse cx={690} cy={752} rx={80} ry={8} fill={color.sand} />, 0.5)}
              {d.fade(
                <g transform="translate(700 282) rotate(-7)" style={{ color: color.forest }}>
                  <rect x={-98} y={-27} width={196} height={54} rx={27} fill={color.white} stroke="currentColor" strokeWidth={STROKE.thin} />
                  <text
                    y={8}
                    textAnchor="middle"
                    fill="currentColor"
                    fontFamily={font.display}
                    fontWeight={600}
                    fontSize={20}
                    letterSpacing={4}
                  >
                    HANDOVER
                  </text>
                </g>,
              )}
            </g>
          );
        })()}
    </svg>
  );
}
