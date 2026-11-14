import { MagnifyingGlass, Plus, Trash } from '@phosphor-icons/react';
import { useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Button, ConfirmDialog, EmptyState, ErrorState, Input, Listbox, Modal, PageHeader, Select, StatusTag, TableSkeleton, TableWrap, Tabs, Td, Textarea, Th } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { OrdersTable, ShortfallList } from '@/components/inventory/Orders';
import { SpecsFields, specsBody, specsError, specsForm, type Specs } from '@/components/inventory/Specs';
import type { MediaAsset } from '@/types/cms';
import { useSort } from '@/hooks/useSort';
import { ApiError, api } from '@/lib/api';
import { date, money } from '@/lib/format';

/* Inventory (Admin only), apps/api modules/inventory. Its types live here so removing the feature is this file plus its route and menu entries. */
const TYPES = ['Sheet', 'Hardware', 'Bought-in'] as const;
interface Item extends Specs {
  id: string;
  sku: string;
  name: string;
  type: (typeof TYPES)[number];
  category: string | null;
  unit: string;
  size_note: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  on_hand: number;
  /** Reserved for projects; available = on_hand - reserved. */
  reserved: number;
  available: number;
  /** Ordered from a supplier (Sent or Part-received) and not in yet. */
  on_order: number;
  avg_cost: number;
  /** What the quote maker prices it at; null = avg_cost. */
  quote_cost: number | null;
  reorder_level: number | null;
  active: boolean;
  low: boolean;
}
interface Supplier {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  lead_days: number | null;
  notes: string | null;
}
interface Movement {
  id: string;
  kind: 'receive' | 'issue' | 'return' | 'adjust';
  quantity: number;
  unit_cost: number;
  reason: string | null;
  by_name: string;
  created_at: string;
}

const TABS = [
  { id: 'items', label: 'Items' },
  { id: 'to-order', label: 'To order' },
  { id: 'orders', label: 'Orders' },
  { id: 'suppliers', label: 'Suppliers' },
];
type Show = 'active' | 'low' | 'archived';
const KIND_LABEL = { receive: 'Stock in', issue: 'Used on job', return: 'Returned', adjust: 'Count corrected' } as const;
const failed = (caught: unknown) => (caught instanceof ApiError ? caught.message : 'That did not work. Please try again.');
/** '' -> null and numbers from text inputs, so the form can stay in strings. */
const orNull = (value: string) => value.trim() || null;
const intOrNull = (value: string) => (value.trim() === '' ? null : Number(value));

/**
 * Stock for the whole business: `?view=to-order|orders|suppliers`, `?show=low|archived` on Items,
 * `?new=1` adds an item (or a supplier / order on that tab). The old `?view=low|off|shortfall`
 * still work: the low-stock alert links to `?view=low`.
 */
