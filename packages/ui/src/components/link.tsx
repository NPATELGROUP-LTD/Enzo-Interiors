import * as React from 'react';

import { cn } from '../lib/utils';

/**
 * Brief v6 §Text links / tertiary actions: lightweight and stable — never a
 * button container. No background, box, shadow or movement at any state.
 * Use for navigational/tertiary actions ("View projects", "Open inbox");
 * use <Button variant="primary|secondary|destructive"> for committing
 * actions (booking, sending, saving, approving, deleting).
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
