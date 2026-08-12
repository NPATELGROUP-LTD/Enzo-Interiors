import * as React from 'react';

import { cn } from '../lib/utils';

/**
 * Text input — forms across all three apps.
 *
 * Used by: apps/web (contact/booking forms), apps/admin (client/quote/
 * invoice forms, table filters), apps/portal (settings, messages).
 * Variants: none (single style); states: default, disabled (native),
 * error (native `aria-invalid`), success (`success` prop — no native HTML
 * equivalent to hook into, so it's explicit).
 * A11y: error state relies on `aria-invalid`, which is what screen readers
 * announce — always pair with a visible error message referenced via
 * `aria-describedby`, don't rely on colour alone.
 * Brief v6 deviations: none.
 */
function Input({
  className,
  type,
  success,
  ...props
}: React.ComponentProps<'input'> & {
  /** No native HTML equivalent to aria-invalid, so this is an explicit prop. Don't combine with aria-invalid. */
  success?: boolean;
}) {
  return (
    <input
      type={type}
      data-slot="input"
      data-success={success || undefined}
      className={cn(
        'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input flex h-11 w-full min-w-0 rounded-md border px-3 py-1 text-sm bg-input-background transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'aria-invalid:ring-destructive/20 aria-invalid:border-destructive',
        'data-[success=true]:border-success data-[success=true]:ring-success/20',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
