import { MagnifyingGlass, Plus, Trash } from '@phosphor-icons/react';
import { useMemo, useState, type FormEvent } from 'react';

import { MediaField } from '@/components/cms/MediaPicker';
import { Button, EmptyState, ErrorState, Input, LoadingState, Modal, Select, StatusTag, TableWrap, Td, Th, Toggle } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { useSort } from '@/hooks/useSort';
import { ApiError, api } from '@/lib/api';
import type { MediaAsset } from '@/types/cms';

/* An inventory item's specs (apps/api inventory SpecsDto): the one material record the quote maker shares.
   The Admin edits them inside the item form; an Editor edits only these, on the catalogue below. */

export const BOARD_ROLES = [
  ['carcass', 'Carcass (sides, shelves)'],
  ['front', 'Fronts (doors, drawer fronts)'],
  ['worktop', 'Worktop'],
  ['back', 'Backs'],
] as const;
type Role = (typeof BOARD_ROLES)[number][0];

export interface Specs {
  length_mm: number | null;
  width_mm: number | null;
  thickness_mm: number | null;
  grain: boolean;
  board_role: Role | null;
  swatch: string | null;
  image_id: string | null;
  specs: Array<{ label: string; value: string }>;
  show_on_site: boolean;
  public_name: string | null;
}

export interface CatalogueItem extends Specs {
  id: string;
  sku: string;
  name: string;
  type: 'Sheet' | 'Hardware' | 'Bought-in';
  category: string | null;
  unit: string;
  size_note: string | null;
  active: boolean;
}

/** The form keeps strings, so a half-typed number is never lost. */
export interface SpecsForm {
  length_mm: string;
  width_mm: string;
  thickness_mm: string;
  grain: boolean;
  board_role: string;
  swatch: string;
  image_id: string;
  specs: Array<{ label: string; value: string }>;
  show_on_site: boolean;
  public_name: string;
}

const text = (value: number | null | undefined) => (value == null ? '' : String(value));

export function specsForm(item?: Partial<Specs> | null): SpecsForm {
  return {
    length_mm: text(item?.length_mm),
    width_mm: text(item?.width_mm),
    thickness_mm: text(item?.thickness_mm),
    grain: item?.grain ?? false,
    board_role: item?.board_role ?? '',
    swatch: item?.swatch ?? '',
    image_id: item?.image_id ?? '',
    specs: item?.specs?.map((line) => ({ ...line })) ?? [],
    show_on_site: item?.show_on_site ?? false,
    public_name: item?.public_name ?? '',
  };
}

const whole = (value: string) => (value.trim() === '' ? null : Number(value));

/** The request body; blank spec rows are dropped rather than refused. */
export function specsBody(form: SpecsForm): Specs {
  return {
    length_mm: whole(form.length_mm),
    width_mm: whole(form.width_mm),
    thickness_mm: whole(form.thickness_mm),
    grain: form.grain,
    board_role: (form.board_role || null) as Role | null,
    swatch: form.swatch.trim() || null,
    image_id: form.image_id || null,
    specs: form.specs.map(({ label, value }) => ({ label: label.trim(), value: value.trim() })).filter((line) => line.label && line.value),
    show_on_site: form.show_on_site,
    public_name: form.public_name.trim() || null,
  };
}

