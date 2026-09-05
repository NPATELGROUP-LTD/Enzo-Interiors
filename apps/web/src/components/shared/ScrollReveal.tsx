"use client";

// Ported from Boilerplate:src/app/components/shared/ScrollReveal.tsx.
// Uses gsap ScrollTrigger — browser-only, must be a Client Component.
import { useRef, useEffect, type ReactNode } from "react";
import { revealOnScroll } from "@/hooks/useGSAP";

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export function ScrollReveal({
  children,
  className = "",
  delay = 0,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    // Through revealOnScroll rather than a `scrollTrigger` inside the
    // tween's vars: a tween-attached trigger measures synchronously inside
    // the commit that creates it, which is the shape that crashes a page
    // carrying other, still-unmeasured `once: true` reveals. See
    // hooks/useGSAP.ts.
    const timeline = revealOnScroll(
      ref.current,
      (tl) =>
        tl.fromTo(
          ref.current,
          { opacity: 0, y: 40 },
          { opacity: 1, y: 0, duration: 0.8, delay, ease: "power3.out" },
        ),
      { start: "top 90%" },
    );

    return () => {
      timeline.scrollTrigger?.kill();
      timeline.kill();
    };
  }, [delay]);

  return (
    <div ref={ref} className={className} style={{ opacity: 0 }}>
      {children}
    </div>
  );
}
