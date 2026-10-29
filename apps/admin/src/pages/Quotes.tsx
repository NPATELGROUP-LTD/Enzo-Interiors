import { PaperPlaneRight, Plus, Receipt, Trash } from '@phosphor-icons/react';
import clsx from 'clsx';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FIELD_BASE,
  Input,
  LoadingState,
  Modal,
  Select,
  StatusTag,
  TableWrap,
  Tabs,
  Td,
  Textarea,
  Th,
  type StatusTone,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { useSort } from '@/hooks/useSort';
import { ApiError, api } from '@/lib/api';
import { date, money } from '@/lib/format';
import type { Client, Project, Quote, QuoteStatus } from '@/types/api';

const TONE: Record<QuoteStatus, StatusTone> = { Draft: 'neutral', Sent: 'info', Accepted: 'success', Declined: 'danger' };
const FILTERS = [
  { id: 'all', label: 'All quotes' },
  { id: 'Draft', label: 'Drafts' },
  { id: 'Sent', label: 'Sent' },
  { id: 'Accepted', label: 'Accepted' },
  { id: 'Declined', label: 'Declined' },
];

/* The form works in strings so a half-typed price is allowed; the sums are a PREVIEW in whole pennies,
 * and the API's figures replace them once the quote is saved. */
interface Row {
  key: number;
  description: string;
  quantity: string;
  unit_price: string;
}
let rowKey = 0;
const blank = (): Row => ({ key: ++rowKey, description: '', quantity: '1', unit_price: '' });
const pennies = (value: number) => Math.round(value * 100) || 0;

function preview(rows: Row[], vatRate: number, discount: number) {
  const subtotal = rows.reduce((total, row) => total + pennies((Number(row.quantity) || 0) * (Number(row.unit_price) || 0)), 0);
  const net = subtotal - pennies(discount);
  const vat = Math.round((net * vatRate) / 100);
  return { subtotal: subtotal / 100, net: net / 100, vat: vat / 100, gross: (net + vat) / 100 };
}

