"use client";

// The room-size switch, shared by all four investment layouts.
//
// The pill travels between options rather than each option toggling its own
// background, so the control reads as one thing with a position instead of
// three things with states. Its position and width are measured off the
// real button boxes, which keeps it aligned at any label length — including
// after a font swap or a translation.
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ROOM_SIZE_LABELS, ROOM_SIZES, type RoomSize } from "@/lib/quote-estimate";
import { cn } from "@/lib/utils";

interface RoomSizeControlProps {
  value: RoomSize;
  onChange: (size: RoomSize) => void;
  tone?: "light" | "dark";
}

export function RoomSizeControl({
  value,
  onChange,
  tone = "light",
}: RoomSizeControlProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const dark = tone === "dark";

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const pill = root.querySelector<HTMLElement>("[data-pill]");
    const buttons = Array.from(root.querySelectorAll("button"));
    if (!pill || !buttons.length) return;

    const place = (immediate: boolean) => {
      const button = buttons[ROOM_SIZES.indexOf(value)];
      if (!button) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      gsap.to(pill, {
        x: button.offsetLeft,
        width: button.offsetWidth,
        duration: immediate || reduced ? 0 : 0.45,
        ease: "power3.out",
      });
    };

    place(true);
    const onResize = () => place(true);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [value]);

  return (
    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-6">
      <span
        id="room-size-label"
        className={cn(
          "font-display text-[10.5px] font-semibold uppercase tracking-[0.26em]",
          dark ? "text-enzo-sand" : "text-enzo-forest-light",
        )}
      >
        Room size
      </span>
      <div
        ref={rootRef}
        role="group"
        aria-labelledby="room-size-label"
        className={cn(
          "relative inline-flex rounded-full border p-1",
          dark ? "border-enzo-cream/20 bg-enzo-dark/40" : "border-border/70 bg-background",
        )}
      >
        <span
          aria-hidden="true"
          data-pill
          className={cn(
            "absolute inset-y-1 left-0 rounded-full",
            dark ? "bg-enzo-sand" : "bg-primary",
          )}
        />
        {ROOM_SIZES.map((size) => (
          <button
            key={size}
            type="button"
            onClick={() => onChange(size)}
            aria-pressed={value === size}
            className={cn(
              "relative z-10 rounded-full px-6 py-2 text-[13px] transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              dark
                ? value === size
                  ? "text-enzo-forest focus-visible:ring-enzo-sand focus-visible:ring-offset-enzo-dark"
                  : "text-enzo-cream/60 hover:text-enzo-cream focus-visible:ring-enzo-sand focus-visible:ring-offset-enzo-dark"
                : value === size
                  ? "text-primary-foreground focus-visible:ring-ring focus-visible:ring-offset-background"
                  : "text-muted-foreground hover:text-primary focus-visible:ring-ring focus-visible:ring-offset-background",
            )}
          >
            {ROOM_SIZE_LABELS[size]}
          </button>
        ))}
      </div>
    </div>
  );
}
