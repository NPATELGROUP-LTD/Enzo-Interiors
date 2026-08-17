"use client";

// Lightweight GSAP-driven custom cursor: a fast-following dot and a slower
// lagging ring, positioned via gsap.quickTo (not React state) so a mousemove
// never triggers a re-render. Only mounts on pointer:fine + hover:hover
// devices with no reduced-motion preference — touch/mobile and
// prefers-reduced-motion users always keep the native cursor.
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

export function CustomCursor() {
  const isFinePointer = useMediaQuery("(hover: hover) and (pointer: fine)");
  const prefersReducedMotion = usePrefersReducedMotion();

  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  const active = isFinePointer && !prefersReducedMotion;

  useEffect(() => {
    if (!active) return;

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    document.body.classList.add("cursor-none");

    const setDotX = gsap.quickTo(dot, "x", { duration: 0.1, ease: "power3" });
    const setDotY = gsap.quickTo(dot, "y", { duration: 0.1, ease: "power3" });
    const setRingX = gsap.quickTo(ring, "x", { duration: 0.4, ease: "power3" });
    const setRingY = gsap.quickTo(ring, "y", { duration: 0.4, ease: "power3" });

    const onMouseMove = (e: MouseEvent) => {
      setDotX(e.clientX);
      setDotY(e.clientY);
      setRingX(e.clientX);
      setRingY(e.clientY);
    };

    const onMouseOver = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest?.("[data-cursor]");
      ring.dataset.hover = target ? "true" : "false";
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    document.addEventListener("mouseover", onMouseOver, { passive: true });

    return () => {
      document.body.classList.remove("cursor-none");
      window.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseover", onMouseOver);
    };
  }, [active]);

  if (!active) return null;

  return (
    <>
      <div
        ref={dotRef}
        className="pointer-events-none fixed left-0 top-0 z-[200] h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
        aria-hidden="true"
      />
      <div
        ref={ringRef}
        data-hover="false"
        className="pointer-events-none fixed left-0 top-0 z-[200] h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/50 transition-[width,height,opacity] duration-200 data-[hover=true]:h-12 data-[hover=true]:w-12 data-[hover=true]:border-primary"
        aria-hidden="true"
      />
    </>
  );
}
