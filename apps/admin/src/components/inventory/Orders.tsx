import { Plus, Printer, Trash } from '@phosphor-icons/react';
import { useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';

import { DEFAULT_ISSUER, printWhenReady } from '@/components/invoice/InvoiceSheet';
import { Button, ConfirmDialog, EmptyState, Input, Modal, Select, StatusTag, TableWrap, Td, Textarea, Th, type StatusTone } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { useSort } from '@/hooks/useSort';
import { ApiError, api } from '@/lib/api';
import { date, money } from '@/lib/format';

/* Purchase orders and the shortfall list (apps/api modules/inventory/orders.ts). Remove: this file and its two tabs in pages/Inventory.tsx. */
interface Option {
  id: string;
  sku: string;
  name: string;
  unit: string;
  avg_cost: number;
  active: boolean;
}
interface Supplier {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
}
type Status = 'Draft' | 'Sent' | 'Part-received' | 'Received' | 'Cancelled';
interface OrderRow {
  id: string;
  ref: string;
  status: Status;
  supplier_name: string;
  lines: number;
  gross: number;
  created_at: string;
  expected_at: string | null;
}
interface Order {
  id: string;
  ref: string;
  status: Status;
  supplier_id: string;
  supplier: Supplier | null;
  vat_rate: number;
  expected_at: string | null;
  notes: string | null;
  sent_at: string | null;
  created_at: string;
  items: { id: string; item_id: string; sku: string; name: string; unit: string; size_note: string | null; quantity: number; received: number; unit_cost: number }[];
  totals: { subtotal: number; net: number; vat: number; gross: number };
}
interface Short {
  id: string;
  sku: string;
  name: string;
  unit: string;
  supplier_id: string | null;
  avg_cost: number;
  free: number;
  wanted: number;
  on_order: number;
  reorder_level: number | null;
  suggest: number;
}

const TONE: Record<Status, StatusTone> = { Draft: 'neutral', Sent: 'info', 'Part-received': 'warning', Received: 'success', Cancelled: 'neutral' };
const failed = (caught: unknown) => (caught instanceof ApiError ? caught.message : 'That did not work. Please try again.');

export function OrdersTable({ items, suppliers, newOrder, onNewDone }: { items: Option[]; suppliers: Supplier[]; newOrder: boolean; onNewDone: () => void }) {
  const orders = useQuery<OrderRow[]>('/inventory/orders');
  const [openId, setOpenId] = useState<string | null>(null);
  const { rows, header } = useSort(orders.data ?? [], { ref: (o) => o.ref, supplier: (o) => o.supplier_name, status: (o) => o.status, gross: (o) => o.gross, when: (o) => o.created_at });
  const refetch = () => orders.refetch();

  return (
    <>
      {!orders.data ? null : orders.data.length === 0 ? (
        <EmptyState title="No orders yet" message="Write one here, or turn the To order list into drafts." />
      ) : (
        <TableWrap className="max-md:min-w-0">
          <thead>
            <tr>
              <Th sort={header('ref')}>Order</Th>
              <Th className="max-sm:hidden" sort={header('supplier')}>Supplier</Th>
              <Th sort={header('status')}>Status</Th>
              <Th className="max-sm:hidden" sort={header('when')}>Written</Th>
              <Th className="text-right" sort={header('gross')}>Total</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((order) => (
              <tr key={order.id} onClick={() => setOpenId(order.id)} className="cursor-pointer hover:bg-ink/[0.03]">
                <Td className="font-semibold text-ink">{order.ref}<span className="block text-xs font-normal text-ink-muted sm:hidden">{order.supplier_name}</span></Td>
                <Td className="max-sm:hidden">{order.supplier_name}</Td>
                <Td>
                  <StatusTag tone={TONE[order.status]}>{order.status}</StatusTag>
                </Td>
                <Td className="max-sm:hidden">{date(order.created_at)}</Td>
                <Td className="tabular text-right">{money(order.gross)}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
      {openId ? <OrderPanel id={openId} items={items} suppliers={suppliers} onClose={() => setOpenId(null)} onChanged={refetch} /> : null}
      {newOrder ? (
        <OrderForm
          order={null}
          items={items}
          suppliers={suppliers}
          onClose={onNewDone}
          onSaved={async (saved) => {
            await refetch();
            setOpenId(saved.id);
          }}
        />
      ) : null}
    </>
  );
}

/** One order: what it can do depends on its status. Receiving books stock in at each line's cost. */
function OrderPanel({ id, items, suppliers, onClose, onChanged }: { id: string; items: Option[]; suppliers: Supplier[]; onClose: () => void; onChanged: () => Promise<unknown> }) {
  const toast = useToast();
  const order = useQuery<Order>(`/inventory/orders/${id}`);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [arrived, setArrived] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const o = order.data;

  const act = async (request: () => Promise<Order | void>, done: string) => {
    setBusy(true);
    try {
      const next = await request();
      if (next) order.setData(next);
      toast.success(done);
      await onChanged();
    } catch (caught) {
      toast.error(failed(caught));
    } finally {
      setBusy(false);
    }
  };

  const receive = (event: FormEvent) => {
    event.preventDefault();
    const lines = o!.items.map((line) => ({ line_id: line.id, quantity: Number(arrived[line.id] ?? line.quantity - line.received) })).filter((line) => line.quantity > 0);
    if (!lines.length) return toast.error('Enter what arrived.');
    void act(async () => {
      const next = await api.post<Order>(`/inventory/orders/${id}/receive`, { lines });
      setArrived({});
      return next;
    }, 'Stocked in.');
  };

  const print = async () => {
    setPrinting(true);
    await printWhenReady();
    setPrinting(false);
  };

  if (!o) return null;
  const open = o.status === 'Sent' || o.status === 'Part-received';
  return (
    <Modal
      open
      onClose={onClose}
      title={`${o.ref} · ${o.supplier?.name ?? ''}`}
      description={[o.status, o.sent_at ? `sent ${date(o.sent_at)}` : null, o.expected_at ? `expected ${date(o.expected_at)}` : null].filter(Boolean).join(' · ')}
      width="lg"
      footer={
        <>
          {o.status === 'Draft' ? (
            <>
              <Button variant="ghost" icon={<Trash size={15} aria-hidden="true" />} onClick={() => setDeleting(true)}>
                Delete
              </Button>
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Edit
              </Button>
            </>
          ) : null}
          {o.status === 'Sent' ? (
            <Button variant="ghost" loading={busy} onClick={() => void act(() => api.post<Order>(`/inventory/orders/${id}/draft`), 'Back to Draft.')}>
              Back to Draft
            </Button>
          ) : null}
          {o.status === 'Draft' || o.status === 'Sent' ? (
            <Button variant="ghost" loading={busy} onClick={() => void act(() => api.post<Order>(`/inventory/orders/${id}/cancel`), 'Cancelled.')}>
              Cancel order
            </Button>
          ) : null}
          <Button variant="secondary" icon={<Printer size={15} aria-hidden="true" />} onClick={() => void print()}>
            Print / PDF
          </Button>
          {o.status === 'Draft' ? (
            <Button variant="primary" loading={busy} onClick={() => void act(() => api.post<Order>(`/inventory/orders/${id}/send`), 'Marked as sent. Print it for the supplier.')}>
              Mark as sent
            </Button>
          ) : null}
        </>
      }
    >
      <form onSubmit={receive} className="flex flex-col gap-4">
        <TableWrap className="max-md:min-w-0">
          <thead>
            <tr>
              <Th>Item</Th>
              <Th className="text-right">Ordered</Th>
              <Th className="text-right">In</Th>
              <Th className="text-right max-sm:hidden">Cost each</Th>
              {open ? <Th className="text-right">Arrived now</Th> : null}
            </tr>
          </thead>
          <tbody>
            {o.items.map((line) => (
              <tr key={line.id}>
                <Td>
                  <span className="font-semibold text-ink">{line.sku}</span> {line.name}
                </Td>
                <Td className="tabular text-right">
                  {line.quantity} {line.unit}
                </Td>
                <Td className="tabular text-right">{line.received}</Td>
                <Td className="tabular text-right max-sm:hidden">{money(line.unit_cost)}</Td>
                {open ? (
                  <Td className="text-right">
                    <input
                      aria-label={`Arrived now: ${line.name}`}
                      type="number"
                      min={0}
                      max={line.quantity - line.received}
                      step={1}
                      className="tabular w-20 rounded-control border border-border bg-surface px-2 py-1 text-right"
                      value={arrived[line.id] ?? String(line.quantity - line.received)}
                      onChange={(event) => setArrived({ ...arrived, [line.id]: event.target.value })}
                    />
                  </Td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </TableWrap>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="tabular text-sm text-ink-muted">
            Net {money(o.totals.net)} · VAT {o.vat_rate}% {money(o.totals.vat)} · <span className="font-semibold text-ink">Total {money(o.totals.gross)}</span>
          </p>
          {open ? (
            <Button type="submit" variant="primary" loading={busy}>
              Stock in
            </Button>
          ) : null}
        </div>
        {o.notes ? <p className="whitespace-pre-line text-sm text-ink-muted">{o.notes}</p> : null}
      </form>

      {editing ? (
        <OrderForm
          order={o}
          items={items}
          suppliers={suppliers}
          onClose={() => setEditing(false)}
          onSaved={async (saved) => {
            order.setData(saved);
            await onChanged();
          }}
        />
      ) : null}
      <ConfirmDialog
        open={deleting}
        title={`Delete ${o.ref}?`}
        message="Only a Draft can be deleted."
        confirmLabel="Delete"
        onConfirm={() => void act(() => api.delete(`/inventory/orders/${id}`), 'Deleted.').then(onClose)}
        onCancel={() => setDeleting(false)}
      />
      {printing ? createPortal(<OrderPrint order={o} />, document.body) : null}
    </Modal>
  );
}

/** A Draft is written or rewritten whole; each line's cost starts at the item's average. */
function OrderForm({ order, items, suppliers, onClose, onSaved }: { order: Order | null; items: Option[]; suppliers: Supplier[]; onClose: () => void; onSaved: (saved: Order) => Promise<unknown> }) {
  const toast = useToast();
  const usable = items.filter((item) => item.active);
  const [supplierId, setSupplierId] = useState(order?.supplier_id ?? suppliers[0]?.id ?? '');
  const [vat, setVat] = useState(String(order?.vat_rate ?? 20));
  const [expected, setExpected] = useState(order?.expected_at?.slice(0, 10) ?? '');
  const [notes, setNotes] = useState(order?.notes ?? '');
  const [lines, setLines] = useState(order?.items.map((l) => ({ item_id: l.item_id, quantity: String(l.quantity), unit_cost: String(l.unit_cost) })) ?? [{ item_id: '', quantity: '1', unit_cost: '' }]);
  const [busy, setBusy] = useState(false);
  const setLine = (index: number, patch: Partial<(typeof lines)[number]>) => setLines(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const body = {
      supplier_id: supplierId,
      vat_rate: Number(vat),
      expected_at: expected ? new Date(`${expected}T12:00:00`).toISOString() : null,
      notes: notes.trim() || null,
      items: lines.map((line) => ({ item_id: line.item_id, quantity: Number(line.quantity), unit_cost: Number(line.unit_cost) })),
    };
    try {
      const saved = order ? await api.put<Order>(`/inventory/orders/${order.id}`, body) : await api.post<Order>('/inventory/orders', body);
      toast.success(order ? 'Saved.' : `${saved.ref} written as a Draft.`);
      onClose();
      await onSaved(saved);
    } catch (caught) {
      toast.error(failed(caught));
    } finally {
      setBusy(false);
    }
  };

  if (!suppliers.length) {
    return (
      <Modal open onClose={onClose} title="New order">
        <p className="text-sm text-ink-muted">Add a supplier first, on the Suppliers tab.</p>
      </Modal>
    );
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={order ? `Edit ${order.ref}` : 'New order'}
      width="lg"
      footer={
        <Button type="submit" form="inventory-order" variant="primary" loading={busy}>
          {order ? 'Save' : 'Write draft'}
        </Button>
      }
    >
      <form id="inventory-order" onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Select label="Supplier" value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </Select>
          <Input label="VAT %" type="number" min={0} max={100} step="0.01" required value={vat} onChange={(event) => setVat(event.target.value)} />
          <Input label="Expected" type="date" value={expected} onChange={(event) => setExpected(event.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          {lines.map((line, index) => (
            <div key={index} className="grid grid-cols-[1fr_5rem_7rem_auto] items-end gap-2">
              <Select
                label={index ? '' : 'Item'}
                aria-label="Item"
                required
                value={line.item_id}
                onChange={(event) => {
                  const picked = usable.find((item) => item.id === event.target.value);
                  setLine(index, { item_id: event.target.value, unit_cost: line.unit_cost || String(picked?.avg_cost ?? '') });
                }}
              >
                <option value="">Pick an item</option>
                {usable.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.sku} · {item.name}
                  </option>
                ))}
              </Select>
              <Input label={index ? '' : 'Qty'} aria-label="Quantity" type="number" min={1} step={1} required value={line.quantity} onChange={(event) => setLine(index, { quantity: event.target.value })} />
              <Input label={index ? '' : 'Net cost each (£)'} aria-label="Net cost each" type="number" min={0} step="0.01" required value={line.unit_cost} onChange={(event) => setLine(index, { unit_cost: event.target.value })} />
              <Button variant="ghost" aria-label="Remove line" disabled={lines.length === 1} icon={<Trash size={15} aria-hidden="true" />} onClick={() => setLines(lines.filter((_, i) => i !== index))} />
            </div>
          ))}
          <div>
            <Button variant="ghost" icon={<Plus size={15} aria-hidden="true" />} onClick={() => setLines([...lines, { item_id: '', quantity: '1', unit_cost: '' }])}>
              Add line
            </Button>
          </div>
        </div>
        <Textarea label="Notes for the supplier" maxLength={2000} rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </form>
    </Modal>
  );
}

/** The A4 sheet the printer gets (the invoice print rules in invoice-sheet.css: only .inv-print prints). */
function OrderPrint({ order }: { order: Order }) {
  const issuer = DEFAULT_ISSUER;
  return (
    <div className="inv-print">
      <div className="inv-sheet bg-white p-[16mm] text-[11pt] text-black">
        <div className="mb-8 flex justify-between gap-6">
          <div>
            <p className="text-lg font-bold">{issuer.name}</p>
            {issuer.address.map((line) => (
              <p key={line}>{line}</p>
            ))}
            <p>
              {issuer.phone} · {issuer.email}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">Purchase order</p>
            <p className="font-semibold">{order.ref}</p>
            <p>Date {date(order.sent_at ?? order.created_at)}</p>
            {order.expected_at ? <p>Wanted by {date(order.expected_at)}</p> : null}
          </div>
        </div>
        <div className="mb-6">
          <p className="font-semibold">To</p>
          <p>{order.supplier?.name}</p>
          {[order.supplier?.contact_name, order.supplier?.email, order.supplier?.phone].filter(Boolean).map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-black text-left">
              <th className="py-1">Item</th>
              <th className="py-1 text-right">Qty</th>
              <th className="py-1 text-right">Net each</th>
              <th className="py-1 text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((line) => (
              <tr key={line.id} className="border-b border-neutral-300">
                <td className="py-1">
                  {line.sku} · {line.name}
                  {line.size_note ? <span className="block text-[9pt]">{line.size_note}</span> : null}
                </td>
                <td className="py-1 text-right">
                  {line.quantity} {line.unit}
                </td>
                <td className="py-1 text-right">{money(line.unit_cost)}</td>
                <td className="py-1 text-right">{money(Math.round(line.quantity * line.unit_cost * 100) / 100)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ml-auto mt-4 w-64">
          <p className="flex justify-between">
            <span>Net</span>
            <span>{money(order.totals.net)}</span>
          </p>
          <p className="flex justify-between">
            <span>VAT {order.vat_rate}%</span>
            <span>{money(order.totals.vat)}</span>
          </p>
          <p className="flex justify-between border-t border-black font-bold">
            <span>Total</span>
            <span>{money(order.totals.gross)}</span>
          </p>
        </div>
        {order.notes ? <p className="mt-8 whitespace-pre-line">{order.notes}</p> : null}
      </div>
    </div>
  );
}

/** What to buy, by supplier; each group becomes one Draft order at the items' average cost. */
export function ShortfallList({ suppliers, onOrdered }: { suppliers: Supplier[]; onOrdered: () => void }) {
  const toast = useToast();
  const shortfall = useQuery<Short[]>('/inventory/shortfall');
  const [busy, setBusy] = useState<string | null>(null);
  if (!shortfall.data) return null;
  if (!shortfall.data.length) return <EmptyState title="Nothing to buy" message="Every project need is covered and nothing is under its reorder level, counting what is on order." />;

  const groups = new Map<string, Short[]>();
  for (const row of shortfall.data) groups.set(row.supplier_id ?? '', [...(groups.get(row.supplier_id ?? '') ?? []), row]);
  const draft = async (supplierId: string, rows: Short[]) => {
    setBusy(supplierId);
    try {
      const order = await api.post<Order>('/inventory/orders', { supplier_id: supplierId, items: rows.map((row) => ({ item_id: row.id, quantity: row.suggest, unit_cost: row.avg_cost })) });
      toast.success(`${order.ref} written as a Draft. Check the costs, then mark it as sent.`);
      onOrdered();
    } catch (caught) {
      toast.error(failed(caught));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {[...groups].map(([supplierId, rows]) => (
        <section key={supplierId} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-ink">{suppliers.find((s) => s.id === supplierId)?.name ?? 'No supplier set'}</h2>
            {supplierId ? (
              <Button variant="primary" loading={busy === supplierId} onClick={() => void draft(supplierId, rows)}>
                Draft order
              </Button>
            ) : (
              <span className="text-sm text-ink-muted">Set a supplier on these items to order them.</span>
            )}
          </div>
          <TableWrap className="max-md:min-w-0">
            <thead>
              <tr>
                <Th>Item</Th>
                <Th className="text-right">Projects need</Th>
                <Th className="text-right max-sm:hidden">Free</Th>
                <Th className="text-right max-sm:hidden">On order</Th>
                <Th className="text-right max-md:hidden">Reorder at</Th>
                <Th className="text-right">Buy</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <Td>
                    <span className="font-semibold text-ink">{row.sku}</span> {row.name}
                  </Td>
                  <Td className="tabular text-right">{row.wanted}</Td>
                  <Td className="tabular text-right max-sm:hidden">{row.free}</Td>
                  <Td className="tabular text-right max-sm:hidden">{row.on_order}</Td>
                  <Td className="tabular text-right max-md:hidden">{row.reorder_level ?? '—'}</Td>
                  <Td className="tabular text-right font-semibold">
                    {row.suggest} {row.unit}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </section>
      ))}
    </div>
  );
}
