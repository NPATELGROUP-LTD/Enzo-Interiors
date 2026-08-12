import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/utils';

/**
 * Status tag — table statuses (invoice/quote/booking), card bottom slots.
 *
 * Used by: apps/admin (Clients/Quotes/Invoices/Bookings tables), apps/portal
 * (My Quotes, My Invoices), `DashboardCard`/`StatWidget` bottom slots.
 * Variants: neutral (draft/default), success (paid/approved), warning
 * (pending/awaiting decision), danger (overdue/error).
 * A11y: colour is never the only signal — always pair with a written label
 * (never render this with icon-only or dot-only content).
 * Brief v6 deviations: none — sentence-case, 12px, 600 weight, 8px radius,
 * matching `.tag` in docs/Enzo_Interiors_UI_UX_Visual_Brief_v6.html exactly.
 * (Not the uppercase/700-weight/letter-spaced "eyebrow" style — that's a
 * different pattern, used for section/card eyebrow labels, e.g.
 * `DashboardCard`'s eyebrow slot.)
 */
const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-md border px-2 py-1 text-xs font-semibold w-fit whitespace-nowrap shrink-0 gap-1 overflow-hidden',
  {
    variants: {
      variant: {
        neutral: 'border-border bg-muted text-muted-foreground',
        success: 'border-transparent bg-success-bg text-success',
        warning: 'border-transparent bg-warning-bg text-warning',
        danger: 'border-transparent bg-destructive-bg text-destructive',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span';

  return (
    <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
