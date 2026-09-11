"use client";

import { useId } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Spinning circular text badge with a static center icon — same motif as a
// "Shop now" / "Summer Sale" rotating stamp, reskinned in Enzo's palette.
// The ring text is auto-repeated to fill the circle's circumference
// (rather than a fixed string), so it never overlaps itself or leaves an
// awkward gap regardless of label length or badge size.
export function RotatingBadge({
  label,
  href,
  size = 116,
  className,
}: {
  label: string;
  href: string;
  size?: number;
  className?: string;
}) {
  const pathId = useId();
  // Text radius sits inside the icon inset (see inset-[18px] below) with
  // extra clearance so the ring never crowds the center circle.
  const r = size / 2 - 20;
  const fontSize = Math.max(7.5, Math.min(10.5, size * 0.082));
  const centerInset = Math.max(18, Math.round(size * 0.2));
  const unit = `${label}   •   `;
  // Rough average glyph advance at this tracking/weight — good enough to
  // estimate how many repeats comfortably tile the ring without measuring.
  const approxCharWidth = fontSize * 0.62;
  const circumference = 2 * Math.PI * r;
  const repeats = Math.max(2, Math.round(circumference / (unit.length * approxCharWidth)));
  const ringText = unit.repeat(repeats);

  return (
    <div className={cn("group/badge relative shrink-0", className)} style={{ height: size, width: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 h-full w-full animate-[spin_16s_linear_infinite] text-enzo-cream/75"
      >
        <defs>
          <path
            id={pathId}
            d={`M ${size / 2},${size / 2} m -${r},0 a ${r},${r} 0 1,1 ${r * 2},0 a ${r},${r} 0 1,1 -${r * 2},0`}
          />
        </defs>
        <text fill="currentColor" style={{ fontSize, letterSpacing: "0.15em" }}>
          <textPath href={`#${pathId}`} startOffset="0%">
            {ringText}
          </textPath>
        </text>
      </svg>
      <Link
        href={href}
        aria-label={label}
        className="absolute flex items-center justify-center overflow-hidden rounded-full bg-enzo-forest text-enzo-cream shadow-[0_10px_28px_rgba(16,46,45,0.5)] transition-colors duration-300 group-hover/badge:bg-enzo-sage group-hover/badge:text-enzo-forest"
        style={{ inset: centerInset }}
      >
        <ArrowUpRight className="h-4 w-4 -translate-x-3 translate-y-3 opacity-0 transition-all duration-300 ease-out group-hover/badge:translate-x-0 group-hover/badge:translate-y-0 group-hover/badge:opacity-100" />
        <ArrowUpRight className="absolute h-4 w-4 transition-all duration-300 ease-out group-hover/badge:translate-x-3 group-hover/badge:-translate-y-3 group-hover/badge:opacity-0" />
      </Link>
    </div>
  );
}
