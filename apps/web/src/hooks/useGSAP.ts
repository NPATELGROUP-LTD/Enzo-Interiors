"use client";

// Small local stand-in for @gsap/react's useGSAP, so the landing sections
// get scoped setup/cleanup without adding another dependency.
//
// Every animation is registered through gsap.matchMedia(), which buys two
// things at once: reverting the media query tears down all tweens AND
// ScrollTriggers created inside it (no manual kill lists), and the
// reduced-motion preference becomes a live condition rather than a
// one-shot read — flipping the OS setting re-runs the callback and reverts
// the motion instead of leaving a half-animated page behind.
import { useEffect, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export type GsapConditions = Record<string, boolean>;

export type GsapSetup = (
  /** The ref'd element, already null-checked. */
  root: HTMLElement,
  /** True when the visitor asked for reduced motion — render the end state. */
  reduced: boolean,
  /** Results of any extra `queries` passed in options. */
  conditions: GsapConditions,
) => void | (() => void);

interface UseGSAPOptions {
  /**
   * Extra media queries to branch on, e.g. `{ desktop: "(min-width: 1024px)" }`.
   * Results arrive as booleans in the callback's third argument, and
   * crossing a breakpoint reverts and re-runs the setup automatically.
   */
  queries?: Record<string, string>;
  /** Re-run the setup when these change. Keep the length constant. */
  deps?: unknown[];
}

export function useGSAP(
  ref: RefObject<HTMLElement | null>,
  setup: GsapSetup,
  options: UseGSAPOptions = {},
) {
  const { queries, deps = [] } = options;
  // Serialised so a fresh object literal on every render doesn't retrigger
  // the effect — the queries themselves are static strings in practice.
  const queryKey = JSON.stringify(queries ?? {});

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const mm = gsap.matchMedia();
    const parsedQueries: Record<string, string> = JSON.parse(queryKey);

    mm.add(
      {
        // `always` is load-bearing, not decoration. gsap.matchMedia() only
        // invokes the callback when at least one of its conditions matches,
        // so a component whose only condition was the reduced-motion query
        // would never run its setup for the (vast majority of) visitors who
        // have not asked for reduced motion. A condition that is true
        // everywhere guarantees the callback fires, and the real queries
        // stay available as booleans.
        always: "(min-width: 0px)",
        reduced: "(prefers-reduced-motion: reduce)",
        ...parsedQueries,
      },
      (context) => {
        const conditions = (context.conditions ?? {}) as GsapConditions;
        const { reduced = false, always: _always, ...rest } = conditions;
        // A returned cleanup runs when matchMedia reverts (unmount or a
        // condition change), which is where listener teardown belongs.
        return setup(root, reduced, rest);
      },
      root,
    );

    return () => {
      mm.revert();
    };
    // `setup` is intentionally excluded: callers pass an inline closure that
    // is a new function every render, and re-running the whole matchMedia
    // setup on each render would thrash ScrollTrigger. `deps` is the
    // explicit opt-in for re-running.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, queryKey, ...deps]);
}
