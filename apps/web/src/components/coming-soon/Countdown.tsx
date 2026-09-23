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
      <p role="status" className="font-display text-lg text-enzo-sand">
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
    <dl role="timer" className="grid grid-cols-4 gap-px overflow-hidden rounded-xl bg-enzo-cream/15">
      {cells.map(([value, label]) => (
        <div key={label} className="flex flex-col-reverse items-center gap-1 bg-enzo-forest px-2 py-4 sm:px-6 sm:py-6">
          <dt className="text-[11px] uppercase tracking-[0.18em] text-enzo-sage sm:text-xs">{label}</dt>
          <dd className="font-display text-4xl font-semibold tabular-nums leading-none text-enzo-cream sm:text-6xl">
            {value === null ? "--" : String(value).padStart(2, "0")}
          </dd>
        </div>
      ))}
    </dl>
  );
}
