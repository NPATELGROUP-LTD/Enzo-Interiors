import * as React from 'react';

import { cn } from '../lib/utils';

/**
 * Text link — lightweight navigational/tertiary action, not a button.
 *
 * Used by: apps/admin (DashboardCard bottom slots, "View projects"/"Open
 * inbox"), apps/portal (same pattern), apps/web (secondary nav CTAs).
 * Variants: none; states: default, hover, focus, `disabled` (renders a
 * non-interactive `<span>`, not a disabled `<a>`).
 * A11y: focus uses a real `outline` (2px, offset 2px) which stays visible
 * alongside the underline — don't remove either.
 * Brief v6 deviations: none — lightweight and stable per §Text links /
 * tertiary actions: no background, box, shadow, or movement at any state.
 * Use `<Button variant="primary|secondary|destructive">` instead for
 * committing actions (booking, sending, saving, approving, deleting).
 */
function TextLink({
  className,
  disabled,
  ...props
}: React.ComponentProps<'a'> & { disabled?: boolean }) {
  if (disabled) {
    return (
      <span
        data-slot="text-link"
        aria-disabled="true"
        className={cn('text-muted-foreground cursor-not-allowed text-sm font-semibold', className)}
      >
        {props.children}
      </span>
    );
  }

  return (
    <a
      data-slot="text-link"
      className={cn(
        'text-primary underline decoration-1 underline-offset-[3px] text-sm font-semibold transition-colors duration-[160ms]',
        'hover:text-primary-hover hover:decoration-2',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        className,
      )}
      {...props}
    />
  );
}

export { TextLink };
