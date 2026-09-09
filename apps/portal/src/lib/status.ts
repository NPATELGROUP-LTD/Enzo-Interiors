import type { StatusTone } from '@/components/ui';
import type { BookingStatus, InvoiceStatus, ProjectStage, QuoteStatus } from '@/types/api';

/**
 * Status colour is reinforcement, never the only signal — every tag also
 * carries its written label.
 *
 * The wording here is deliberately client-facing. Internal CRM language
 * ("Outstanding", "Expired") is softened where a client is the reader, because
 * the portal is a reassurance surface rather than an operations tool.
 */

export const invoiceTone = (status: InvoiceStatus, isOverdue = false): StatusTone => {
  if (status === 'Paid') return 'success';
  if (status === 'Overdue' || isOverdue) return 'danger';
  if (status === 'Outstanding') return 'warning';
  if (status === 'Sent') return 'info';
  return 'neutral';
};

/** What the client sees on an invoice row. */
export const invoiceLabel = (status: InvoiceStatus, isOverdue = false): string => {
  if (status === 'Paid') return 'Paid';
  if (status === 'Overdue' || isOverdue) return 'Overdue';
  if (status === 'Outstanding' || status === 'Sent') return 'Due';
  return 'Draft';
};

export const quoteTone = (status: QuoteStatus): StatusTone => {
  switch (status) {
    case 'Accepted':
      return 'success';
    case 'Sent':
      return 'warning'; // awaiting the client's decision
    case 'Expired':
      return 'neutral';
    default:
      return 'neutral';
  }
};

export const quoteLabel = (status: QuoteStatus): string => {
  switch (status) {
    case 'Sent':
      return 'Awaiting your decision';
    case 'Accepted':
      return 'Accepted';
    case 'Expired':
      return 'No longer valid';
    default:
      return 'Being prepared';
  }
};

export const projectTone = (stage: ProjectStage): StatusTone => {
  switch (stage) {
    case 'Completed':
      return 'success';
    case 'Approval':
      return 'warning'; // needs the client
    case 'Installation':
      return 'info';
    default:
      return 'neutral';
  }
};

export const bookingTone = (status: BookingStatus): StatusTone => {
  switch (status) {
    case 'Confirmed':
      return 'success';
    case 'Pending':
      return 'warning';
    default:
      return 'neutral';
  }
};
