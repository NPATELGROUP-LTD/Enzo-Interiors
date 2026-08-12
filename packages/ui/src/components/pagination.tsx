import * as React from 'react';
import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from 'lucide-react';

import { cn } from '../lib/utils';

/**
 * Compact page navigation — "Page X of Y" + prev/next only.
 *
 * Used by: apps/admin (Clients/Quotes/Invoices/Bookings tables), apps/web
 * (portfolio gallery), apps/portal (My Quotes/Invoices lists).
 * Variants: none; deliberately no numbered page-jump control — the brief's
 * admin tables are filter/search-driven, not deep-pagination-driven.
 * A11y: root has `role="navigation" aria-label="pagination"`; the active
 * page link gets `aria-current="page"`.
 * Brief v6 deviations: doesn't reuse `Button`'s variants (the ported
 * source used shadcn's "outline"/"ghost", which don't exist here) — this
 * component defines its own minimal, lighter-weight control styling
 * appropriate for a repeated row of controls rather than reusing CTA-
 * weight button variants.
 */
function Pagination({ className, ...props }: React.ComponentProps<'nav'>) {
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      data-slot="pagination"
      className={cn('mx-auto flex w-full justify-center', className)}
      {...props}
    />
  );
}

function PaginationContent({ className, ...props }: React.ComponentProps<'ul'>) {
  return <ul data-slot="pagination-content" className={cn('flex flex-row items-center gap-1', className)} {...props} />;
}

function PaginationItem({ ...props }: React.ComponentProps<'li'>) {
  return <li data-slot="pagination-item" {...props} />;
}

type PaginationLinkProps = {
  isActive?: boolean;
} & React.ComponentProps<'a'>;

function PaginationLink({ className, isActive, ...props }: PaginationLinkProps) {
  return (
    <a
      aria-current={isActive ? 'page' : undefined}
      data-slot="pagination-link"
      data-active={isActive}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-md text-sm font-medium outline-none transition-colors duration-[160ms] hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        isActive ? 'bg-accent text-accent-foreground' : 'text-foreground',
        className,
      )}
      {...props}
    />
  );
}

function PaginationPrevious({ className, ...props }: React.ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink
      aria-label="Go to previous page"
      className={cn('w-auto gap-1 px-2.5', className)}
      {...props}
    >
      <ChevronLeftIcon className="size-4" />
      <span className="hidden sm:block">Previous</span>
    </PaginationLink>
  );
}

function PaginationNext({ className, ...props }: React.ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink aria-label="Go to next page" className={cn('w-auto gap-1 px-2.5', className)} {...props}>
      <span className="hidden sm:block">Next</span>
      <ChevronRightIcon className="size-4" />
    </PaginationLink>
  );
}

function PaginationEllipsis({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span aria-hidden data-slot="pagination-ellipsis" className={cn('flex size-9 items-center justify-center', className)} {...props}>
      <MoreHorizontalIcon className="size-4" />
      <span className="sr-only">More pages</span>
    </span>
  );
}

export { Pagination, PaginationContent, PaginationLink, PaginationItem, PaginationPrevious, PaginationNext, PaginationEllipsis };
