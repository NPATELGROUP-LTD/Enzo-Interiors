import {
  PaperPlaneRight,
  Plus,
  SealCheck,
  Trash,
} from '@phosphor-icons/react';
import { useMemo, useState, type FormEvent } from 'react';

import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  Select,
  StatusTag,
  TableSkeleton,
  TableWrap,
  Td,
  Th,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { date, money, moneyCompact } from '@/lib/format';
import { invoiceTone } from '@/lib/status';
import type { BusinessSettings, Client, Invoice, InvoiceStatus, Project } from '@/types/api';

const FILTERS: Array<'all' | InvoiceStatus> = [
  'all',
  'Draft',
  'Sent',
  'Outstanding',
  'Overdue',
  'Paid',
];

export function InvoicesPage() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const invoices = useQuery<Invoice[]>('/invoices');
  const clients = useQuery<Client[]>('/clients');
  const projects = useQuery<Project[]>('/projects');
  const settings = useQuery<BusinessSettings>('/business-settings');

  const [filter, setFilter] = useState<'all' | InvoiceStatus>('all');
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [markingPaid, setMarkingPaid] = useState<Invoice | null>(null);
  const [markPending, setMarkPending] = useState(false);
  const [deleting, setDeleting] = useState<Invoice | null>(null);

  const vatRate = settings.data?.vat_rate ?? 20;
  const [form, setForm] = useState({
    client_id: '',
    project_id: '',
    net_amount: 0,
    vat_rate: vatRate,
    due_in_days: 30,
    status: 'Draft' as 'Draft' | 'Sent' | 'Outstanding',
  });

  const visible = useMemo(
    () =>
      (invoices.data ?? []).filter((invoice) => {
        if (filter === 'all') return true;
        if (filter === 'Overdue') return invoice.is_overdue || invoice.status === 'Overdue';
        return invoice.status === filter;
      }),
    [invoices.data, filter],
  );

  const totals = useMemo(() => {
    const rows = invoices.data ?? [];
    const sum = (list: Invoice[]) =>
      Math.round(list.reduce((total, invoice) => total + invoice.amount, 0) * 100) / 100;
    return {
      paid: sum(rows.filter((invoice) => invoice.status === 'Paid')),
      outstanding: sum(
        rows.filter((invoice) => invoice.status === 'Outstanding' || invoice.status === 'Overdue'),
      ),
      overdue: sum(rows.filter((invoice) => invoice.is_overdue)),
      draft: rows.filter((invoice) => invoice.status === 'Draft').length,
    };
  }, [invoices.data]);

  /** Live preview: the API stores a gross amount, so build it from net + VAT. */
  const preview = useMemo(() => {
    const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
    const net = round(form.net_amount);
    const vat = round(net * (form.vat_rate / 100));
    return { net, vat, gross: round(net + vat) };
  }, [form.net_amount, form.vat_rate]);

  const clientProjects = (projects.data ?? []).filter(
    (project) => project.client_id === form.client_id,
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!form.client_id) return setFormError('Choose a client.');
    if (preview.gross <= 0) return setFormError('Enter an amount greater than zero.');

    const due = new Date();
    due.setDate(due.getDate() + form.due_in_days);

    setSaving(true);
    try {
      await api.post<Invoice>('/invoices', {
        client_id: form.client_id,
        project_id: form.project_id || null,
        // The API's `amount` column is the gross payable.
        amount: preview.gross,
        vat_rate: form.vat_rate,
        due_date: due.toISOString().slice(0, 10),
        status: form.status,
      });
      toast.success('Invoice created.');
      setCreating(false);
      setForm({
        client_id: '',
        project_id: '',
        net_amount: 0,
        vat_rate: vatRate,
        due_in_days: 30,
        status: 'Draft',
      });
      await invoices.refetch();
    } catch (caught) {
      setFormError(caught instanceof ApiError ? caught.message : 'Could not create this invoice.');
    } finally {
      setSaving(false);
    }
  };

  const send = async (invoice: Invoice) => {
    try {
      await api.put(`/invoices/${invoice.id}`, { status: 'Outstanding' });
      toast.success(`${invoice.number} marked as sent and outstanding.`);
      await invoices.refetch();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not update this invoice.');
    }
  };

  const doMarkPaid = async () => {
    if (!markingPaid) return;
    setMarkPending(true);
    try {
      await api.put(`/invoices/${markingPaid.id}/mark-paid`);
      toast.success(`${markingPaid.number} marked as paid.`);
      setMarkingPaid(null);
      await invoices.refetch();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not mark this invoice paid.');
    } finally {
      setMarkPending(false);
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    try {
      await api.delete(`/invoices/${deleting.id}`);
      toast.success(`${deleting.number} deleted.`);
      setDeleting(null);
      await invoices.refetch();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not delete this invoice.');
      setDeleting(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Payment is taken outside the platform — an invoice becomes Paid only when you mark it so."
        actions={
          isAdmin ? (
            <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setCreating(true)}>
              New invoice
            </Button>
          ) : null
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card accent="success" className="pl-4">
          <p className="label-eyebrow">Paid</p>
          <p className="tabular mt-1.5 text-2xl font-bold text-green-900">
            {moneyCompact(totals.paid)}
          </p>
        </Card>
        <Card accent="warning" className="pl-4">
          <p className="label-eyebrow">Outstanding</p>
          <p className="tabular mt-1.5 text-2xl font-bold text-green-900">
            {moneyCompact(totals.outstanding)}
          </p>
        </Card>
        <Card accent={totals.overdue > 0 ? 'danger' : 'none'} className="pl-4">
          <p className="label-eyebrow">Overdue</p>
          <p className="tabular mt-1.5 text-2xl font-bold text-green-900">
            {moneyCompact(totals.overdue)}
          </p>
        </Card>
        <Card className="pl-4">
          <p className="label-eyebrow">Drafts</p>
          <p className="tabular mt-1.5 text-2xl font-bold text-green-900">{totals.draft}</p>
        </Card>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Filter invoices">
        {FILTERS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setFilter(option)}
            aria-pressed={filter === option}
            className={`min-h-11 rounded-control border px-3 text-sm font-semibold transition-colors duration-[160ms] ${
              filter === option
                ? 'border-transparent bg-green-900 text-on-primary'
                : 'border-transparent bg-ink/[0.06] text-ink-muted hover:bg-ink/[0.1] hover:text-ink'
            }`}
          >
            {option === 'all' ? 'All' : option}
          </button>
        ))}
      </div>

      {invoices.error ? (
        <ErrorState message={invoices.error} onRetry={invoices.refetch} />
      ) : invoices.loading ? (
        <Card className="p-0">
          <TableSkeleton rows={6} columns={6} />
        </Card>
      ) : visible.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            title={invoices.data?.length ? 'No invoices match that filter' : 'No invoices yet'}
            message={
              invoices.data?.length
                ? 'Try a different status filter.'
                : 'Create an invoice directly, or convert an accepted quote from Quotes & Pricing.'
            }
            action={
              invoices.data?.length ? (
                <Button variant="secondary" onClick={() => setFilter('all')}>
                  Show all
                </Button>
              ) : isAdmin ? (
                <Button variant="primary" onClick={() => setCreating(true)}>
                  New invoice
                </Button>
              ) : null
            }
          />
        </Card>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>Number</Th>
              <Th>Client</Th>
              <Th>Project</Th>
              <Th>Status</Th>
              <Th>Due</Th>
              <Th className="text-right">Net</Th>
              <Th className="text-right">Total</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {visible.map((invoice) => (
              <tr key={invoice.id} className="hover:bg-surface-muted/40">
                <Td className="whitespace-nowrap font-medium text-ink">{invoice.number}</Td>
                <Td className="text-ink">{invoice.client_name}</Td>
                <Td className="text-ink-muted">{invoice.project_name ?? '—'}</Td>
                <Td>
                  <StatusTag tone={invoiceTone(invoice.status, invoice.is_overdue)}>
                    {invoice.status}
                  </StatusTag>
                  {invoice.is_overdue && invoice.status !== 'Overdue' ? (
                    <span className="ml-1.5 text-xs text-danger">
                      {invoice.days_overdue}d late
                    </span>
                  ) : null}
                </Td>
                <Td className="whitespace-nowrap text-ink-muted">{date(invoice.due_date)}</Td>
                <Td className="tabular whitespace-nowrap text-right text-ink-muted">
                  {money(invoice.net_amount)}
                </Td>
                <Td className="tabular whitespace-nowrap text-right font-semibold text-ink">
                  {money(invoice.amount)}
                </Td>
                <Td>
                  <div className="flex justify-end gap-1">
                    {isAdmin && invoice.status === 'Draft' ? (
                      <button
                        type="button"
                        onClick={() => void send(invoice)}
                        aria-label={`Mark ${invoice.number} as sent`}
                        title="Mark as sent"
                        className="flex min-h-11 min-w-11 items-center justify-center rounded-control text-ink-muted transition-colors hover:text-green-900"
                      >
                        <PaperPlaneRight size={16} aria-hidden="true" />
                      </button>
                    ) : null}
                    {isAdmin && invoice.status !== 'Paid' && invoice.status !== 'Draft' ? (
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
                    {isAdmin && invoice.status !== 'Paid' ? (
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

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New invoice"
        description="Enter the net amount — VAT and the gross total are calculated for you."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreating(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="invoice-form" variant="primary" loading={saving}>
              Create invoice
            </Button>
          </>
        }
      >
        <form id="invoice-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Select
            label="Client"
            value={form.client_id}
            onChange={(event) =>
              setForm({ ...form, client_id: event.target.value, project_id: '' })
            }
            required
          >
            <option value="">Choose a client…</option>
            {(clients.data ?? []).map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </Select>

          <Select
            label="Project"
            value={form.project_id}
            onChange={(event) => setForm({ ...form, project_id: event.target.value })}
            hint={form.client_id ? undefined : 'Choose a client first.'}
          >
            <option value="">No project</option>
            {clientProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>

          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Net amount (£)"
              type="number"
              min={0}
              step="0.01"
              value={form.net_amount || ''}
              onChange={(event) => setForm({ ...form, net_amount: Number(event.target.value) })}
              required
            />
            <Input
              label="VAT rate (%)"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={form.vat_rate}
              onChange={(event) => setForm({ ...form, vat_rate: Number(event.target.value) })}
            />
            <Input
              label="Terms (days)"
              type="number"
              min={0}
              value={form.due_in_days}
              onChange={(event) => setForm({ ...form, due_in_days: Number(event.target.value) })}
            />
          </div>

          <Select
            label="Initial status"
            value={form.status}
            onChange={(event) =>
              setForm({ ...form, status: event.target.value as 'Draft' | 'Sent' | 'Outstanding' })
            }
            hint="Paid can only be set later, via the manual mark-paid action."
          >
            <option value="Draft">Draft</option>
            <option value="Sent">Sent</option>
            <option value="Outstanding">Outstanding</option>
          </Select>

          <Card accent="primary" className="pl-5">
            <p className="label-eyebrow">Preview</p>
            <dl className="mt-2 flex flex-col gap-1.5">
              <div className="flex justify-between">
                <dt className="text-ink-muted">Net</dt>
                <dd className="tabular font-medium text-ink">{money(preview.net)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">VAT at {form.vat_rate}%</dt>
                <dd className="tabular font-medium text-ink">{money(preview.vat)}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-1.5">
                <dt className="font-semibold text-ink">Total payable</dt>
                <dd className="tabular text-lg font-bold text-green-900">{money(preview.gross)}</dd>
              </div>
            </dl>
          </Card>

          {formError ? (
            <p role="alert" className="rounded-control border border-danger/30 bg-danger-bg px-3 py-2 text-danger">
              {formError}
            </p>
          ) : null}
        </form>
      </Modal>

      <ConfirmDialog
        open={markingPaid !== null}
        title={`Mark ${markingPaid?.number ?? 'invoice'} as paid?`}
        message={
          <>
            <p>
              Record that {markingPaid ? money(markingPaid.amount) : 'this amount'} has been
              received from {markingPaid?.client_name}.
            </p>
            <p className="mt-2 text-ink-muted">
              Only do this once the money has actually arrived — there is no payment gateway, so
              this is the sole record of payment. It also updates the client’s lifetime value.
            </p>
          </>
        }
        confirmLabel="Mark as paid"
        pending={markPending}
        onConfirm={doMarkPaid}
        onCancel={() => setMarkingPaid(null)}
      />

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.number ?? 'invoice'}?`}
        message="If this invoice came from a quote, that quote is released so it can be converted again."
        confirmLabel="Delete invoice"
        onConfirm={doDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
