// The measure rule — the site's signature heading device (SectionIntro).
//
// A draughting rule with minor and major ticks draws itself across the row,
// carrying an index, a label and a datum: a true fact about the section
// rather than a decorative eyebrow. Here the rule is drawn once and its
// words roll over as the video moves from beat to beat.
import type { CSSProperties } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { font } from "../brand/fonts";
import { color, EASE, sec } from "../brand/tokens";
import { SwapText } from "./Masked";

export interface RuleBeat {
  from: number;
  index?: string;
  label: string;
  datum?: string;
}

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// Approximate set widths per character, at scale 1 — the label is uppercase
// Inter 600 tracked 0.3em, the datum Inter 400. Measured off rendered frames;
// close enough that the rule always starts a gap's width after the word.
const LABEL_CHAR = 22.6;
const DATUM_CHAR = 15.6;

/**
 * The width a slot should have at `frame`: the current beat's word, easing to
 * the next one's as it rolls in — so the rule follows the words instead of
 * leaving a hole where a longer word used to be.
 */
function slotWidth(frame: number, beats: readonly RuleBeat[], text: (b: RuleBeat) => string, perChar: number) {
  let width = text(beats[0]).length * perChar;
  for (let i = 1; i < beats.length; i++) {
    const from = beats[i].from;
    const next = text(beats[i]).length * perChar;
    width = interpolate(frame, [from - 3, from + 12], [width, next], { ...clamp, easing: EASE.editorial });
  }
  return width;
}

export function RuleRow({
  beats,
  drawAt,
  tone = "light",
  scale = 1,
  exitAt,
  style,
}: {
  beats: readonly RuleBeat[];
  drawAt: number;
  tone?: "light" | "dark";
  /** 1 = sized for a 1080px-wide frame. */
  scale?: number;
  /** Fade the whole row out from this frame. */
  exitAt?: number;
  style?: CSSProperties;
}) {
  const frame = useCurrentFrame();
  const dark = tone === "dark";
  // The rule draws before the words land — "measure first, then name the thing".
  const drawn = interpolate(frame, [drawAt, drawAt + sec(0.9)], [0, 100], { ...clamp, easing: EASE.editorial });
  const fade = exitAt === undefined ? 1 : interpolate(frame, [exitAt, exitAt + 8], [1, 0], clamp);

  const ink = dark ? "rgba(212,201,181,0.6)" : "rgba(16,46,45,0.38)";
  const tick = Math.max(2, Math.round(2 * scale));

  const textBeats = (key: "index" | "label" | "datum") =>
    beats.map((b, i) => ({ from: (i === 0 ? drawAt + 2 : b.from) + (key === "datum" ? 2 : 0), text: b[key] ?? "" }));

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 22 * scale,
        opacity: fade,
        ...style,
      }}
    >
      {beats.some((b) => b.index) && (
        <SwapText
          beats={textBeats("index")}
          style={{
            fontFamily: font.display,
            fontWeight: 600,
            fontSize: 27 * scale,
            letterSpacing: "0.18em",
            fontVariantNumeric: "tabular-nums",
            color: dark ? color.cream : color.forest,
            lineHeight: 1,
          }}
        />
      )}
      <SwapText
        beats={textBeats("label")}
        style={{
          width: slotWidth(frame, beats, (b) => b.label, LABEL_CHAR * scale),
          fontFamily: font.body,
          fontWeight: 600,
          fontSize: 24 * scale,
          letterSpacing: "0.3em",
          textTransform: "uppercase",
          color: dark ? color.sand : color.forestLight,
          lineHeight: 1,
        }}
      />
      <span style={{ position: "relative", flex: 1, height: 20 * scale, marginBottom: 3 * scale, minWidth: 40 }}>
        <span
          style={{
            position: "absolute",
            inset: 0,
            color: ink,
            clipPath: `inset(0 ${100 - drawn}% 0 0)`,
          }}
        >
          <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: tick, background: "currentColor" }} />
          <span
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 8 * scale,
              backgroundImage: `repeating-linear-gradient(to right, currentColor 0 ${tick}px, transparent ${tick}px ${26 * scale}px)`,
            }}
          />
          <span
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 19 * scale,
              backgroundImage: `repeating-linear-gradient(to right, currentColor 0 ${tick}px, transparent ${tick}px ${130 * scale}px)`,
            }}
          />
        </span>
      </span>
      {beats.some((b) => b.datum) && (
        <SwapText
          beats={textBeats("datum")}
          align="end"
          style={{
            width: slotWidth(frame, beats, (b) => b.datum ?? "", DATUM_CHAR * scale),
            fontFamily: font.body,
            fontSize: 27 * scale,
            letterSpacing: "0.02em",
            color: dark ? "rgba(242,240,235,0.72)" : "rgba(44,44,44,0.8)",
            lineHeight: 1,
          }}
        />
      )}
    </div>
  );
}
