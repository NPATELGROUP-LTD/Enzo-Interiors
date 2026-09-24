// Setting and fitting the kinetic cut's display type.
//
// Every line is fitted to its box before it is drawn, so a line never runs
// off the frame whatever the words are (the domain and launch line are
// props). Widths come from a table of Archivo Expanded Black's advances,
// measured in Chromium at wdth 125 / wght 900, in em.
import type { CSSProperties } from "react";
import { font } from "../brand/fonts";

const ADVANCE: Record<string, number> = {
  A: 0.954, B: 0.93, C: 0.939, D: 0.933, E: 0.86, F: 0.807, G: 1.012, H: 1.009, I: 0.395, J: 0.764,
  K: 0.988, L: 0.786, M: 1.178, N: 1.007, O: 1.008, P: 0.865, Q: 1.008, R: 0.943, S: 0.882, T: 0.877,
  U: 0.989, V: 0.938, W: 1.23, X: 0.961, Y: 0.966, Z: 0.877,
  "0": 0.811, "1": 0.731, "2": 0.809, "3": 0.813, "4": 0.819, "5": 0.813, "6": 0.815, "7": 0.748, "8": 0.828, "9": 0.815,
  " ": 0.29, ".": 0.381, ",": 0.381, ":": 0.371, ";": 0.381, "?": 0.743, "!": 0.391, "'": 0.324, "’": 0.324,
  "“": 0.607, "”": 0.607, '"': 0.598, "-": 0.416, "–": 0.625, "—": 1.25, "&": 1.065, "@": 1.24, "£": 0.799,
  "%": 1.166, "/": 0.309, "+": 0.75, "(": 0.389, ")": 0.389, "·": 0.418,
};

/** Tracking the wide face is set at, in em. */
export const WIDE_TRACKING = -0.01;

/** Set width of a line of wide display type, in px. */
export function wideWidth(text: string, size: number, tracking = WIDE_TRACKING) {
  const chars = [...text.toUpperCase()];
  const em = chars.reduce((sum, c) => sum + (ADVANCE[c] ?? 0.9), 0) + tracking * Math.max(0, chars.length - 1);
  return em * size;
}

/** The largest size, up to `max`, at which `text` fits in `width`. */
export function fitWide(text: string, width: number, max: number) {
  return Math.min(max, width / (wideWidth(text, 1) || 1));
}

/** Archivo Expanded Black, uppercase — the kinetic cut's voice. */
export const wide = (size: number): CSSProperties => ({
  fontFamily: font.wide,
  fontWeight: 900,
  fontStretch: "125%",
  fontVariationSettings: "'wdth' 125, 'wght' 900",
  fontSize: size,
  lineHeight: 1,
  letterSpacing: `${WIDE_TRACKING}em`,
  textTransform: "uppercase",
  whiteSpace: "nowrap",
});

/** Small technical labels: Space Grotesk, as the site's measure rule uses. */
export const mono = (size: number, weight = 700): CSSProperties => ({
  fontFamily: font.display,
  fontWeight: weight,
  fontSize: size,
  lineHeight: 1,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
});
