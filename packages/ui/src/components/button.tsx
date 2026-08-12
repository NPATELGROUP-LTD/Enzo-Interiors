import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';

import { cn } from '../lib/utils';

/**
 * Primary action across all three consumer apps.
 *
 * Used by: apps/web (booking wizard, quote calculator CTAs), apps/admin
 * (every form/table action), apps/portal (quote accept/decline, approvals).
 * Variants: primary — one principal forward action per screen; secondary —
 * alternative/lower-emphasis action; destructive — delete/remove, only
 * after confirmation. Sizes: default (44px, meets touch-target minimum),
 * sm (dense admin tables/toolbars), lg, icon (44px square).
 * A11y: focus-visible uses a real `outline` (not a ring/box-shadow halo) to
 * match `TextLink`; `loading` sets `aria-busy` and disables interaction
 * while preserving the button's width (content stays in the DOM, just
 * hidden, so it doesn't reflow surrounding layout).
 * Brief v6 deviations: "outline"/"ghost" shadcn defaults are intentionally
 * omitted — the brief doesn't define them and says to flag ambiguous cases
 * rather than invent new visual variants. Add one later if a real screen
 * needs it.
 */
const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold [transition:background-color_160ms_ease,border-color_160ms_ease,color_160ms_ease,box-shadow_160ms_ease,transform_120ms_ease] active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary-hover hover:shadow-primary-hover',
        secondary:
          'bg-secondary text-secondary-foreground border border-secondary-border hover:bg-secondary-hover hover:border-primary hover:shadow-secondary-hover',
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
  loading = false,
  disabled,
  children,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Centers a spinner over the button and disables it without changing its width. Not supported with `asChild`. */
    loading?: boolean;
  }) {
  if (asChild) {
    return (
      <Slot
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {children}
      </Slot>
    );
  }

  return (
    <button
      data-slot="button"
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {loading && <Loader2 className="absolute size-4 animate-spin" aria-hidden="true" />}
      <span className={cn(loading && 'invisible')}>{children}</span>
    </button>
  );
}

export { Button, buttonVariants };
