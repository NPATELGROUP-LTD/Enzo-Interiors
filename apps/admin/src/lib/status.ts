import type { StatusTone } from '@/components/ui';
import type {
  BookingStatus,
  ClientStatus,
  InvoiceStatus,
  ProjectStage,
  SubmissionStatus,
} from '@/types/api';

/**
 * Status colour is reinforcement, never the only signal — every tag also
 * carries its written label, per the brief's accessibility rule. These maps
 * keep one status looking the same everywhere it appears.
 */

export const invoiceTone = (status: InvoiceStatus, isOverdue = false): StatusTone => {
  if (status === 'Paid') return 'success';
  if (status === 'Overdue' || isOverdue) return 'danger';
  if (status === 'Outstanding') return 'warning';
  if (status === 'Sent') return 'info';
  return 'neutral'; // Draft
};

export const bookingTone = (status: BookingStatus): StatusTone => {
  switch (status) {
    case 'Confirmed':
      return 'success';
    case 'Pending':
      return 'warning';
    default:
      return 'neutral'; // Cancelled
  }
};

export const projectTone = (stage: ProjectStage): StatusTone => {
  switch (stage) {
    case 'Completed':
      return 'success';
    // Approval sits with the client, so it reads as "awaiting a decision".
    case 'Approval':
      return 'warning';
    case 'Installation':
      return 'info';
    default:
      return 'neutral';
  }
};

export const clientTone = (status: ClientStatus): StatusTone =>
  status === 'Active' ? 'success' : 'neutral';

export const submissionTone = (status: SubmissionStatus): StatusTone => {
  switch (status) {
    case 'New':
      return 'warning';
    case 'Converted':
      return 'success';
    case 'Contacted':
      return 'info';
    default:
      return 'neutral'; // Archived
  }
};
