import { closestCenter, DndContext, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { DotsSixVertical, PaperPlaneRight, Plus, Receipt, Trash } from '@phosphor-icons/react';
import clsx from 'clsx';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
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
 * and the API's figures replace them once the quote is saved. A line is a cost plus a margin (a % on top
 * of the cost); what the client pays each is worked out from the two, and the API repeats the sum. */
interface Row {
  key: number;
  description: string;
  quantity: string;
  cost: string;
  margin: string;
}
let rowKey = 0;
const blank = (margin = ''): Row => ({ key: ++rowKey, description: '', quantity: '1', cost: '', margin });
const pennies = (value: number) => Math.round(value * 100) || 0;
/** The price each, in pennies, the client pays for a line. */
const sellPence = (row: Row) => Math.round((pennies(Number(row.cost) || 0) * (100 + (Number(row.margin) || 0))) / 100);

function preview(rows: Row[], vatRate: number, discount: number) {
  const subtotal = rows.reduce((total, row) => total + (Number(row.quantity) || 0) * sellPence(row), 0);
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

/** One quote: the studio's own figures, and a tab showing exactly what the client is sent. */
function QuoteBody({ quote }: { quote: Quote }) {
  const [tab, setTab] = useState('studio');
  return (
    <div className="flex flex-col gap-4">
      <Tabs tabs={[{ id: 'studio', label: 'Studio view' }, { id: 'client', label: 'Client view' }]} active={tab} onChange={setTab} />
      <div className="flex flex-wrap items-center gap-2">
        <StatusTag tone={quote.expired ? 'warning' : TONE[quote.status]}>{quote.expired ? 'Expired' : quote.status}</StatusTag>
        {quote.valid_until ? <span className="text-sm text-ink-muted">Valid until {date(quote.valid_until)}</span> : null}
        {quote.responded_at ? <span className="text-sm text-ink-muted">Answered {date(quote.responded_at)}</span> : null}
        {quote.invoice_id ? <span className="text-sm text-ink-muted">Invoice made</span> : null}
      </div>
      {quote.response_comment ? <p className="rounded-control bg-surface-muted px-3 py-2 text-sm text-ink">“{quote.response_comment}”</p> : null}
      {tab === 'client' ? (
        <ClientQuoteView subtotal={quote.subtotal_amount} discount={quote.discount} vatRate={quote.vat_rate} vat={quote.vat_amount} total={quote.amount} notes={quote.notes} />
      ) : (
        <>
          <QuoteLines quote={quote} />
          {quote.notes ? <p className="whitespace-pre-wrap text-sm text-ink-muted">{quote.notes}</p> : null}
        </>
      )}
    </div>
  );
}

/** What the client's portal shows: the installation charges and the totals. Never the lines, costs or margins. Keep in step with apps/portal Quotes.tsx. */
function ClientQuoteView({ subtotal, discount, vatRate, vat, total, notes }: { subtotal: number; discount: number; vatRate: number; vat: number; total: number; notes?: string | null }) {
  return (
    <div className="flex flex-col gap-3 rounded-control border border-dashed border-border p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">What the client sees</p>
      <div className="flex items-baseline justify-between text-sm font-semibold text-ink"><span>Installation charges</span><span className="tabular">{money(subtotal)}</span></div>
      <dl className="flex flex-col gap-1 border-t border-border pt-3 text-sm">
        <div className="flex justify-between"><dt className="text-ink-muted">Subtotal</dt><dd className="tabular">{money(subtotal)}</dd></div>
        {discount > 0 ? <div className="flex justify-between"><dt className="text-ink-muted">Discount</dt><dd className="tabular">−{money(discount)}</dd></div> : null}
        <div className="flex justify-between"><dt className="text-ink-muted">VAT ({vatRate}%)</dt><dd className="tabular">{money(vat)}</dd></div>
        <div className="flex justify-between text-base font-semibold text-ink"><dt>Total</dt><dd className="tabular">{money(total)}</dd></div>
      </dl>
      {notes ? <p className="whitespace-pre-wrap text-sm text-ink-muted">{notes}</p> : null}
    </div>
  );
}

function QuoteLines({ quote }: { quote: Quote }) {
  // Lines made before margins existed have no cost: they count as sold at cost.
  const cost = quote.items.reduce((total, item) => total + item.quantity * (item.cost_price ?? item.unit_price), 0);
  return (
    <div>
      <ul className="divide-y divide-border/60 text-sm">
        {quote.items.map((item) => (
          <li key={item.id} className="flex items-baseline justify-between gap-4 py-2">
            <span className="min-w-0 text-ink">
              {item.description}
              <span className="block text-xs text-ink-muted">
                {item.cost_price !== null ? `Cost ${money(item.cost_price)} + ${item.margin_pct ?? 0}% margin` : item.detail}
              </span>
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
        <div className="flex justify-between border-t border-border pt-2 text-ink-muted"><dt>Profit after discount, before VAT</dt><dd className="tabular font-semibold text-ink">{money(quote.net_amount - cost)}</dd></div>
      </dl>
    </div>
  );
}

/** One draggable, droppable line: the grip (or the up and down keys on it) reorders; every field is labelled. */
function LineRow({ row, index, count, onChange, onRemove, onShift }: { row: Row; index: number; count: number; onChange: (patch: Partial<Row>) => void; onRemove: () => void; onShift: (by: -1 | 1) => void }) {
  const drag = useDraggable({ id: row.key });
  const drop = useDroppable({ id: row.key });
  const field = (label: string, input: ReactNode) => (
    <label className="flex flex-col gap-1 text-xs text-ink-muted">
      {label}
      {input}
    </label>
  );
  return (
    <div
      ref={(node) => {
        drag.setNodeRef(node);
        drop.setNodeRef(node);
      }}
      style={{ transform: drag.transform ? `translate3d(0, ${drag.transform.y}px, 0)` : undefined }}
      className={clsx('relative flex flex-col gap-2 rounded-control border bg-surface p-2', drag.isDragging ? 'z-10 border-green-900 shadow-overlay' : drop.isOver ? 'border-green-900' : 'border-border')}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          {...drag.listeners}
          {...drag.attributes}
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
              event.preventDefault();
              onShift(event.key === 'ArrowUp' ? -1 : 1);
            }
          }}
          aria-label={`Move line ${index + 1} of ${count}: drag, or press the up and down arrow keys`}
          className="flex min-h-11 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-control text-ink-muted hover:text-ink active:cursor-grabbing"
        >
          <DotsSixVertical size={18} aria-hidden="true" />
        </button>
        <input value={row.description} onChange={(event) => onChange({ description: event.target.value })} aria-label={`Line ${index + 1} item`} placeholder="Item" maxLength={300} className={FIELD_BASE} />
        <button type="button" disabled={count === 1} onClick={onRemove} aria-label={`Remove line ${index + 1}`} className="flex min-h-11 min-w-11 items-center justify-center rounded-control text-ink-muted hover:text-danger disabled:opacity-30">
          <Trash size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 pl-10 sm:grid-cols-4">
        {field('Qty', <input type="number" inputMode="numeric" min={1} step={1} value={row.quantity} onChange={(event) => onChange({ quantity: event.target.value.split(/[.,]/)[0]!.replace(/\D/g, '') })} className={clsx(FIELD_BASE, 'tabular')} />)}
        {field('Cost each (£)', <input type="number" inputMode="decimal" min={0} step="0.01" value={row.cost} onChange={(event) => onChange({ cost: event.target.value })} placeholder="0.00" className={clsx(FIELD_BASE, 'tabular')} />)}
        {field('Margin (%)', <input type="number" inputMode="decimal" min={0} max={1000} step="0.01" value={row.margin} onChange={(event) => onChange({ margin: event.target.value })} placeholder="0" className={clsx(FIELD_BASE, 'tabular')} />)}
        {field('Price each (£)', <output className="tabular flex min-h-11 items-center text-sm font-semibold text-ink">{money(sellPence(row) / 100)}</output>)}
      </div>
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
    quote?.items.length
      ? quote.items.map((item) => ({ key: ++rowKey, description: item.description, quantity: String(item.quantity), cost: String(item.cost_price ?? item.unit_price), margin: String(item.margin_pct ?? 0) }))
      : [blank()],
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('edit');
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }));

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
  /** Moves a line to another place in the list (dragged, or by the arrow keys). */
  const moveRow = (from: number, to: number) =>
    setRows((current) => {
      if (to < 0 || to >= current.length) return current;
      const next = [...current];
      next.splice(to, 0, next.splice(from, 1)[0]!);
      return next;
    });
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) moveRow(rows.findIndex((r) => r.key === active.id), rows.findIndex((r) => r.key === over.id));
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!clientId || !projectId) return setError('Choose the client and the project this quote is for.');
    const items = rows
      .filter((row) => row.description.trim())
      .map((row) => ({ description: row.description.trim(), quantity: Number(row.quantity), unit_price: sellPence(row) / 100, cost_price: Number(row.cost) || 0, margin_pct: Number(row.margin) || 0 }));
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
        <Tabs tabs={[{ id: 'edit', label: 'Edit' }, { id: 'preview', label: 'Client preview' }]} active={tab} onChange={setTab} />
        {tab === 'preview' ? (
          <ClientQuoteView subtotal={totals.subtotal} discount={Number(discount) || 0} vatRate={Number(vatRate) || 0} vat={totals.vat} total={totals.gross} notes={notes.trim() || null} />
        ) : null}
        <div className={clsx('flex flex-col gap-4', tab === 'preview' && 'hidden')}>
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
          <p className="text-sm font-semibold text-ink">Lines <span className="font-normal text-ink-muted">(cost and price are before VAT; price = cost + margin)</span></p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            {rows.map((row, index) => (
              <LineRow
                key={row.key}
                row={row}
                index={index}
                count={rows.length}
                onChange={(patch) => set(row.key, patch)}
                onRemove={() => setRows((current) => current.filter((r) => r.key !== row.key))}
                onShift={(by) => moveRow(index, index + by)}
              />
            ))}
          </DndContext>
          <div>
            <Button type="button" variant="secondary" icon={<Plus size={16} aria-hidden="true" />} disabled={rows.length >= 50} onClick={() => setRows((current) => [...current, blank(current.at(-1)?.margin ?? '')])}>
              Add line
            </Button>
          </div>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="VAT %" type="number" inputMode="decimal" min="0" max="100" step="0.01" value={vatRate} onChange={(event) => setVatRate(event.target.value)} />
          <Input label="Discount (£)" type="number" inputMode="decimal" min="0" step="0.01" value={discount} hint="Taken off before VAT." onChange={(event) => setDiscount(event.target.value)} />
        </div>
        <Textarea label="Notes for the client" rows={3} maxLength={4000} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>

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
