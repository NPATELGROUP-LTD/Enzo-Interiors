"use client";

// A currency figure that counts to its new value instead of swapping.
//
// Shared by all four investment layouts: whichever presentation a page
// uses, changing the room size has to *look* like it did something. A
// number that silently replaces itself reads as a render glitch; one that
// travels reads as a recalculation.
//
// The tween writes textContent directly rather than driving React state, so
// a change costs one tween and no re-render. The element is server-rendered
// with its initial figure, so a real price is in the HTML before any JS
// runs.
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { GBP } from "@/lib/service-metrics";

export function RollingFigure({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (reduced) {
      shown.current = value;
      node.textContent = GBP.format(value);
      return;
    }

    const proxy = { value: shown.current };
    const tween = gsap.to(proxy, {
      value,
      duration: 0.55,
      ease: "power2.out",
      onUpdate: () => {
        node.textContent = GBP.format(Math.round(proxy.value));
      },
      onComplete: () => {
        shown.current = value;
      },
    });

    return () => {
      tween.kill();
      // Remember where the interrupted tween actually got to, so a rapid
      // second change counts on from there instead of jumping back.
      shown.current = proxy.value;
    };
  }, [value, reduced]);

  return <span ref={ref}>{GBP.format(value)}</span>;
}
