import * as React from 'react';
import { Star } from 'lucide-react';

import { cn } from '../lib/utils';

export interface RatingStarsProps {
  value: number;
  max?: number;
  /** Omit (or set false) for interactive editing — pass `onChange` in that case. */
  readOnly?: boolean;
  onChange?: (value: number) => void;
  size?: 'sm' | 'md';
  className?: string;
  /** Accessible label for the rating as a whole, e.g. "4 out of 5 stars". Required when readOnly. */
  label?: string;
}

const starSize = { sm: 'size-4', md: 'size-5' } as const;

/**
 * Star rating — read-only display or interactive input.
 *
 * Used by: apps/admin (Content Manager — testimonials review/approval).
 * Variants: `size` (sm/md); `readOnly` (display) vs interactive (pass
 * `onChange`) — whole stars only, no half-star granularity (not needed by
 * any current Enzo flow).
 * A11y: read-only mode renders `role="img"` with an `aria-label` summarizing
 * the value (pass `label`, e.g. "4 out of 5 stars") rather than exposing
 * five separate meaningless star elements to assistive tech. Interactive
 * mode renders a `radiogroup` of buttons so it's keyboard-operable.
 * Brief v6 deviations: none — new composition, not ported. Not from
 * Watermelon UI directly (no confirmed rating component there); built
 * fresh against this library's existing token/interaction conventions.
 */
function RatingStars({ value, max = 5, readOnly = true, onChange, size = 'md', className, label }: RatingStarsProps) {
  const stars = Array.from({ length: max }, (_, i) => i + 1);

  if (readOnly) {
    return (
      <div data-slot="rating-stars" role="img" aria-label={label ?? `${value} out of ${max} stars`} className={cn('flex gap-0.5', className)}>
        {stars.map((star) => (
          <Star
            key={star}
            aria-hidden="true"
            className={cn(starSize[size], star <= value ? 'fill-warning text-warning' : 'fill-none text-border')}
          />
        ))}
      </div>
    );
  }

  return (
    <div data-slot="rating-stars" role="radiogroup" aria-label={label ?? 'Rating'} className={cn('flex gap-0.5', className)}>
      {stars.map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={star === value}
          aria-label={`${star} star${star === 1 ? '' : 's'}`}
          onClick={() => onChange?.(star)}
          className="outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Star className={cn(starSize[size], star <= value ? 'fill-warning text-warning' : 'fill-none text-border', 'transition-colors duration-[160ms]')} />
        </button>
      ))}
    </div>
  );
}

export { RatingStars };
