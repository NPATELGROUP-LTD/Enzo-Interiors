import * as React from 'react';
import { AlertTriangle, Inbox, Loader2, type LucideIcon } from 'lucide-react';

import { cn } from '../lib/utils';

type EmptyStateVariant = 'empty' | 'error' | 'loading';

const defaultIcon: Record<EmptyStateVariant, LucideIcon> = {
  empty: Inbox,
  error: AlertTriangle,
  loading: Loader2,
};

export interface EmptyStateProps extends Omit<React.ComponentProps<'div'>, 'title'> {
  variant?: EmptyStateVariant;
  /** Defaults to a variant-appropriate lucide icon; pass `null` to omit the icon entirely. */
  icon?: LucideIcon | null;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Typically a `<Button>` — e.g. "Add client" (empty) or "Retry" (error). Not shown for `loading`. */
  action?: React.ReactNode;
}

/**
 * Placeholder content for a data region with nothing to show — required
 * composition inside `Table` (or any list view) for its loading/empty/error
 * states, which the brief mandates explicitly for every admin data table.
 *
 * Used by: apps/admin (every data table: Clients, Quotes, Invoices,
 * Bookings, Projects), apps/portal (My Projects/Quotes/Invoices/Documents
 * when a client has none yet).
 * Variants: empty (no data — pair with an action to create the first
 * record), error (fetch failed — pair with a Retry action), loading
 * (in-flight fetch — for a single fetch prefer `Skeleton` rows instead;
 * use this variant for a full-region loading replacement, e.g. after a
 * filter change that can't reuse the previous rows as skeletons).
 * A11y: `loading` sets `role="status"` and `aria-live="polite"` so screen
 * readers announce the state change; `error`'s icon uses `--destructive`,
 * not colour alone — always paired with the written title/description.
 * Brief v6 deviations: none — this composition is explicitly required by
 * the brief's table requirements, not a shadcn/Boilerplate-sourced pattern.
 */
function EmptyState({
  variant = 'empty',
  icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  const Icon = icon === null ? null : (icon ?? defaultIcon[variant]);

  return (
    <div
      data-slot="empty-state"
      role={variant === 'loading' ? 'status' : undefined}
      aria-live={variant === 'loading' ? 'polite' : undefined}
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center',
        className,
      )}
      {...props}
    >
      {Icon ? (
        <Icon
          className={cn(
            'size-8',
            variant === 'error' && 'text-destructive',
            variant === 'loading' && 'animate-spin text-muted-foreground',
            variant === 'empty' && 'text-muted-foreground',
          )}
          aria-hidden="true"
        />
      ) : null}
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description ? <p className="max-w-sm text-[13px] text-muted-foreground">{description}</p> : null}
      </div>
      {action && variant !== 'loading' ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

export { EmptyState };
