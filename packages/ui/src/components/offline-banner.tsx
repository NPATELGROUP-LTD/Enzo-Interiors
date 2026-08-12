import * as React from 'react';

import { Alert, AlertDescription, AlertTitle } from './alert';

export interface OfflineBannerProps {
  status: 'offline' | 'reconnecting' | 'restored';
}

const statusCopy: Record<OfflineBannerProps['status'], { title: string; description: string }> = {
  offline: { title: "You're offline", description: 'Showing the last data we have. Changes will sync once you reconnect.' },
  reconnecting: { title: 'Reconnecting…', description: 'Attempting to restore your connection.' },
  restored: { title: 'Back online', description: 'Your data is up to date.' },
};

/**
 * Fixed-position PWA offline/reconnecting indicator.
 *
 * Used by: apps/admin and apps/portal ONLY (PWA-specific — apps/web is
 * never offline-first). Mount once near the app shell root; the app owns
 * `navigator.onLine`/reconnection-detection logic and passes the resulting
 * `status` in.
 * Variants: `status` (offline/reconnecting/restored) — render `restored`
 * briefly then unmount it (the consumer's responsibility, e.g. via a
 * timeout), don't render anything when fully online with no prior outage.
 * A11y: wraps `Alert` with `variant="offline"` for offline/reconnecting so
 * screen readers get the same `role="alert"` announcement; `restored` uses
 * `variant="info"` (not alarming).
 * Brief v6 deviations: none — the brief requires the app shell to persist
 * with a "clear reconnection message" during offline states; this is that
 * message, not the shell-persistence behavior itself (that's a PWA
 * service-worker concern at the app level).
 */
function OfflineBanner({ status }: OfflineBannerProps) {
  const copy = statusCopy[status];

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex justify-center p-3">
      <Alert variant={status === 'restored' ? 'info' : 'offline'} style={{ maxWidth: 420 }}>
        <AlertTitle>{copy.title}</AlertTitle>
        <AlertDescription>{copy.description}</AlertDescription>
      </Alert>
    </div>
  );
}

export { OfflineBanner };
