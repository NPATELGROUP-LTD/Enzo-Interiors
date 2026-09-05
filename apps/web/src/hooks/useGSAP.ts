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
 * ── Trap 1: the trigger that measures an empty timeline ──
 * `gsap.timeline({ scrollTrigger: {...} })` evaluates the trigger *at
 * construction*, while the timeline is still empty. On an image-heavy page
 * that is a live trap: before the photographs load, every section collapses
 * and a section that will eventually sit 4,000px down is inside the viewport
 * at the moment its trigger is created. The trigger fires immediately, plays
 * a zero-length timeline, and `once: true` then disposes it — so when the
 * images land and the page grows to its real height, the tweens that were
 * appended afterwards never run and the section stays at `opacity: 0`
 * forever. It is exactly the failure the /portfolio close section had: a
 * blank cream screen where a call to action should be.
 *
 * ── Trap 2: the trigger that measures while other triggers are dying ──
 * The subtler reason to always route through here, and the cause of the
 * "Cannot read properties of undefined (reading 'end')" crash on the
 * service pages.
 *
 * ScrollTrigger defers the first refresh of a *timeline*-attached trigger by
 * a tick (it cannot measure a timeline that may still be being populated),
 * but refreshes a *tween*-attached one — i.e. anything written as
 * `gsap.from(el, { scrollTrigger: {...} })` — synchronously, inside the
 * constructor. So a single React commit that creates both ends up running
 * one trigger's `refresh()` while a dozen sibling triggers are still sitting
 * in the global `_triggers` array un-measured.
 *
 * That refresh walks every earlier trigger and force-refreshes any it finds
 * un-measured. Force-refreshing a `once: true` trigger that is already in
 * view makes it fire *and kill itself*, splicing itself out of `_triggers`
 * mid-walk. GSAP compensates for one removal per iteration; a page whose top
 * half is already on screen removes several at once, the walk runs off the
 * end of the shortened array, and it reads `.end` off `undefined`.
 *
 * Nothing about that is fixable from the outside — but it is entirely
 * avoidable: if *no* trigger measures during the commit that creates them,
 * no trigger is ever created mid-walk, every earlier trigger is already
 * measured by the time the next one refreshes, and the force-refresh branch
 * never runs. Which is to say: attach every ScrollTrigger to a timeline, and
 * the crash cannot happen. That is what these two helpers are for, and why
 * `gsap.from(..., { scrollTrigger })` should not appear in this codebase.
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
 * Runs `onVisible` once, the first time `element` has scrolled up past
 * `threshold` of the viewport height — and nothing after that.
 *
 * ── Why not a ScrollTrigger ──
 * This exists for the one job ScrollTrigger is genuinely bad at on this
 * site: revealing something whose position is not yet knowable when the
 * component mounts. A ScrollTrigger resolves `start: "top 82%"` into a pixel
 * offset once, against whatever height the document happens to have at
 * creation — and on these pages that is a document with no photographs
 * loaded, a hero stage that has not finished pinning, and a 425vh sticky
 * track that has not finished laying out. When the page then grows by
 * thousands of pixels, that cached offset describes a place the section is
 * no longer anywhere near: the trigger reads as already fired-and-passed,
 * never calls back, and the section stays at `opacity: 0` under its own
 * heading. That was landing §05 — quotes that appeared only on some loads.
 *
 * IntersectionObserver has no cached geometry to go stale. The browser
 * re-evaluates the intersection itself whenever the page reflows, so a
 * section that moves 4,000px down when the images land is simply observed
 * at its new position. It also delivers a first callback on observe, so an
 * element already in view on load reveals without waiting for a scroll — and
 * unlike a `gsap.ticker` poll it keeps working in a tab whose animation
 * frames are throttled.
 *
 * @returns a disconnect function, for the setup callback to return.
 */
export function revealWhenVisible(
  element: Element,
  onVisible: () => void,
  threshold = 0.82,
): () => void {
  let done = false;
  const observer = new IntersectionObserver(
    (entries) => {
      if (done || !entries.some((entry) => entry.isIntersecting)) return;
      done = true;
      observer.disconnect();
      onVisible();
    },
    // Pulling the bottom of the root box up by (1 - threshold) makes
    // "intersecting" mean "the top of this has crossed `threshold` of the
    // viewport" — the same reading line as ScrollTrigger's "top 82%",
    // recomputed by the browser instead of cached by us.
    { rootMargin: `0px 0px -${Math.round((1 - threshold) * 100)}% 0px` },
  );
  observer.observe(element);
  return () => observer.disconnect();
}

/**
 * A ScrollTrigger that only *watches* — `onUpdate`, `onEnter`, `onRefresh` —
 * with no animation of its own, created on the same deferred footing as
 * every animated trigger above.
 *
 * ── Why this is not just ScrollTrigger.create ──
 * ScrollTrigger measures a new trigger synchronously unless it has a
 * timeline attached, in which case it waits a tick (it cannot measure a
 * timeline that may still be being filled). A watcher has nothing to attach,
 * so `ScrollTrigger.create({ trigger, onUpdate })` measures immediately —
 * inside the same React commit that is still creating a dozen other
 * triggers — and its refresh then force-refreshes every un-measured trigger
 * ahead of it. Force-refreshing a `once: true` trigger that is already on
 * screen makes it fire and kill itself mid-walk; enough of those at once and
 * the walk runs off the end of the array it is iterating and reads `.end`
 * off `undefined`. That is the crash described at length above, and a bare
 * watcher is one of the two shapes that can start it.
 *
 * Handing it an empty paused timeline is not decoration: it is the switch
 * that puts this trigger on GSAP's own deferred path, so it measures a tick
 * later alongside all the others, in creation order, with nothing left
 * un-measured for it to force. The timeline stays empty and does nothing.
 */
export function observeScroll(vars: ScrollTrigger.Vars): ScrollTrigger {
  return ScrollTrigger.create({ ...vars, animation: gsap.timeline({ paused: true }) });
}
