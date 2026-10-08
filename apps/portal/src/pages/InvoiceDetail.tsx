import { ArrowLeft, Printer } from '@phosphor-icons/react';
import { Link, useParams } from 'react-router-dom';

import { Button, Card, ErrorState, LoadingState, StatusTag } from '@/components/ui';
import { useQuery } from '@/hooks/useApi';
import { date, money } from '@/lib/format';
import { invoiceLabel, invoiceTone } from '@/lib/status';
import type { Invoice } from '@/types/api';

/**
 * One invoice, laid out to print: Ctrl/⌘ P (or the button) hides the app
 * around it (theme.css @media print). View only; there is no payment here.
 */
export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: invoice, loading, error, refetch } = useQuery<Invoice>(
    id ? `/invoices/${encodeURIComponent(id)}` : null,
  );

  if (loading) return <LoadingState label="Loading your invoice…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!invoice) return <ErrorState message="Invoice not found." />;

  const items = invoice.items ?? [];

  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link to="/invoices" className="text-link inline-flex items-center gap-1.5">
          <ArrowLeft size={14} aria-hidden="true" />
          All invoices
        </Link>
        <Button variant="secondary" icon={<Printer size={16} aria-hidden="true" />} onClick={() => window.print()}>
          Print
        </Button>
      </div>

      <Card className="print-sheet mx-auto max-w-3xl p-5 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-ink-muted">Enzo Interiors</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">Invoice {invoice.number}</h1>
            <p className="mt-1 text-ink-muted">{invoice.client_name}</p>
          </div>
          <StatusTag tone={invoiceTone(invoice.status, invoice.is_overdue)}>
            {invoiceLabel(invoice.status, invoice.is_overdue)}
          </StatusTag>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          {[
            ['Issued', date(invoice.created_at)],
            ['Due', date(invoice.due_date)],
            ['Project', invoice.project_name ?? 'None'],
            ['Paid', invoice.paid_at ? date(invoice.paid_at) : 'Not yet'],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="label-eyebrow">{label}</dt>
              <dd className="mt-0.5 break-words font-medium text-ink">{value}</dd>
            </div>
          ))}
        </dl>

        {items.length > 0 ? (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[30rem] border-separate border-spacing-0 text-left">
              <thead>
                <tr>
                  <th scope="col" className="label-eyebrow border-b border-border py-2 pr-3">Description</th>
                  <th scope="col" className="label-eyebrow border-b border-border px-3 py-2 text-right">Qty</th>
                  <th scope="col" className="label-eyebrow border-b border-border px-3 py-2 text-right">Unit price</th>
                  <th scope="col" className="label-eyebrow border-b border-border py-2 pl-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2.5 pr-3 text-ink">{item.description}</td>
                    <td className="tabular px-3 py-2.5 text-right text-ink-muted">{item.quantity}</td>
                    <td className="tabular whitespace-nowrap px-3 py-2.5 text-right text-ink-muted">{money(item.unit_price)}</td>
                    <td className="tabular whitespace-nowrap py-2.5 pl-3 text-right text-ink">
                      {money(Math.round(item.quantity * item.unit_price * 100) / 100)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <dl className="ml-auto mt-6 max-w-xs space-y-1.5 border-t border-border pt-4">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Net</dt>
            <dd className="tabular text-ink">{money(invoice.net_amount)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">VAT at {invoice.vat_rate}%</dt>
            <dd className="tabular text-ink">{money(invoice.vat_amount)}</dd>
          </div>
          <div className="flex justify-between gap-4 pt-1.5 text-base font-bold">
            <dt className="text-ink">Total</dt>
            <dd className="tabular text-ink">{money(invoice.amount)}</dd>
          </div>
        </dl>

        <p className="mt-8 text-xs text-ink-muted">
          Pay Enzo Interiors directly, by bank transfer or by card in the studio. There is no online
          payment in this portal; once your payment reaches us this invoice shows as paid.
        </p>
      </Card>
    </>
  );
}
