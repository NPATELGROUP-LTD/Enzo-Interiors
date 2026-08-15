"use client";

// Reveals a grid/list of children on scroll using a single ScrollTrigger.batch()
// call instead of one ScrollTrigger per item — used by grid sections (Services,
// WhyEnzo, Instagram) where mounting N individual triggers for tiles that all
// enter the viewport together is wasted work compared to one batched call.
import { useEffect, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function useStaggerReveal(
  containerRef: RefObject<HTMLElement | null>,
  selector = ":scope > *",
) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const targets = container.querySelectorAll<HTMLElement>(selector);
    if (targets.length === 0) return;

    gsap.set(targets, { opacity: 0, y: 30 });

    const batches = ScrollTrigger.batch(targets, {
      start: "top 90%",
      once: true,
      onEnter: (els) =>
        gsap.to(els, {
          opacity: 1,
          y: 0,
          duration: 0.7,
          ease: "power3.out",
          stagger: 0.08,
        }),
    });

    return () => {
      batches.forEach((b) => b.kill());
    };
  }, [containerRef, selector]);
}