export function InventoryPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('view');
  const view = raw === 'low' || raw === 'off' ? 'items' : raw === 'shortfall' ? 'to-order' : (TABS.find((tab) => tab.id === raw)?.id ?? 'items');
  const asked = raw === 'low' ? 'low' : raw === 'off' ? 'archived' : params.get('show');
  const show: Show = asked === 'low' || asked === 'archived' ? asked : 'active';
  const items = useQuery<Item[]>('/inventory/items');
  const suppliers = useQuery<Supplier[]>('/inventory/suppliers');
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Item | Supplier | 'new' | null>(params.get('new') === '1' ? 'new' : null);
  const [search, setSearch] = useState('');

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (items.data ?? []).filter((item) => {
      if (show === 'archived' ? item.active : !item.active || (show === 'low' && !item.low)) return false;
      return !term || [item.name, item.sku, item.category ?? '', item.supplier_name ?? ''].some((value) => value.toLowerCase().includes(term));
    });
  }, [items.data, show, search]);
  const { rows, header } = useSort(shown, {
    sku: (i) => i.sku,
    name: (i) => i.name,
    type: (i) => i.type,
    supplier: (i) => i.supplier_name ?? '',
    on_hand: (i) => i.on_hand,
    cost: (i) => i.avg_cost,
    value: (i) => i.on_hand * i.avg_cost,
  });
  const lowCount = (items.data ?? []).filter((item) => item.active && item.low).length;
  const value = (items.data ?? []).reduce((total, item) => total + item.on_hand * item.avg_cost, 0);
  const opened = items.data?.find((item) => item.id === openId) ?? null;
  const onItems = view === 'items';
  const onSuppliers = view === 'suppliers';
  const onOrders = view === 'orders' || view === 'to-order';
  const refetch = () => Promise.all([items.refetch(), suppliers.refetch()]);
  const toView = (id: string) => setParams(id === 'items' ? {} : { view: id });
  const close = () => {
    setEditing(null);
    if (params.get('new')) toView(view);
  };

  const query = onSuppliers ? suppliers : items;
  const waiting = !query.data || (view === 'orders' && !suppliers.data);
  // The search box and buttons stand as tall as the tabs (a touch screen makes the tab pill taller).
  const tall = 'pointer-coarse:min-h-12';

  return (
    <div className="flex h-full flex-col px-5 pb-5 pt-3 sm:px-8">
      {/* The shell's section name is not needed here; an empty heading keeps it from showing. */}
      <PageHeader title="" />

      <div className="mb-4 flex shrink-0 flex-wrap items-center gap-3">
        <div className="[&>div]:mb-0">
          <Tabs tabs={TABS} active={view} onChange={toView} />
        </div>
        <div className="relative min-w-0 basis-full sm:flex-1 sm:basis-0">
          {onItems ? (
            <div className="relative mx-auto w-full sm:max-w-sm">
              <MagnifyingGlass size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search items"
                aria-label="Search items"
                className={`min-h-11 w-full rounded-control border border-border bg-surface pl-9 pr-3 text-ink placeholder:text-ink-muted/70 focus:border-green-900 pointer-fine:min-h-9 ${tall}`}
              />
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 max-sm:w-full">
          {onItems ? (
            <div className="w-40 max-sm:flex-1"><Listbox aria-label="Show" value={show} onChange={(event) => setParams(event.target.value === 'active' ? {} : { show: event.target.value })}>
              <option value="active">In use</option>
              <option value="low">Low stock ({lowCount})</option>
              <option value="archived">Archived</option>
            </Listbox></div>
          ) : null}
          {view === 'to-order' ? null : (
            <Button
              variant="primary"
              className={tall}
              icon={<Plus size={16} aria-hidden="true" />}
              onClick={() => (view === 'orders' ? setParams({ view, new: '1' }) : setEditing('new'))}
            >
              {onSuppliers ? 'New supplier' : view === 'orders' ? 'New order' : 'New item'}
            </Button>
          )}
        </div>
      </div>

      {query.error && !query.data ? (
        <ErrorState message={query.error} onRetry={() => void query.refetch()} />
      ) : waiting ? (
        <TableSkeleton rows={6} columns={4} />
      ) : onItems ? (
        shown.length === 0 ? (
          <EmptyState
            title={show === 'low' ? 'Nothing is low' : show === 'archived' ? 'Nothing archived' : search ? 'No matching items' : 'No items yet'}
            message={
              show === 'active' && !search
                ? 'Add the boards, fittings and bought-in items you keep, then book stock in as it arrives.'
                : search
                  ? 'Try a different name or code.'
                  : 'Items show here when they are.'
            }
          />
        ) : (
          <>
            <TableWrap className="max-md:min-w-0" wrapClassName="min-h-0 overflow-y-auto">
              <thead>
                <tr>
                  <Th sort={header('sku')}>Code</Th>
                  <Th sort={header('name')}>Name</Th>
                  <Th col="lg" sort={header('type')}>Type</Th>
                  <Th col="xl" sort={header('supplier')}>Supplier</Th>
                  <Th className="text-right" sort={header('on_hand')}>In stock</Th>
                  <Th col="md" className="text-right" sort={header('cost')}>Avg cost</Th>
                  <Th col="lg" className="text-right" sort={header('value')}>Value</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id} onClick={() => setOpenId(item.id)} className="cursor-pointer hover:bg-surface-muted/40">
                    <Td className="font-semibold text-ink">{item.sku}</Td>
                    <Td className="[overflow-wrap:anywhere]">
                      <button type="button" className="text-link text-left" onClick={(event) => { event.stopPropagation(); setOpenId(item.id); }}>
                        {item.name}
                      </button>
                    </Td>
                    <Td col="lg">{item.type}</Td>
                    <Td col="xl">{item.supplier_name ?? '—'}</Td>
                    <Td className="tabular text-right">
                      <span className="inline-flex items-center gap-2">
                        {item.low && item.active ? <StatusTag tone="warning">Low</StatusTag> : null}
                        <span className="font-semibold">{item.on_hand}</span> {item.unit}
                      </span>
                      {item.reserved ? <span className="block text-xs text-ink-muted">{item.reserved} reserved · {item.available} free</span> : null}
                      {item.on_order ? <span className="block text-xs text-ink-muted">{item.on_order} on order</span> : null}
                    </Td>
                    <Td col="md" className="tabular text-right">{money(item.avg_cost)}</Td>
                    <Td col="lg" className="tabular text-right">{money(item.on_hand * item.avg_cost)}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            <div className="mt-3 flex shrink-0 flex-wrap items-end justify-between gap-3">
              <span className="tabular text-sm text-ink-muted">Stock value {money(value)}</span>
              <ReserveStage />
            </div>
          </>
        )
      ) : (
        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-1">
          {view === 'orders' ? (
            <OrdersTable items={items.data ?? []} suppliers={suppliers.data ?? []} newOrder={params.get('new') === '1'} onNewDone={() => setParams({ view })} />
          ) : view === 'to-order' ? (
            <ShortfallList suppliers={suppliers.data ?? []} onOrdered={() => setParams({ view: 'orders' })} />
          ) : (
            <SupplierTable suppliers={suppliers.data ?? []} onOpen={setEditing} />
          )}
        </div>
      )}

      {opened ? <ItemPanel item={opened} onClose={() => setOpenId(null)} onEdit={() => setEditing(opened)} onChanged={refetch} /> : null}
      {editing && !onOrders && (onSuppliers ? editing === 'new' || !('sku' in editing) : editing === 'new' || 'sku' in editing) ? (
        onSuppliers ? (
          <SupplierForm supplier={editing === 'new' ? null : (editing as Supplier)} onClose={close} onSaved={refetch} />
        ) : (
          <ItemForm item={editing === 'new' ? null : (editing as Item)} suppliers={suppliers.data ?? []} onClose={close} onSaved={refetch} />
        )
      ) : null}
    </div>
  );
}

