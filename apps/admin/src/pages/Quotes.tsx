import { ArrowDown, ArrowLeft, ArrowUp, Eye, PaperPlaneRight, Plus, Printer, Receipt, TextHOne, Trash, X } from '@phosphor-icons/react';
import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { InvoicePreview, InvoicePrint, printWhenReady, quoteSheet } from '@/components/invoice/InvoiceSheet';
import { Button, Card, ConfirmDialog, EmptyState, ErrorState, FIELD_BASE, Input, LoadingState, StatusTag, TableWrap, Tabs, Td, Textarea, Th, type StatusTone } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { useSort } from '@/hooks/useSort';
import { ApiError, api } from '@/lib/api';
import { date, money } from '@/lib/format';
import type { Quote, QuoteItem, QuoteStatus } from '@/types/api';

import { DesignsView, LibraryView, PricingView } from './QuoteMaker';

const TONE: Record<QuoteStatus, StatusTone> = { Draft: 'neutral', Sent: 'info', Accepted: 'success', Declined: 'danger' };
const FILTERS = [
  { id: 'all', label: 'All quotes' },
  { id: 'Draft', label: 'Drafts' },
  { id: 'Sent', label: 'Sent' },
  { id: 'Accepted', label: 'Accepted' },
  { id: 'Declined', label: 'Declined' },
];
const TABS = [
  { id: 'designs', label: 'Designs' },
  { id: 'quotes', label: 'Quotes' },
  { id: 'library', label: 'Unit library' },
  { id: 'pricing', label: 'Pricing' },
];

/** Draft, or Declined (the API takes the edit as a fresh draft). */
const editable = (quote: Quote) => quote.status === 'Draft' || quote.status === 'Declined';

/** `/quotes`: Designs, Quotes, Unit library, Pricing. `?view=` filters the quotes; `/quotes/:id` opens one. Admin only. */
export function QuotesPage() {
  const { id } = useParams();
  return id ? <QuoteDetail id={id} /> : <QuotesHome />;
}

function QuotesHome() {
  const [params, setParams] = useSearchParams();
  // A status filter in the address (the dashboard links to ?view=Sent) means the quotes themselves.
  const tab = TABS.some((entry) => entry.id === params.get('tab')) ? params.get('tab')! : params.get('view') ? 'quotes' : 'designs';
  return (
    <div className="px-5 pb-16 pt-6 sm:px-8 lg:pt-8">
      <div className="mb-4">
        <Tabs tabs={TABS} active={tab} onChange={(next) => setParams(next === 'designs' ? {} : { tab: next })} />
      </div>
      {tab === 'quotes' ? <QuoteList /> : tab === 'library' ? <LibraryView /> : tab === 'pricing' ? <PricingView /> : <DesignsView />}
    </div>
  );
}

