import { ArrowLeft, Printer } from '@phosphor-icons/react';
import { Link, useParams } from 'react-router-dom';

import { InvoicePreview, InvoicePrint, printWhenReady } from '@/components/invoice/InvoiceSheet';
import { Button, ErrorState, LoadingState, StatusTag } from '@/components/ui';
import { useQuery } from '@/hooks/useApi';
import { invoiceLabel, invoiceTone } from '@/lib/status';
import type { Invoice } from '@/types/api';

/**
 * One invoice as the A4 sheet the studio sends. Print (or Ctrl/⌘ P) prints
 * just that sheet, one page, on white (components/invoice/invoice-sheet.css).
 * View only; there is no payment here.
 */
export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: invoice, loading, error, refetch } = useQuery<Invoice>(
    id ? `/invoices/${encodeURIComponent(id)}` : null,
  );

  if (loading) return <LoadingState label="Loading your invoice…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!invoice) return <ErrorState message="Invoice not found." />;

  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/invoices" className="text-link inline-flex items-center gap-1.5">
            <ArrowLeft size={14} aria-hidden="true" />
            All invoices
          </Link>
          <StatusTag tone={invoiceTone(invoice.status, invoice.is_overdue)}>
            {invoiceLabel(invoice.status, invoice.is_overdue)}
          </StatusTag>
        </div>
        <Button variant="secondary" icon={<Printer size={16} aria-hidden="true" />} onClick={() => void printWhenReady()}>
          Print / Save as PDF
        </Button>
      </div>

      <div className="mx-auto max-w-[210mm]">
        <InvoicePreview invoice={invoice} />
      </div>

      <p className="no-print mx-auto mt-2 max-w-[210mm] text-xs text-ink-muted">
        Pay Enzo Interiors directly, by bank transfer or by card in the studio. There is no online
        payment in this portal; once your payment reaches us this invoice shows as paid.
      </p>

      <InvoicePrint invoices={[invoice]} />
    </>
  );
}
