"use client";

// Page transitions.
//
// ── The problem a transition actually solves here ──
// Every page of this site opens with a scroll-driven reveal that assumes it
// has just been arrived at: masked headlines slide up, plates wipe in, the
// service heroes switch on like a screen. Navigate between two of them with
// nothing in between and you get the *end* of one page and the *beginning* of
// another in the same frame — the old page's finished state is still painted
// when the new page's opening reveal starts, so two different animations
// overlap for a beat and neither reads.
//
// So the transition is a curtain, not a crossfade: a solid forest panel wipes
// down over the old page, the route changes underneath it, and it wipes off
// to reveal the new one already at the top. That gives every page's own
// entrance a clean stage, and it hides the scroll-position reset — which is
// the other thing that looks broken when it happens in the open.
//
// ── Why this is not a library ──
// The App Router has no exit animation for a route segment: by the time the
// pathname changes, the old tree is already gone. Rather than fight that with
// a frozen-router hack, the panel is driven by the pathname itself — it
// covers on mount of each new path and uncovers once that path has painted.
// The cover is therefore genuinely instantaneous from the reader's point of
// view (it plays over the new page, not between two pages), which is also why
// it can be short: 0.42s in, 0.55s out.
//
// ── Reduced motion, and not breaking navigation ──
// With `prefers-reduced-motion: reduce` the panel never renders at all: a
// full-screen wipe on every navigation is exactly the kind of motion that
// setting exists to refuse. The panel is `pointer-events-none` throughout and
// removed from the DOM between navigations, so it can never sit invisibly
// over the page swallowing clicks — the classic failure of this pattern.
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

export function PageTransition() {
  const pathname = usePathname();
  const reduced = usePrefersReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  // The first paint of the whole site is not a *transition* — the hero has
  // its own entrance and a curtain over it would be a second one.
  const firstRef = useRef(true);

  useEffect(() => {
    if (reduced) return;
    if (firstRef.current) {
      firstRef.current = false;
      return;
    }
    setPlaying(true);
  }, [pathname, reduced]);

  useEffect(() => {
    if (!playing) return;
    const panel = panelRef.current;
    if (!panel) return;

    const timeline = gsap.timeline({ onComplete: () => setPlaying(false) });
    timeline
      .fromTo(
        panel,
        { clipPath: "inset(0% 0% 100% 0%)" },
        { clipPath: "inset(0% 0% 0% 0%)", duration: 0.42, ease: "power3.inOut" },
      )
      // Held for a beat so the new page's own reveals have started behind it
      // rather than firing into an empty frame the moment it lifts.
      .to(panel, { clipPath: "inset(100% 0% 0% 0%)", duration: 0.55, ease: "power3.inOut" }, "+=0.08");

    return () => {
      timeline.kill();
    };
  }, [playing]);

  if (reduced || !playing) return null;

  return (
    <div
      ref={panelRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[150] bg-enzo-forest"
      style={{ clipPath: "inset(0% 0% 100% 0%)" }}
    >
      {/* The mark, so the curtain is the brand rather than a coloured block.
          Sits at the same left offset as the header's logo, so it reads as
          the page's own furniture arriving early. */}
      <span className="absolute bottom-10 left-[clamp(1.25rem,4.5vw,5.5rem)] font-display text-[10.5px] font-semibold uppercase tracking-[0.3em] text-enzo-sand">
        Enzo Interiors
      </span>
    </div>
  );
}