function QuoteList() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const quotes = useQuery<Quote[]>('/quotes');
  const filter = params.get('view') ?? 'all';
  const shown = useMemo(() => (quotes.data ?? []).filter((quote) => filter === 'all' || quote.status === filter), [quotes.data, filter]);
  const { rows, header } = useSort(shown, {
    number: (q) => q.number,
    client: (q) => q.client_name,
    project: (q) => q.project_name ?? '',
    status: (q) => q.status,
    valid: (q) => q.valid_until ?? '',
    total: (q) => q.amount,
  });
  if (quotes.error && !quotes.data) return <ErrorState message={quotes.error} onRetry={() => void quotes.refetch()} />;
  if (!quotes.data) return <LoadingState label="Loading quotes…" />;

  return (
    <>
      <div className="mb-4">
        <div className="max-sm:hidden">
          <Tabs tabs={FILTERS} active={filter} onChange={(id) => setParams(id === 'all' ? { tab: 'quotes' } : { tab: 'quotes', view: id })} />
        </div>
        <select
          aria-label="Filter quotes"
          value={filter}
          onChange={(event) => setParams(event.target.value === 'all' ? { tab: 'quotes' } : { tab: 'quotes', view: event.target.value })}
          className={`${FIELD_BASE} w-full sm:hidden`}
        >
          {FILTERS.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </select>
      </div>
      {shown.length === 0 ? (
        <EmptyState title="No quotes" message="A quote is made from a design: open a design and choose Make quote. It lands here, ready to check and send." />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th sort={header('number')}>Number</Th>
              <Th col="md" sort={header('client')}>Client</Th>
              <Th col="xl" sort={header('project')}>Project</Th>
              <Th sort={header('status')}>Status</Th>
              <Th col="lg" sort={header('valid')}>Valid until</Th>
              <Th className="text-right" sort={header('total')}>Total</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((quote) => (
              <tr key={quote.id} onClick={() => navigate(`/quotes/${quote.id}`)} className="cursor-pointer hover:bg-ink/[0.03]">
                <Td className="font-semibold text-ink">
                  {quote.number}
                  <span className="block truncate text-xs font-normal text-ink-muted md:hidden">{quote.client_name}</span>
                </Td>
                <Td col="md">{quote.client_name}</Td>
                <Td col="xl">{quote.project_name ?? '—'}</Td>
                <Td>
                  <StatusTag tone={quote.expired ? 'warning' : TONE[quote.status]}>{quote.expired ? 'Expired' : quote.status}</StatusTag>
                </Td>
                <Td col="lg">{quote.valid_until ? date(quote.valid_until) : '—'}</Td>
                <Td className="tabular text-right font-semibold">{money(quote.amount)}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}

/* ---------------------------------------------------------------------------
 * The form works in strings (a half-typed price is allowed) and the sums are a
 * PREVIEW in whole pennies; the API's figures replace them on save. A line is a
 * cost plus a margin (%): the price each is worked out from the two, and the API
 * repeats the sum. Same on-sheet editing as an invoice (InvoiceSheet `editBody`).
 * ------------------------------------------------------------------------- */

type Row =
  | { key: number; kind: 'heading'; text: string }
  | { key: number; kind: 'line'; description: string; detail: string; quantity: string; cost: string; margin: string };
type LineRow = Extract<Row, { kind: 'line' }>;

let rowKey = 0;
const blankLine = (margin = ''): LineRow => ({ key: ++rowKey, kind: 'line', description: '', detail: '', quantity: '1', cost: '', margin });
const blankHeading = (): Row => ({ key: ++rowKey, kind: 'heading', text: '' });
const pennies = (value: number) => Math.round(value * 100) || 0;
/** The price each, in pennies, the client pays for a line. */
const sellPence = (row: LineRow) => Math.round((pennies(Number(row.cost) || 0) * (100 + (Number(row.margin) || 0))) / 100);

/** Stored lines -> editor rows: a heading wherever the section changes. Lines from before margins existed count as sold at cost. */
function toRows(items: QuoteItem[]): Row[] {
  const rows: Row[] = [];
  items.forEach((item, index) => {
    if (item.section && item.section !== items[index - 1]?.section) rows.push({ key: ++rowKey, kind: 'heading', text: item.section });
    rows.push({
      key: ++rowKey,
      kind: 'line',
      description: item.description,
      detail: item.detail ?? '',
      quantity: String(item.quantity),
      cost: String(item.cost_price ?? item.unit_price),
      margin: String(item.margin_pct ?? 0),
    });
  });
  return rows;
}

/** Editor rows -> lines as the API takes them: each line carries the heading above it. */
function toItems(rows: Row[]) {
  let section: string | null = null;
  const items: Array<{ section: string | null; description: string; detail: string | null; quantity: number; unit_price: number; cost_price: number; margin_pct: number }> = [];
  for (const row of rows) {
    if (row.kind === 'heading') section = row.text.trim() || null;
    else {
      items.push({
        section,
        description: row.description.trim(),
        detail: row.detail.trim() || null,
        quantity: Number(row.quantity),
        unit_price: sellPence(row) / 100,
        cost_price: Number(row.cost) || 0,
        margin_pct: Number(row.margin) || 0,
      });
    }
  }
  return items;
}

function totalsOf(items: Array<{ quantity: number; unit_price: number }>, vatRate: number, discount: number) {
  const subtotal = items.reduce((total, item) => total + pennies(item.quantity * item.unit_price), 0);
  const net = subtotal - pennies(discount);
  const vat = Math.round((net * vatRate) / 100);
  return { subtotal: subtotal / 100, net: net / 100, vat: vat / 100, gross: (net + vat) / 100 };
}

/** Inventory items offered on a line's name; picking one fills its name and its average cost (still editable). */
type StockOption = { sku: string; name: string; avg_cost: number; active: boolean };
const stockLabel = (item: StockOption) => `${item.sku} · ${item.name}`;

function QuoteDetail({ id }: { id: string }) {
  const quote = useQuery<Quote>(`/quotes/${encodeURIComponent(id)}`);
  if (quote.error && !quote.data) return <ErrorState message={quote.error} onRetry={() => void quote.refetch()} />;
  if (!quote.data) return <LoadingState label="Opening quote…" />;
  // A status change (sent, withdrawn, answered) starts the form again from what the API now holds.
  return <QuoteEditor key={`${quote.data.id}:${quote.data.status}`} quote={quote.data} onChange={(next) => quote.setData(next)} />;
}

function QuoteEditor({ quote, onChange }: { quote: Quote; onChange: (next: Quote) => void }) {
  const toast = useToast();
  const navigate = useNavigate();
  const canEdit = editable(quote);
  const stock = (useQuery<StockOption[]>('/inventory/items').data ?? []).filter((item) => item.active);

  const [title, setTitle] = useState(quote.title ?? '');
  const [validUntil, setValidUntil] = useState(quote.valid_until?.slice(0, 10) ?? '');
  const [vatRate, setVatRate] = useState(String(quote.vat_rate));
  const [discount, setDiscount] = useState(quote.discount ? String(quote.discount) : '');
  const [notes, setNotes] = useState(quote.notes ?? '');
  const [rows, setRows] = useState<Row[]>(() => (quote.items.length ? toRows(quote.items) : [blankLine()]));
  const [view, setView] = useState('studio');
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const items = toItems(rows);
  const rate = Number(vatRate) || 0;
  const off = Number(discount) || 0;
  const preview = totalsOf(items, rate, off);
  const body = { title: title.trim() || null, notes: notes.trim() || null, valid_until: validUntil || null, vat_rate: rate, discount: off, items };
  const dirty = canEdit && JSON.stringify(body) !== JSON.stringify({ title: quote.title, notes: quote.notes, valid_until: quote.valid_until?.slice(0, 10) ?? null, vat_rate: quote.vat_rate, discount: quote.discount, items: toItems(toRows(quote.items)) });
  const cost = rows.reduce((total, row) => (row.kind === 'line' ? total + (Number(row.quantity) || 0) * pennies(Number(row.cost) || 0) : total), 0) / 100;

  // What the sheet shows: the saved quote with this form's edits laid over it; the client's copy is the same sheet without the fields.
  const live: Quote = canEdit
    ? {
        ...quote,
        title: body.title,
        notes: body.notes,
        valid_until: body.valid_until,
        vat_rate: rate,
        discount: off,
        subtotal_amount: preview.subtotal,
        net_amount: preview.net,
        vat_amount: preview.vat,
        amount: preview.gross,
        items: items.map((item, position) => ({ ...item, id: String(position), quote_id: quote.id, position })),
      }
    : quote;
  const studioSheet = quoteSheet(live);
  const clientSheet = studioSheet;

  const setRow = (key: number, change: Partial<LineRow> | { text: string }) =>
    setRows((current) => current.map((row) => (row.key === key ? ({ ...row, ...change } as Row) : row)));
  const removeRow = (key: number) => setRows((current) => current.filter((row) => row.key !== key));
  const shift = (from: number, by: -1 | 1) =>
    setRows((current) => {
      const to = from + by;
      if (to < 0 || to >= current.length) return current;
      const next = [...current];
      next.splice(to, 0, next.splice(from, 1)[0]!);
      return next;
    });
  /** A new line at the end of the section that `headingKey` starts. */
  const addLineTo = (headingKey: number) =>
    setRows((current) => {
      const start = current.findIndex((row) => row.key === headingKey);
      const nextHeading = current.findIndex((row, index) => index > start && row.kind === 'heading');
      const at = nextHeading === -1 ? current.length : nextHeading;
      const above = current.slice(0, at).reverse().find((row): row is LineRow => row.kind === 'line');
      return [...current.slice(0, at), blankLine(above?.margin ?? ''), ...current.slice(at)];
    });

  /** The item rows as fields on the A4 sheet itself (screen only; the printed sheet is the client's copy). */
  const linesOnSheet = canEdit ? (
    <>
      {rows.map((row, index) => {
        const up = (
          <button type="button" className="inv-edit-btn" disabled={index === 0} onClick={() => shift(index, -1)} aria-label={`Move row ${index + 1} up`}>
            <ArrowUp size={13} aria-hidden="true" />
          </button>
        );
        const down = (
          <button type="button" className="inv-edit-btn" disabled={index === rows.length - 1} onClick={() => shift(index, 1)} aria-label={`Move row ${index + 1} down`}>
            <ArrowDown size={13} aria-hidden="true" />
          </button>
        );
        return row.kind === 'heading' ? (
          <tr key={row.key} className="inv-section">
            <th colSpan={4} scope="rowgroup">
              <div className="inv-edit-cell">
                <input value={row.text} onChange={(event) => setRow(row.key, { text: event.target.value })} aria-label={`Section heading ${index + 1}`} placeholder="Section heading, e.g. Materials" maxLength={120} />
                <button type="button" className="inv-edit-btn" onClick={() => addLineTo(row.key)} aria-label={`Add a line under ${row.text || 'this heading'}`} title="Add a line to this section">
                  <Plus size={14} aria-hidden="true" />
                </button>
                <button type="button" className="inv-edit-btn" onClick={() => removeRow(row.key)} aria-label={`Remove heading ${row.text || index + 1}`}>
                  <Trash size={14} aria-hidden="true" />
                </button>
                {up}
                {down}
              </div>
            </th>
          </tr>
        ) : (
          <tr key={row.key}>
            <td>
              <input
                value={row.description}
                list={stock.length ? 'quote-stock-items' : undefined}
                onChange={(event) => {
                  const picked = stock.find((item) => stockLabel(item) === event.target.value);
                  setRow(row.key, picked ? { description: picked.name, cost: picked.avg_cost.toFixed(2) } : { description: event.target.value });
                }}
                aria-label={`Line ${index + 1} item`}
                placeholder={stock.length ? 'Item, or pick from stock' : 'Item'}
                maxLength={300}
              />
            </td>
            <td>
              <input value={row.detail} onChange={(event) => setRow(row.key, { detail: event.target.value })} aria-label={`Line ${index + 1} description`} placeholder="Description" maxLength={300} />
            </td>
            <td className="inv-right">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={row.quantity}
                // Whole numbers only: the arrows step by 1 and a pasted 2.5 becomes 2.
                onChange={(event) => setRow(row.key, { quantity: event.target.value.split(/[.,]/)[0]!.replace(/\D/g, '') })}
                aria-label={`Line ${index + 1} quantity`}
                placeholder="Qty"
                className="inv-num"
              />
            </td>
            <td>
              <div className="inv-edit-cell">
                <div className="inv-edit-stack">
                  <label className="inv-lbl" title="What one costs you. The client never sees it.">
                    <span>Cost £</span>
                    <input type="number" inputMode="decimal" min={0} step="0.01" value={row.cost} onChange={(event) => setRow(row.key, { cost: event.target.value })} aria-label={`Line ${index + 1} cost each, in pounds`} placeholder="0.00" className="inv-num" />
                  </label>
                  <label className="inv-lbl" title="Added on top of the cost to give the price. The client never sees it.">
                    <span>Margin %</span>
                    <input type="number" inputMode="decimal" min={0} max={1000} step="0.01" value={row.margin} onChange={(event) => setRow(row.key, { margin: event.target.value })} aria-label={`Line ${index + 1} margin, in percent`} placeholder="0" className="inv-num" />
                  </label>
                  <span className="inv-num inv-edit-sum">{money(((Number(row.quantity) || 0) * sellPence(row)) / 100)}</span>
                </div>
                <div className="inv-edit-stack inv-edit-tools">
                  {up}
                  <button type="button" className="inv-edit-btn" onClick={() => removeRow(row.key)} aria-label={`Remove line ${index + 1}`}>
                    <Trash size={14} aria-hidden="true" />
                  </button>
                  {down}
                </div>
              </div>
            </td>
          </tr>
        );
      })}
      <tr className="inv-edit-add">
        <td colSpan={4}>
          <button type="button" className="inv-edit-btn" disabled={items.length >= 50} onClick={() => setRows((current) => [...current, blankLine(items.at(-1)?.margin_pct ? String(items.at(-1)!.margin_pct) : '')])}>
            <Plus size={14} aria-hidden="true" />
            &nbsp;Add line
          </button>
          <button type="button" className="inv-edit-btn" disabled={items.length >= 50} onClick={() => setRows((current) => [...current, blankHeading(), blankLine()])}>
            <TextHOne size={14} aria-hidden="true" />
            &nbsp;Add section
          </button>
        </td>
      </tr>
    </>
  ) : undefined;

  const failure = (caught: unknown) => (caught instanceof ApiError ? caught.fieldMessages[0] ?? caught.message : 'That did not work. Please try again.');

  /** Checks the form, then saves it. Returns the saved quote, or null with the reason shown. */
  const save = async (): Promise<Quote | null> => {
    setError(null);
    const lines = rows.filter((row): row is LineRow => row.kind === 'line');
    const fail = (message: string) => {
      setError(message);
      return null;
    };
    if (lines.length === 0) return fail('Add at least one line.');
    if (lines.some((line) => !line.description.trim())) return fail('Name each line’s item, or remove the empty ones.');
    if (lines.some((line) => !Number.isInteger(Number(line.quantity)) || Number(line.quantity) < 1)) return fail('Each quantity must be a whole number, 1 or more.');
    if (lines.some((line) => !(Number(line.cost || 0) >= 0))) return fail('Costs cannot be negative.');
    if (!(off >= 0)) return fail('The discount cannot be negative.');
    if (preview.net < 0) return fail('The discount cannot be more than the lines add up to.');
    setBusy('save');
    try {
      const saved = await api.put<Quote>(`/quotes/${quote.id}`, body);
      toast.success(`${saved.number} saved.`);
      onChange(saved);
      return saved;
    } catch (caught) {
      setError(failure(caught));
      return null;
    } finally {
      setBusy(null);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void save();
  };

  const act = async (key: string, path: string, done: string) => {
    setBusy(key);
    try {
      onChange(await api.post<Quote>(`/quotes/${quote.id}/${path}`, {}));
      toast.success(done);
    } catch (caught) {
      toast.error(failure(caught));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy('delete');
    try {
      await api.delete(`/quotes/${quote.id}`);
      toast.success('Deleted.');
      navigate('/quotes?tab=quotes');
    } catch (caught) {
      toast.error(failure(caught));
      setBusy(null);
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col px-5 pb-16 sm:px-8 xl:h-full xl:overflow-hidden xl:pb-0">
      <div className="sticky top-0 z-20 -mx-5 mb-5 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-canvas/90 px-5 py-3 backdrop-blur sm:-mx-8 sm:px-8 xl:static xl:mb-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/quotes?tab=quotes"
            aria-label="Back to all quotes"
            title="All quotes"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control border border-border bg-surface text-ink shadow-card hover:bg-secondary-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring/40 pointer-coarse:h-11 pointer-coarse:w-11"
          >
            <ArrowLeft size={16} aria-hidden="true" />
          </Link>
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-xl font-bold tracking-tight text-ink">{quote.number}</h2>
            <StatusTag tone={quote.expired ? 'warning' : TONE[quote.status]}>{quote.expired ? 'Expired' : quote.status}</StatusTag>
            <span className="text-sm text-ink-muted">{quote.client_name}</span>
            {quote.responded_at ? <span className="text-sm text-ink-muted">Answered {date(quote.responded_at)}</span> : null}
            {quote.invoice_id ? <span className="text-sm text-ink-muted">Invoice made</span> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={<Printer size={16} aria-hidden="true" />} onClick={() => void printWhenReady()}>
            Print / Save as PDF
          </Button>
          {canEdit ? (
            <Button variant="secondary" icon={<Trash size={16} aria-hidden="true" />} onClick={() => setDeleting(true)}>
              Delete
            </Button>
          ) : null}
          {quote.status === 'Sent' ? (
            <Button variant="secondary" loading={busy === 'withdraw'} onClick={() => void act('withdraw', 'withdraw', 'Withdrawn. It is a draft again.')}>
              Withdraw
            </Button>
          ) : null}
          {quote.status === 'Accepted' && !quote.invoice_id ? (
            <Button variant="primary" icon={<Receipt size={16} aria-hidden="true" />} loading={busy === 'invoice'} onClick={() => void act('invoice', 'invoice', 'A draft invoice has been made. Find it under Invoices.')}>
              Create invoice
            </Button>
          ) : null}
          {canEdit ? (
            <Button type="submit" form="quote-form" variant={quote.status === 'Draft' ? 'secondary' : 'primary'} loading={busy === 'save'}>
              Save changes
            </Button>
          ) : null}
          {quote.status === 'Draft' ? (
            <Button
              variant="primary"
              icon={<PaperPlaneRight size={16} aria-hidden="true" />}
              loading={busy === 'send'}
              onClick={() => (dirty ? toast.error('Save your changes before sending, so the client gets what you see.') : void act('send', 'send', `Sent to ${quote.client_name}.`))}
            >
              Send to client
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid items-start gap-6 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] xl:grid-rows-[minmax(0,1fr)] xl:items-stretch">
        <form id="quote-form" onSubmit={submit} className="flex flex-col gap-4 xl:min-h-0 xl:overflow-y-auto xl:pb-6 xl:pr-1 [&>*]:shrink-0" noValidate>
          <div className="max-xl:hidden">
            <Tabs tabs={[{ id: 'studio', label: 'Studio sheet' }, { id: 'client', label: 'Client copy' }]} active={view} onChange={setView} />
          </div>
          {!canEdit ? (
            <p className="rounded-control border border-border bg-surface-muted px-3 py-2 text-sm text-ink-muted">
              {quote.status === 'Sent' ? 'This quote is with the client. Withdraw it to edit it.' : 'An accepted quote is final. Create the invoice from it.'}
            </p>
          ) : null}
          {quote.response_comment ? <p className="rounded-control bg-surface-muted px-3 py-2 text-sm text-ink">“{quote.response_comment}”</p> : null}

          <Card className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-ink">Quote</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Client" value={quote.client_name} disabled readOnly />
              <Input label="Project" value={quote.project_name ?? ''} disabled readOnly />
            </div>
            <Input label="Title" value={title} maxLength={200} disabled={!canEdit} placeholder="e.g. Kitchen and utility" onChange={(event) => setTitle(event.target.value)} />
            <Input label="Valid until" type="date" value={validUntil} disabled={!canEdit} min={new Date().toISOString().slice(0, 10)} hint="The last day the client can accept." onChange={(event) => setValidUntil(event.target.value)} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="VAT %" type="number" inputMode="decimal" min="0" max="100" step="0.01" value={vatRate} disabled={!canEdit} onChange={(event) => setVatRate(event.target.value)} />
              <Input label="Discount (£)" type="number" inputMode="decimal" min="0" step="0.01" value={discount} disabled={!canEdit} hint="Taken off before VAT." onChange={(event) => setDiscount(event.target.value)} />
            </div>
            <Textarea label="Notes for the client" rows={3} maxLength={4000} value={notes} disabled={!canEdit} onChange={(event) => setNotes(event.target.value)} />
          </Card>

          {/* Below xl: lines as a plain list; the sheet opens full screen from Preview. */}
          <Card className="flex flex-col gap-4 xl:hidden">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-ink">Lines</h2>
              <Button type="button" variant="secondary" icon={<Eye size={16} aria-hidden="true" />} onClick={() => setPreviewing(true)}>
                Preview
              </Button>
            </div>
            {rows.map((row, index) => (
              <div key={row.key} className="flex flex-col gap-3 rounded-control border border-border p-3">
                {row.kind === 'heading' ? (
                  <Input label="Section heading" value={row.text} maxLength={120} disabled={!canEdit} placeholder="e.g. Materials" onChange={(event) => setRow(row.key, { text: event.target.value })} />
                ) : (
                  <>
                    <Input label="Item" value={row.description} maxLength={300} disabled={!canEdit} onChange={(event) => setRow(row.key, { description: event.target.value })} />
                    <Input label="Description" value={row.detail} maxLength={300} disabled={!canEdit} onChange={(event) => setRow(row.key, { detail: event.target.value })} />
                    <div className="grid grid-cols-3 gap-3">
                      <Input label="Qty" type="number" inputMode="numeric" min={1} step={1} value={row.quantity} disabled={!canEdit} onChange={(event) => setRow(row.key, { quantity: event.target.value.split(/[.,]/)[0]!.replace(/\D/g, '') })} />
                      <Input label="Cost £" type="number" inputMode="decimal" min={0} step="0.01" value={row.cost} disabled={!canEdit} onChange={(event) => setRow(row.key, { cost: event.target.value })} />
                      <Input label="Margin %" type="number" inputMode="decimal" min={0} max={1000} step="0.01" value={row.margin} disabled={!canEdit} onChange={(event) => setRow(row.key, { margin: event.target.value })} />
                    </div>
                    <p className="text-sm text-ink-muted">Line total <span className="tabular font-semibold text-ink">{money(((Number(row.quantity) || 0) * sellPence(row)) / 100)}</span></p>
                  </>
                )}
                {canEdit ? (
                  <div className="flex items-center gap-1">
                    <Button type="button" variant="ghost" icon={<ArrowUp size={16} aria-hidden="true" />} disabled={index === 0} onClick={() => shift(index, -1)} aria-label="Move up" />
                    <Button type="button" variant="ghost" icon={<ArrowDown size={16} aria-hidden="true" />} disabled={index === rows.length - 1} onClick={() => shift(index, 1)} aria-label="Move down" />
                    <Button type="button" variant="ghost" className="ml-auto" icon={<Trash size={16} aria-hidden="true" />} onClick={() => removeRow(row.key)}>Remove</Button>
                  </div>
                ) : null}
              </div>
            ))}
            {canEdit ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" icon={<Plus size={16} aria-hidden="true" />} disabled={items.length >= 50} onClick={() => setRows((current) => [...current, blankLine(items.at(-1)?.margin_pct ? String(items.at(-1)!.margin_pct) : '')])}>Add line</Button>
                <Button type="button" variant="secondary" icon={<TextHOne size={16} aria-hidden="true" />} disabled={items.length >= 50} onClick={() => setRows((current) => [...current, blankHeading(), blankLine()])}>Add section</Button>
              </div>
            ) : null}
          </Card>

          <Card className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-ink">Studio only</h2>
            <dl className="flex flex-col gap-1 text-sm">
              <div className="flex justify-between"><dt className="text-ink-muted">Cost of the lines</dt><dd className="tabular">{money(cost)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-muted">Profit after discount, before VAT</dt><dd className="tabular font-semibold text-ink">{money(live.net_amount - cost)}</dd></div>
            </dl>
            <p className="text-sm text-ink-muted">Cost and margin are never shown to the client, and neither are the lines: they see the installation charges and the totals.</p>
          </Card>

          {error ? (
            <p role="alert" className="rounded-control border border-danger/30 bg-danger-bg px-3 py-2 text-danger">
              {error}
            </p>
          ) : null}
        </form>

        <section aria-label="Quote preview" className="flex min-w-0 flex-col gap-3 max-xl:hidden xl:min-h-0 xl:overflow-y-auto xl:pb-6">
          {view === 'client' ? <InvoicePreview invoice={clientSheet} kind="quote" /> : <InvoicePreview invoice={studioSheet} editBody={linesOnSheet} kind="quote" />}
          {stock.length ? (
            <datalist id="quote-stock-items">
              {stock.map((item) => (
                <option key={item.sku} value={stockLabel(item)} />
              ))}
            </datalist>
          ) : null}
        </section>
      </div>

      {previewing ? (
        <div role="dialog" aria-modal="true" aria-label="Quote preview" className="fixed inset-0 z-[110] flex flex-col bg-canvas xl:hidden">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2">
            <Tabs tabs={[{ id: 'studio', label: 'Studio sheet' }, { id: 'client', label: 'Client copy' }]} active={view} onChange={setView} />
            <Button type="button" variant="secondary" icon={<X size={16} aria-hidden="true" />} onClick={() => setPreviewing(false)}>Close</Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {view === 'client' ? <InvoicePreview invoice={clientSheet} kind="quote" /> : <InvoicePreview invoice={studioSheet} kind="quote" />}
          </div>
        </div>
      ) : null}

      <InvoicePrint invoices={[clientSheet]} kind="quote" />

      <ConfirmDialog
        open={deleting}
        title={`Delete ${quote.number}?`}
        message="It is removed for good."
        confirmLabel="Delete"
        pending={busy === 'delete'}
        onConfirm={() => void remove()}
        onCancel={() => setDeleting(false)}
      />
    </div>
  );
}
