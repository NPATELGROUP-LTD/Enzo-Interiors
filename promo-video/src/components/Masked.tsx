// Masked lines — the site's headline reveal (SectionIntro, HeroSequence).
//
// Each line sits in its own clipping box and rises into it from below on
// expo.out; leaving, it carries on upward on power2.in rather than
// retracing, so a line that swaps for another reads as a roll, not a blink.
import type { CSSProperties, ReactNode } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { DUR, EASE, LINE_STAGGER, sec } from "../brand/tokens";

// Past 100%, because the clip box carries extra room under the line for
// descenders and a line parked at exactly 100% shows its top in that room.
const HIDDEN = 118;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export function maskedOffset(
  frame: number,
  enterAt: number,
  exitAt?: number,
  enterDur: number = DUR.editorial,
  exitDur: number = DUR.exit,
) {
  if (exitAt !== undefined && frame >= exitAt) {
    return interpolate(frame, [exitAt, exitAt + exitDur], [0, -HIDDEN], { ...clamp, easing: EASE.exit });
  }
  return interpolate(frame, [enterAt, enterAt + enterDur], [HIDDEN, 0], { ...clamp, easing: EASE.editorial });
}

export function MaskedLine({
  enterAt,
  exitAt,
  enterDur,
  exitDur,
  children,
  style,
}: {
  enterAt: number;
  exitAt?: number;
  enterDur?: number;
  exitDur?: number;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const frame = useCurrentFrame();
  const y = maskedOffset(frame, enterAt, exitAt, enterDur, exitDur);
  return (
    <span style={{ display: "block", overflow: "hidden", paddingBottom: "0.14em", marginBottom: "-0.14em", ...style }}>
      <span style={{ display: "block", transform: `translateY(${y}%)`, whiteSpace: "nowrap" }}>{children}</span>
    </span>
  );
}

/** A headline of one or more masked lines, staggered like SectionIntro's. */
export function Headline({
  lines,
  enterAt,
  exitAt,
  style,
  lineColors,
}: {
  lines: readonly ReactNode[];
  enterAt: number;
  exitAt?: number;
  style?: CSSProperties;
  /** Per-line colour, for the site's accent line (the sage "made to measure."). */
  lineColors?: readonly (string | undefined)[];
}) {
  return (
    <div style={style}>
      {lines.map((line, i) => (
        <MaskedLine
          key={i}
          enterAt={enterAt + i * LINE_STAGGER}
          exitAt={exitAt === undefined ? undefined : exitAt + i}
          style={lineColors?.[i] ? { color: lineColors[i] } : undefined}
        >
          {line}
        </MaskedLine>
      ))}
    </div>
  );
}

/**
 * Several headlines sharing one position, each taking over from the last at
 * its `from`. The outgoing one starts leaving a few frames before, so the two
 * cross in the mask the way the site's TextRoll does.
 */
export function SwapHeadline({
  beats,
  style,
  lineColors,
  exitAt,
}: {
  beats: readonly { from: number; lines: readonly ReactNode[] }[];
  style?: CSSProperties;
  lineColors?: readonly (string | undefined)[];
  /** When the last headline leaves, if it does. */
  exitAt?: number;
}) {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "grid", ...style }}>
      {beats.map((beat, i) => {
        const next = beats[i + 1];
        const leaveAt = next ? next.from - 4 : exitAt;
        // Nothing to draw before it enters or once it has fully left.
        if (frame < beat.from - 1) return null;
        if (leaveAt !== undefined && frame > leaveAt + DUR.exit + beat.lines.length + 2) return null;
        return (
          <Headline
            key={i}
            lines={beat.lines}
            enterAt={beat.from}
            exitAt={leaveAt}
            lineColors={lineColors}
            style={{ gridArea: "1 / 1" }}
          />
        );
      })}
    </div>
  );
}

/** A single small masked word that swaps in step with a beat list. */
export function SwapText({
  beats,
  style,
  align = "start",
}: {
  beats: readonly { from: number; text: ReactNode }[];
  style?: CSSProperties;
  align?: "start" | "end";
}) {
  return (
    <span style={{ display: "inline-grid", justifyItems: align, flexShrink: 0, ...style }}>
      {beats.map((beat, i) => {
        const next = beats[i + 1];
        return (
          <MaskedLine
            key={i}
            enterAt={beat.from}
            exitAt={next ? next.from - 3 : undefined}
            enterDur={DUR.enter}
            exitDur={sec(0.25)}
            style={{ gridArea: "1 / 1" }}
          >
            {beat.text}
          </MaskedLine>
        );
      })}
    </span>
  );
}
