import {
  ArrowLeft,
  ArrowUUpLeft,
  DownloadSimple,
  FilePdf,
  PaperPlaneRight,
  Plus,
  Printer,
  SealCheck,
  TextHOne,
  Trash,
  X,
} from '@phosphor-icons/react';
import clsx from 'clsx';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';

import { DEFAULT_ISSUER, InvoicePreview, InvoicePrint, printWhenReady } from '@/components/invoice/InvoiceSheet';
import { INVOICE_VIEWS } from '@/components/layout/AdminLayout';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FIELD_BASE,
  Input,
  LoadingState,
  Select,
  StatusTag,
  TableSkeleton,
  TableWrap,
  Tabs,
  Td,
  Textarea,
  Th,
  Toggle,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { useSort } from '@/hooks/useSort';
import { ApiError, api } from '@/lib/api';
import { date, money, moneyCompact } from '@/lib/format';
import { invoiceTone } from '@/lib/status';
import type { BankDetails, Client, Invoice, InvoiceIssuer, InvoiceItem, InvoiceStage, PaymentScheduleRow, Project } from '@/types/api';

type View = (typeof INVOICE_VIEWS)[number]['id'];

/** Sent includes the older "Outstanding" status. */
const isSent = (invoice: Invoice) => invoice.status === 'Sent' || invoice.status === 'Outstanding';
const isLate = (invoice: Invoice) => invoice.is_overdue || invoice.status === 'Overdue';

const VIEW_FILTER: Record<View, (invoice: Invoice) => boolean> = {
  all: () => true,
  draft: (invoice) => invoice.status === 'Draft',
  sent: isSent,
  overdue: isLate,
  paid: (invoice) => invoice.status === 'Paid',
};

/** GET /invoices/export takes at most this many ids per call. */
const EXPORT_CHUNK = 200;

/* ---------------------------------------------------------------------------
 * The form works in strings (so a half-typed price is allowed) and the sums
 * below are PREVIEW ONLY, in whole pennies. The API works the total out in
 * exact decimals and is the one that counts: the screen shows its figures
 * again as soon as the invoice is saved.
 * ------------------------------------------------------------------------- */

/** The editor's rows: a section heading, or a line under the heading above it. */
type Row =
  | { key: number; kind: 'heading'; text: string }
  | { key: number; kind: 'line'; description: string; detail: string; quantity: string; unit_price: string };
type LineRow = Extract<Row, { kind: 'line' }>;

interface ScheduleRow {
  key: number;
  label: string;
  amount: string;
  date: string;
}

let rowKey = 0;
const blankLine = (): LineRow => ({ key: ++rowKey, kind: 'line', description: '', detail: '', quantity: '1', unit_price: '' });
const blankHeading = (): Row => ({ key: ++rowKey, kind: 'heading', text: '' });

/** Stored lines -> editor rows: a heading wherever the section changes. */
function toRows(items: InvoiceItem[]): Row[] {
  const rows: Row[] = [];
  items.forEach((item, index) => {
    if (item.section && item.section !== items[index - 1]?.section) rows.push({ key: ++rowKey, kind: 'heading', text: item.section });
    rows.push({
      key: ++rowKey,
      kind: 'line',
      description: item.description,
      detail: item.detail ?? '',
      quantity: String(item.quantity),
      unit_price: item.unit_price > 0 ? String(item.unit_price) : '',
    });
  });
  return rows;
}

/** Editor rows -> lines as the API takes them: each line carries the heading above it. */
function toItems(rows: Row[]) {
  let section: string | null = null;
  const items: Array<Pick<InvoiceItem, 'section' | 'description' | 'detail' | 'quantity' | 'unit_price'>> = [];
  for (const row of rows) {
    if (row.kind === 'heading') section = row.text.trim() || null;
    else {
      items.push({
        section,
        description: row.description.trim(),
        detail: row.detail.trim() || null,
        quantity: Number(row.quantity),
        unit_price: Number(row.unit_price) || 0, // blank = a quantity-only row
      });
    }
  }
  return items;
}

const pennies = (value: number) => Math.round(value * 100) || 0;

function previewTotals(items: Array<{ quantity: number; unit_price: number }>, vatRate: number, discount: number) {
  const subtotal = items.reduce((total, item) => total + pennies(item.quantity * item.unit_price), 0);
  const net = subtotal - pennies(discount);
  const vat = Math.round((net * vatRate) / 100);
  return { subtotal: subtotal / 100, net: net / 100, vat: vat / 100, gross: (net + vat) / 100 };
}

/** One payment stage in the editor: a percentage of the total payable, or a fixed £ amount. */
interface StageRow {
  key: number;
  label: string;
  mode: 'percent' | 'fixed';
  value: string;
  due_note: string;
}

const MAX_STAGES = 6;
/** What a new invoice starts with; every stage can be changed or removed. */
const DEFAULT_STAGES: Array<Pick<StageRow, 'label' | 'value'>> = [
  { label: 'On start', value: '50' },
  { label: 'On installation', value: '40' },
  { label: 'On completion', value: '10' },
];
const defaultStageRows = (): StageRow[] =>
  DEFAULT_STAGES.map((stage) => ({ key: ++rowKey, mode: 'percent', due_note: '', ...stage }));
const stageRowsOf = (stages: InvoiceStage[]): StageRow[] =>
  stages.map((stage) => ({ key: ++rowKey, label: stage.label, mode: stage.mode, value: String(stage.value), due_note: stage.due_note ?? '' }));
const stagePayload = (rows: StageRow[]) =>
  rows.map((row) => ({ label: row.label.trim(), mode: row.mode, value: Number(row.value), due_note: row.due_note.trim() || null }));

/**
 * PREVIEW of the API's stage amounts: each to the penny, the last taking the
 * remainder. `balanced` mirrors the API's rule, so a mix that would leave money
 * unaccounted for is flagged before saving; the API is the one that counts.
 */
function previewStages(payable: number, rows: Array<{ mode: 'percent' | 'fixed'; value: number }>) {
  const total = pennies(payable);
  const exact = rows.map((row) => (row.mode === 'percent' ? (total * row.value) / 100 : pennies(row.value)));
  const amounts = exact.map((value) => Math.round(value));
  if (amounts.length > 0) amounts[amounts.length - 1] = total - amounts.slice(0, -1).reduce((sum, value) => sum + value, 0);
  const nominal = exact.reduce((sum, value) => sum + value, 0);
  const percentStages = rows.filter((row) => row.mode === 'percent').length;
  return {
    amounts: amounts.map((value) => value / 100),
    nominal: nominal / 100,
    balanced: Math.abs(nominal - total) <= 0.5 * percentStages + 1e-6,
  };
}

/** "1 of 3 stages paid", or null for an invoice that is paid in one go. */
const stageProgress = (invoice: Invoice): string | null => {
  const stages = invoice.stages ?? [];
  return stages.length > 0 ? `${stages.filter((stage) => stage.paid_at).length} of ${stages.length} stages paid` : null;
};

const inDays = (days: number) => {
  const day = new Date();
  day.setDate(day.getDate() + days);
  return day.toISOString().slice(0, 10);
};

