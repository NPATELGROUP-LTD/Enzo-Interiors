'use client';

import * as React from 'react';
import * as SeparatorPrimitive from '@radix-ui/react-separator';

import { cn } from '../lib/utils';

/**
 * Thin dividing line — horizontal or vertical.
 *
 * Used by: apps/admin and apps/portal — section dividers, between
 * `DropdownMenu`/`Command` groups (once ported), Accordion items.
 * Variants: `orientation` (horizontal/vertical); states: none.
 * A11y: `decorative` (default `true`) marks it `aria-hidden` and excludes
 * it from the accessibility tree — set `decorative={false}` only if the
 * separator carries real semantic meaning (rare; Radix then renders it
 * with `role="separator"`).
 * Brief v6 deviations: none — uses `--border`.
 */
function Separator({
  className,
  orientation = 'horizontal',
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator-root"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        'bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px',
        className,
      )}
      {...props}
    />
  );
}

export { Separator };
