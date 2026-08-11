'use client';

import * as React from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

/**
 * Ported from the legacy boilerplate's sonner.tsx, but decoupled from
 * `next-themes` (a Next.js-oriented package) since apps/admin and
 * apps/portal are Vite SPAs, not Next.js. Pass `theme` explicitly from
 * this package's `useDarkMode` hook instead.
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
