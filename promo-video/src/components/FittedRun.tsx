// "The Fitted Run" — the site's page transition
// (apps/web/src/components/shared/PageTransition.tsx), frame for frame.
//
// Five tall door panels are fitted into the opening, alternate ones dropping
// from the head and rising from the base the way a fitter works along a
// wall. They meet on shadow gaps. A sand rail draws across the closed run and
// a plate hangs from it naming where you are going. Then the run lifts away —
// each panel carrying on the way it came, never retracing — and the next
// scene is revealed from a band outward.
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { font } from "../brand/fonts";
import { color, EASE, RUN_GAP, RUN_PANELS, sec } from "../brand/tokens";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** -1 arrives from above, +1 from below. */
const side = (i: number) => (i % 2 === 0 ? -1 : 1);

export interface RunPlate {
  index: string;
  label: string;
  imprint?: string;
}

export function FittedRun({
  closeAt,
  openAt,
  plate,
  forward = true,
  tempo = 1.25,
  scale = 1,
  padX = 72,
}: {
  /** Frame the first panel starts moving in. */
  closeAt: number;
  /** Frame the marks start clearing and the run lifts away. */
  openAt: number;
  plate?: RunPlate;
  /** Fit left→right (forward through the site) or right→left. */
  forward?: boolean;
  /**
   * The site's timings stretched by this factor. The site's run is a page
   * transition and wants to be quick; in a film it is a moment of its own.
   */
  tempo?: number;
  /** 1 = sized for a 1080px-wide frame. */
  scale?: number;
  padX?: number;
}) {
  const frame = useCurrentFrame();
  if (frame < closeAt - 1 || frame > openAt + sec(0.8 * tempo)) return null;

  const t = (s: number) => s * 30 * tempo;
  const order = (i: number) => (forward ? i : RUN_PANELS.length - 1 - i);

  const railIn = interpolate(frame, [closeAt + t(0.24), closeAt + t(0.54)], [0, 1], { ...clamp, easing: EASE.settle });
  const plateIn = interpolate(frame, [closeAt + t(0.42), closeAt + t(0.62)], [0, 1], { ...clamp, easing: EASE.settle });
  // Both marks clear before the doors start opening beneath them.
  const marksOut = interpolate(frame, [openAt, openAt + t(0.14)], [1, 0], { ...clamp, easing: EASE.exit });

  return (
    <AbsoluteFill style={{ display: "flex", flexDirection: "row", overflow: "hidden" }}>
      {RUN_PANELS.map((tone, i) => {
        const delay = order(i) * t(0.04);
        const shut = interpolate(frame, [closeAt + delay, closeAt + delay + t(0.4)], [0, 1], { ...clamp, easing: EASE.run });
        const lift = interpolate(frame, [openAt + t(0.02) + delay, openAt + t(0.02) + delay + t(0.42)], [0, 1], {
          ...clamp,
          easing: EASE.run,
        });
        // 101 rather than 100: a sub-pixel seam at the extreme shows the page.
        const y = frame < openAt ? side(i) * 101 * (1 - shut) : -side(i) * 101 * lift;
        return (
          <div
            key={tone}
            style={{
              flex: 1,
              height: "100%",
              transform: `translateY(${y}%)`,
              backgroundColor: tone,
              borderLeft: i > 0 ? `${Math.max(2, 4 * scale)}px solid ${RUN_GAP}` : undefined,
              // Fine vertical grain and a soft fall of light down the door —
              // the difference between a coloured rectangle and a faced panel.
              backgroundImage:
                `repeating-linear-gradient(90deg, rgba(242,240,235,0.03) 0px, rgba(242,240,235,0.03) ${2 * scale}px, transparent ${2 * scale}px, transparent ${8 * scale}px),` +
                "linear-gradient(180deg, rgba(242,240,235,0.06) 0%, transparent 38%, rgba(0,0,0,0.16) 100%)",
            }}
          />
        );
      })}

      {/* The rail — at handle height rather than centred. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "58%",
          height: Math.max(1, 2 * scale),
          background: "rgba(212,201,181,0.55)",
          transformOrigin: forward ? "left center" : "right center",
          transform: `scaleX(${railIn})`,
          opacity: marksOut,
        }}
      />

      {plate && (
        <div
          style={{
            position: "absolute",
            bottom: "42%",
            left: padX,
            marginBottom: 26 * scale,
            opacity: plateIn * marksOut,
            transform: `translateY(${(1 - plateIn) * 20 * scale}px)`,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 22 * scale }}>
            <span
              style={{
                fontFamily: font.display,
                fontWeight: 600,
                fontSize: 50 * scale,
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
                color: color.sand,
              }}
            >
              {plate.index}
            </span>
            <span style={{ fontFamily: font.body, fontWeight: 500, fontSize: 40 * scale, color: color.cream }}>
              {plate.label}
            </span>
          </div>
          {plate.imprint && (
            <div
              style={{
                marginTop: 14 * scale,
                fontFamily: font.display,
                fontWeight: 600,
                fontSize: 20 * scale,
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                color: "rgba(212,201,181,0.85)",
              }}
            >
              {plate.imprint}
            </div>
          )}
        </div>
      )}
    </AbsoluteFill>
  );
}
