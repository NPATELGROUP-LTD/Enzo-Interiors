'use client';

import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/utils';

const progressIndicatorVariants = cva('h-full w-full flex-1 transition-all', {
  variants: {
    variant: {
      default: 'bg-primary',
      success: 'bg-success',
      warning: 'bg-warning',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

/**
 * Linear progress bar.
 *
 * Used by: apps/portal (project progress %), apps/admin (quote/invoice
 * lifecycle status when shown as a bar rather than a `Badge`).
 * Variants: `variant` (default/success/warning) — colours the indicator;
 * pick based on what the progress represents (e.g. warning for "nearing a
 * deadline").
 * A11y: Radix sets `role="progressbar"` with `aria-valuenow`/`aria-valuemax`
 * derived from `value`/`max`.
 * Brief v6 deviations: track uses `--muted` (a neutral "quiet background"
 * token) rather than the ported shadcn default's `bg-primary/20` opacity
 * hack, for consistency with this library's discrete-token approach.
 */
function Progress({
  className,
  value,
  variant,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & VariantProps<typeof progressIndicatorVariants>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn('bg-muted relative h-2 w-full overflow-hidden rounded-full', className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(progressIndicatorVariants({ variant }))}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
