// The kinetic cut's palette: Enzo's own colours doing the jobs the reference
// reel gives its blues and near-black. Ink is the deepest leaf of the
// site's Fitted Run, so outlines and hard shadows stay in the forest family.
import { color } from "../brand/tokens";

export const k = {
  ink: "#0B2320",
  forest: color.forest,
  sage: color.sage,
  /** Sage let down halfway to cream — the light ground. */
  sageLight: "#BEC7BB",
  cream: color.cream,
  white: color.white,
  sand: color.sand,
  /** The shadow gap of the run — the dark ground. */
  dark: "#0C1A17",
  /** Hard shadow on the dark ground, where ink would vanish. */
  darkShadow: "#3E5446",
} as const;

export type Ground = "sageLight" | "sage" | "cream" | "white" | "dark" | "forest";

export const groundColor: Record<Ground, string> = {
  sageLight: k.sageLight,
  sage: k.sage,
  cream: k.cream,
  white: k.white,
  dark: k.dark,
  forest: k.forest,
};

export const isDark = (g: Ground) => g === "dark" || g === "forest";