/** A spreadsheet of the chosen rows. Text that a spreadsheet would run as a formula is defused. */
function downloadCsv(invoices: Invoice[]) {
  const cell = (value: string | number | null) => {
    let text = value === null ? '' : typeof value === 'number' ? value.toFixed(2) : value;
    if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const day = (iso: string | null) => (iso ? iso.slice(0, 10) : '');
  const header = ['Number', 'Client', 'Project', 'Job', 'Status', 'Issued', 'Due', 'Paid', 'Subtotal', 'Discount', 'Net', 'VAT rate %', 'VAT', 'Total', 'Paid so far', 'Balance', 'Stages'];
  const lines = invoices.map((invoice) =>
    [
      invoice.number,
      invoice.client_name,
      invoice.project_name ?? '',
      invoice.job_name ?? '',
      invoice.status,
      day(invoice.created_at),
      day(invoice.due_date),
      day(invoice.paid_at),
      invoice.subtotal_amount,
      invoice.discount,
      invoice.net_amount,
      invoice.vat_rate,
      invoice.vat_amount,
      invoice.amount,
      invoice.paid_amount ?? (invoice.status === 'Paid' ? invoice.amount : 0),
      invoice.balance_amount ?? (invoice.status === 'Paid' ? 0 : invoice.amount),
      (invoice.stages ?? [])
        .map((stage) => `${stage.label} ${stage.mode === 'percent' ? `${stage.value}% ` : ''}${stage.amount.toFixed(2)} (${stage.paid_at ? `paid ${day(stage.paid_at)}` : 'due'})`)
        .join('; '),
    ]
      .map(cell)
      .join(','),
  );
  const blob = new Blob(['﻿', [header.map(cell).join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

/**
 * Invoices. An invoice is lines of work at a net price, in sections, with an
 * optional £ discount before VAT; VAT and the total are worked out from them.
 * Lines, VAT and the discount change only while it is a Draft (once sent the
 * client may have it); the job details and payment schedule change any time.
 * It becomes Paid only when an Admin records it here — payment is taken
 * outside the platform and there is no payment gateway.
 *
 * `?view=` picks a list, `?new=1` opens a new invoice, `?open=<id>` opens one.
 */
export function InvoicesPage() {
  const toast = useToast();
  const invoices = useQuery<Invoice[]>('/invoices');
  const clients = useQuery<Client[]>('/clients');
  const projects = useQuery<Project[]>('/projects');

  const [params, setParams] = useSearchParams();
  const view: View = INVOICE_VIEWS.find(({ id }) => id === params.get('view'))?.id ?? 'all';
  const creating = params.get('new') === '1';
  const openId = params.get('open');
  const opened = openId ? (invoices.data ?? []).find((invoice) => invoice.id === openId) : undefined;
  /** Changes some of the address's parameters and keeps the rest (see Clients). */
  const update = (changes: Record<string, string | null>, replace = false) =>
    setParams(
      () => {
        const next = new URLSearchParams(window.location.search);
        for (const [key, value] of Object.entries(changes)) {
          if (value === null) next.delete(key);
          else next.set(key, value);
        }
        return next;
      },
      { replace },
    );

  const [markingPaid, setMarkingPaid] = useState<Invoice | null>(null);
  const [deleting, setDeleting] = useState<Invoice | null>(null);
  const [pending, setPending] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [exporting, setExporting] = useState(false);
  const [printJob, setPrintJob] = useState<Invoice[] | null>(null);

  const rows = useMemo(() => invoices.data ?? [], [invoices.data]);
  const visible = rows.filter(VIEW_FILTER[view]);
  const { rows: sortedVisible, header } = useSort(visible, {
    number: (invoice) => invoice.number,
    client: (invoice) => invoice.client_name,
    project: (invoice) => invoice.project_name,
    status: (invoice) => invoice.status,
    due: (invoice) => invoice.due_date,
    total: (invoice) => invoice.amount,
  });
  const counts = Object.fromEntries(INVOICE_VIEWS.map(({ id }) => [id, rows.filter(VIEW_FILTER[id]).length]));
  const issuer: InvoiceIssuer = rows[0]?.issuer ?? DEFAULT_ISSUER;
  // Same for the bank details: one block for every invoice, so any saved invoice carries it.
  const bank = rows.find((invoice) => invoice.bank_details)?.bank_details ?? null;
  const chosen = rows.filter((invoice) => selected.has(invoice.id));
  const allVisibleChosen = visible.length > 0 && visible.every((invoice) => selected.has(invoice.id));

  const totals = useMemo(() => {
    // Received and still owed, so an invoice part-paid in stages counts for each part.
    const sum = (list: Invoice[], pick: (invoice: Invoice) => number) =>
      list.reduce((total, invoice) => total + Math.round(pick(invoice) * 100), 0) / 100;
    const received = (invoice: Invoice) => invoice.paid_amount ?? (invoice.status === 'Paid' ? invoice.amount : 0);
    const owed = (invoice: Invoice) => invoice.balance_amount ?? invoice.amount;
    return {
      paid: sum(rows, received),
      outstanding: sum(rows.filter((invoice) => isSent(invoice) || invoice.status === 'Overdue'), owed),
      overdue: sum(rows.filter(isLate).filter((invoice) => invoice.status !== 'Paid'), owed),
      drafts: rows.filter(VIEW_FILTER.draft).length,
    };
  }, [rows]);

  // A bulk print: render every chosen invoice as its own A4 page, print, then let go.
  useEffect(() => {
    if (!printJob) return;
    const done = () => setPrintJob(null);
    window.addEventListener('afterprint', done, { once: true });
    void printWhenReady();
    return () => window.removeEventListener('afterprint', done);
  }, [printJob]);

  const toggle = (id: string, on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const toggleVisible = (on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      for (const invoice of visible) {
        if (on) next.add(invoice.id);
        else next.delete(invoice.id);
      }
      return next;
    });

  const exportPdf = async () => {
    const ids = chosen.map((invoice) => invoice.id);
    setExporting(true);
    try {
      const full: Invoice[] = [];
      for (let start = 0; start < ids.length; start += EXPORT_CHUNK) {
        const chunk = ids.slice(start, start + EXPORT_CHUNK).join(',');
        full.push(...(await api.get<Invoice[]>(`/invoices/export?ids=${encodeURIComponent(chunk)}`)));
      }
      setPrintJob(full);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not load those invoices.');
    } finally {
      setExporting(false);
    }
  };

  /** One call, one toast, one reload: every action on this screen goes through it. */
  const act = async (run: () => Promise<unknown>, done: string, failed: string) => {
    setPending(true);
    try {
      await run();
      toast.success(done);
      await invoices.refetch();
      return true;
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : failed);
      return false;
    } finally {
      setPending(false);
    }
  };

  const setStatus = (invoice: Invoice, status: 'Sent' | 'Draft') =>
    act(
      () => api.put(`/invoices/${invoice.id}`, { status }),
      status === 'Sent' ? `${invoice.number} marked as sent.` : `${invoice.number} is a draft again.`,
      'Could not update this invoice.',
    );

  const doMarkPaid = async () => {
    if (!markingPaid) return;
    if (await act(() => api.put(`/invoices/${markingPaid.id}/mark-paid`), `${markingPaid.number} marked as paid.`, 'Could not mark this invoice paid.')) {
      setMarkingPaid(null);
    }
  };

  const doDelete = async (password: string) => {
    if (!deleting) return;
    const body = deleting.status === 'Paid' ? { password } : undefined;
    if (await act(() => api.delete(`/invoices/${deleting.id}`, body), `${deleting.number} deleted.`, 'Could not delete this invoice.')) {
      toggle(deleting.id, false);
      if (openId === deleting.id) update({ open: null }, true);
      setDeleting(null);
    } else if (deleting.status !== 'Paid') setDeleting(null);
  };

  const openNew = () => update({ new: '1' });
  const editing = creating || openId !== null;

  let main;
  if (editing && !creating && !opened) {
    main = invoices.loading ? (
      <LoadingState label="Loading the invoice…" />
    ) : (
      <ErrorState message={invoices.error ?? 'That invoice no longer exists.'} onRetry={invoices.refetch} />
    );
  } else if (editing) {
    main = (
      <InvoiceEditor
        // A fresh form for each invoice, and for each time "new" is opened.
        key={opened?.id ?? 'new'}
        invoice={opened}
        clients={clients.data ?? []}
        projects={projects.data ?? []}
        issuer={issuer}
        bank={bank}
        busy={pending}
        onClose={() => update({ new: null, open: null })}
        onSaved={async (id) => {
          await invoices.refetch();
          if (creating) update({ new: null, open: id }, true);
        }}
        onStatus={setStatus}
        onMarkPaid={setMarkingPaid}
        onDelete={setDeleting}
      />
    );
  } else {
    main = (
      <>
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card accent="success" className="pl-4">
            <p className="label-eyebrow">Paid</p>
            <p className="tabular mt-1.5 text-2xl font-bold text-green-900">{moneyCompact(totals.paid)}</p>
          </Card>
          <Card accent="warning" className="pl-4">
            <p className="label-eyebrow">Outstanding</p>
            <p className="tabular mt-1.5 text-2xl font-bold text-green-900">{moneyCompact(totals.outstanding)}</p>
          </Card>
          <Card accent={totals.overdue > 0 ? 'danger' : 'none'} className="pl-4">
            <p className="label-eyebrow">Overdue</p>
            <p className="tabular mt-1.5 text-2xl font-bold text-green-900">{moneyCompact(totals.overdue)}</p>
          </Card>
          <Card className="pl-4">
            <p className="label-eyebrow">Drafts</p>
            <p className="tabular mt-1.5 text-2xl font-bold text-green-900">{totals.drafts}</p>
          </Card>
        </div>

        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <Tabs
            tabs={INVOICE_VIEWS.map(({ id, label }) => ({ id, label, count: invoices.data ? counts[id] : undefined }))}
            active={view}
            onChange={(id) => update({ view: id === 'all' ? null : id })}
          />
          <div className="mb-4">
            <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={openNew}>
              New invoice
            </Button>
          </div>
        </div>

        {chosen.length > 0 ? (
          <div
            role="region"
            aria-label="Selected invoices"
            className="mb-4 flex flex-wrap items-center gap-2 rounded-card border border-border bg-surface px-3 py-2 shadow-card"
          >
            <p className="mr-auto text-sm font-medium text-ink">
              {chosen.length} {chosen.length === 1 ? 'invoice' : 'invoices'} selected
            </p>
            <Button variant="secondary" icon={<FilePdf size={16} aria-hidden="true" />} loading={exporting} onClick={() => void exportPdf()}>
              Print / Save as PDF
            </Button>
            <Button variant="secondary" icon={<DownloadSimple size={16} aria-hidden="true" />} onClick={() => downloadCsv(chosen)}>
              Download CSV
            </Button>
            <Button variant="secondary" icon={<X size={16} aria-hidden="true" />} onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        ) : (
          <p className="mb-4 text-sm text-ink-muted">
            Payment is taken outside the platform. An invoice becomes Paid only when you record it. Tick invoices to export them.
          </p>
        )}

        {invoices.error ? (
          <ErrorState message={invoices.error} onRetry={invoices.refetch} />
        ) : invoices.loading ? (
          <TableSkeleton rows={6} columns={7} />
        ) : visible.length === 0 ? (
          <EmptyState
            title={rows.length ? 'No invoices here' : 'No invoices yet'}
            message={rows.length ? 'Try another list, or look under All invoices.' : 'Create an invoice for a client to get started.'}
            action={
              rows.length ? (
                <Button variant="secondary" onClick={() => update({ view: null })}>
                  Show all invoices
                </Button>
              ) : (
                <Button variant="primary" onClick={openNew}>
                  New invoice
                </Button>
              )
            }
          />
        ) : (
          <TableWrap className="max-sm:min-w-0">
            <thead>
              <tr>
                <Th className="w-10">
                  <input
                    type="checkbox"
                    checked={allVisibleChosen}
                    onChange={(event) => toggleVisible(event.target.checked)}
                    aria-label="Select every invoice in this list"
                    className="h-4 w-4 accent-green-900"
                  />
                </Th>
                <Th sort={header('number')}>Number</Th>
                <Th className="max-sm:hidden" sort={header('client')}>Client</Th>
                <Th className="max-sm:hidden" sort={header('project')}>Project</Th>
                <Th sort={header('status')}>Status</Th>
                <Th className="max-sm:hidden" sort={header('due')}>Due</Th>
                <Th className="text-right" sort={header('total')}>Total</Th>
                <Th className="text-right max-sm:hidden">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {sortedVisible.map((invoice) => (
                <tr
                  key={invoice.id}
                  // The whole row opens it; its own checkbox and buttons keep their jobs.
                  onClick={(event) => {
                    if (!(event.target as HTMLElement).closest('a, button, input, label')) update({ open: invoice.id });
                  }}
                  className={clsx('cursor-pointer hover:bg-surface-muted/40', selected.has(invoice.id) && 'bg-green-100/40')}
                >
                  <Td>
                    <input
                      type="checkbox"
                      checked={selected.has(invoice.id)}
                      onChange={(event) => toggle(invoice.id, event.target.checked)}
                      aria-label={`Select ${invoice.number}`}
                      className="h-4 w-4 accent-green-900"
                    />
                  </Td>
                  <Td className="whitespace-nowrap font-medium text-ink">
                    <button
                      type="button"
                      onClick={() => update({ open: invoice.id })}
                      className="-mx-1 min-h-11 rounded-control px-1 text-left font-medium text-ink underline-offset-2 hover:text-green-900 hover:underline pointer-fine:min-h-0"
                    >
                      {invoice.number}
                    </button>
                    <span className="block text-xs font-normal text-ink-muted sm:hidden">{invoice.client_name}</span>
                  </Td>
                  <Td className="text-ink max-sm:hidden">{invoice.client_name}</Td>
                  <Td className="text-ink-muted max-sm:hidden">{invoice.job_name ?? invoice.project_name ?? '—'}</Td>
                  <Td>
                    <StatusTag tone={invoiceTone(invoice.status, invoice.is_overdue)}>{invoice.status}</StatusTag>
                    {invoice.is_overdue && invoice.status !== 'Overdue' ? (
                      <span className="ml-1.5 text-xs text-danger">{invoice.days_overdue}d late</span>
                    ) : null}
                    {invoice.status !== 'Draft' && stageProgress(invoice) ? (
                      <span className="mt-0.5 block text-xs text-ink-muted">{stageProgress(invoice)}</span>
                    ) : null}
                  </Td>
                  <Td className="whitespace-nowrap text-ink-muted max-sm:hidden">{date(invoice.due_date)}</Td>
                  <Td className="tabular whitespace-nowrap text-right font-semibold text-ink">
                    {money(invoice.amount)}
                    {invoice.status !== 'Paid' && (invoice.paid_amount ?? 0) > 0 ? (
                      <span className="block text-xs font-normal text-ink-muted">{money(invoice.balance_amount ?? 0)} to pay</span>
                    ) : null}
                  </Td>
                  {/* Phones act from the opened invoice, which has the same buttons. */}
                  <Td className="max-sm:hidden">
                    <div className="flex justify-end gap-1">
                      {invoice.status === 'Draft' ? (
                        <button
                          type="button"
                          onClick={() => void setStatus(invoice, 'Sent')}
                          aria-label={`Mark ${invoice.number} as sent`}
                          title="Mark as sent"
                          className="flex min-h-11 min-w-11 items-center justify-center rounded-control text-ink-muted transition-colors hover:text-green-900"
                        >
                          <PaperPlaneRight size={16} aria-hidden="true" />
                        </button>
                      ) : null}
                      {invoice.status !== 'Paid' && invoice.status !== 'Draft' ? (
                        <button
                          type="button"
                          // Paid in stages: the payments are recorded stage by stage, inside the invoice.
                          onClick={() => (invoice.stages?.length ? update({ open: invoice.id }) : setMarkingPaid(invoice))}
                          aria-label={invoice.stages?.length ? `Record payments on ${invoice.number}` : `Mark ${invoice.number} as paid`}
                          title={invoice.stages?.length ? 'Record payments' : 'Mark as paid'}
                          className="flex min-h-11 min-w-11 items-center justify-center rounded-control text-ink-muted transition-colors hover:text-success"
                        >
                          <SealCheck size={16} aria-hidden="true" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setDeleting(invoice)}
                        aria-label={`Delete ${invoice.number}`}
                        className="flex min-h-11 min-w-11 items-center justify-center rounded-control text-ink-muted transition-colors hover:text-danger"
                      >
                        <Trash size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </>
    );
  }

  return (
    <div className="px-5 pb-16 pt-6 sm:px-8 lg:pt-8">
      {main}

      {printJob ? <InvoicePrint invoices={printJob} /> : null}

      <ConfirmDialog
        open={markingPaid !== null}
        title={`Mark ${markingPaid?.number ?? 'invoice'} as paid?`}
        message={
          <>
            <p>
              Record that {markingPaid ? money(markingPaid.amount) : 'this amount'} has been received from{' '}
              {markingPaid?.client_name}.
            </p>
            <p className="mt-2 text-ink-muted">
              Only do this once the money has actually arrived — there is no payment gateway, so this is the sole record of
              payment. It also updates the client’s lifetime value, and it cannot be undone.
            </p>
          </>
        }
        confirmLabel="Mark as paid"
        pending={pending}
        onConfirm={doMarkPaid}
        onCancel={() => setMarkingPaid(null)}
      />

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.number ?? 'invoice'}?`}
        message={
          deleting?.status === 'Paid'
            ? 'This invoice is paid. Deleting it removes the payment record and takes its amount off the client’s total spent. It cannot be restored.'
            : 'A deleted invoice cannot be restored.'
        }
        confirmLabel="Delete invoice"
        password={deleting?.status === 'Paid'}
        pending={pending}
        onConfirm={(password) => void doDelete(password)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* One invoice: the form on the left, the A4 sheet it makes on the right      */
/* -------------------------------------------------------------------------- */

function InvoiceEditor({
  invoice,
  clients,
  projects,
  issuer,
  bank,
  busy,
  onClose,
  onSaved,
  onStatus,
  onMarkPaid,
  onDelete,
}: {
  /** Undefined = a new invoice. */
  invoice: Invoice | undefined;
  clients: Client[];
  projects: Project[];
  issuer: InvoiceIssuer;
  bank: BankDetails | null;
  busy: boolean;
  onClose: () => void;
  onSaved: (id: string) => Promise<void>;
  onStatus: (invoice: Invoice, status: 'Sent' | 'Draft') => Promise<boolean>;
  onMarkPaid: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
}) {
  const toast = useToast();
  const paid = invoice?.status === 'Paid';
  // Made before lines existed: a stored total only, nothing to itemise or discount.
  const legacy = invoice !== undefined && (invoice.items?.length ?? 0) === 0;
  const moneyEditable = (!invoice || invoice.status === 'Draft') && !legacy;

  const [clientId, setClientId] = useState(invoice?.client_id ?? '');
  const [projectId, setProjectId] = useState(invoice?.project_id ?? '');
  const [dueDate, setDueDate] = useState(invoice ? invoice.due_date.slice(0, 10) : inDays(30));
  const [vatRate, setVatRate] = useState(invoice ? String(invoice.vat_rate) : '');
  // A new one starts at Settings › VAT; a saved one keeps its own rate.
  const defaultVat = useQuery<{ vat_rate: number }>(invoice ? null : '/settings/vat').data?.vat_rate;
  useEffect(() => {
    if (defaultVat !== undefined) setVatRate((current) => (current === '' ? String(defaultVat) : current));
  }, [defaultVat]);
  const [discount, setDiscount] = useState(invoice?.discount ? String(invoice.discount) : '');
  const [jobName, setJobName] = useState(invoice?.job_name ?? '');
  const [jobAddress, setJobAddress] = useState(invoice?.job_address ?? '');
  // The last address this form filled in itself, so choosing another project or client replaces it but never something typed.
  const [autoAddress, setAutoAddress] = useState('');
  const [jobNotes, setJobNotes] = useState(invoice?.job_notes ?? '');
  const [rows, setRows] = useState<Row[]>(() => (invoice?.items?.length ? toRows(invoice.items) : [blankLine()]));
  const [schedule, setSchedule] = useState<ScheduleRow[]>(() =>
    (invoice?.payment_schedule ?? []).map((row) => ({ key: ++rowKey, label: row.label, amount: String(row.amount), date: row.date ?? '' })),
  );
  const saved = invoice?.stages ?? [];
  // A new invoice starts from 50 / 40 / 10; an older one with no stages stays as it was until you add some.
  const [stageRows, setStageRows] = useState<StageRow[]>(() => (invoice ? stageRowsOf(saved) : defaultStageRows()));
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [recording, setRecording] = useState<InvoiceStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const allowDownload = async (next: boolean) => {
    try {
      await api.patch(`/invoices/${invoice!.id}/client-download`, { client_can_download: next });
      toast.success(next ? 'The client can now download and print this invoice.' : 'The client can only view this invoice.');
      await onSaved(invoice!.id);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not change that.');
    }
  };

  const client = clients.find((entry) => entry.id === clientId);
  const project = projects.find((entry) => entry.id === projectId);
  /** The job is at the project's site, else at the client's own address. */
  const fillAddress = (nextClientId: string, nextProjectId: string) => {
    const next = projects.find((entry) => entry.id === nextProjectId)?.site_address ?? clients.find((entry) => entry.id === nextClientId)?.address ?? '';
    if (jobAddress && jobAddress !== autoAddress) return;
    setJobAddress(next);
    setAutoAddress(next);
  };
  const clientProjects = projects.filter((entry) => entry.client_id === clientId);
  const rate = Number(vatRate) || 0;
  const items = toItems(rows);
  const off = Number(discount) || 0;
  const preview = previewTotals(items, rate, off);
  const scheduleRows: PaymentScheduleRow[] = schedule
    .filter((row) => row.label.trim())
    .map((row) => ({ label: row.label.trim(), amount: Number(row.amount) || 0, date: row.date || null }));
  // An invoice with no lines keeps its stored amount.
  const payable = items.length > 0 ? preview.gross : (invoice?.amount ?? 0);
  const scheduled = scheduleRows.reduce((total, row) => total + pennies(row.amount), 0) / 100;

  // Stages: editable until one is paid; payments are recorded on a sent invoice and undone until it is fully paid.
  const anyStagePaid = saved.some((stage) => stage.paid_at);
  const stagesEditable = !paid && !anyStagePaid;
  const canRecord = invoice !== undefined && invoice.status !== 'Draft' && !paid;
  // The total the stages split: this form's own figure while the lines can change, else the saved one.
  const stageTotal = moneyEditable ? preview.gross : (invoice?.amount ?? 0);
  const stagePreview = previewStages(stageTotal, stageRows.map((row) => ({ mode: row.mode, value: Number(row.value) || 0 })));
  const stagesDirty = JSON.stringify(stagePayload(stageRows)) !== JSON.stringify(stagePayload(stageRowsOf(saved)));
  const sheetStages: InvoiceStage[] = stagesEditable
    ? stageRows.map((row, position) => ({
        id: String(row.key),
        position,
        label: row.label.trim() || 'Payment',
        mode: row.mode,
        value: Number(row.value) || 0,
        amount: stagePreview.amounts[position] ?? 0,
        due_note: row.due_note.trim() || null,
        paid_at: null,
      }))
    : saved;

  // What the sheet shows: the saved invoice with this form's edits laid over it.
  const sheet: Invoice = {
    id: invoice?.id ?? 'new',
    number: invoice?.number ?? 'New invoice',
    status: invoice?.status ?? 'Draft',
    created_at: invoice?.created_at ?? new Date().toISOString(),
    paid_at: invoice?.paid_at ?? null,
    is_overdue: invoice?.is_overdue ?? false,
    days_overdue: invoice?.days_overdue ?? 0,
    client_id: clientId,
    project_id: projectId || null,
    due_date: dueDate,
    client_name: client?.name ?? invoice?.client_name ?? 'Choose a client',
    client_email: client?.email ?? invoice?.client_email ?? null,
    client_phone: client?.phone ?? invoice?.client_phone ?? null,
    project_name: project?.name ?? null,
    job_name: jobName.trim() || null,
    job_address: jobAddress.trim() || null,
    job_notes: jobNotes.trim() || null,
    payment_schedule: scheduleRows,
    issuer: invoice?.issuer ?? issuer,
    stages: sheetStages,
    paid_amount: invoice?.paid_amount ?? 0,
    balance_amount: invoice?.balance_amount ?? 0,
    bank_details: invoice?.bank_details ?? bank,
    ...(moneyEditable
      ? {
          items: items.map((item, position) => ({ ...item, id: String(position), position })),
          vat_rate: rate,
          discount: off,
          subtotal_amount: preview.subtotal,
          net_amount: preview.net,
          vat_amount: preview.vat,
          amount: preview.gross,
        }
      : {
          items: invoice?.items ?? [],
          vat_rate: invoice?.vat_rate ?? 0,
          discount: invoice?.discount ?? 0,
          subtotal_amount: invoice?.subtotal_amount ?? 0,
          net_amount: invoice?.net_amount ?? 0,
          vat_amount: invoice?.vat_amount ?? 0,
          amount: invoice?.amount ?? 0,
        }),
  };

  const setRow = (key: number, change: Partial<LineRow> | { text: string }) =>
    setRows((current) => current.map((row) => (row.key === key ? ({ ...row, ...change } as Row) : row)));
  const removeRow = (key: number) => setRows((current) => current.filter((row) => row.key !== key));
  /** A new line at the end of the section that `headingKey` starts. */
  const addLineTo = (headingKey: number) =>
    setRows((current) => {
      const start = current.findIndex((row) => row.key === headingKey);
      const nextHeading = current.findIndex((row, index) => index > start && row.kind === 'heading');
      const at = nextHeading === -1 ? current.length : nextHeading;
      return [...current.slice(0, at), blankLine(), ...current.slice(at)];
    });
  const setStage = (key: number, change: Partial<StageRow>) =>
    setStageRows((current) => current.map((row) => (row.key === key ? { ...row, ...change } : row)));

  /** Record or undo one stage's payment: its own audited call, then the list reloads. */
  const payStage = async (stage: InvoiceStage) => {
    if (!invoice) return;
    setSaving(true);
    try {
      await api.put(`/invoices/${invoice.id}/stages/${stage.id}/paid`, { paid_at: payDate });
      toast.success(`${stage.label} marked as paid.`);
      setRecording(null);
      await onSaved(invoice.id);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not record this payment.');
    } finally {
      setSaving(false);
    }
  };
  const undoStage = async (stage: InvoiceStage) => {
    if (!invoice) return;
    setSaving(true);
    try {
      await api.delete(`/invoices/${invoice.id}/stages/${stage.id}/paid`);
      toast.success(`${stage.label} is unpaid again.`);
      await onSaved(invoice.id);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not undo this payment.');
    } finally {
      setSaving(false);
    }
  };

  const setScheduleRow = (key: number, change: Partial<ScheduleRow>) =>
    setSchedule((current) => current.map((row) => (row.key === key ? { ...row, ...change } : row)));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!clientId) return setError('Choose a client.');
    if (!dueDate) return setError('Choose a due date.');
    if (moneyEditable) {
      const lines = rows.filter((row): row is LineRow => row.kind === 'line');
      if (lines.length === 0) return setError('Add at least one line.');
      if (lines.some((line) => !line.description.trim())) return setError('Name each line’s item, or remove the empty ones.');
      if (lines.some((line) => !Number.isInteger(Number(line.quantity)) || Number(line.quantity) < 1)) {
        return setError('Each quantity must be a whole number, 1 or more.');
      }
      if (lines.some((line) => line.unit_price !== '' && !(Number(line.unit_price) >= 0))) return setError('Prices cannot be negative.');
      if (!(off >= 0)) return setError('The discount cannot be negative.');
      if (preview.net < 0) return setError('The discount cannot be more than the lines add up to.');
      if (preview.gross <= 0) return setError('The total must be more than zero. Give at least one line a price.');
    }
    if (schedule.some((row) => row.label.trim() && !(Number(row.amount) >= 0))) return setError('Enter an amount for each payment.');
    if (stagesEditable && stageRows.length > 0) {
      if (stageRows.some((row) => !row.label.trim())) return setError('Name each payment stage, e.g. On start.');
      if (stageRows.some((row) => !(Number(row.value) > 0))) return setError('Each payment stage needs an amount above zero.');
      if (stageRows.some((row) => row.mode === 'percent' && Number(row.value) > 100)) return setError('A stage cannot be more than 100%.');
      if (stageTotal <= 0) return setError('Give the invoice a total before splitting it into stages.');
      if (!stagePreview.balanced) {
        return setError(`The stages add up to ${money(stagePreview.nominal)} but the invoice total is ${money(stageTotal)}. Adjust a stage so they match.`);
      }
    }

    const paperwork = {
      job_name: jobName,
      job_address: jobAddress,
      job_notes: jobNotes,
      payment_schedule: scheduleRows,
    };
    const payload = paid
      ? paperwork
      : {
          ...paperwork,
          project_id: projectId || null,
          due_date: dueDate,
          // Blank VAT = the setting had not loaded: the API then applies Settings › VAT itself.
          ...(moneyEditable ? { ...(vatRate.trim() === '' ? {} : { vat_rate: rate }), discount: off, items } : {}),
          ...(stagesEditable ? { stages: stagePayload(stageRows) } : {}),
        };

    setSaving(true);
    try {
      if (invoice) {
        await api.put(`/invoices/${invoice.id}`, payload);
        toast.success(`${invoice.number} saved.`);
        await onSaved(invoice.id);
      } else {
        const created = await api.post<Invoice>('/invoices', { ...payload, client_id: clientId });
        toast.success(`${created.number} created as a draft.`);
        await onSaved(created.id);
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save this invoice.');
    } finally {
      setSaving(false);
    }
  };

  const lockNote = paid
    ? 'This invoice is paid, so its figures, dates and project are final. The job details and payment schedule can still change.'
    : legacy
      ? `This invoice was raised before lines existed, so its total of ${money(invoice?.amount ?? 0)} stays as it is.`
      : invoice && invoice.status !== 'Draft'
        ? 'Lines, VAT and the discount change only on a draft. Move it back to draft to edit them.'
        : null;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <button type="button" onClick={onClose} className="text-link inline-flex min-h-11 items-center gap-1.5 text-sm pointer-fine:min-h-0">
            <ArrowLeft size={14} aria-hidden="true" />
            All invoices
          </button>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-xl font-bold tracking-tight text-ink">{invoice ? invoice.number : 'New invoice'}</h2>
            {invoice ? (
              <>
                <StatusTag tone={invoiceTone(invoice.status, invoice.is_overdue)}>{invoice.status}</StatusTag>
                <span className="text-sm text-ink-muted">{invoice.client_name}</span>
                {invoice.is_overdue && invoice.status !== 'Overdue' ? (
                  <span className="text-sm text-danger">{invoice.days_overdue} days late</span>
                ) : null}
                {invoice.status !== 'Draft' && stageProgress(invoice) ? (
                  <span className="text-sm text-ink-muted">
                    {stageProgress(invoice)}
                    {!paid ? <> · {money(invoice.balance_amount ?? invoice.amount)} to pay</> : null}
                  </span>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={<Printer size={16} aria-hidden="true" />} onClick={() => void printWhenReady()}>
            Print / Save as PDF
          </Button>
          {invoice ? (
            <Button variant="secondary" icon={<Trash size={16} aria-hidden="true" />} onClick={() => onDelete(invoice)}>
              Delete
            </Button>
          ) : null}
          {invoice && invoice.status === 'Draft' ? (
            <>
              <Button
                variant="secondary"
                icon={<PaperPlaneRight size={16} aria-hidden="true" />}
                disabled={busy}
                onClick={() => void onStatus(invoice, 'Sent')}
              >
                Mark as sent
              </Button>
            </>
          ) : null}
          {invoice && invoice.status !== 'Draft' && !paid ? (
            <>
              {anyStagePaid ? null : (
                <Button
                  variant="secondary"
                  icon={<ArrowUUpLeft size={16} aria-hidden="true" />}
                  disabled={busy}
                  onClick={() => void onStatus(invoice, 'Draft')}
                >
                  Back to draft
                </Button>
              )}
              {/* With stages, the payments are recorded stage by stage (below); the last one settles the invoice. */}
              {saved.length > 0 ? null : (
                <Button variant="secondary" icon={<SealCheck size={16} aria-hidden="true" />} onClick={() => onMarkPaid(invoice)}>
                  Mark as paid
                </Button>
              )}
            </>
          ) : null}
          <Button type="submit" form="invoice-form" variant="primary" loading={saving}>
            {invoice ? 'Save changes' : 'Create draft'}
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,30rem)_minmax(0,1fr)]">
        <form id="invoice-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {lockNote ? <p className="rounded-control border border-border bg-surface-muted px-3 py-2 text-sm text-ink-muted">{lockNote}</p> : null}

          <Card className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-ink">Customer</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Client"
                value={clientId}
                disabled={invoice !== undefined}
                onChange={(event) => {
                  setClientId(event.target.value);
                  setProjectId('');
                  fillAddress(event.target.value, '');
                }}
                required
              >
                <option value="">Choose a client…</option>
                {clients.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </Select>
              <Select
                label="Project"
                value={projectId}
                disabled={paid}
                onChange={(event) => {
                  setProjectId(event.target.value);
                  fillAddress(clientId, event.target.value);
                }}
                hint={clientId ? undefined : 'Choose a client first.'}
              >
                <option value="">No project</option>
                {clientProjects.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </Select>
              <Input
                label="Due date"
                type="date"
                value={dueDate}
                disabled={paid}
                onChange={(event) => setDueDate(event.target.value)}
                required
              />
            </div>
          </Card>

          {invoice && invoice.status !== 'Draft' ? (
            <Card>
              <Toggle
                label="Client can download and print"
                description="Off: the client can view this invoice in the portal but not save or print it. Staff are not affected."
                checked={Boolean(invoice.client_can_download)}
                onChange={(next) => void allowDownload(next)}
              />
            </Card>
          ) : null}

          <Card className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-ink">Job</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Job name" value={jobName} maxLength={200} placeholder="Media wall" onChange={(event) => setJobName(event.target.value)} />
              <Input
                label="Job address"
                value={jobAddress}
                maxLength={300}
                hint="Starts as the project’s site address, else the client’s."
                onChange={(event) => setJobAddress(event.target.value)}
              />
            </div>
            <Textarea
              label="Job notes"
              value={jobNotes}
              maxLength={4000}
              rows={4}
              placeholder={'Interior: …\nExterior: …\nHandle: Push to open\nLED temp: Warm'}
              hint="Printed as written, one line each."
              onChange={(event) => setJobNotes(event.target.value)}
            />
          </Card>

          {moneyEditable ? (
            <Card className="flex flex-col gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink">Itemised list</h2>
                <p className="mt-0.5 text-sm text-ink-muted">
                  Prices are before VAT. Leave a price blank for a quantity-only row, such as materials.
                </p>
              </div>
              {rows.map((row, index) =>
                row.kind === 'heading' ? (
                  <div key={row.key} className="mt-2 flex items-center gap-2 first:mt-0">
                    <input
                      value={row.text}
                      onChange={(event) => setRow(row.key, { text: event.target.value })}
                      aria-label={`Section heading ${index + 1}`}
                      placeholder="Section heading, e.g. Materials"
                      maxLength={120}
                      className={clsx(FIELD_BASE, 'font-semibold text-green-900')}
                    />
                    <button
                      type="button"
                      onClick={() => addLineTo(row.key)}
                      aria-label={`Add a line under ${row.text || 'this heading'}`}
                      title="Add a line to this section"
                      className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-control text-ink-muted transition-colors hover:text-green-900"
                    >
                      <Plus size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      aria-label={`Remove heading ${row.text || index + 1}`}
                      className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-control text-ink-muted transition-colors hover:text-danger"
                    >
                      <Trash size={16} aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <div
                    key={row.key}
                    className="grid grid-cols-[minmax(0,1fr)_4.5rem_6.5rem_2.75rem] items-center gap-2 border-l-2 border-border pl-2"
                  >
                    <input
                      value={row.description}
                      onChange={(event) => setRow(row.key, { description: event.target.value })}
                      aria-label={`Line ${index + 1} item`}
                      placeholder="Item"
                      maxLength={300}
                      className={FIELD_BASE}
                    />
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      value={row.quantity}
                      // Whole numbers only: the arrows step by 1 and a pasted 2.5 becomes 2.
                      onChange={(event) =>
                        setRow(row.key, { quantity: event.target.value.split(/[.,]/)[0]!.replace(/\D/g, '') })
                      }
                      aria-label={`Line ${index + 1} quantity`}
                      placeholder="Qty"
                      className={clsx(FIELD_BASE, 'tabular')}
                    />
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      value={row.unit_price}
                      onChange={(event) => setRow(row.key, { unit_price: event.target.value })}
                      aria-label={`Line ${index + 1} price each, in pounds`}
                      placeholder="£ each"
                      className={clsx(FIELD_BASE, 'tabular')}
                    />
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      aria-label={`Remove line ${index + 1}`}
                      className="flex min-h-11 min-w-11 items-center justify-center rounded-control text-ink-muted transition-colors hover:text-danger"
                    >
                      <Trash size={16} aria-hidden="true" />
                    </button>
                    <input
                      value={row.detail}
                      onChange={(event) => setRow(row.key, { detail: event.target.value })}
                      aria-label={`Line ${index + 1} description`}
                      placeholder="Description (optional)"
                      maxLength={300}
                      className={clsx(FIELD_BASE, 'col-span-3 text-sm')}
                    />
                  </div>
                ),
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  icon={<Plus size={16} aria-hidden="true" />}
                  onClick={() => setRows((current) => [...current, blankLine()])}
                  disabled={items.length >= 50}
                >
                  Add line
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  icon={<TextHOne size={16} aria-hidden="true" />}
                  onClick={() => setRows((current) => [...current, blankHeading(), blankLine()])}
                  disabled={items.length >= 50}
                >
                  Add section
                </Button>
              </div>

              <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
                <Input
                  label="Discount (£)"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={discount}
                  placeholder="0.00"
                  hint="Taken off before VAT."
                  onChange={(event) => setDiscount(event.target.value)}
                />
                <Input
                  label="VAT rate (%)"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  step="0.01"
                  value={vatRate}
                  onChange={(event) => setVatRate(event.target.value)}
                />
              </div>
              <dl className="flex flex-col gap-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-muted">Total project value</dt>
                  <dd className="tabular text-ink">{money(preview.subtotal)}</dd>
                </div>
                {off > 0 ? (
                  <div className="flex justify-between">
                    <dt className="text-ink-muted">Discount</dt>
                    <dd className="tabular text-ink">−{money(off)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <dt className="text-ink-muted">VAT at {rate}%</dt>
                  <dd className="tabular text-ink">{money(preview.vat)}</dd>
                </div>
                <div className="flex justify-between border-t border-border pt-1.5">
                  <dt className="font-semibold text-ink">Total payable</dt>
                  <dd className="tabular text-base font-bold text-green-900">{money(preview.gross)}</dd>
                </div>
              </dl>
            </Card>
          ) : null}

          <Card className="flex flex-col gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink">Payment stages</h2>
              <p className="mt-0.5 text-sm text-ink-muted">
                Split the total into payments, each a percentage or a fixed amount. The invoice becomes Paid only when every stage has
                been paid. Leave none to be paid in one go.
              </p>
            </div>
            {stagesEditable ? (
              <>
                {stageRows.map((row, index) => (
                  <div
                    key={row.key}
                    className="grid grid-cols-[minmax(0,1fr)_5.25rem_5.5rem_2.75rem] items-center gap-2 border-l-2 border-border pl-2"
                  >
                    <input
                      value={row.label}
                      onChange={(event) => setStage(row.key, { label: event.target.value })}
                      aria-label={`Stage ${index + 1} trigger`}
                      placeholder="On start"
                      maxLength={60}
                      className={FIELD_BASE}
                    />
                    <div role="group" aria-label={`Stage ${index + 1} is a`} className="flex min-h-11 overflow-hidden rounded-[7px] border border-border pointer-fine:min-h-9">
                      {(['percent', 'fixed'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          aria-pressed={row.mode === mode}
                          aria-label={mode === 'percent' ? 'Percentage' : 'Fixed amount in pounds'}
                          onClick={() => setStage(row.key, { mode })}
                          className={clsx(
                            'flex-1 text-sm font-semibold transition-colors',
                            row.mode === mode ? 'bg-green-900 text-on-primary' : 'bg-surface text-ink-muted hover:text-ink',
                          )}
                        >
                          {mode === 'percent' ? '%' : '£'}
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      value={row.value}
                      onChange={(event) => setStage(row.key, { value: event.target.value })}
                      aria-label={`Stage ${index + 1} ${row.mode === 'percent' ? 'percentage' : 'amount in pounds'}`}
                      className={clsx(FIELD_BASE, 'tabular')}
                    />
                    <button
                      type="button"
                      onClick={() => setStageRows((current) => current.filter((entry) => entry.key !== row.key))}
                      aria-label={`Remove stage ${index + 1}`}
                      className="flex min-h-11 min-w-11 items-center justify-center rounded-control text-ink-muted transition-colors hover:text-danger"
                    >
                      <Trash size={16} aria-hidden="true" />
                    </button>
                    <input
                      value={row.due_note}
                      onChange={(event) => setStage(row.key, { due_note: event.target.value })}
                      aria-label={`Stage ${index + 1} note (optional)`}
                      placeholder="Note (optional)"
                      maxLength={120}
                      className={clsx(FIELD_BASE, 'text-sm')}
                    />
                    <p className="tabular col-span-2 text-right text-sm font-semibold text-ink">{money(stagePreview.amounts[index] ?? 0)}</p>
                    {canRecord && !stagesDirty && saved[index] ? (
                      <button
                        type="button"
                        onClick={() => setRecording(saved[index]!)}
                        aria-label={`Record ${row.label || `stage ${index + 1}`} as paid`}
                        title="Record as paid"
                        className="flex min-h-11 min-w-11 items-center justify-center rounded-control text-ink-muted transition-colors hover:text-success"
                      >
                        <SealCheck size={18} aria-hidden="true" />
                      </button>
                    ) : (
                      <span />
                    )}
                  </div>
                ))}
                {stageRows.length > 0 && !stagePreview.balanced ? (
                  <p role="status" className="text-sm text-warning">
                    The stages add up to {money(stagePreview.nominal)} of {money(stageTotal)} payable.
                  </p>
                ) : null}
                {canRecord && stageRows.length > 0 && stagesDirty ? (
                  <p className="text-sm text-ink-muted">Save your changes before recording a payment.</p>
                ) : null}
                <div>
                  <Button
                    type="button"
                    variant="secondary"
                    icon={<Plus size={16} aria-hidden="true" />}
                    onClick={() =>
                      setStageRows((current) =>
                        current.length === 0 ? defaultStageRows() : [...current, { key: ++rowKey, label: '', mode: 'fixed', value: '', due_note: '' }],
                      )
                    }
                    disabled={stageRows.length >= MAX_STAGES}
                  >
                    {stageRows.length === 0 ? 'Add 50 / 40 / 10 stages' : 'Add stage'}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <ul className="divide-y divide-border">
                  {saved.map((stage) => (
                    <li key={stage.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
                      <div className="min-w-0">
                        <p className="font-medium text-ink">
                          {stage.label}
                          {stage.mode === 'percent' ? <span className="text-ink-muted"> · {stage.value}%</span> : null}
                        </p>
                        <p className="text-xs text-ink-muted">
                          {stage.paid_at
                            ? `Paid ${date(stage.paid_at)}${stage.paid_by ? ` · recorded by ${stage.paid_by}` : ''}`
                            : (stage.due_note ?? 'Not paid yet')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="tabular font-semibold text-ink">{money(stage.amount)}</span>
                        {stage.paid_at ? (
                          paid ? null : (
                            <Button type="button" variant="secondary" icon={<ArrowUUpLeft size={16} aria-hidden="true" />} disabled={saving} onClick={() => void undoStage(stage)}>
                              Undo
                            </Button>
                          )
                        ) : canRecord ? (
                          <Button type="button" variant="secondary" icon={<SealCheck size={16} aria-hidden="true" />} disabled={saving} onClick={() => setRecording(stage)}>
                            Mark paid
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
                {paid ? null : (
                  <p className="text-sm text-ink-muted">A stage has been paid, so the stages are locked. Undo a payment to change them.</p>
                )}
              </>
            )}
          </Card>

          <Card className="flex flex-col gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink">Payment schedule</h2>
              <p className="mt-0.5 text-sm text-ink-muted">
                Printed under the totals, e.g. deposit received, due on delivery, due on completion. It does not change the total.
              </p>
            </div>
            {schedule.map((row, index) => (
              <div key={row.key} className="grid grid-cols-[minmax(0,1fr)_7.5rem_2.75rem] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_9.5rem_7rem_2.75rem]">
                <input
                  value={row.label}
                  onChange={(event) => setScheduleRow(row.key, { label: event.target.value })}
                  aria-label={`Payment ${index + 1} label`}
                  placeholder="Deposit received"
                  maxLength={120}
                  className={FIELD_BASE}
                />
                <input
                  type="date"
                  value={row.date}
                  onChange={(event) => setScheduleRow(row.key, { date: event.target.value })}
                  aria-label={`Payment ${index + 1} date (optional)`}
                  className={clsx(FIELD_BASE, 'col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto')}
                />
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={row.amount}
                  onChange={(event) => setScheduleRow(row.key, { amount: event.target.value })}
                  aria-label={`Payment ${index + 1} amount in pounds`}
                  placeholder="£"
                  className={clsx(FIELD_BASE, 'tabular')}
                />
                <button
                  type="button"
                  onClick={() => setSchedule((current) => current.filter((entry) => entry.key !== row.key))}
                  aria-label={`Remove payment ${index + 1}`}
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-control text-ink-muted transition-colors hover:text-danger"
                >
                  <Trash size={16} aria-hidden="true" />
                </button>
              </div>
            ))}
            {scheduleRows.length > 0 && pennies(scheduled) !== pennies(payable) ? (
              <p role="status" className="text-sm text-warning">
                The schedule adds up to {money(scheduled)} of {money(payable)} payable.
              </p>
            ) : null}
            <div>
              <Button
                type="button"
                variant="secondary"
                icon={<Plus size={16} aria-hidden="true" />}
                onClick={() => setSchedule((current) => [...current, { key: ++rowKey, label: '', amount: '', date: '' }])}
                disabled={schedule.length >= 12}
              >
                Add payment
              </Button>
            </div>
          </Card>

          {error ? (
            <p role="alert" className="rounded-control border border-danger/30 bg-danger-bg px-3 py-2 text-danger">
              {error}
            </p>
          ) : null}
        </form>

        <section aria-label="Invoice preview" className="min-w-0 xl:sticky xl:top-4">
          <InvoicePreview invoice={sheet} />
        </section>
      </div>

      <InvoicePrint invoices={[sheet]} />

      <ConfirmDialog
        open={recording !== null}
        title={`Record ${recording?.label ?? 'this stage'} as paid?`}
        message={
          <>
            <div className="max-w-xs">
              <Input
                label="Payment received on"
                type="date"
                value={payDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(event) => setPayDate(event.target.value)}
              />
            </div>
            <p className="mt-3">
              Record that {recording ? money(recording.amount) : 'this amount'} has been received from {invoice?.client_name}. Only do
              this once the money has actually arrived; there is no payment gateway.
            </p>
            {recording && saved.filter((stage) => !stage.paid_at).length === 1 ? (
              <p className="mt-2 font-medium text-ink">
                This is the last unpaid stage, so the invoice becomes Paid and the client’s lifetime value is updated. That cannot be undone.
              </p>
            ) : (
              <p className="mt-2 text-ink-muted">You can undo this until the invoice is fully paid.</p>
            )}
          </>
        }
        confirmLabel="Record payment"
        pending={saving}
        onConfirm={() => recording && void payStage(recording)}
        onCancel={() => setRecording(null)}
      />
    </>
  );
}
