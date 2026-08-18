"use client";

// Chooses the full scroll-scrubbed sequence on desktop, or a static image on
// mobile / when the user prefers reduced motion — a genuine component swap
// (no canvas mount, no 97-frame preload) rather than a CSS-only reflow.
import { useEffect, useState } from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { HeroSequence } from "./HeroSequence";
import { HeroStatic } from "./HeroStatic";

export function Hero() {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const prefersReducedMotion = usePrefersReducedMotion();

  // useMediaQuery/usePrefersReducedMotion are deliberately SSR-safe by
  // defaulting to false until mounted (see useMediaQuery.ts's comment) —
  // but that means for one render, `isDesktop` reads false even on a
  // desktop viewport, which would flash the full HeroStatic (Navbar,
  // decorative frame, "Stop Dreaming" CTA content) before swapping to
  // HeroSequence a moment later. Gating on an actual client mount instead
  // shows a neutral placeholder (matching both variants' background) for
  // that one frame rather than the wrong variant's real content — no
  // hydration mismatch risk either, since server and first client render
  // both deterministically render the same placeholder.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="h-screen w-full bg-enzo-dark" />;
  }

  if (isDesktop && !prefersReducedMotion) {
    return <HeroSequence />;
  }
  return <HeroStatic />;
}
