import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/utils';

/**
 * Brief v6 §Buttons and Links defines exactly three button variants —
 * primary, secondary, destructive — plus a separate text-link pattern
 * (see `Link` in link.tsx) that is explicitly NOT a button container.
 * "outline"/"ghost" shadcn defaults are intentionally omitted: the brief
 * doesn't define them, and it says to flag ambiguous cases rather than
 * invent new visual variants. Add one later if a real screen needs it.
 *
 * All variants: 8px corners (--radius-md), no pill shapes, 160ms transition,
 * 16px horizontal padding, Inter 600/14px, 44px minimum height by default
 * to meet the brief's touch-target rule.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-[color,background-color,border-color,box-shadow] duration-[160ms] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-ring focus-visible:ring-[3px] focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary-hover hover:shadow-sm',
        secondary:
          'bg-secondary text-secondary-foreground border border-secondary-hover hover:bg-secondary-hover hover:border-primary hover:shadow-sm',
        destructive:
          'bg-card text-destructive border border-destructive hover:bg-destructive-bg',
      },
      size: {
        default: 'h-11 px-4 py-2 has-[>svg]:px-3.5', // 44px — meets the brief's minimum touch target
        sm: 'h-9 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-13 rounded-md px-6 has-[>svg]:px-5',
        icon: 'size-11 rounded-md',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
