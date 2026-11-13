import { Check, Printer } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';

import { InvoiceDownloadButton } from '@/components/InvoiceDownload';
import { InvoicePreview, InvoicePrint, printWhenReady } from '@/components/invoice/InvoiceSheet';
import { ProtectedView, VIEW_ONLY_NOTE } from '@/components/ProtectedView';
import { Button, Card, ErrorState, LoadingState, PageHeader, StatusTag } from '@/components/ui';
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

  const stages = invoice?.stages ?? [];

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
      <PageHeader
        title={`Invoice ${invoice.number}`}
        description={invoice.project_name ?? invoice.job_name ?? undefined}
        actions={
          <>
            <StatusTag tone={invoiceTone(invoice.status, invoice.is_overdue)}>
              {invoiceLabel(invoice.status, invoice.is_overdue)}
            </StatusTag>
            {canSave ? (
              <>
                <InvoiceDownloadButton invoice={invoice} />
                <Button variant="secondary" icon={<Printer size={16} aria-hidden="true" />} onClick={() => void printWhenReady()}>
                  Print
                </Button>
              </>
            ) : null}
          </>
        }
      />
      {canSave ? null : <p className="no-print mb-3 text-xs text-ink-muted">{VIEW_ONLY_NOTE}</p>}

      {/* The A4 sheet shrinks to unreadable text on a phone; Download and Print still give the sheet. */}
      <Protect on={!canSave}>
      <Card className="no-print sm:hidden">
        <p className="text-xs text-ink-muted">Due {date(invoice.due_date)}</p>
        <ul className="rows mt-2">
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
        {stages.length > 0 ? (
          <>
            <p className="mt-4 text-xs font-semibold text-ink-muted">
              Payment stages · {stages.filter((stage) => stage.paid_at).length} of {stages.length} paid
            </p>
            <ul className="rows mt-1">
              {stages.map((stage) => (
                <li key={stage.id} className="flex justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 text-ink">
                    {stage.label}
                    {stage.mode === 'percent' ? <span className="text-ink-muted"> · {Number(stage.value)}%</span> : null}
                    <span className="flex items-center gap-1 text-xs text-ink-muted">
                      {stage.paid_at ? (
                        <>
                          <Check size={12} weight="bold" aria-hidden="true" /> Paid {date(stage.paid_at)}
                        </>
                      ) : (
                        (stage.due_note ?? 'Due')
                      )}
                    </span>
                  </span>
                  <span className="tabular shrink-0 text-ink">{money(stage.amount)}</span>
                </li>
              ))}
            </ul>
            {invoice.status !== 'Paid' && (invoice.paid_amount ?? 0) > 0 ? (
              <p className="mt-1 text-right text-sm text-ink-muted">
                Balance due <span className="tabular font-semibold text-ink">{money(invoice.balance_amount ?? 0)}</span>
              </p>
            ) : null}
          </>
        ) : null}
        {invoice.bank_details ? (
          <>
            <p className="mt-4 text-xs font-semibold text-ink-muted">Pay by bank transfer</p>
            <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-ink-muted">Account name</dt>
              <dd className="text-ink">{invoice.bank_details.account_name}</dd>
              <dt className="text-ink-muted">Bank</dt>
              <dd className="text-ink">{invoice.bank_details.bank_name}</dd>
              <dt className="text-ink-muted">Sort code</dt>
              <dd className="tabular text-ink">{invoice.bank_details.sort_code}</dd>
              <dt className="text-ink-muted">Account number</dt>
              <dd className="tabular text-ink">{invoice.bank_details.account_number}</dd>
              <dt className="text-ink-muted">Reference</dt>
              <dd className="text-ink">{invoice.number}</dd>
            </dl>
            {invoice.bank_details.reference_note ? (
              <p className="mt-1 text-xs text-ink-muted">{invoice.bank_details.reference_note}</p>
            ) : null}
          </>
        ) : null}
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
