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

export function SmoothScroll({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (!registered) {
      gsap.registerPlugin(ScrollTrigger);
      registered = true;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const lenis = new Lenis({
      duration: 1.15,
      smoothWheel: true,
      touchMultiplier: 1.5,
    });

    lenis.on("scroll", ScrollTrigger.update);

    const update = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(update);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
