"use client";

// Site-wide smooth scroll via Lenis, wired into GSAP's ticker so
// ScrollTrigger instances elsewhere (like HeroSequence's pin+scrub) stay in
// sync with Lenis's eased scroll position. Lenis animates the real
// document scrollTop by default (no wrapper/content DOM restructuring, no
// CSS transform on an ancestor) — unlike GSAP's own ScrollSmoother, it
// doesn't create a new containing block for `position: fixed` descendants,
// so it can safely wrap the whole app (Navbar included) from the root
// layout without needing to carve out an exemption for it.
import { useEffect, type ReactNode } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

let registered = false;
let instance: Lenis | null = null;

/** The live Lenis instance, or null when smooth scroll is off (reduced motion). */
export const getLenis = () => instance;

export function SmoothScroll({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (!registered) {
      gsap.registerPlugin(ScrollTrigger);
      registered = true;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const lenis = new Lenis({
      // Slightly shorter glide than the default so the page settles sooner
      // after the wheel stops, and a wheel multiplier above 1 so each notch
      // covers more ground — together these are what stop the scroll-driven
      // hero from feeling like it needs endless scrolling, without making
      // the motion itself abrupt.
      duration: 1.05,
      smoothWheel: true,
      wheelMultiplier: 1.35,
      touchMultiplier: 1.8,
      // Anchor links glide instead of jumping, which matters here because
      // `scroll-behavior: smooth` is deliberately off in theme.css — Lenis and
      // the browser both animating scrollTop is exactly the fight that made
      // the page feel unsmooth.
      anchors: true,
      // Explicit rather than implicit: this instance is driven from the GSAP
      // ticker below, so Lenis must not also run its own rAF loop.
      autoRaf: false,
      // Touch stays native. `syncTouch` routes finger scrolling through Lenis
      // too, which on iOS costs the rubber-band and the momentum users expect
      // from the OS — a worse trade than the consistency it buys.
      syncTouch: false,
    });

    lenis.on("scroll", ScrollTrigger.update);
    instance = lenis;

    const update = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(update);
      instance = null;
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