/** Which project stage reserves stock for a project's materials (also by hand on the project). */
function ReserveStage() {
  const toast = useToast();
  const settings = useQuery<{ reserve_on_stage: string | null; stages: string[] }>('/inventory/settings');
  if (!settings.data) return null;
  const save = async (value: string) => {
    try {
      settings.setData(await api.put('/inventory/settings', { reserve_on_stage: value || null }));
      toast.success(value ? `Stock is reserved when a project reaches ${value}.` : 'Stock is reserved by hand only.');
    } catch (caught) {
      toast.error(failed(caught));
    }
  };
  return (
    <Select label="Project stock" value={settings.data.reserve_on_stage ?? ''} onChange={(event) => void save(event.target.value)}>
      <option value="">Reserve project stock by hand</option>
      {settings.data.stages.slice(0, -1).map((stage) => (
        <option key={stage} value={stage}>
          Reserve at {stage}
        </option>
      ))}
    </Select>
  );
}

function SupplierTable({ suppliers, onOpen }: { suppliers: Supplier[]; onOpen: (supplier: Supplier) => void }) {
  const { rows, header } = useSort(suppliers, { name: (s) => s.name, lead: (s) => s.lead_days ?? -1 });
  if (!suppliers.length) return <EmptyState title="No suppliers yet" message="Add who you buy from, then pick them on each item." />;
  return (
    <TableWrap className="max-md:min-w-0">
      <thead>
        <tr>
          <Th sort={header('name')}>Name</Th>
          <Th col="md">Contact</Th>
          <Th col="lg">Email</Th>
          <Th col="xl">Phone</Th>
          <Th className="text-right" sort={header('lead')}>Lead time</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((supplier) => (
          <tr key={supplier.id} onClick={() => onOpen(supplier)} className="cursor-pointer hover:bg-surface-muted/40">
            <Td className="[overflow-wrap:anywhere]">
              <button type="button" className="text-link text-left" onClick={(event) => { event.stopPropagation(); onOpen(supplier); }}>
                {supplier.name}
              </button>
            </Td>
            <Td col="md">{supplier.contact_name ?? '—'}</Td>
            <Td col="lg">{supplier.email ?? '—'}</Td>
            <Td col="xl">{supplier.phone ?? '—'}</Td>
            <Td className="tabular text-right">{supplier.lead_days === null ? '—' : `${supplier.lead_days} days`}</Td>
          </tr>
        ))}
      </tbody>
    </TableWrap>
  );
}

