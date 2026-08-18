"use client";

// A single launch experience for the whole site. It plays once per browser
// tab, waits for the cinematic hero when it is present, and can be replayed
// by a future auth flow with `window.dispatchEvent(new Event("enzo:launch"))`.
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const SESSION_KEY = "enzo:launch-seen";
const MINIMUM_DISPLAY_MS = 900;
const HERO_READY_FALLBACK_MS = 4500;
const REPLAY_DISPLAY_MS = 1150;

export function LaunchOverlay() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    let exitTimer: number | undefined;
    let fallbackTimer: number | undefined;
    let minimumTimer: number | undefined;
    let minimumElapsed = false;
    let waitingForHero = false;

    const dismiss = () => {
      if (exitTimer) return;
      setExiting(true);
      exitTimer = window.setTimeout(() => setVisible(false), 650);
    };

    const finishWhenReady = () => {
      if (waitingForHero && minimumElapsed) dismiss();
    };

    const start = ({ waitForHero }: { waitForHero: boolean }) => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(fallbackTimer);
      window.clearTimeout(minimumTimer);
      exitTimer = undefined;
      minimumElapsed = false;
      waitingForHero = waitForHero;
      setExiting(false);
      setVisible(true);

      minimumTimer = window.setTimeout(() => {
        minimumElapsed = true;
        finishWhenReady();
      }, MINIMUM_DISPLAY_MS);
      fallbackTimer = window.setTimeout(dismiss, waitForHero ? HERO_READY_FALLBACK_MS : REPLAY_DISPLAY_MS);
    };

    const onHeroReady = () => {
      waitingForHero = true;
      finishWhenReady();
    };
    const onReplay = () => start({ waitForHero: false });

    try {
      const isFirstVisitThisTab = window.sessionStorage.getItem(SESSION_KEY) !== "true";
      if (isFirstVisitThisTab) {
        window.sessionStorage.setItem(SESSION_KEY, "true");
        start({ waitForHero: pathname === "/" });
        if (document.documentElement.dataset.enzoHeroReady === "true") onHeroReady();
      } else {
        setVisible(false);
      }
    } catch {
      // Privacy modes can disable session storage. The animation remains a
      // safe, short-lived first-load experience in that case.
      start({ waitForHero: true });
    }

    window.addEventListener("enzo:hero-ready", onHeroReady);
    window.addEventListener("enzo:launch", onReplay);
    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(fallbackTimer);
      window.clearTimeout(minimumTimer);
      window.removeEventListener("enzo:hero-ready", onHeroReady);
      window.removeEventListener("enzo:launch", onReplay);
    };
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Preparing your Enzo Interiors experience"
      className="fixed inset-0 z-[200] grid place-items-center overflow-hidden bg-enzo-dark transition-opacity duration-650 ease-out"
      style={{ opacity: exiting ? 0 : 1, pointerEvents: exiting ? "none" : "auto" }}
    >
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_47%,rgba(61,99,71,0.4),transparent_47%),radial-gradient(ellipse_at_12%_100%,rgba(212,201,181,0.12),transparent_48%)]" />
      <div aria-hidden="true" className="absolute left-1/2 top-1/2 h-[min(74vw,620px)] w-[min(74vw,620px)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-enzo-cream/10" />
      <div aria-hidden="true" className="absolute left-1/2 top-1/2 h-[min(56vw,470px)] w-[min(56vw,470px)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-enzo-sage/20" />

      <div className="relative flex flex-col items-center px-6 text-center">
        <span className="mb-5 font-sans text-[10px] font-semibold uppercase tracking-[0.38em] text-enzo-sage sm:text-[11px]">Enzo Interiors</span>
        <div className="overflow-hidden">
          <p className="animate-[launch-wordmark_900ms_cubic-bezier(0.16,1,0.3,1)_both] motion-reduce:animate-none font-display text-[clamp(4rem,16vw,10rem)] font-semibold leading-[0.8] tracking-[-0.08em] text-enzo-cream">ENZO</p>
        </div>
        <div className="mt-8 flex items-center gap-3 text-enzo-cream/55">
          <span className="h-px w-9 bg-enzo-sage/80" />
          <span className="font-sans text-[10px] uppercase tracking-[0.28em]">Made for living</span>
          <span className="h-px w-9 bg-enzo-sage/80" />
        </div>
      </div>

      <span className="absolute bottom-10 h-1 w-1 rounded-full bg-enzo-sage shadow-[0_0_28px_9px_rgba(138,158,140,0.48)]" />
    </div>
  );
}
