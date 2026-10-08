import { ArrowUUpLeft, PaperPlaneRight, Plus, SealCheck, Trash } from '@phosphor-icons/react';
import clsx from 'clsx';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';

import { INVOICE_VIEWS } from '@/components/layout/AdminLayout';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FIELD_BASE,
  Input,
  Modal,
  Select,
  StatusTag,
  TableSkeleton,
  TableWrap,
  Tabs,
  Td,
  Th,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
import { date, money, moneyCompact } from '@/lib/format';
import { invoiceTone } from '@/lib/status';
import type { Client, Invoice, Project } from '@/types/api';

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

/* ---------------------------------------------------------------------------
 * The form works in strings (so a half-typed price is allowed) and the sums
 * below are PREVIEW ONLY, in whole pennies. The API works the total out in
 * exact decimals and is the one that counts: the screen shows its figures
 * again as soon as the invoice is saved.
 * ------------------------------------------------------------------------- */

interface Line {
  key: number;
  description: string;
  quantity: string;
  unit_price: string;
}

let lineKey = 0;
const blankLine = (): Line => ({ key: ++lineKey, description: '', quantity: '1', unit_price: '' });

const linePennies = (line: Line) => Math.round(Number(line.quantity) * Number(line.unit_price) * 100) || 0;

function previewTotals(lines: Line[], vatRate: number) {
  const net = lines.reduce((total, line) => total + linePennies(line), 0);
  const vat = Math.round((net * vatRate) / 100);
  return { net: net / 100, vat: vat / 100, gross: (net + vat) / 100 };
}

const inDays = (days: number) => {
  const day = new Date();
  day.setDate(day.getDate() + days);
  return day.toISOString().slice(0, 10);
};

