'use client';

import * as React from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

/**
 * Toast notification host — mount once near the app root.
 *
 * Used by: apps/admin and apps/portal — one `<Toaster />` per app shell;
 * trigger toasts anywhere via `toast()` from `sonner`.
 * Variants: none (Sonner's own `ToasterProps` pass through, e.g.
 * `position`); states: managed by Sonner internally (entrance/exit,
 * stacking, swipe-to-dismiss).
 * A11y: Sonner's toasts are announced via an `aria-live` region internally
 * — no extra wiring needed.
 * Brief v6 deviations: none. Ported from the legacy boilerplate's
 * sonner.tsx, but decoupled from `next-themes` (a Next.js-oriented
 * package) since apps/admin and apps/portal are Vite SPAs, not Next.js —
 * pass `theme` explicitly from this package's `useDarkMode` hook instead.
 */
function Toaster({ theme = 'light', ...props }: ToasterProps) {
  return (
    <Sonner
      theme={theme}
      className="toaster group"
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
