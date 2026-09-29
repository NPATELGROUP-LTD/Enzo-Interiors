"use client";

import { useEffect, useState } from "react";
import type { StudioHours } from "@/lib/content";
import { getStudioStatus, type StudioStatus } from "@/lib/studio-hours";

/**
 * "Open until 17:00" / "Opens Tuesday 10:00", live. Shows `fallback` until it
 * mounts, for the same hydration reason as ContactMasthead, then re-reads the
 * clock every minute so a page left open through closing time stays true.
 */
export function OpenStatus({ hours, fallback }: { hours: StudioHours; fallback: string }) {
  const [status, setStatus] = useState<StudioStatus | null>(null);

  useEffect(() => {
    const tick = () => setStatus(getStudioStatus(hours));
    tick();
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, [hours]);

  return (
    <span className="flex items-center gap-2.5 tabular-nums">
      {status ? (
        <span
          aria-hidden
          className={`size-2 rounded-full ${status.open ? "bg-enzo-sand shadow-[0_0_0_4px_rgb(212_201_181/0.18)]" : "border border-enzo-cream/50"}`}
        />
      ) : null}
      {status ? status.label : fallback}
    </span>
  );
}