/**
 * Invoices. An invoice is lines of work at a net price; VAT and the total are
 * worked out from them. Lines and VAT change only while it is a Draft: once it
 * is sent the client may have it, so it can be moved back to Draft first. It
 * becomes Paid only when an Admin records it here — payment is taken outside
 * the platform and there is no payment gateway.
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

  const rows = useMemo(() => invoices.data ?? [], [invoices.data]);
  const visible = rows.filter(VIEW_FILTER[view]);
  const counts = Object.fromEntries(INVOICE_VIEWS.map(({ id }) => [id, rows.filter(VIEW_FILTER[id]).length]));

  const totals = useMemo(() => {
    const pennies = (list: Invoice[]) => list.reduce((total, invoice) => total + Math.round(invoice.amount * 100), 0) / 100;
    return {
      paid: pennies(rows.filter(VIEW_FILTER.paid)),
      outstanding: pennies(rows.filter((invoice) => isSent(invoice) || invoice.status === 'Overdue')),
      overdue: pennies(rows.filter(isLate).filter((invoice) => invoice.status !== 'Paid')),
      drafts: rows.filter(VIEW_FILTER.draft).length,
    };
  }, [rows]);

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

  const doDelete = async () => {
    if (!deleting) return;
    await act(() => api.delete(`/invoices/${deleting.id}`), `${deleting.number} deleted.`, 'Could not delete this invoice.');
    setDeleting(null);
  };

  const openNew = () => update({ new: '1' });

  return (
    <div className="px-5 pb-16 pt-6 sm:px-8 lg:pt-8">
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
      <p className="mb-4 text-sm text-ink-muted">
        Payment is taken outside the platform. An invoice becomes Paid only when you record it.
      </p>

      {invoices.error ? (
        <ErrorState message={invoices.error} onRetry={invoices.refetch} />
      ) : invoices.loading ? (
        <TableSkeleton rows={6} columns={6} />
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
        <TableWrap>
          <thead>
            <tr>
              <Th>Number</Th>
              <Th>Client</Th>
              <Th>Project</Th>
              <Th>Status</Th>
              <Th>Due</Th>
              <Th className="text-right">Total</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {visible.map((invoice) => (
              <tr key={invoice.id} className="hover:bg-surface-muted/40">
                <Td className="whitespace-nowrap font-medium text-ink">
                  <button
                    type="button"
                    onClick={() => update({ open: invoice.id })}
                    className="-mx-1 min-h-11 rounded-control px-1 text-left font-medium text-ink underline-offset-2 hover:text-green-900 hover:underline pointer-fine:min-h-0"
                  >
                    {invoice.number}
                  </button>
                </Td>
                <Td className="text-ink">{invoice.client_name}</Td>
                <Td className="text-ink-muted">{invoice.project_name ?? '—'}</Td>
                <Td>
                  <StatusTag tone={invoiceTone(invoice.status, invoice.is_overdue)}>{invoice.status}</StatusTag>
                  {invoice.is_overdue && invoice.status !== 'Overdue' ? (
                    <span className="ml-1.5 text-xs text-danger">{invoice.days_overdue}d late</span>
                  ) : null}
                </Td>
                <Td className="whitespace-nowrap text-ink-muted">{date(invoice.due_date)}</Td>
                <Td className="tabular whitespace-nowrap text-right font-semibold text-ink">{money(invoice.amount)}</Td>
                <Td>
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
                        onClick={() => setMarkingPaid(invoice)}
                        aria-label={`Mark ${invoice.number} as paid`}
                        title="Mark as paid"
                        className="flex min-h-11 min-w-11 items-center justify-center rounded-control text-ink-muted transition-colors hover:text-success"
                      >
                        <SealCheck size={16} aria-hidden="true" />
                      </button>
                    ) : null}
                    {invoice.status !== 'Paid' ? (
                      <button
                        type="button"
                        onClick={() => setDeleting(invoice)}
                        aria-label={`Delete ${invoice.number}`}
                        className="flex min-h-11 min-w-11 items-center justify-center rounded-control text-ink-muted transition-colors hover:text-danger"
                      >
                        <Trash size={16} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}

      <InvoiceDialog
        // A fresh form for each invoice, and for each time "new" is opened.
        key={creating ? 'new' : (opened?.id ?? 'closed')}
        open={creating || opened !== undefined}
        invoice={creating ? undefined : opened}
        clients={clients.data ?? []}
        projects={projects.data ?? []}
        onClose={() => update({ new: null, open: null }, true)}
        onSaved={async () => {
          await invoices.refetch();
        }}
        onReopen={(invoice) => setStatus(invoice, 'Draft')}
        onMarkPaid={(invoice) => {
          update({ open: null }, true);
          setMarkingPaid(invoice);
        }}
        busy={pending}
      />

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
        message="A deleted invoice cannot be restored."
        confirmLabel="Delete invoice"
        pending={pending}
        onConfirm={doDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* One invoice: a form while it is a Draft, otherwise a read-only record      */
/* -------------------------------------------------------------------------- */

