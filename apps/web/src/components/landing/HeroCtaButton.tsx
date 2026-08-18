"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Pill CTA with an embedded circular icon chip — label stays put, the
// circle swaps in a fresh arrow sliding in from the opposite corner the old
// one exits through, rather than a plain rotate. ArrowUpRight (not
// ArrowRight+rotate) means the resting state is already the 45°-up arrow.
export function HeroCtaButton({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-4 rounded-full bg-enzo-cream py-1.5 pl-6 pr-1.5 text-enzo-forest transition-transform duration-300 hover:scale-[1.02] active:scale-[0.98]",
        className,
      )}
    >
      <span className="font-sans text-[13px] font-semibold tracking-wide">{label}</span>
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-enzo-forest text-enzo-cream transition-colors duration-300 group-hover:bg-enzo-sage group-hover:text-enzo-forest">
        <ArrowUpRight className="h-4 w-4 transition-all duration-300 ease-out group-hover:translate-x-3 group-hover:-translate-y-3 group-hover:opacity-0" />
        <ArrowUpRight className="absolute h-4 w-4 -translate-x-3 translate-y-3 opacity-0 transition-all duration-300 ease-out group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100" />
      </span>
    </Link>
  );
}
