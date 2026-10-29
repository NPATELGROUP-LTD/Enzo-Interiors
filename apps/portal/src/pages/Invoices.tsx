import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { InvoiceDownloadButton } from '@/components/InvoiceDownload';
import {
  buttonClass,
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
import { useSort } from '@/hooks/useSort';
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
  const navigate = useNavigate();

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
  const { rows: sortedVisible, header } = useSort(visible, {
    number: (invoice) => invoice.number,
    issued: (invoice) => invoice.created_at,
    due: (invoice) => invoice.due_date,
    status: (invoice) => invoice.status,
    amount: (invoice) => invoice.amount,
  });

  return (
    <>
      <PageHeader
        title="Invoices"
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
            <>
            <ul className="space-y-3 sm:hidden">
              {visible.map((invoice) => (
                <li
                  key={invoice.id}
                  // The whole card opens it; its own buttons keep their jobs.
                  onClick={(event) => {
                    if (!(event.target as HTMLElement).closest('a, button')) navigate(`/invoices/${invoice.id}`);
                  }}
                  className="cursor-pointer"
                >
                  <Card>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-ink">{invoice.number}</p>
                        <p className="truncate text-xs text-ink-muted">{invoice.project_name ?? invoice.job_name ?? ''}</p>
                      </div>
                      <StatusTag tone={invoiceTone(invoice.status, invoice.is_overdue)}>
                        {invoiceLabel(invoice.status, invoice.is_overdue)}
                      </StatusTag>
                    </div>
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <p className="text-xs text-ink-muted">
                        Due {date(invoice.due_date)}
                        {invoice.is_overdue ? <span className="text-danger"> · {invoice.days_overdue}d late</span> : null}
                      </p>
                      <p className="tabular text-lg font-semibold text-ink">{money(invoice.amount)}</p>
                    </div>
                    <div className="mt-3 flex gap-2 [&>*]:flex-1">
                      <Link to={`/invoices/${invoice.id}`} className={buttonClass('secondary')} aria-label={`View invoice ${invoice.number}`}>
                        View
                      </Link>
                      {invoice.client_can_download ? <InvoiceDownloadButton invoice={invoice} /> : null}
                    </div>
                  </Card>
                </li>
              ))}
            </ul>

            <div className="max-sm:hidden">
            <TableWrap>
              <thead>
                <tr>
                  <Th sort={header('number')}>Invoice</Th>
                  <Th className="max-sm:hidden">Project</Th>
                  <Th className="max-sm:hidden" sort={header('issued')}>Issued</Th>
                  <Th className="max-sm:hidden" sort={header('due')}>Due</Th>
                  <Th sort={header('status')}>Status</Th>
                  <Th className="text-right" sort={header('amount')}>Amount</Th>
                </tr>
              </thead>
              <tbody>
                {sortedVisible.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="cursor-pointer hover:bg-surface-muted/40"
                    // The number stays the link for keyboards; a click anywhere else on the row opens it too.
                    onClick={(event) => {
                      if (!(event.target as HTMLElement).closest('a, button')) navigate(`/invoices/${invoice.id}`);
                    }}
                  >
                    <Td className="whitespace-nowrap font-medium">
                      <Link to={`/invoices/${invoice.id}`} className="text-link">
                        {invoice.number}
                      </Link>
                    </Td>
                    <Td className="text-ink-muted max-sm:hidden">{invoice.project_name ?? '—'}</Td>
                    <Td className="whitespace-nowrap text-ink-muted max-sm:hidden">{date(invoice.created_at)}</Td>
                    <Td className="whitespace-nowrap text-ink-muted max-sm:hidden">
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
            </div>
            </>
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
