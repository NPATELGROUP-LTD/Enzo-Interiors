"use client";

// Chooses the full scroll-scrubbed sequence on desktop, or a static image on
// mobile / when the user prefers reduced motion — a genuine component swap
// (no canvas mount, no 97-frame preload) rather than a CSS-only reflow.
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { HeroSequence } from "./HeroSequence";
import { HeroStatic } from "./HeroStatic";

export function Hero() {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const prefersReducedMotion = usePrefersReducedMotion();

  if (isDesktop && !prefersReducedMotion) {
    return <HeroSequence />;
  }
  return <HeroStatic />;
}