/** Every quote, and one open at a time (`/quotes/:id`); `?new=1&project=` starts one for a project. Admin only. */
export function QuotesPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { id: openId } = useParams();
  const [params, setParams] = useSearchParams();
  const quotes = useQuery<Quote[]>('/quotes');
  const clients = useQuery<Client[]>('/clients');
  const projects = useQuery<Project[]>('/projects');
  const filter = params.get('view') ?? 'all';
  const creating = params.get('new') === '1';
  const [editing, setEditing] = useState<Quote | null>(null);
  const [deleting, setDeleting] = useState<Quote | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const shown = useMemo(() => (quotes.data ?? []).filter((quote) => filter === 'all' || quote.status === filter), [quotes.data, filter]);
  const { rows, header } = useSort(shown, {
    number: (q) => q.number,
    client: (q) => q.client_name,
    project: (q) => q.project_name ?? '',
    status: (q) => q.status,
    valid: (q) => q.valid_until ?? '',
    total: (q) => q.amount,
  });
  const opened = openId ? (quotes.data ?? []).find((quote) => quote.id === openId) : undefined;

  const run = async (key: string, request: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try {
      await request();
      toast.success(done);
      await quotes.refetch();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'That did not work. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  if (quotes.error && !quotes.data) return <ErrorState message={quotes.error} onRetry={() => void quotes.refetch()} />;
  if (!quotes.data) return <LoadingState label="Loading quotes…" />;

  return (
    <div className="px-5 pb-16 pt-6 sm:px-8 lg:pt-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs tabs={FILTERS} active={filter} onChange={(id) => setParams(id === 'all' ? {} : { view: id })} />
        <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setParams({ new: '1' })}>
          New quote
        </Button>
      </div>

      {shown.length === 0 ? (
        <EmptyState title="No quotes" message="Write a quote for a project and send it to the client. They accept or decline in the portal." />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th sort={header('number')}>Number</Th>
              <Th className="max-sm:hidden" sort={header('client')}>Client</Th>
              <Th className="max-sm:hidden" sort={header('project')}>Project</Th>
              <Th sort={header('status')}>Status</Th>
              <Th className="max-sm:hidden" sort={header('valid')}>Valid until</Th>
              <Th className="text-right" sort={header('total')}>Total</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((quote) => (
              <tr key={quote.id} onClick={() => navigate(`/quotes/${quote.id}`)} className="cursor-pointer hover:bg-ink/[0.03]">
                <Td className="font-semibold text-ink">{quote.number}</Td>
                <Td className="max-sm:hidden">{quote.client_name}</Td>
                <Td className="max-sm:hidden">{quote.project_name ?? '—'}</Td>
                <Td>
                  <StatusTag tone={quote.expired ? 'warning' : TONE[quote.status]}>{quote.expired ? 'Expired' : quote.status}</StatusTag>
                </Td>
                <Td className="max-sm:hidden">{quote.valid_until ? date(quote.valid_until) : '—'}</Td>
                <Td className="tabular text-right font-semibold">{money(quote.amount)}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}

      {creating || editing ? (
        <QuoteEditor
          quote={editing}
          clients={clients.data ?? []}
          projects={projects.data ?? []}
          presetProject={params.get('project')}
          onClose={() => {
            setEditing(null);
            if (creating) setParams({});
          }}
          onSaved={async (saved) => {
            setEditing(null);
            setParams({});
            await quotes.refetch();
            navigate(`/quotes/${saved.id}`);
          }}
        />
      ) : null}

      <Modal
        open={Boolean(opened) && !editing}
        onClose={() => navigate('/quotes')}
        title={opened ? `${opened.number}${opened.title ? ` · ${opened.title}` : ''}` : ''}
        description={opened ? `${opened.client_name} · ${opened.project_name ?? 'Project'}` : undefined}
        width="lg"
        footer={
          opened ? (
            <>
              {opened.status === 'Draft' || opened.status === 'Declined' ? (
                <>
                  <Button variant="ghost" icon={<Trash size={15} aria-hidden="true" />} onClick={() => setDeleting(opened)}>
                    Delete
                  </Button>
                  <Button variant="secondary" onClick={() => setEditing(opened)}>
                    Edit
                  </Button>
                </>
              ) : null}
              {opened.status === 'Draft' ? (
                <Button
                  variant="primary"
                  icon={<PaperPlaneRight size={15} aria-hidden="true" />}
                  loading={busy === 'send'}
                  onClick={() => void run('send', () => api.post(`/quotes/${opened.id}/send`, {}), `Sent to ${opened.client_name}.`)}
                >
                  Send to client
                </Button>
              ) : null}
              {opened.status === 'Sent' ? (
                <Button variant="secondary" loading={busy === 'withdraw'} onClick={() => void run('withdraw', () => api.post(`/quotes/${opened.id}/withdraw`, {}), 'Withdrawn. It is a draft again.')}>
                  Withdraw
                </Button>
              ) : null}
              {opened.status === 'Accepted' && !opened.invoice_id ? (
                <Button variant="primary" icon={<Receipt size={15} aria-hidden="true" />} loading={busy === 'invoice'} onClick={() => void run('invoice', () => api.post(`/quotes/${opened.id}/invoice`, {}), 'A draft invoice has been made. Find it under Invoices.')}>
                  Create invoice
                </Button>
              ) : null}
            </>
          ) : null
        }
      >
        {opened ? <QuoteBody quote={opened} /> : null}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.number ?? 'quote'}?`}
        message="It is removed for good."
        confirmLabel="Delete"
        pending={busy === 'delete'}
        onConfirm={async () => {
          if (!deleting) return;
          await run('delete', () => api.delete(`/quotes/${deleting.id}`), 'Deleted.');
          setDeleting(null);
          navigate('/quotes');
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

/** One quote as the client sees it, plus their answer. */
function QuoteBody({ quote }: { quote: Quote }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusTag tone={quote.expired ? 'warning' : TONE[quote.status]}>{quote.expired ? 'Expired' : quote.status}</StatusTag>
        {quote.valid_until ? <span className="text-sm text-ink-muted">Valid until {date(quote.valid_until)}</span> : null}
        {quote.responded_at ? <span className="text-sm text-ink-muted">Answered {date(quote.responded_at)}</span> : null}
        {quote.invoice_id ? <span className="text-sm text-ink-muted">Invoice made</span> : null}
      </div>
      {quote.response_comment ? <p className="rounded-control bg-surface-muted px-3 py-2 text-sm text-ink">“{quote.response_comment}”</p> : null}
      <QuoteLines quote={quote} />
      {quote.notes ? <p className="whitespace-pre-wrap text-sm text-ink-muted">{quote.notes}</p> : null}
    </div>
  );
}

export function QuoteLines({ quote }: { quote: Quote }) {
  return (
    <div>
      <ul className="divide-y divide-border/60 text-sm">
        {quote.items.map((item) => (
          <li key={item.id} className="flex items-baseline justify-between gap-4 py-2">
            <span className="min-w-0 text-ink">
              {item.description}
              {item.detail ? <span className="block text-xs text-ink-muted">{item.detail}</span> : null}
            </span>
            <span className="tabular shrink-0 text-ink-muted">
              {item.quantity} × {money(item.unit_price)} = <span className="font-semibold text-ink">{money(item.quantity * item.unit_price)}</span>
            </span>
          </li>
        ))}
      </ul>
      <dl className="mt-3 flex flex-col gap-1 border-t border-border pt-3 text-sm">
        <div className="flex justify-between"><dt className="text-ink-muted">Subtotal</dt><dd className="tabular">{money(quote.subtotal_amount)}</dd></div>
        {quote.discount > 0 ? <div className="flex justify-between"><dt className="text-ink-muted">Discount</dt><dd className="tabular">−{money(quote.discount)}</dd></div> : null}
        <div className="flex justify-between"><dt className="text-ink-muted">VAT ({quote.vat_rate}%)</dt><dd className="tabular">{money(quote.vat_amount)}</dd></div>
        <div className="flex justify-between text-base font-semibold text-ink"><dt>Total</dt><dd className="tabular">{money(quote.amount)}</dd></div>
      </dl>
    </div>
  );
}

function QuoteEditor({
  quote,
  clients,
  projects,
  presetProject,
  onClose,
  onSaved,
}: {
  quote: Quote | null;
  clients: Client[];
  projects: Project[];
  presetProject: string | null;
  onClose: () => void;
  onSaved: (saved: Quote) => void | Promise<void>;
}) {
  const preset = projects.find((project) => project.id === presetProject);
  const [clientId, setClientId] = useState(quote?.client_id ?? preset?.client_id ?? '');
  const [projectId, setProjectId] = useState(quote?.project_id ?? preset?.id ?? '');
  const [title, setTitle] = useState(quote?.title ?? '');
  const [validUntil, setValidUntil] = useState(quote?.valid_until?.slice(0, 10) ?? '');
  const [vatRate, setVatRate] = useState(String(quote?.vat_rate ?? 20));
  const [discount, setDiscount] = useState(quote?.discount ? String(quote.discount) : '');
  const [notes, setNotes] = useState(quote?.notes ?? '');
  const [rows, setRows] = useState<Row[]>(() =>
    quote?.items.length ? quote.items.map((item) => ({ key: ++rowKey, description: item.description, quantity: String(item.quantity), unit_price: String(item.unit_price) })) : [blank()],
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // A project on the way in (from its page) fills the client once the lists have loaded.
  useEffect(() => {
    if (preset && !clientId) {
      setClientId(preset.client_id);
      setProjectId(preset.id);
    }
  }, [preset, clientId]);

  const own = projects.filter((project) => project.client_id === clientId);
  const totals = preview(rows, Number(vatRate) || 0, Number(discount) || 0);
  const set = (key: number, patch: Partial<Row>) => setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!clientId || !projectId) return setError('Choose the client and the project this quote is for.');
    const items = rows.filter((row) => row.description.trim()).map((row) => ({ description: row.description.trim(), quantity: Number(row.quantity), unit_price: Number(row.unit_price) || 0 }));
    if (items.length === 0) return setError('Add at least one line.');
    const body = { title: title.trim() || null, notes: notes.trim() || null, valid_until: validUntil || null, vat_rate: Number(vatRate) || 0, discount: Number(discount) || 0, items };
    setSaving(true);
    try {
      const saved = quote ? await api.put<Quote>(`/quotes/${quote.id}`, body) : await api.post<Quote>('/quotes', { ...body, client_id: clientId, project_id: projectId });
      await onSaved(saved);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.fieldMessages[0] ?? caught.message : 'Could not save the quote.');
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={quote ? `Edit ${quote.number}` : 'New quote'} width="lg">
      <form onSubmit={save} className="flex flex-col gap-4" noValidate>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="Client" value={clientId} disabled={Boolean(quote)} onChange={(event) => { setClientId(event.target.value); setProjectId(''); }}>
            <option value="">Choose a client…</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </Select>
          <Select label="Project" value={projectId} disabled={Boolean(quote) || !clientId} onChange={(event) => setProjectId(event.target.value)}>
            <option value="">{clientId ? (own.length ? 'Choose a project…' : 'This client has no project') : 'Choose a client first'}</option>
            {own.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </Select>
          <Input label="Title" value={title} maxLength={200} placeholder="e.g. Kitchen and utility" onChange={(event) => setTitle(event.target.value)} />
          <Input label="Valid until" type="date" value={validUntil} min={new Date().toISOString().slice(0, 10)} hint="The last day the client can accept." onChange={(event) => setValidUntil(event.target.value)} />
        </div>

        <Card className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-ink">Lines <span className="font-normal text-ink-muted">(prices are before VAT)</span></p>
          {rows.map((row, index) => (
            <div key={row.key} className="grid grid-cols-[minmax(0,1fr)_4.5rem_6.5rem_2.75rem] items-center gap-2">
              <input value={row.description} onChange={(event) => set(row.key, { description: event.target.value })} aria-label={`Line ${index + 1} item`} placeholder="Item" maxLength={300} className={FIELD_BASE} />
              <input
                type="number" inputMode="numeric" min={1} step={1} value={row.quantity}
                onChange={(event) => set(row.key, { quantity: event.target.value.split(/[.,]/)[0]!.replace(/\D/g, '') })}
                aria-label={`Line ${index + 1} quantity`} placeholder="Qty" className={clsx(FIELD_BASE, 'tabular')}
              />
              <input type="number" inputMode="decimal" min={0} step="0.01" value={row.unit_price} onChange={(event) => set(row.key, { unit_price: event.target.value })} aria-label={`Line ${index + 1} price each, in pounds`} placeholder="£ each" className={clsx(FIELD_BASE, 'tabular')} />
              <button type="button" disabled={rows.length === 1} onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))} aria-label={`Remove line ${index + 1}`} className="flex min-h-11 min-w-11 items-center justify-center rounded-control text-ink-muted hover:text-danger disabled:opacity-30">
                <Trash size={16} aria-hidden="true" />
              </button>
            </div>
          ))}
          <div>
            <Button type="button" variant="secondary" icon={<Plus size={16} aria-hidden="true" />} disabled={rows.length >= 50} onClick={() => setRows((current) => [...current, blank()])}>
              Add line
            </Button>
          </div>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="VAT %" type="number" inputMode="decimal" min="0" max="100" step="0.01" value={vatRate} onChange={(event) => setVatRate(event.target.value)} />
          <Input label="Discount (£)" type="number" inputMode="decimal" min="0" step="0.01" value={discount} hint="Taken off before VAT." onChange={(event) => setDiscount(event.target.value)} />
        </div>
        <Textarea label="Notes for the client" rows={3} maxLength={4000} value={notes} onChange={(event) => setNotes(event.target.value)} />

        <p className="tabular text-right text-sm text-ink-muted">
          Subtotal {money(totals.subtotal)} · VAT {money(totals.vat)} · <span className="text-base font-semibold text-ink">Total {money(totals.gross)}</span>
        </p>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving}>Save quote</Button>
        </div>
      </form>
    </Modal>
  );
}