/** One item: stock in, used on a job or a corrected count, and its last 100 movements. */
function ItemPanel({ item, onClose, onEdit, onChanged }: { item: Item; onClose: () => void; onEdit: () => void; onChanged: () => Promise<unknown> }) {
  const toast = useToast();
  const movements = useQuery<Movement[]>(`/inventory/items/${item.id}/movements`);
  const prices = useQuery<{ unit_cost: number; created_at: string; po_ref: number | null; supplier_name: string | null }[]>(`/inventory/items/${item.id}/prices`);
  const [kind, setKind] = useState<Movement['kind']>('receive');
  const [quantity, setQuantity] = useState('');
  const [cost, setCost] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post(`/inventory/items/${item.id}/movements`, {
        kind,
        quantity: Number(quantity),
        ...(kind === 'receive' ? { unit_cost: Number(cost) } : { reason }),
      });
      toast.success('Booked.');
      setQuantity('');
      setCost('');
      setReason('');
      await Promise.all([onChanged(), movements.refetch(), prices.refetch()]);
    } catch (caught) {
      toast.error(failed(caught));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    try {
      await api.delete(`/inventory/items/${item.id}`);
      toast.success('Deleted.');
      onClose();
      await onChanged();
    } catch (caught) {
      toast.error(failed(caught));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`${item.sku} · ${item.name}`}
      description={[item.type, item.category, item.size_note, item.supplier_name].filter(Boolean).join(' · ')}
      width="lg"
      footer={
        <>
          <Button variant="ghost" icon={<Trash size={15} aria-hidden="true" />} onClick={() => setDeleting(true)}>
            Delete
          </Button>
          <Button variant="secondary" onClick={onEdit}>
            Edit
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
          {[
            ['In stock', `${item.on_hand} ${item.unit}`],
            ['Reserved for projects', String(item.reserved)],
            ['Free', String(item.available)],
            ['Avg cost', money(item.avg_cost)],
            ['Reorder at', item.reorder_level === null ? '—' : String(item.reorder_level)],
          ].map(([label, figure]) => (
            <div key={label} className="rounded-control bg-surface-muted px-3 py-2">
              <dt className="text-ink-muted">{label}</dt>
              <dd className="tabular font-semibold text-ink">{figure}</dd>
            </div>
          ))}
        </dl>

        {prices.data?.length ? (
          <p className="text-sm text-ink-muted">
            Last paid:{' '}
            {prices.data.slice(0, 4).map((price, index) => (
              <span key={index} className="tabular">
                {index ? ' · ' : ''}
                {money(price.unit_cost)} {price.supplier_name ? `from ${price.supplier_name}` : ''} ({date(price.created_at)})
              </span>
            ))}
          </p>
        ) : null}

        {item.active ? (
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[10rem_7rem_1fr_auto] sm:items-end">
            <Select label="Action" value={kind} onChange={(event) => setKind(event.target.value as Movement['kind'])}>
              <option value="receive">Stock in</option>
              <option value="issue">Used on job</option>
              <option value="adjust">Correct count (±)</option>
            </Select>
            <Input label={kind === 'adjust' ? 'Change (+ or −)' : 'How many'} type="number" step={1} min={kind === 'adjust' ? undefined : 1} required value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            {kind === 'receive' ? (
              <Input label="Net cost each (£)" type="number" step="0.01" min={0} required value={cost} onChange={(event) => setCost(event.target.value)} />
            ) : (
              <Input label="Why" required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder={kind === 'adjust' ? 'Counted, damaged…' : 'Workshop use'} />
            )}
            <Button type="submit" variant="primary" loading={busy}>
              Book
            </Button>
          </form>
        ) : (
          <p className="text-sm text-ink-muted">Archived. Edit it to bring it back before booking stock.</p>
        )}

        {movements.data?.length ? (
          <TableWrap>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>What</Th>
                <Th className="text-right">Qty</Th>
                <Th col="md" className="text-right">Cost each</Th>
                <Th col="lg">By</Th>
              </tr>
            </thead>
            <tbody>
              {movements.data.map((move) => (
                <tr key={move.id}>
                  <Td>{date(move.created_at)}</Td>
                  <Td>
                    {KIND_LABEL[move.kind]}
                    {move.reason ? <span className="text-ink-muted"> · {move.reason}</span> : null}
                  </Td>
                  <Td className="tabular text-right font-semibold">{move.quantity > 0 ? `+${move.quantity}` : move.quantity}</Td>
                  <Td col="md" className="tabular text-right">{money(move.unit_cost)}</Td>
                  <Td col="lg">{move.by_name}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        ) : movements.data ? (
          <p className="text-sm text-ink-muted">No stock booked yet.</p>
        ) : null}
      </div>
      <ConfirmDialog
        open={deleting}
        title={`Delete ${item.name}?`}
        message="Only an item with no stock history can be deleted. Otherwise archive it."
        confirmLabel="Delete"
        onConfirm={remove}
        onCancel={() => setDeleting(false)}
      />
    </Modal>
  );
}

function useSave(onSaved: () => Promise<unknown>, onClose: () => void) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const save = async (request: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await request();
      toast.success(done);
      onClose();
      await onSaved();
    } catch (caught) {
      toast.error(failed(caught));
    } finally {
      setBusy(false);
    }
  };
  return { busy, save };
}

function ItemForm({ item, suppliers, onClose, onSaved }: { item: Item | null; suppliers: Supplier[]; onClose: () => void; onSaved: () => Promise<unknown> }) {
  const { busy, save } = useSave(onSaved, onClose);
  const [form, setForm] = useState({
    sku: item?.sku ?? '',
    name: item?.name ?? '',
    type: item?.type ?? 'Sheet',
    category: item?.category ?? '',
    unit: item?.unit ?? 'each',
    size_note: item?.size_note ?? '',
    supplier_id: item?.supplier_id ?? '',
    reorder_level: item?.reorder_level?.toString() ?? '',
    quote_cost: item?.quote_cost?.toString() ?? '',
    active: item?.active ?? true,
  });
  const [specs, setSpecs] = useState(() => specsForm(item));
  const assets = useQuery<MediaAsset[]>('/cms/media');
  const toast = useToast();
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => setForm({ ...form, [key]: event.target.value });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const problem = specsError(specs);
    if (problem) return toast.error(problem);
    const body = {
      ...form,
      ...specsBody(specs),
      category: orNull(form.category),
      size_note: orNull(form.size_note),
      supplier_id: form.supplier_id || null,
      reorder_level: intOrNull(form.reorder_level),
      quote_cost: form.quote_cost.trim() === '' ? null : Number(form.quote_cost),
    };
    void save(() => (item ? api.put(`/inventory/items/${item.id}`, body) : api.post('/inventory/items', body)), item ? 'Saved.' : 'Item added.');
  };

  return (
    <Modal
      open
      onClose={onClose}
      width="lg"
      title={item ? `Edit ${item.name}` : 'New item'}
      footer={
        <Button type="submit" form="inventory-item" variant="primary" loading={busy}>
          {item ? 'Save' : 'Add item'}
        </Button>
      }
    >
      <form id="inventory-item" onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Input label="Code" required maxLength={40} value={form.sku} onChange={set('sku')} />
        <Input label="Name" required maxLength={200} value={form.name} onChange={set('name')} />
        <Select label="Type" value={form.type} onChange={set('type')}>
          {TYPES.map((type) => (
            <option key={type}>{type}</option>
          ))}
        </Select>
        <Input label="Unit" required maxLength={20} value={form.unit} onChange={set('unit')} hint="sheet, each, box…" />
        <Input label="Category" maxLength={80} value={form.category} onChange={set('category')} />
        <Input label="Size / finish" maxLength={200} value={form.size_note} onChange={set('size_note')} hint="e.g. 2440 × 1220 × 18 mm, oak veneer" />
        <Select label="Supplier" value={form.supplier_id} onChange={set('supplier_id')}>
          <option value="">None</option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </Select>
        <Input label="Reorder at" type="number" min={0} step={1} value={form.reorder_level} onChange={set('reorder_level')} hint="Admins are told when stock falls to this. Empty = never." />
        <Input
          label="Quoting cost (£, net)"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={form.quote_cost}
          onChange={set('quote_cost')}
          hint={`Per ${form.unit || 'unit'}, what quotes price it at. Empty = the average cost${item ? ` (${money(item.avg_cost)})` : ''}.`}
        />
        <SpecsFields form={specs} onChange={setSpecs} assets={assets.data ?? []} onAssetsChanged={() => void assets.refetch()} isSheet={form.type === 'Sheet'} />
        {item ? (
          <label className="flex items-center gap-2 text-sm text-ink sm:col-span-2">
            <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
            In use (untick to archive it: hidden, no new bookings, history kept)
          </label>
        ) : null}
      </form>
    </Modal>
  );
}

