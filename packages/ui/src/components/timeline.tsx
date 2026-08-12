import * as React from 'react';
import { Check } from 'lucide-react';

import { cn } from '../lib/utils';

export interface TimelineItem {
  id: string | number;
  label: React.ReactNode;
  timestamp?: React.ReactNode;
  description?: React.ReactNode;
  status: 'complete' | 'current' | 'upcoming';
}

export interface TimelineProps extends Omit<React.ComponentProps<'ol'>, 'children'> {
  items: TimelineItem[];
}

const dotClass: Record<TimelineItem['status'], string> = {
  complete: 'bg-primary text-primary-foreground',
  current: 'bg-primary/20 text-primary ring-2 ring-primary',
  upcoming: 'bg-muted text-muted-foreground',
};

/**
 * Vertical event timeline.
 *
 * Used by: apps/portal (Project Detail timeline), apps/admin (Client Detail
 * activity log).
 * Variants: none — each item's `status` (complete/current/upcoming) drives
 * its dot styling.
 * A11y: renders as an `<ol>` (chronological order is meaningful);
 * `aria-current="step"` marks the current item.
 * Brief v6 deviations: none — new composition, not ported.
 */
function Timeline({ items, className, ...props }: TimelineProps) {
  return (
    <ol data-slot="timeline" className={cn('flex flex-col', className)} {...props}>
      {items.map((item, index) => (
        <li key={item.id} className="relative flex gap-3 pb-8 last:pb-0">
          {index < items.length - 1 ? <span className="absolute left-[11px] top-6 h-full w-px bg-border" aria-hidden="true" /> : null}
          <span
            aria-current={item.status === 'current' ? 'step' : undefined}
            className={cn('relative flex size-6 shrink-0 items-center justify-center rounded-full text-xs', dotClass[item.status])}
          >
            {item.status === 'complete' ? <Check className="size-3.5" aria-hidden="true" /> : null}
          </span>
          <div className="flex flex-col gap-0.5 pt-0.5">
            <div className="flex items-baseline gap-2">
              <span className={cn('text-sm font-semibold', item.status === 'upcoming' && 'text-muted-foreground')}>{item.label}</span>
              {item.timestamp ? <span className="text-[13px] text-muted-foreground">{item.timestamp}</span> : null}
            </div>
            {item.description ? <p className="text-[13px] text-muted-foreground">{item.description}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export { Timeline };