function InvoiceDialog({
  open,
  invoice,
  clients,
  projects,
  onClose,
  onSaved,
  onReopen,
  onMarkPaid,
  busy,
}: {
  open: boolean;
  /** Undefined = a new invoice. */
  invoice: Invoice | undefined;
  clients: Client[];
  projects: Project[];
  onClose: () => void;
  onSaved: () => Promise<void>;
  onReopen: (invoice: Invoice) => Promise<boolean>;
  onMarkPaid: (invoice: Invoice) => void;
  busy: boolean;
}) {
  const toast = useToast();
  const editable = !invoice || invoice.status === 'Draft';
  const hasLines = (invoice?.items?.length ?? 0) > 0;

  const [clientId, setClientId] = useState(invoice?.client_id ?? '');
  const [projectId, setProjectId] = useState(invoice?.project_id ?? '');
  const [dueDate, setDueDate] = useState(invoice ? invoice.due_date.slice(0, 10) : inDays(30));
  const [vatRate, setVatRate] = useState(String(invoice?.vat_rate ?? 20));
  const [lines, setLines] = useState<Line[]>(() =>
    invoice?.items?.length
      ? invoice.items.map((item) => ({
          key: ++lineKey,
          description: item.description,
          quantity: String(item.quantity),
          unit_price: String(item.unit_price),
        }))
      : [blankLine()],
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // The Draft a stored amount was kept for (made before lines existed) has no
  // lines to edit; saving it can only change the due date, project and status.
  const legacy = invoice !== undefined && !hasLines;

  useEffect(() => setError(null), [open]);

  const rate = Number(vatRate) || 0;
  const preview = previewTotals(lines, rate);
  const clientProjects = projects.filter((project) => project.client_id === clientId);
  const setLine = (key: number, change: Partial<Line>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...change } : line)));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!clientId) return setError('Choose a client.');
    if (!dueDate) return setError('Choose a due date.');
    if (!legacy) {
      if (lines.some((line) => !line.description.trim())) return setError('Describe each line, or remove the empty ones.');
      if (lines.some((line) => !(Number(line.quantity) > 0))) return setError('Each quantity must be more than zero.');
      if (lines.some((line) => !(Number(line.unit_price) >= 0) || line.unit_price === '')) return setError('Enter a price for each line.');
      if (preview.gross <= 0) return setError('The total must be more than zero.');
    }

    const payload = {
      project_id: projectId || null,
      due_date: dueDate,
      ...(legacy
        ? {}
        : {
            vat_rate: rate,
            items: lines.map((line) => ({
              description: line.description.trim(),
              quantity: Number(line.quantity),
              unit_price: Number(line.unit_price),
            })),
          }),
    };

    setSaving(true);
    try {
      if (invoice) {
        await api.put(`/invoices/${invoice.id}`, payload);
        toast.success(`${invoice.number} saved.`);
      } else {
        await api.post('/invoices', { ...payload, client_id: clientId });
        toast.success('Invoice created as a draft.');
      }
      await onSaved();
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save this invoice.');
    } finally {
      setSaving(false);
    }
  };

  const shown = editable ? preview : { net: invoice?.net_amount ?? 0, vat: invoice?.vat_amount ?? 0, gross: invoice?.amount ?? 0 };

  const totalsCard = (
    <Card accent="primary" className="pl-5">
      <dl className="flex flex-col gap-1.5">
        <div className="flex justify-between">
          <dt className="text-ink-muted">Subtotal</dt>
          <dd className="tabular font-medium text-ink">{money(shown.net)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-muted">VAT at {editable ? rate : (invoice?.vat_rate ?? 0)}%</dt>
          <dd className="tabular font-medium text-ink">{money(shown.vat)}</dd>
        </div>
        <div className="flex justify-between border-t border-border pt-1.5">
          <dt className="font-semibold text-ink">Total payable</dt>
          <dd className="tabular text-lg font-bold text-green-900">{money(shown.gross)}</dd>
        </div>
      </dl>
    </Card>
  );

  if (invoice && !editable) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title={invoice.number}
        description={`${invoice.client_name}${invoice.project_name ? ` · ${invoice.project_name}` : ''}`}
        width="lg"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            {invoice.status !== 'Paid' ? (
              <>
                <Button
                  variant="secondary"
                  icon={<ArrowUUpLeft size={16} aria-hidden="true" />}
                  disabled={busy}
                  onClick={() => void onReopen(invoice)}
                >
                  Back to draft
                </Button>
                <Button variant="primary" icon={<SealCheck size={16} aria-hidden="true" />} onClick={() => onMarkPaid(invoice)}>
                  Mark as paid
                </Button>
              </>
            ) : null}
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-ink-muted">
            <StatusTag tone={invoiceTone(invoice.status, invoice.is_overdue)}>{invoice.status}</StatusTag>
            <span>Due {date(invoice.due_date)}</span>
            {invoice.is_overdue && invoice.status !== 'Overdue' ? (
              <span className="text-danger">{invoice.days_overdue} days late</span>
            ) : null}
            {invoice.paid_at ? <span>Paid {date(invoice.paid_at)}</span> : null}
          </div>

          {hasLines ? (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Description</Th>
                  <Th className="text-right">Qty</Th>
                  <Th className="text-right">Price</Th>
                  <Th className="text-right">Amount</Th>
                </tr>
              </thead>
              <tbody>
                {invoice.items?.map((item) => (
                  <tr key={item.id}>
                    <Td className="text-ink">{item.description}</Td>
                    <Td className="tabular text-right text-ink-muted">{item.quantity}</Td>
                    <Td className="tabular whitespace-nowrap text-right text-ink-muted">{money(item.unit_price)}</Td>
                    <Td className="tabular whitespace-nowrap text-right text-ink">
                      {money(Math.round(item.quantity * item.unit_price * 100) / 100)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          ) : (
            <p className="text-ink-muted">This invoice was raised before lines were added, so it has a total only.</p>
          )}

          {totalsCard}
          <p className="text-sm text-ink-muted">
            {invoice.status === 'Paid'
              ? 'A paid invoice is a financial record and cannot be changed.'
              : 'Lines and VAT can only be changed on a draft. Move it back to draft to edit them.'}
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={invoice ? `Edit ${invoice.number}` : 'New invoice'}
      description="Enter each line at its price before VAT. VAT and the total are worked out for you."
      width="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="invoice-form" variant="primary" loading={saving}>
            {invoice ? 'Save changes' : 'Create draft'}
          </Button>
        </>
      }
    >
      <form id="invoice-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Client"
            value={clientId}
            disabled={invoice !== undefined}
            onChange={(event) => {
              setClientId(event.target.value);
              setProjectId('');
            }}
            required
          >
            <option value="">Choose a client…</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </Select>
          <Select
            label="Project"
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            hint={clientId ? undefined : 'Choose a client first.'}
          >
            <option value="">No project</option>
            {clientProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
          <Input label="Due date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} required />
          {legacy ? null : (
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
          )}
        </div>

        {legacy ? (
          <p className="text-ink-muted">
            This invoice was raised before lines were added, so its total of {money(invoice?.amount ?? 0)} stays as it is.
          </p>
        ) : (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold text-ink">Lines</legend>
            <div
              aria-hidden="true"
              className="hidden gap-2 px-0.5 text-xs font-semibold text-ink-muted sm:grid sm:grid-cols-[minmax(0,1fr)_5.5rem_7rem_6rem_2.75rem]"
            >
              <span>Description</span>
              <span>Quantity</span>
              <span>Price (£)</span>
              <span className="text-right">Amount</span>
              <span />
            </div>
            {lines.map((line, index) => (
              <div
                key={line.key}
                className="grid grid-cols-2 items-center gap-2 border-t border-border pt-2 first:border-0 first:pt-0 sm:grid-cols-[minmax(0,1fr)_5.5rem_7rem_6rem_2.75rem] sm:border-0 sm:pt-0"
              >
                <input
                  value={line.description}
                  onChange={(event) => setLine(line.key, { description: event.target.value })}
                  aria-label={`Line ${index + 1} description`}
                  placeholder="Fitted wardrobe, 3 doors"
                  maxLength={300}
                  className={clsx(FIELD_BASE, 'col-span-2 sm:col-span-1')}
                />
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={line.quantity}
                  onChange={(event) => setLine(line.key, { quantity: event.target.value })}
                  aria-label={`Line ${index + 1} quantity`}
                  placeholder="Qty"
                  className={clsx(FIELD_BASE, 'tabular')}
                />
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={line.unit_price}
                  onChange={(event) => setLine(line.key, { unit_price: event.target.value })}
                  aria-label={`Line ${index + 1} price`}
                  placeholder="Price"
                  className={clsx(FIELD_BASE, 'tabular')}
                />
                <p className="tabular text-right text-ink sm:col-start-4">{money(linePennies(line) / 100)}</p>
                <button
                  type="button"
                  onClick={() => setLines((current) => current.filter((entry) => entry.key !== line.key))}
                  disabled={lines.length === 1}
                  aria-label={`Remove line ${index + 1}`}
                  className="flex min-h-11 min-w-11 items-center justify-center justify-self-end rounded-control text-ink-muted transition-colors hover:text-danger disabled:opacity-40 disabled:hover:text-ink-muted"
                >
                  <Trash size={16} aria-hidden="true" />
                </button>
              </div>
            ))}
            <div>
              <Button
                type="button"
                variant="secondary"
                icon={<Plus size={16} aria-hidden="true" />}
                onClick={() => setLines((current) => [...current, blankLine()])}
                disabled={lines.length >= 50}
              >
                Add line
              </Button>
            </div>
          </fieldset>
        )}

        {totalsCard}

        {error ? (
          <p role="alert" className="rounded-control border border-danger/30 bg-danger-bg px-3 py-2 text-danger">
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
