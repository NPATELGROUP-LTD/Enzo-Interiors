"use client";

// Editorial caption card anchored at the bottom of the Hero so it reads
// reliably against every frame. Content crossfades on scene change via
// GSAP; a progress-dot row keeps the reader oriented in the story.
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { cn } from "@/lib/utils";
import type { HeroScene } from "./hero-scenes";

interface HeroCaptionProps {
  scenes: HeroScene[];
  activeIndex: number;
  revealed: boolean;
}

export function HeroCaption({ scenes, activeIndex, revealed }: HeroCaptionProps) {
  const [renderedIndex, setRenderedIndex] = useState(activeIndex);
  const contentRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const hasEnteredRef = useRef(false);

  useEffect(() => {
    if (activeIndex === renderedIndex) return;
    const el = contentRef.current;
    if (!el) {
      setRenderedIndex(activeIndex);
      return;
    }
    const tl = gsap.timeline();
    tl.to(el, { opacity: 0, y: -6, duration: 0.26, ease: "power2.in" }).call(
      () => setRenderedIndex(activeIndex),
    );
    return () => {
      tl.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    gsap.fromTo(
      el,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" },
    );
  }, [renderedIndex]);

  useEffect(() => {
    if (!revealed || hasEnteredRef.current) return;
    const card = cardRef.current;
    if (!card) return;
    hasEnteredRef.current = true;
    gsap.fromTo(
      card,
      { opacity: 0, y: 24 },
      { opacity: 1, y: 0, duration: 0.7, delay: 0.15, ease: "power3.out" },
    );
  }, [revealed]);

  const scene = scenes[renderedIndex];
  if (!scene) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[3] flex items-end justify-start sm:justify-start">
      <div
        ref={cardRef}
        className={cn(
          "m-3 w-[calc(100vw-24px)] rounded-[18px] border border-black/[0.06] bg-card/[0.92] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45),0_2px_10px_rgba(0,0,0,0.08)] backdrop-blur-md backdrop-saturate-[1.1]",
          "sm:m-[0_clamp(16px,4vw,64px)_clamp(20px,6vh,56px)] sm:w-[min(460px,calc(100vw-32px))] sm:rounded-[20px]",
          "p-[clamp(16px,2vw,22px)_clamp(20px,3vw,30px)]",
        )}
        style={{ opacity: revealed ? undefined : 0 }}
      >
        <div ref={contentRef}>
          <div className="mb-2.5 flex items-center gap-2.5">
            <span className="font-sans text-[12px] font-semibold tracking-[0.04em] text-primary">
              {String(renderedIndex + 1).padStart(2, "0")}
            </span>
            <span className="h-px w-4 bg-primary/55" aria-hidden="true" />
            <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              {scene.label}
            </span>
          </div>
          <h2 className="mb-2 font-serif text-[clamp(20px,2.6vw,30px)] font-semibold leading-[1.15] tracking-[-0.01em] text-foreground">
            {scene.heading}
          </h2>
          <p className="max-w-[42ch] font-sans text-[clamp(13.5px,1.5vw,15.5px)] leading-[1.55] text-foreground/72">
            {scene.body}
          </p>
        </div>

        <div className="mt-[clamp(14px,2vw,20px)] flex gap-1.5" role="presentation">
          {scenes.map((s, i) => (
            <span
              key={`${s.label}-${i}`}
              className={cn(
                "relative h-[3px] flex-1 overflow-hidden rounded-full bg-muted",
                i < renderedIndex && "bg-primary/70",
              )}
            >
              {i === renderedIndex && (
                <span
                  className="absolute inset-0 origin-left bg-primary"
                  style={{ animation: "hero-dot-fill 2.6s ease forwards" }}
                />
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
