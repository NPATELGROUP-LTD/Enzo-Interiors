'use client';

import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';

import { cn } from '../lib/utils';

/**
 * Form field label.
 *
 * Used by: apps/admin and apps/portal — every labelled `Input`/`Textarea`/
 * `Select`/`Switch` field. apps/web forms too.
 * Variants: none; states: default, disabled (dims automatically when paired
 * with a `peer`-marked disabled control, or wrapped in a `group` with
 * `data-disabled`).
 * A11y: always pair with `htmlFor` pointing at the control's `id` — this is
 * what makes the field's accessible name correct and gives the label a
 * click target that focuses the control.
 * Brief v6 deviations: none.
 */
function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        'flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { Label };
