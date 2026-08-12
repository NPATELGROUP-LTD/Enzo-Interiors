import * as React from 'react';

import { cn } from '../lib/utils';

/**
 * Multi-line text input — notes, messages, descriptions.
 *
 * Used by: apps/admin (client notes, quote descriptions), apps/portal
 * (message composer), apps/web (contact form message field).
 * Variants: none; states: default, disabled, error (`aria-invalid`),
 * success (`success` prop — see `Input`'s doc comment for why).
 * A11y: same as `Input` — pair `aria-invalid` with a visible, referenced
 * error message.
 * Brief v6 deviations: none.
 */
function Textarea({
  className,
  success,
  ...props
}: React.ComponentProps<'textarea'> & {
  success?: boolean;
}) {
  return (
    <textarea
      data-slot="textarea"
      data-success={success || undefined}
      className={cn(
        'resize-none border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 aria-invalid:border-destructive data-[success=true]:border-success data-[success=true]:ring-success/20 flex field-sizing-content min-h-16 w-full rounded-md border bg-input-background px-3 py-2 text-sm transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
