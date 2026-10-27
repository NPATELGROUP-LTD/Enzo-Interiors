import { ArrowLeft, Printer } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';

import { InvoiceDownloadButton } from '@/components/InvoiceDownload';
import { InvoicePreview, InvoicePrint, printWhenReady } from '@/components/invoice/InvoiceSheet';
import { ProtectedView, VIEW_ONLY_NOTE } from '@/components/ProtectedView';
import { Button, Card, ErrorState, LoadingState, StatusTag } from '@/components/ui';
import { useQuery } from '@/hooks/useApi';
import { date, money } from '@/lib/format';
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
  if (error || !invoice) {
    return (
      <>
        <ErrorState message={error ?? 'Invoice not found.'} onRetry={error ? refetch : undefined} />
        <p className="text-center">
          <Link to="/invoices" className="text-link">
            Back to invoices
          </Link>
        </p>
      </>
    );
  }

  const canSave = Boolean(invoice.client_can_download);

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
        {canSave ? (
          <div className="flex gap-2">
            <InvoiceDownloadButton invoice={invoice} />
            <Button variant="secondary" icon={<Printer size={16} aria-hidden="true" />} onClick={() => void printWhenReady()}>
              Print
            </Button>
          </div>
        ) : (
          <p className="max-w-md text-xs text-ink-muted">{VIEW_ONLY_NOTE}</p>
        )}
      </div>

      {/* The A4 sheet shrinks to unreadable text on a phone; Download and Print still give the sheet. */}
      <Protect on={!canSave}>
      <Card className="no-print sm:hidden">
        <p className="font-semibold text-ink">Invoice {invoice.number}</p>
        <p className="text-xs text-ink-muted">
          {invoice.project_name ?? invoice.job_name ?? ''} · due {date(invoice.due_date)}
        </p>
        <ul className="rows mt-3">
          {(invoice.items ?? []).map((item) => (
            <li key={item.id} className="flex justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 text-ink">
                {item.description}
                {item.quantity !== 1 ? <span className="text-ink-muted"> × {item.quantity}</span> : null}
              </span>
              {item.unit_price > 0 ? (
                <span className="tabular shrink-0 text-ink">{money(item.unit_price * item.quantity)}</span>
              ) : null}
            </li>
          ))}
        </ul>
        <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
          {invoice.discount > 0 ? (
            <>
              <dt className="text-ink-muted">Discount</dt>
              <dd className="tabular text-right text-ink">−{money(invoice.discount)}</dd>
            </>
          ) : null}
          <dt className="text-ink-muted">Net</dt>
          <dd className="tabular text-right text-ink">{money(invoice.net_amount)}</dd>
          <dt className="text-ink-muted">VAT</dt>
          <dd className="tabular text-right text-ink">{money(invoice.vat_amount)}</dd>
          <dt className="font-semibold text-ink">Total payable</dt>
          <dd className="tabular text-right font-semibold text-ink">{money(invoice.amount)}</dd>
        </dl>
      </Card>

      <div className="mx-auto hidden max-w-[210mm] sm:block">
        <InvoicePreview invoice={invoice} />
      </div>
      </Protect>

      <p className="no-print mx-auto mt-2 max-w-[210mm] text-xs text-ink-muted">
        Pay Enzo Interiors directly, by bank transfer or by card in the studio. There is no online
        payment in this portal; once your payment reaches us this invoice shows as paid.
      </p>

      {canSave ? <InvoicePrint invoices={[invoice]} /> : null}
    </>
  );
}

/** The invoice behind a watermark when the client may only view it. */
function Protect({ on, children }: { on: boolean; children: ReactNode }) {
  return on ? <ProtectedView>{children}</ProtectedView> : <>{children}</>;
}
