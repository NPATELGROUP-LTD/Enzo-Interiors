import { ArrowClockwise } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';

const READY = 45; // rubber-band px, about 90px of finger travel
const MAX = 110;

const installed = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

/** True when nothing under the finger can still scroll up, and no dialog is open. */
function atTop(target: EventTarget | null): boolean {
  if (window.scrollY > 0) return false;
  for (let el = target instanceof Element ? target : null; el; el = el.parentElement) {
    if (el.matches('[role="dialog"], [aria-modal="true"]')) return false;
    if (/auto|scroll/.test(getComputedStyle(el).overflowY) && el.scrollTop > 0) return false;
  }
  return true;
}

/**
 * An installed app has no browser chrome, so nothing reloads it. Drag down from the top to reload,
 * as a tab does (the page itself sets overscroll-behavior: none). Identical copy in admin and portal.
 */
export function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [reloading, setReloading] = useState(false);
  const from = useRef<number | null>(null);
  const latest = useRef(0);

  useEffect(() => {
    if (!installed()) return;
    const move = (y: number) => {
      latest.current = from.current === null ? 0 : Math.min(MAX, Math.max(0, (y - from.current) * 0.5));
      setPull(latest.current);
    };
    const onStart = (e: TouchEvent) => {
      from.current = e.touches.length === 1 && atTop(e.target) ? e.touches[0]!.clientY : null;
    };
    const onMove = (e: TouchEvent) => from.current !== null && move(e.touches[0]!.clientY);
    const onEnd = () => {
      const go = latest.current >= READY && from.current !== null;
      from.current = null;
      latest.current = 0;
      setPull(0);
      if (go) {
        setReloading(true);
        window.location.reload();
      }
    };
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  if (pull === 0 && !reloading) return null;
  const ready = reloading || pull >= READY;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed left-1/2 z-[100] flex size-10 items-center justify-center rounded-full border border-border bg-surface text-ink shadow-lg"
      style={{ top: 'calc(env(safe-area-inset-top) + 8px)', transform: `translate(-50%, ${reloading ? 24 : pull - 24}px)`, opacity: reloading ? 1 : Math.min(1, pull / 40) }}
    >
      <ArrowClockwise size={20} className={reloading ? 'animate-spin' : undefined} style={reloading ? undefined : { transform: `rotate(${pull * 3}deg)`, color: ready ? 'var(--ink)' : undefined }} />
    </div>
  );
}
