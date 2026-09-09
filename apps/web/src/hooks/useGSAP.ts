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
import { useLayoutEffect, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

type GsapConditions = Record<string, boolean>;

type GsapSetup = (
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

  useLayoutEffect(() => {
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

/**
 * Builds a timeline, then gives it a ScrollTrigger — in that order, always.
 *
 * A trigger passed into a tween or into `gsap.timeline({ scrollTrigger })`
 * measures synchronously at construction, while the timeline is still empty
 * and sibling triggers in the same commit are still un-measured. That is
 * what fires `once: true` reveals against a pre-image-load page height, and
 * what produces the "Cannot read properties of undefined (reading 'end')"
 * crash. Attach every ScrollTrigger to an already-populated timeline and
 * neither can happen — so `gsap.from(el, { scrollTrigger })` must not appear
 * in this codebase.
 *
 * @param trigger  The element whose position drives the reveal.
 * @param build    Populates the timeline. Runs before the trigger exists.
 */
export function revealOnScroll(
  trigger: Element,
  build: (timeline: gsap.core.Timeline) => void,
  options: { start?: string; once?: boolean } = {},
): gsap.core.Timeline {
  return scrollTimeline(build, {
    trigger,
    start: options.start ?? "top 82%",
    once: options.once ?? true,
  });
}

/**
 * The general form of `revealOnScroll`: any ScrollTrigger configuration —
 * scrubs, ranges, pins, callbacks — driving a timeline that is fully
 * populated before the trigger exists.
 *
 * Reach for this instead of passing `scrollTrigger` inside a tween's vars.
 * The two are equivalent in what they animate and *not* equivalent in when
 * they measure; see the note above for why that difference bites.
 */
export function scrollTimeline(
  build: (timeline: gsap.core.Timeline) => void,
  vars: ScrollTrigger.Vars,
): gsap.core.Timeline {
  const timeline = gsap.timeline({ paused: true });
  build(timeline);
  ScrollTrigger.create({ ...vars, animation: timeline });
  return timeline;
}

/**
 * The single most common shape in this codebase — "these elements animate in
 * from somewhere once they are scrolled to" — as one call, so the safe
 * pattern is also the shortest one to type.
 *
 * `targets` may be anything gsap accepts. `trigger` defaults to the first
 * target, matching what the hand-written `gsap.from(x, { scrollTrigger: {
 * trigger: x[0] }})` calls this replaced were doing.
 */
export function fromOnScroll(
  targets: gsap.TweenTarget,
  vars: gsap.TweenVars,
  options: { trigger?: Element | null; start?: string; once?: boolean } = {},
): gsap.core.Timeline | null {
  const list = gsap.utils.toArray<Element>(targets);
  const trigger = options.trigger ?? list[0];
  if (!trigger) return null;

  return revealOnScroll(trigger, (timeline) => timeline.from(targets, vars), {
    start: options.start,
    once: options.once,
  });
}

/**
 * A ScrollTrigger that only *watches* — `onUpdate`, `onEnter`, `onRefresh` —
 * with no animation of its own.
 *
 * The empty paused timeline is not decoration: it is what puts a watcher on
 * GSAP's deferred measurement path, same as every animated trigger above.
 * `ScrollTrigger.create({ trigger, onUpdate })` with nothing attached
 * measures synchronously and can trip the crash described on
 * `revealOnScroll`. The timeline stays empty and does nothing.
 */
export function observeScroll(vars: ScrollTrigger.Vars): ScrollTrigger {
  return ScrollTrigger.create({ ...vars, animation: gsap.timeline({ paused: true }) });
}