function SupplierForm({ supplier, onClose, onSaved }: { supplier: Supplier | null; onClose: () => void; onSaved: () => Promise<unknown> }) {
  const { busy, save } = useSave(onSaved, onClose);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    name: supplier?.name ?? '',
    contact_name: supplier?.contact_name ?? '',
    email: supplier?.email ?? '',
    phone: supplier?.phone ?? '',
    lead_days: supplier?.lead_days?.toString() ?? '',
    notes: supplier?.notes ?? '',
  });
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => setForm({ ...form, [key]: event.target.value });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const body = {
      name: form.name,
      contact_name: orNull(form.contact_name),
      email: orNull(form.email),
      phone: orNull(form.phone),
      lead_days: intOrNull(form.lead_days),
      notes: orNull(form.notes),
    };
    void save(() => (supplier ? api.put(`/inventory/suppliers/${supplier.id}`, body) : api.post('/inventory/suppliers', body)), supplier ? 'Saved.' : 'Supplier added.');
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={supplier ? supplier.name : 'New supplier'}
      footer={
        <>
          {supplier ? (
            <Button variant="ghost" icon={<Trash size={15} aria-hidden="true" />} onClick={() => setDeleting(true)}>
              Delete
            </Button>
          ) : null}
          <Button type="submit" form="inventory-supplier" variant="primary" loading={busy}>
            {supplier ? 'Save' : 'Add supplier'}
          </Button>
        </>
      }
    >
      <form id="inventory-supplier" onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Input label="Name" required maxLength={200} value={form.name} onChange={set('name')} />
        <Input label="Contact" maxLength={200} value={form.contact_name} onChange={set('contact_name')} />
        <Input label="Email" type="email" maxLength={254} value={form.email} onChange={set('email')} />
        <Input label="Phone" maxLength={30} value={form.phone} onChange={set('phone')} />
        <Input label="Lead time (days)" type="number" min={0} max={365} step={1} value={form.lead_days} onChange={set('lead_days')} />
        <div className="sm:col-span-2">
          <Textarea label="Notes" maxLength={2000} rows={3} value={form.notes} onChange={set('notes')} />
        </div>
      </form>
      {supplier ? (
        <ConfirmDialog
          open={deleting}
          title={`Delete ${supplier.name}?`}
          message="Its items stay, with no supplier."
          confirmLabel="Delete"
          onConfirm={() => save(() => api.delete(`/inventory/suppliers/${supplier.id}`), 'Deleted.')}
          onCancel={() => setDeleting(false)}
        />
      ) : null}
    </Modal>
  );
}
