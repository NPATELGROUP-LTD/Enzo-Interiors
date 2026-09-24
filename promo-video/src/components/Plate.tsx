// The image plate — the site's rounded card (ElevationDrawing's sheet, the
// portfolio tiles), and the reveal an image plate makes on arrival.
import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { color, EASE, sec } from "../brand/tokens";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export function Plate({
  rect,
  radius = 28,
  children,
  style,
}: {
  rect: Rect;
  radius?: number;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        borderRadius: radius,
        overflow: "hidden",
        background: color.white,
        // Same hairline as the site's card border (border/70).
        boxShadow: `inset 0 0 0 2px rgba(196,184,168,0.7)`,
        // Promote to its own layer so the rounded clip holds on every frame.
        isolation: "isolate",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Drawing-sheet tooth: a faint 24px grid, low enough to read as paper. */
export function SheetGrid({ cell = 36 }: { cell?: number }) {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: color.white,
        backgroundImage:
          `repeating-linear-gradient(to right, rgba(16,46,45,0.06) 0 2px, transparent 2px ${cell}px),` +
          `repeating-linear-gradient(to bottom, rgba(16,46,45,0.06) 0 2px, transparent 2px ${cell}px)`,
      }}
    />
  );
}

/**
 * New plate content rising in from the bottom edge, like a panel lifted into
 * an opening, with the image settling from a slight over-scale — the site's
 * editorial image reveal.
 */
export function PlateReveal({ at, children }: { at: number; children: ReactNode }) {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const p = interpolate(frame, [at, at + sec(0.75)], [0, 1], { ...clamp, easing: EASE.run });
  const settle = interpolate(frame, [at, at + sec(1.2)], [1.12, 1], { ...clamp, easing: EASE.editorial });
  return (
    <AbsoluteFill style={{ clipPath: `inset(${(1 - p) * 100}% 0 0 0)` }}>
      <AbsoluteFill style={{ transform: `scale(${settle})` }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
}
