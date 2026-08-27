"use client";

// Chooses the full scroll-scrubbed frame sequence on large screens, or the
// purpose-built static hero on anything smaller — a genuine component swap (no
// canvas mount, no 144-frame preload) rather than a CSS-only reflow.
//
// The threshold is 1024px, not 768px: a tablet has neither the bandwidth
// budget for 432 frames nor the pointer for a scrubbed sequence, so it gets
// the static hero along with phones. Below that width the frame sequence never
// mounts at all.
//
// This tracks the media query live, so dragging a desktop window narrow really
// does swap to the mobile hero. That used to throw `removeChild`: GSAP's pin
// re-parented the hero's <section> into a `.pin-spacer`, so React was
// unmounting a node that had been moved out from under it. HeroSequence now
// pins an inner element instead, leaving the <section> exactly where React put
// it, which is what makes a live swap safe.
import { useSyncExternalStore } from "react";
import { HeroSequence } from "./HeroSequence";
import { HeroStatic } from "./HeroStatic";

type HeroVariant = "sequence" | "static";

const DESKTOP_QUERY = "(min-width: 1024px)";
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const desktop = window.matchMedia(DESKTOP_QUERY);
  const reduced = window.matchMedia(REDUCED_QUERY);
  desktop.addEventListener("change", onChange);
  reduced.addEventListener("change", onChange);
  return () => {
    desktop.removeEventListener("change", onChange);
    reduced.removeEventListener("change", onChange);
  };
}

/** Returns a primitive, so it is safe for React to call on every render. */
function readVariant(): HeroVariant {
  const desktop = window.matchMedia(DESKTOP_QUERY).matches;
  const reduced = window.matchMedia(REDUCED_QUERY).matches;
  return desktop && !reduced ? "sequence" : "static";
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
