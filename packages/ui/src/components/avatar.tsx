'use client';

import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cva } from 'class-variance-authority';

import { cn } from '../lib/utils';

const avatarSizeClass = {
  sm: 'size-7 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-12 text-base',
} as const;

type AvatarSize = keyof typeof avatarSizeClass;

/**
 * Client/staff identification image with initials fallback.
 *
 * Used by: apps/admin (assigned designer, client table rows), apps/portal
 * (message sender identity). Use `AvatarGroup` for a stack of assignees
 * (e.g. a Kanban card's assigned staff).
 * Variants: `size` (sm/md/lg).
 * A11y: `AvatarImage` needs a real `alt` (person's name); `AvatarFallback`
 * renders initials as text, not decorative — screen readers get the name
 * either way as long as `alt`/fallback content is meaningful.
 * Brief v6 deviations: none.
 */
function Avatar({
  className,
  size = 'md',
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & { size?: AvatarSize }) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn('relative flex shrink-0 overflow-hidden rounded-full', avatarSizeClass[size], className)}
      {...props}
    />
  );
}

function AvatarImage({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return <AvatarPrimitive.Image data-slot="avatar-image" className={cn('aspect-square size-full', className)} {...props} />;
}

function AvatarFallback({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn('bg-accent text-accent-foreground flex size-full items-center justify-center rounded-full font-semibold', className)}
      {...props}
    />
  );
}

const avatarGroupItemClass = cva('relative rounded-full ring-2 ring-card', {
  variants: {
    size: avatarSizeClass,
  },
});

export interface AvatarGroupProps extends React.ComponentProps<'div'> {
  /** Max avatars to show before collapsing the rest into a "+N" bubble. */
  max?: number;
  size?: AvatarSize;
}

/**
 * Overlapping stack of `Avatar`s with a "+N" overflow bubble.
 *
 * Used by: apps/admin (Kanban card assignees, multi-staff project rows).
 * Variants: `size` (sm/md/lg, applied to every avatar + the overflow
 * bubble); `max` (default 4).
 * A11y: wrap in a labelled region if the group's meaning isn't obvious
 * from context (e.g. `aria-label="Assigned staff"`).
 * Brief v6 deviations: none — this is a new composition, not ported.
 */
function AvatarGroup({ children, max = 4, size = 'md', className, ...props }: AvatarGroupProps) {
  const items = React.Children.toArray(children);
  const visible = items.slice(0, max);
  const overflow = items.length - visible.length;

  return (
    <div data-slot="avatar-group" className={cn('flex -space-x-2', className)} {...props}>
      {visible.map((child, i) => (
        <div key={i} className={cn(avatarGroupItemClass({ size }))}>
          {child}
        </div>
      ))}
      {overflow > 0 ? (
        <div
          className={cn(
            avatarGroupItemClass({ size }),
            'bg-muted text-muted-foreground flex items-center justify-center font-semibold',
          )}
        >
          +{overflow}
        </div>
      ) : null}
    </div>
  );
}

export { Avatar, AvatarImage, AvatarFallback, AvatarGroup };
