"use client";

// Site-wide smooth scroll via GSAP's ScrollSmoother (bundled free with the
// `gsap` package — no extra dependency, and it's built specifically to
// keep existing ScrollTrigger instances (like HeroSequence's pin+scrub)
// working unmodified: ScrollSmoother sets up the scroller proxy under the
// hood, so `self.progress` / `self.scroll()` calls elsewhere in the app
// don't need to know it's there. Barba.js (page-transition tooling) isn't
// used here — it solves a different problem (route-to-route transitions),
// not in-page scroll smoothing.
import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import { ScrollTrigger } from "gsap/ScrollTrigger";

let registered = false;

export function SmoothScroll({ children }: { children: ReactNode }) {
  const smootherRef = useRef<ScrollSmoother | null>(null);

  useEffect(() => {
    if (!registered) {
      gsap.registerPlugin(ScrollSmoother, ScrollTrigger);
      registered = true;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    smootherRef.current = ScrollSmoother.create({
      wrapper: "#smooth-wrapper",
      content: "#smooth-content",
      smooth: 1.2,
      smoothTouch: false,
      normalizeScroll: true,
      ignoreMobileResize: true,
    });

    return () => {
      smootherRef.current?.kill();
      smootherRef.current = null;
    };
  }, []);

  return (
    <div id="smooth-wrapper">
      <div id="smooth-content">{children}</div>
    </div>
  );
}
