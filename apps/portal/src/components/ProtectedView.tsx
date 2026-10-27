import clsx from 'clsx';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { useAuth } from '@/lib/auth';

/** The text laid over a protected page, tiled: who is looking, and when. */
function watermark(text: string): string {
  const safe = text.replace(/[&<>"']/g, '');
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='340' height='200'>` +
    `<text x='24' y='120' transform='rotate(-24 170 100)' font-family='sans-serif' font-size='15' ` +
    `fill='rgba(0,0,0,0.16)' stroke='rgba(255,255,255,0.4)' stroke-width='0.5'>${safe}</text></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

/**
 * Wraps something the client may look at but not keep (a file or invoice an Admin has not allowed
 * them to download). Best effort, not DRM: it puts the client's name and today's date across the
 * page, blocks right-click, drag, copy and the Save / Print / View-source shortcuts, hides the
 * content while the tab is hidden or the window loses focus, and is left out of a printout (see
 * `.protected-view` in theme.css). A screenshot or a phone camera still works, and the UI says so.
 */
export function ProtectedView({ children, className }: { children: ReactNode; className?: string }) {
  const { user } = useAuth();
  const [covered, setCovered] = useState(false);
  const mark = useMemo(
    () => watermark(`${user?.name ?? 'Enzo client'} · ${new Date().toLocaleDateString('en-GB')}`),
    [user?.name],
  );

  useEffect(() => {
    // A PDF viewer inside the page takes focus from the window but not from the document.
    const check = () => setCovered(document.hidden || !document.hasFocus());
    const soon = () => void window.setTimeout(check, 60);
    const keys = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && ['s', 'p', 'u'].includes(event.key.toLowerCase())) event.preventDefault();
      if (event.key === 'PrintScreen') {
        setCovered(true);
        void navigator.clipboard?.writeText('').catch(() => undefined);
        window.setTimeout(check, 1500);
      }
    };
    check();
    window.addEventListener('blur', soon);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('keydown', keys);
    return () => {
      window.removeEventListener('blur', soon);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('keydown', keys);
    };
  }, []);

  const block = (event: { preventDefault: () => void }) => event.preventDefault();
  return (
    <div className={clsx('protected-view relative', className)} onContextMenu={block} onDragStart={block} onCopy={block} onCut={block}>
      <div className={covered ? 'invisible' : undefined}>{children}</div>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ backgroundImage: mark }} />
      {covered ? (
        <button
          type="button"
          onClick={() => window.focus()}
          className="absolute inset-0 flex items-center justify-center bg-surface p-6 text-center text-sm text-ink-muted"
        >
          Hidden while this window is not in focus. Click here to carry on.
        </button>
      ) : null}
    </div>
  );
}

/** One honest line to sit under anything wrapped in ProtectedView. */
export const VIEW_ONLY_NOTE =
  'View only: saving and printing are switched off here, though your device can still capture what is on screen. Ask the studio if you need a copy.';
