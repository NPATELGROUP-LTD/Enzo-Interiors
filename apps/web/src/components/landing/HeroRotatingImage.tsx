"use client";

import { useEffect, useState, type RefObject } from "react";
import { RotatingBadge } from "./RotatingBadge";
import { cn } from "@/lib/utils";

interface ShowcaseImage {
  src: string;
  alt: string;
  title?: string;
}

// The CTA's right-side visual: auto-cycles through a handful of finished
// room shots (crossfade), inside a card with an organic notch carved out
// of the bottom-left corner (radial-gradient mask — matches the reference
// layout's blobbed corner), with clickable progress dots underneath.
//
// `imageRef` is exposed so HeroSequence can still drive its scroll-scrubbed
// parallax transform (scale/translateX) directly on the image card, same
// as before this component existed.
export function HeroRotatingImage({
  images,
  intervalMs = 3200,
  className,
  imageRef,
  overlayBadge,
  aspect = "portrait",
  radius = 36,
  notchRadius = 72,
  notchFeather = 2,
}: {
  images: ShowcaseImage[];
  intervalMs?: number;
  className?: string;
  imageRef?: RefObject<HTMLDivElement | null>;
  overlayBadge?: { label: string; href: string; size?: number };
  aspect?: "portrait" | "landscape" | "square";
  radius?: number;
  notchRadius?: number;
  notchFeather?: number;
}) {
  const [active, setActive] = useState(0);
  const aspectClass = aspect === "landscape" ? "aspect-[4/3]" : aspect === "square" ? "aspect-square" : "aspect-[9/10]";

  useEffect(() => {
    if (images.length <= 1) return;
    const id = setInterval(() => setActive((i) => (i + 1) % images.length), intervalMs);
    return () => clearInterval(id);
  }, [images.length, intervalMs]);

  return (
    <div className={cn("w-full", className)}>
      <div
        ref={imageRef}
        className={cn("relative w-full overflow-hidden", aspectClass)}
        style={
          {
            borderRadius: radius,
            ...(notchRadius > 0 || notchFeather > 0
              ? {
                WebkitMaskImage: `radial-gradient(circle at 0 100%, transparent 0px, transparent ${notchRadius}px, black ${notchRadius + notchFeather}px)`,
                maskImage: `radial-gradient(circle at 0 100%, transparent 0px, transparent ${notchRadius}px, black ${notchRadius + notchFeather}px)`,
                }
              : {}),
          }
        }
      >
        {images.map((img, i) => (
          <img
            key={img.src}
            src={img.src}
            alt={img.alt}
            title={img.title ?? img.alt}
            className="absolute inset-0 h-full w-full object-cover transition-opacity ease-in-out"
            style={{ opacity: i === active ? 1 : 0, transitionDuration: "1200ms" }}
          />
        ))}

        {overlayBadge && (
          <div className="absolute bottom-5 left-5">
            <RotatingBadge label={overlayBadge.label} href={overlayBadge.href} size={overlayBadge.size ?? 108} />
          </div>
        )}
      </div>

    </div>
  );
}
