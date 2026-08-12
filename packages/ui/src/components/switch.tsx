'use client';

import * as React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';

import { cn } from '../lib/utils';

/**
 * Toggle switch — settings and preference flags.
 *
 * Used by: apps/admin (Settings, notification preferences), apps/portal
 * (Settings — notification preferences, dark mode).
 * Variants: none; states: checked/unchecked, disabled, error
 * (`aria-invalid`, for the rare case a switch is a required form field).
 * A11y: the thumb shape is a conventional round toggle — this is exempt
 * from the brief's "no pill buttons" rule, which targets CTA buttons, not
 * this widely-recognised toggle pattern.
 * Brief v6 deviations: none.
 */
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-switch-background focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 aria-invalid:outline aria-invalid:outline-destructive inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="bg-card pointer-events-none block size-4 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
