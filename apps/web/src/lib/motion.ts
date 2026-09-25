// Shared motion tokens for the landing sections.
//
// Every scroll-driven section on the homepage reads its easing/duration
// from here so the whole page moves with one rhythm rather than each
// component inventing its own timing (see the `motion-consistency` /
// `duration-timing` UX rules). Values are GSAP-native strings/seconds so
// they drop straight into tween configs.

export const EASE = {
  /** Arrivals: elements settling into their final position. */
  enter: "power3.out",
  /** Departures + state swaps: shorter, snappier than an entrance. */
  exit: "power2.in",
  /** Two-way transitions (open/close, active row swaps). */
  swap: "power2.inOut",
  /** Long editorial reveals — masked lines, image plates. */
  editorial: "expo.out",
  /** Anything tied to a continuous rate: scrub, rotation, marquee. */
  linear: "none",
} as const;

export const DUR = {
  /** Hover/press feedback. */
  micro: 0.28,
  /** Standard element entrance. */
  enter: 0.7,
  /** Headline / image-plate reveals. */
  editorial: 1.05,
} as const;

/** Per-item delay for staggered grids and lists (30–50ms guidance). */
export const STAGGER = 0.06;

/**
 * The one scroll-start every section shares, so sections read as a single
 * page rhythm instead of each firing at a different depth.
 */
export const REVEAL_START = "top 82%";
