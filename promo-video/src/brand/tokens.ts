// Enzo Interiors — brand tokens for the launch videos.
//
// Mirrored from the public website rather than imported from it, because
// every app in this repo is self-contained (see the root README). If the
// site's palette or motion changes, these are the lines to update:
//
//   colours   apps/web/src/styles/theme.css        (--enzo-* tokens)
//   the run   apps/web/src/components/shared/PageTransition.tsx
//   motion    apps/web/src/lib/motion.ts
import { Easing } from "remotion";

export const color = {
  cream: "#F2F0EB",
  white: "#FAFAF7",
  forest: "#102E2D",
  forestLight: "#31473A",
  sage: "#8A9E8C",
  sand: "#D4C9B5",
  charcoal: "#2C2C2C",
  dark: "#1E1E1C",
  footerDark: "#0F0F11",
  border: "#C4B8A8",
  mutedForeground: "#67675F",
} as const;

/**
 * The Fitted Run's five door panels — consecutive leaves of one veneer, so no
 * two neighbours match — and the shadow gap between them. Same values as the
 * site's page transition.
 */
export const RUN_PANELS = ["#0A2123", "#102E2D", "#0B2422", "#173331", "#0E2928"] as const;
export const RUN_GAP = "#0B1712";

/** The site's grounds. The dark one is HeroStatic's: forest with a sage glow. */
export const ground = {
  sheet: color.cream,
  forest:
    `radial-gradient(70% 45% at 15% 0%, rgba(138,158,140,0.2), transparent 60%),` +
    `radial-gradient(60% 40% at 100% 100%, rgba(212,201,181,0.1), transparent 60%),` +
    color.forest,
} as const;

export const FPS = 30;

/** Seconds → frames at the package frame rate. */
export const sec = (seconds: number) => Math.round(seconds * FPS);

/**
 * motion.ts's GSAP eases, as their exact Remotion equivalents. (GSAP's
 * powerN is a polynomial of degree N + 1: power2 is cubic, power3 quartic.)
 */
export const EASE = {
  /** power3.out — arrivals settling into place. */
  enter: Easing.out(Easing.poly(4)),
  /** power2.in — departures and state swaps. */
  exit: Easing.in(Easing.cubic),
  /** power2.out — the run's rail and plate. */
  settle: Easing.out(Easing.cubic),
  /** power3.inOut — the run's doors. */
  run: Easing.inOut(Easing.poly(4)),
  /** expo.out — masked headline lines and image plates. */
  editorial: Easing.out(Easing.exp),
  /** A gentle two-way ease for long camera moves. */
  drift: Easing.inOut(Easing.sin),
} as const;

export const DUR = {
  micro: sec(0.28),
  enter: sec(0.7),
  editorial: sec(1.05),
  exit: sec(0.35),
} as const;

/** Per-line delay on masked headlines (SectionIntro staggers lines 0.09s). */
export const LINE_STAGGER = 3;
