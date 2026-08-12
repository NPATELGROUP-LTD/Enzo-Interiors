import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { AlertTriangle, Info, WifiOff, XCircle, XIcon } from 'lucide-react';

import { cn } from '../lib/utils';

const alertVariants = cva(
  "relative w-full rounded-xl border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        info: 'bg-card text-foreground border-border',
        warning: 'bg-warning-bg text-warning border-transparent',
        danger: 'bg-destructive-bg text-destructive border-transparent',
        offline: 'bg-muted text-muted-foreground border-border',
      },
    },
    defaultVariants: {
      variant: 'info',
    },
  },
);

const variantIcon = {
  info: Info,
  warning: AlertTriangle,
  danger: XCircle,
  offline: WifiOff,
} as const;

export interface AlertProps
  extends React.ComponentProps<'div'>,
    VariantProps<typeof alertVariants> {
  /** Shows a close button and calls this when clicked. Omit for a persistent alert (e.g. the quote calculator's "indicative until consultation" disclaimer, which must always be visible). */
  onDismiss?: () => void;
}

/**
 * Inline banner for page-level or section-level messages.
 *
 * Used by: apps/web (quote calculator disclaimer — persistent, no
 * `onDismiss`), apps/admin/apps/portal (form error summaries, offline/
 * reconnecting state via `variant="offline"` — see also `OfflineBanner`,
 * which composes this for the fixed-position PWA case specifically).
 * Variants: info (neutral), warning, danger, offline.
 * A11y: renders `role="alert"` so assistive tech announces it when it
 * appears; the dismiss button (when present) has an `aria-label`.
 * Brief v6 deviations: none — colour is never the only signal, each
 * variant pairs its background/text tint with a matching icon.
 */
function Alert({ className, variant, onDismiss, children, ...props }: AlertProps) {
  const Icon = variantIcon[variant ?? 'info'];

  return (
    <div data-slot="alert" role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
      <Icon aria-hidden="true" />
      {children}
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="absolute right-3 top-3 text-current opacity-70 outline-none transition-opacity duration-[160ms] hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <XIcon className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-title"
      className={cn('col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight', className)}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-description"
      className={cn('col-start-2 grid justify-items-start gap-1 text-sm text-current/90 [&_p]:leading-relaxed', className)}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription };
