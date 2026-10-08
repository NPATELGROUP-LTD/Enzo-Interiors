import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import {
  Card,
  EmptyState,
  ErrorState,
  MetricCard,
  PageHeader,
  StatusTag,
  TableSkeleton,
  TableWrap,
  Td,
  Th,
} from '@/components/ui';
import { useQuery } from '@/hooks/useApi';
import { date, money } from '@/lib/format';
import { invoiceLabel, invoiceTone } from '@/lib/status';
import type { Invoice } from '@/types/api';

/**
 * Invoices — view and status only.
 *
 * There is deliberately NO payment control anywhere on this screen. The
 * platform has no payment gateway and never will (PRD 10, TRD 13); the client
 * pays Enzo directly and an Admin records it manually. The copy says so
 * plainly so nobody goes looking for a Pay button that does not exist.
 */
export function InvoicesPage() {
  const invoices = useQuery<Invoice[]>('/invoices');

  const totals = useMemo(() => {
    const rows = invoices.data ?? [];
    const sum = (list: Invoice[]) =>
      Math.round(list.reduce((total, invoice) => total + invoice.amount, 0) * 100) / 100;
    const unpaid = rows.filter((invoice) => invoice.status !== 'Paid');
    return {
      paid: sum(rows.filter((invoice) => invoice.status === 'Paid')),
      outstanding: sum(unpaid),
      nextDue: [...unpaid]
        .sort((a, b) => a.due_date.localeCompare(b.due_date))[0],
    };
  }, [invoices.data]);

  // The API never sends a client a Draft.
  const visible = invoices.data ?? [];

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Your invoices and their current status."
      />

      {invoices.error ? (
        <ErrorState message={invoices.error} onRetry={invoices.refetch} />
      ) : invoices.loading ? (
        <Card className="p-0">
          <TableSkeleton rows={5} columns={4} />
        </Card>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <MetricCard
              eyebrow="Paid"
              value={money(totals.paid)}
              accent="success"
              context="Payments received and recorded by Enzo."
            />
            <MetricCard
              eyebrow="Outstanding"
              value={money(totals.outstanding)}
              accent={totals.outstanding > 0 ? 'warning' : 'success'}
              context={
                totals.outstanding > 0
                  ? 'Payable directly to Enzo Interiors.'
                  : 'Nothing outstanding — thank you.'
              }
            />
            <MetricCard
              eyebrow="Next due"
              value={totals.nextDue ? date(totals.nextDue.due_date) : '—'}
              accent={totals.nextDue?.is_overdue ? 'danger' : 'primary'}
              context={
                totals.nextDue
                  ? `${totals.nextDue.number} · ${money(totals.nextDue.amount)}`
                  : 'No invoices are currently due.'
              }
            />
          </div>

          {visible.length === 0 ? (
            <Card className="p-0">
              <EmptyState
                title="No invoices yet"
                message="Invoices will appear here once your project is under way."
              />
            </Card>
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Invoice</Th>
                  <Th>Project</Th>
                  <Th>Issued</Th>
                  <Th>Due</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Amount</Th>
                </tr>
              </thead>
              <tbody>
                {visible.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-surface-muted/40">
                    <Td className="whitespace-nowrap font-medium">
                      <Link to={`/invoices/${invoice.id}`} className="text-link">
                        {invoice.number}
                      </Link>
                    </Td>
                    <Td className="text-ink-muted">{invoice.project_name ?? '—'}</Td>
                    <Td className="whitespace-nowrap text-ink-muted">{date(invoice.created_at)}</Td>
                    <Td className="whitespace-nowrap text-ink-muted">
                      {date(invoice.due_date)}
                      {invoice.is_overdue ? (
                        <span className="ml-1.5 text-xs text-danger">
                          {invoice.days_overdue}d late
                        </span>
                      ) : null}
                    </Td>
                    <Td>
                      <StatusTag tone={invoiceTone(invoice.status, invoice.is_overdue)}>
                        {invoiceLabel(invoice.status, invoice.is_overdue)}
                      </StatusTag>
                    </Td>
                    <Td className="tabular whitespace-nowrap text-right font-semibold text-ink">
                      {money(invoice.amount)}
                      <span className="block text-xs font-normal text-ink-muted">
                        incl. {money(invoice.vat_amount)} VAT
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}

          <Card className="mt-4">
            <p className="label-eyebrow">How to pay</p>
            <p className="mt-2 text-ink">
              Payment is arranged directly with Enzo Interiors — by bank transfer or card in the
              studio. There is no online payment in this portal.
            </p>
            <p className="mt-2 text-ink-muted">
              Once your payment reaches us we will mark the invoice as paid here, usually within a
              working day. If anything looks wrong, message the team and we will sort it out.
            </p>
          </Card>
        </>
      )}
    </>
  );
}
