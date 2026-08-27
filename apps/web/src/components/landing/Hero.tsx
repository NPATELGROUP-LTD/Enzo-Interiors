"use client";

// Chooses the full scroll-scrubbed sequence on desktop, or a static hero on
// mobile / when the user prefers reduced motion — a genuine component swap
// (no canvas mount, no 144-frame preload) rather than a CSS-only reflow.
//
// The choice is made ONCE, on first client render, and then frozen for the
// life of the page. It used to be a live media query, which meant dragging a
// desktop window narrow tore down HeroSequence mid-session and mounted
// HeroStatic in its place. That is bad on its own — the hero you were reading
// vanishes — and it was also the source of the `removeChild` crash: GSAP's pin
// re-parents nodes, so React unmounting a component whose DOM has been moved
// underneath it throws. Freezing the decision means the swap simply never
// happens; a visitor who resizes gets the hero they started with, and the only
// way to change it is a reload, which is what a layout this heavy should cost.
//
// (HeroSequence separately pins an inner element rather than its <section>, so
// even a deliberate unmount is now safe. Belt and braces, because this bug
// only shows up on a resize nobody tests.)
import { useSyncExternalStore } from "react";
import { HeroSequence } from "./HeroSequence";
import { HeroStatic } from "./HeroStatic";

type HeroVariant = "sequence" | "static";

let decidedVariant: HeroVariant | null = null;

/** Memoised so getSnapshot is referentially stable for the whole session. */
function readVariant(): HeroVariant {
  if (decidedVariant) return decidedVariant;
  const desktop = window.matchMedia("(min-width: 768px)").matches;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  decidedVariant = desktop && !reduced ? "sequence" : "static";
  return decidedVariant;
}

/** Never notifies — the whole point is that this value cannot change. */
function subscribe() {
  return () => {};
}

export function Hero() {
  // Server and first client render both return null, so the markup matches and
  // a neutral placeholder paints for one frame rather than the wrong variant's
  // real content flashing before it is replaced.
  const variant = useSyncExternalStore<HeroVariant | null>(subscribe, readVariant, () => null);

  if (!variant) {
    return <div className="h-screen w-full bg-enzo-dark" />;
  }

  return variant === "sequence" ? <HeroSequence /> : <HeroStatic />;
}
