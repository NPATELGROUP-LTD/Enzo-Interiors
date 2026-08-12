import * as React from 'react';

import { cn } from '../lib/utils';

/**
 * Pulsing placeholder shape for in-flight content.
 *
 * Used by: apps/admin (Table loading rows, dashboard cards), apps/portal
 * (project cards, message list) — anywhere content is being fetched and
 * the layout shape is already known. For a full-region loading state where
 * there's no known shape yet, use `EmptyState variant="loading"` instead.
 * Variants: none — size via `className`/inline `style` to match the real
 * content's dimensions (prevents layout shift when it resolves).
 * A11y: purely decorative — doesn't need `aria-hidden` itself, but the
 * region containing it should announce the loading state once (e.g. via
 * `EmptyState`'s `role="status"`, not on every individual skeleton).
 * Brief v6 deviations: none.
 */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="skeleton" className={cn('bg-accent animate-pulse rounded-md', className)} {...props} />;
}

export { Skeleton };
