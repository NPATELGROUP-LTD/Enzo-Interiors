import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/utils';

/**
 * Status tag per Brief v6's dashboard card rules: "written labels only —
 * no dots or bullets". Render text content only; don't prefix with an icon
 * or dot to indicate status.
 */
const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-sm border px-2 py-0.5 text-xs font-bold uppercase tracking-[0.08em] w-fit whitespace-nowrap shrink-0 gap-1 overflow-hidden",
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
