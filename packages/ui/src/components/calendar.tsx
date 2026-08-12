'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';

import { cn } from '../lib/utils';

/**
 * Date/date-range picker.
 *
 * Used by: apps/web (booking wizard step 2 — range or single date), apps/
 * admin (Bookings calendar filter, availability settings).
 * Variants: none — pass `mode="single"` or `mode="range"` (react-day-picker
 * passthrough); `disabled` marks unavailable days (booking availability).
 * A11y: react-day-picker provides grid/keyboard navigation and
 * `aria-selected` out of the box.
 * Brief v6 deviations: nav buttons and day cells define their own minimal
 * styling rather than reusing `Button`'s `buttonVariants` — the ported
 * source referenced shadcn's "outline"/"ghost" variants, which don't exist
 * in this library (see `button.tsx`'s doc comment); a calendar's dense
 * grid of small controls also doesn't want full CTA-weight buttons.
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col sm:flex-row gap-2',
        month: 'flex flex-col gap-4',
        caption: 'flex justify-center pt-1 relative items-center w-full',
        caption_label: 'text-sm font-medium',
        nav: 'flex items-center gap-1',
        nav_button:
          'inline-flex size-7 items-center justify-center rounded-md bg-transparent p-0 opacity-50 outline-none transition-opacity duration-[160ms] hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        nav_button_previous: 'absolute left-1',
        nav_button_next: 'absolute right-1',
        table: 'w-full border-collapse space-x-1',
        head_row: 'flex',
        head_cell: 'text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]',
        row: 'flex w-full mt-2',
        cell: cn(
          'relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent [&:has([aria-selected].day-range-end)]:rounded-r-md',
          props.mode === 'range'
            ? '[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md'
            : '[&:has([aria-selected])]:rounded-md',
        ),
        day: 'inline-flex size-8 items-center justify-center rounded-md p-0 font-normal outline-none transition-colors duration-[160ms] hover:bg-muted aria-selected:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        day_range_start: 'day-range-start aria-selected:bg-primary aria-selected:text-primary-foreground',
        day_range_end: 'day-range-end aria-selected:bg-primary aria-selected:text-primary-foreground',
        day_selected:
          'bg-primary text-primary-foreground hover:bg-primary-hover hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
        day_today: 'bg-accent text-accent-foreground',
        day_outside: 'day-outside text-muted-foreground aria-selected:text-muted-foreground',
        day_disabled: 'text-muted-foreground opacity-50',
        day_range_middle: 'aria-selected:bg-accent aria-selected:text-accent-foreground',
        day_hidden: 'invisible',
        ...classNames,
      }}
      components={{
        IconLeft: ({ className: iconClassName, ...iconProps }) => <ChevronLeft className={cn('size-4', iconClassName)} {...iconProps} />,
        IconRight: ({ className: iconClassName, ...iconProps }) => <ChevronRight className={cn('size-4', iconClassName)} {...iconProps} />,
      }}
      {...props}
    />
  );
}

export { Calendar };