/** What the browser can catch before the API does; the API checks the same and more. */
export function specsError(form: SpecsForm): string | null {
  for (const [key, label, max] of [['length_mm', 'Length', 100_000], ['width_mm', 'Width', 100_000], ['thickness_mm', 'Thickness', 1_000]] as const) {
    const value = whole(form[key]);
    if (value !== null && !(Number.isInteger(value) && value >= 1 && value <= max)) return `${label} is whole millimetres, 1 to ${max.toLocaleString('en-GB')}.`;
  }
  if (form.swatch.trim() && !/^#[0-9a-f]{6}$/i.test(form.swatch.trim())) return 'A swatch is a colour such as #8a6f4e.';
  if (form.specs.length > 30) return 'At most 30 spec rows.';
  return null;
}

/** Size in mm, as people say it: 2800 × 2070 × 18 mm. */
export function sizeLabel(item: Pick<Specs, 'length_mm' | 'width_mm' | 'thickness_mm'> & { size_note?: string | null }): string {
  const dims = [item.length_mm, item.width_mm, item.thickness_mm].filter((value): value is number => value != null);
  return dims.length ? `${dims.join(' × ')} mm` : (item.size_note ?? '—');
}

function Swatch({ colour, image }: { colour: string | null; image?: string }) {
  if (image) return <img src={image} alt="" className="size-8 shrink-0 rounded-md border border-border object-cover" />;
  return (
    <span
      aria-hidden
      className="size-8 shrink-0 rounded-md border border-border"
      style={colour ? { background: colour } : { backgroundImage: 'repeating-linear-gradient(45deg, transparent 0 4px, rgb(0 0 0 / 0.06) 4px 8px)' }}
    />
  );
}

/** The spec fields, laid out to sit inside a two-column form grid. */
export function SpecsFields({ form, onChange, assets, onAssetsChanged, isSheet }: {
  form: SpecsForm;
  onChange: (next: SpecsForm) => void;
  assets: MediaAsset[];
  onAssetsChanged: () => void;
  isSheet: boolean;
}) {
  const set = (change: Partial<SpecsForm>) => onChange({ ...form, ...change });
  const swatch = /^#[0-9a-f]{6}$/i.test(form.swatch.trim()) ? form.swatch.trim() : null;
  const row = (index: number, change: Partial<{ label: string; value: string }>) =>
    set({ specs: form.specs.map((line, at) => (at === index ? { ...line, ...change } : line)) });

  return (
    <>
      <fieldset className="contents">
        <legend className="col-span-full mt-2 border-t border-border pt-4 text-sm font-semibold text-ink">Size</legend>
        <div className="grid grid-cols-3 gap-3 sm:col-span-2">
          <Input label="Length (mm)" type="number" inputMode="numeric" min={1} max={100000} step={1} value={form.length_mm} onChange={(event) => set({ length_mm: event.target.value })} />
          <Input label="Width (mm)" type="number" inputMode="numeric" min={1} max={100000} step={1} value={form.width_mm} onChange={(event) => set({ width_mm: event.target.value })} />
          <Input label="Thickness (mm)" type="number" inputMode="numeric" min={1} max={1000} step={1} value={form.thickness_mm} onChange={(event) => set({ thickness_mm: event.target.value })} />
        </div>
        {isSheet ? (
          <>
            <Select label="Used for" value={form.board_role} onChange={(event) => set({ board_role: event.target.value })} hint="Which parts the quote maker may cut from it.">
              <option value="">Not set</option>
              {BOARD_ROLES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <div className="self-end pb-1">
              <Toggle label="Has a grain" description="Runs along the length, so parts are never turned." checked={form.grain} onChange={(grain) => set({ grain })} />
            </div>
          </>
        ) : null}
      </fieldset>

      <fieldset className="contents">
        <legend className="col-span-full mt-2 border-t border-border pt-4 text-sm font-semibold text-ink">Look</legend>
        <div className="flex items-end gap-3">
          <Swatch colour={swatch} />
          <div className="flex-1">
            <Input label="Swatch colour" value={form.swatch} maxLength={7} placeholder="#8a6f4e" onChange={(event) => set({ swatch: event.target.value })} hint="The colour the 2D and 3D previews paint it." />
          </div>
          <input
            type="color"
            aria-label="Pick the swatch colour"
            value={swatch ?? '#cccccc'}
            onChange={(event) => set({ swatch: event.target.value })}
            className="mb-[26px] h-10 w-11 cursor-pointer rounded-md border border-border bg-surface p-1"
          />
        </div>
        <div className="sm:col-span-2">
          <MediaField
            label="Photo"
            hint="A close-up of the finish or the product. Shown in the catalogue and, if it is on the website, to visitors."
            value={form.image_id ? [form.image_id] : []}
            multiple={false}
            onChange={(ids) => set({ image_id: ids[0] ?? '' })}
            assets={assets}
            onAssetsChanged={onAssetsChanged}
          />
        </div>
      </fieldset>

      <fieldset className="contents">
        <legend className="col-span-full mt-2 border-t border-border pt-4 text-sm font-semibold text-ink">Specification</legend>
        <div className="flex flex-col gap-2 sm:col-span-2">
          {form.specs.length === 0 ? <p className="text-sm text-ink-muted">Rows such as Finish · Matt lacquer, or Load · 25 kg.</p> : null}
          {form.specs.map((line, index) => (
            <div key={index} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] items-end gap-2">
              <Input label={index === 0 ? 'Label' : `Label ${index + 1}`} maxLength={60} value={line.label} onChange={(event) => row(index, { label: event.target.value })} />
              <Input label={index === 0 ? 'Value' : `Value ${index + 1}`} maxLength={200} value={line.value} onChange={(event) => row(index, { value: event.target.value })} />
              <Button
                type="button"
                variant="ghost"
                aria-label={`Remove ${line.label || 'this row'}`}
                onClick={() => set({ specs: form.specs.filter((_, at) => at !== index) })}
                className="mb-1"
              >
                <Trash size={16} />
              </Button>
            </div>
          ))}
          {form.specs.length < 30 ? (
            <div>
              <Button type="button" variant="secondary" onClick={() => set({ specs: [...form.specs, { label: '', value: '' }] })}>
                <Plus size={14} /> Add a row
              </Button>
            </div>
          ) : null}
        </div>
      </fieldset>

      <fieldset className="contents">
        <legend className="col-span-full mt-2 border-t border-border pt-4 text-sm font-semibold text-ink">Website</legend>
        <div className="sm:col-span-2">
          <Toggle
            label="Offer it on the website's quote maker"
            description="Visitors can pick it as a finish. They see the name, swatch and photo, never its cost or stock."
            checked={form.show_on_site}
            onChange={(show_on_site) => set({ show_on_site })}
          />
        </div>
        {form.show_on_site ? (
          <Input label="Name on the website" maxLength={120} value={form.public_name} onChange={(event) => set({ public_name: event.target.value })} hint="e.g. Natural oak. Empty = the item's name." />
        ) : null}
      </fieldset>
    </>
  );
}

/** Inventory for an Editor: every item with its specs, never cost, stock or suppliers. */
export function CataloguePage() {
  const items = useQuery<CatalogueItem[]>('/inventory/catalogue');
  const assets = useQuery<MediaAsset[]>('/cms/media');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<CatalogueItem | null>(null);
  const images = useMemo(() => new Map((assets.data ?? []).map((asset) => [asset.id, asset.src_resolved])), [assets.data]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (items.data ?? []).filter((item) => !needle || `${item.name} ${item.sku} ${item.public_name ?? ''} ${item.category ?? ''}`.toLowerCase().includes(needle));
  }, [items.data, query]);
  const sort = useSort(shown, { name: (item) => item.name, sku: (item) => item.sku, type: (item) => item.type, site: (item) => (item.show_on_site ? 0 : 1) });

  if (items.error) return <ErrorState message={items.error} onRetry={items.refetch} />;
  if (!items.data) return <LoadingState label="Loading the catalogue…" />;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Inventory</h1>
          <p className="mt-1 max-w-[62ch] text-sm text-ink-muted">
            Sizes, finishes, photos and what the website&rsquo;s quote maker offers. Costs and stock are kept by an Admin.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <MagnifyingGlass size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search items"
            aria-label="Search items"
            className="min-h-11 w-full rounded-control border border-border bg-surface pl-9 pr-3 text-ink placeholder:text-ink-muted/70 focus:border-green-900"
          />
        </div>
      </header>

      {shown.length === 0 ? (
        <EmptyState title={query ? 'Nothing matches that' : 'No items yet'} message={query ? 'Try a name or SKU.' : 'An Admin adds items in Inventory.'} />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th sort={sort.header('name')}>Item</Th>
              <Th sort={sort.header('sku')} className="hidden md:table-cell">SKU</Th>
              <Th sort={sort.header('type')} className="hidden sm:table-cell">Type</Th>
              <Th className="hidden lg:table-cell">Size</Th>
              <Th sort={sort.header('site')}>Website</Th>
            </tr>
          </thead>
          <tbody>
            {sort.rows.map((item) => (
              <tr key={item.id} className="cursor-pointer hover:bg-surface-muted" onClick={() => setOpen(item)}>
                <Td>
                  <button type="button" className="flex items-center gap-3 text-left" onClick={(event) => { event.stopPropagation(); setOpen(item); }}>
                    <Swatch colour={item.swatch} image={item.image_id ? images.get(item.image_id) : undefined} />
                    <span>
                      <span className="block font-medium text-ink">{item.name}</span>
                      {!item.active ? <span className="text-xs text-ink-muted">Switched off</span> : null}
                    </span>
                  </button>
                </Td>
                <Td className="hidden font-mono text-xs md:table-cell">{item.sku}</Td>
                <Td className="hidden sm:table-cell">{item.type}</Td>
                <Td className="hidden tabular lg:table-cell">{sizeLabel(item)}</Td>
                <Td>{item.show_on_site ? <StatusTag tone="success">{item.public_name || 'Shown'}</StatusTag> : <span className="text-ink-muted">No</span>}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}

      {open ? (
        <SpecsEditor
          item={open}
          assets={assets.data ?? []}
          onAssetsChanged={() => void assets.refetch()}
          onClose={() => setOpen(null)}
          onSaved={(saved) => {
            items.setData((items.data ?? []).map((row) => (row.id === saved.id ? saved : row)));
            setOpen(null);
          }}
        />
      ) : null}
    </div>
  );
}

function SpecsEditor({ item, assets, onAssetsChanged, onClose, onSaved }: {
  item: CatalogueItem;
  assets: MediaAsset[];
  onAssetsChanged: () => void;
  onClose: () => void;
  onSaved: (saved: CatalogueItem) => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState(() => specsForm(item));
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const problem = specsError(form);
    if (problem) return toast.error(problem);
    setBusy(true);
    try {
      onSaved(await api.put<CatalogueItem>(`/inventory/items/${item.id}/specs`, specsBody(form)));
      toast.success('Specs saved.');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not save the specs.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      width="lg"
      title={item.name}
      description={`${item.sku} · ${item.type}${item.category ? ` · ${item.category}` : ''}`}
      footer={
        <Button type="submit" form="inventory-specs" variant="primary" loading={busy}>
          Save specs
        </Button>
      }
    >
      <form id="inventory-specs" onSubmit={(event) => void submit(event)} className="grid gap-3 sm:grid-cols-2">
        <SpecsFields form={form} onChange={setForm} assets={assets} onAssetsChanged={onAssetsChanged} isSheet={item.type === 'Sheet'} />
      </form>
    </Modal>
  );
}
