"use client";

// Floating glassmorphism text cards shown while a room's frame-scrub is
// paused on its last frame — replaces the single bottom caption card from
// the old hero-scenes/HeroCaption model with 2 cards scattered around the
// screen edges, reusing the same GLASS visual language as the Navbar's
// dock (border border-enzo-cream/15 bg-enzo-forest/60 backdrop-blur-2xl).
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { cn } from "@/lib/utils";
import type { GlassBlock, HeroRoom } from "./hero-rooms";

const GLASS =
  "border border-enzo-cream/15 bg-enzo-forest/60 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3)]";

const POSITION_CLASS: Record<GlassBlock["position"], string> = {
  "top-left": "left-6 top-[26%] md:left-10",
  "top-right": "right-6 top-[26%] md:right-10",
  "bottom-left": "left-6 bottom-[16%] md:left-10",
  "bottom-right": "right-6 bottom-[16%] md:right-10",
  "center-left": "left-6 top-1/2 -translate-y-1/2 md:left-10",
};

interface HeroGlassBlocksProps {
  room: HeroRoom | null;
  /** True while this room's sequence is paused on its last frame. */
  visible: boolean;
}

export function HeroGlassBlocks({ room, visible }: HeroGlassBlocksProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasEnteredRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const cards = container.querySelectorAll("[data-glass-card]");
    if (!cards.length) return;

    if (visible) {
      hasEnteredRef.current = true;
      gsap.fromTo(
        cards,
        { opacity: 0, y: 18, scale: 0.96 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.55,
          ease: "power3.out",
          stagger: 0.08,
          overwrite: true,
        },
      );
    } else if (hasEnteredRef.current) {
      gsap.to(cards, {
        opacity: 0,
        y: 12,
        scale: 0.97,
        duration: 0.35,
        ease: "power2.in",
        stagger: 0.05,
        overwrite: true,
      });
    }
  }, [visible, room?.id]);

  if (!room) return null;

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 z-[4]"
      aria-hidden={!visible}
    >
      {room.glassBlocks.map((block) => (
        <div
          key={`${room.id}-${block.heading}`}
          data-glass-card
          className={cn(
            "absolute w-[min(280px,72vw)] rounded-[18px] p-5 opacity-0",
            GLASS,
            POSITION_CLASS[block.position],
          )}
        >
          <span className="mb-2 block font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-enzo-sage">
            {block.eyebrow}
          </span>
          <h3 className="mb-1.5 font-serif text-[19px] font-semibold leading-[1.2] text-enzo-cream">
            {block.heading}
          </h3>
          <p className="text-[13px] leading-[1.5] text-enzo-cream/72">{block.body}</p>
        </div>
      ))}
    </div>
  );
}
