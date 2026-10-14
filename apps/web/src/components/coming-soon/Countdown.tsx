"use client";

import { useEffect, useState } from "react";

interface Units {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
}

const RELOADED = "enzo-launch-reloaded";

/**
 * Days, hours, minutes and seconds to the launch, ticking once a second.
 *
 * The first render shows dashes on the server and in the browser alike, so
 * there is no hydration mismatch; the real numbers arrive on the first tick.
 * At zero it reloads once, by which time the API has told the site to drop its
 * cached "coming soon" pages.
 */
export function Countdown({
  launchAt,
  units,
  launchingLabel,
}: {
  launchAt: string;
  units: Units;
  launchingLabel: string;
}) {
  const target = Date.parse(launchAt);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const remaining = now === null ? null : Math.max(0, target - now);

  useEffect(() => {
    if (remaining !== 0) return;
    // Once per tab: if the cache has not caught up yet, a loop of reloads
    // would only make it worse. The label below says what is happening.
    try {
      if (sessionStorage.getItem(RELOADED) === launchAt) return;
      sessionStorage.setItem(RELOADED, launchAt);
    } catch {
      return;
    }
    const timer = window.setTimeout(() => window.location.reload(), 3000);
    return () => window.clearTimeout(timer);
  }, [remaining, launchAt]);

  if (remaining === 0) {
    return (
      <p role="status" className="font-title text-2xl tracking-[-0.02em] text-enzo-forest sm:text-3xl">
        {launchingLabel}
      </p>
    );
  }

  const seconds = remaining === null ? null : Math.floor(remaining / 1000);
  const cells: Array<[number | null, string]> = [
    [seconds === null ? null : Math.floor(seconds / 86400), units.days],
    [seconds === null ? null : Math.floor(seconds / 3600) % 24, units.hours],
    [seconds === null ? null : Math.floor(seconds / 60) % 60, units.minutes],
    [seconds === null ? null : seconds % 60, units.seconds],
  ];

  return (
    // Not a live region: announcing every second would drown a screen
    // reader. The launch date is stated in words beside this.
    <dl role="timer" className="grid grid-cols-4 gap-x-4">
      {cells.map(([value, label]) => (
        <div key={label} className="flex flex-col-reverse gap-2">
          <dt className="text-[10px] font-medium uppercase tracking-[0.2em] text-enzo-charcoal/70 sm:text-[11px]">{label}</dt>
          <dd className="font-title text-[clamp(2rem,min(4.2vw,8dvh),4.25rem)] font-normal leading-none tabular-nums tracking-[-0.04em] text-enzo-forest">
            {value === null ? "--" : String(value).padStart(2, "0")}
          </dd>
        </div>
      ))}
    </dl>
  );
}
