'use client';

import * as React from 'react';

import { cn } from '../lib/utils';

/**
 * Data table — the primary pattern for every admin list view.
 *
 * Used by: apps/admin (Clients, Quotes, Invoices, Bookings, Projects list
 * views), apps/portal (My Quotes, My Invoices — read-only).
 * Variants: none (structural primitive); states are a REQUIRED composition,
 * not a prop — the brief explicitly mandates loading/empty/error states
 * and a labelled mobile card view for every admin table:
 *   - loading: render `Skeleton` rows inside `TableBody` (same column
 *     count) while a fetch is in flight, OR swap the whole table for
 *     `<EmptyState variant="loading">` if rows can't be reused (e.g. after
 *     a filter change).
 *   - empty: swap `TableBody`'s content for `<EmptyState variant="empty">`
 *     with a create-first-record action.
 *   - error: swap for `<EmptyState variant="error">` with a Retry action.
 *   - mobile: this component only handles horizontal scroll
 *     (`overflow-x-auto` on its wrapper) — the brief requires a genuine
 *     "labelled card view" fallback below a breakpoint, which means the
 *     consuming screen renders a different, non-`Table` layout on mobile,
 *     not a CSS trick on this component. Plan for that at the screen level.
 * A11y: `TableHead` cells are the sort/column labels — keep them as `<th>`
 * (never repurpose `TableCell` for headers) so assistive tech gets correct
 * table semantics.
 * Brief v6 deviations: none.
 */
function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table data-slot="table" className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return <thead data-slot="table-header" className={cn('bg-muted [&_tr]:border-b', className)} {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return <tbody data-slot="table-body" className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn('bg-muted/50 border-t font-medium [&>tr]:last:border-b-0', className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      data-slot="table-row"
      className={cn('hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors', className)}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        'text-foreground h-10 px-2 text-left align-middle text-xs font-bold uppercase tracking-[0.08em] whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        'p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        className,
      )}
      {...props}
    />
  );
}

function TableCaption({ className, ...props }: React.ComponentProps<'caption'>) {
  return <caption data-slot="table-caption" className={cn('text-muted-foreground mt-4 text-sm', className)} {...props} />;
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
