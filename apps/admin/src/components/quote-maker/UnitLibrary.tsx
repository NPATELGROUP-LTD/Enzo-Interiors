import { ArrowsClockwise, Plus, Trash } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';

import { Button, Checkbox, EmptyState, Input, Modal, Select, StatusTag, TableWrap, Td, Textarea, Th, Toggle } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useSort } from '@/hooks/useSort';
import { ApiError, api } from '@/lib/api';

import {
  BOARD_ROLES,
  MOUNT_LABEL,
  MOUNTS,
  ROLE_LABEL,
  ROOM_TYPES,
  type StockItem,
  type TemplatePanel,
  type TemplateVariant,
  type UnitTemplate,
} from './plan';
import { UnitPreview } from './UnitPreview';

const failed = (caught: unknown) => (caught instanceof ApiError ? caught.message : 'That did not work. Please try again.');
type Body = Omit<UnitTemplate, 'id' | 'problems' | 'updated_by' | 'variants' | 'position'> & { variants: TemplateVariant[] };

const NEW: Body = {
  slug: '',
  name: '',
  description: null,
  room_types: ['kitchen'],
  mount: 'floor',
  elevation_mm: 0,
  structure: { doors: 1, drawers: 0, shelves: 1, back: true, plinth_mm: 150, worktop: true },
  slots: [
    { key: 'carcass', label: 'Carcass', roles: ['carcass'], default_item_id: null },
    { key: 'front', label: 'Front', roles: ['front'], default_item_id: null },
  ],
  variants: [{ width_mm: 600, height_mm: 870, depth_mm: 580, panels: [] }],
  hardware: [],
  labour_hours: 1,
  labour_extra: 0,
  active: true,
};
const slugOf = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

/** The units the quote maker builds from, with why any of them cannot be priced yet. */
export function UnitLibrary({ templates, items, onChanged }: { templates: UnitTemplate[]; items: StockItem[]; onChanged: () => Promise<void> }) {
  const toast = useToast();
  const [editing, setEditing] = useState<UnitTemplate | 'new' | null>(null);
  const [room, setRoom] = useState('');
  const shown = templates.filter((t) => !room || t.room_types.includes(room));
  const { rows, header } = useSort(shown, {
    name: (t) => t.name,
    mount: (t) => t.mount,
    sizes: (t) => t.variants.length,
    labour: (t) => t.labour_hours,
  });

  const toggle = async (template: UnitTemplate, active: boolean) => {
    try {
      await api.put(`/quote-maker/templates/${template.id}`, { ...bodyOf(template), active });
      await onChanged();
    } catch (caught) {
      toast.error(failed(caught));
    }
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="w-56">
          <Select label="Room type" value={room} onChange={(e) => setRoom(e.target.value)}>
            <option value="">All rooms</option>
            {ROOM_TYPES.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        </div>
        <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setEditing('new')}>
          New unit
        </Button>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No units" message="The starter library arrives with the next content import; or add your own." />
      ) : (
        <TableWrap>
          <thead>
              <tr>
                <Th sort={header('name')}>Unit</Th>
                <Th sort={header('mount')}>Kind</Th>
                <Th sort={header('sizes')}>Widths (mm)</Th>
                <Th sort={header('labour')}>Fitting</Th>
                <Th>Status</Th>
                <Th className="w-16">On</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-t border-border hover:bg-surface-muted">
                  <Td>
                    <button type="button" className="text-left font-semibold text-green-900 hover:underline" onClick={() => setEditing(t)}>
                      {t.name}
                    </button>
                    <span className="block text-xs text-ink-muted">{t.room_types.map((r) => ROOM_TYPES.find((x) => x.id === r)?.name ?? r).join(', ')}</span>
                  </Td>
                  <Td>{MOUNT_LABEL[t.mount]}</Td>
                  <Td className="tabular">{t.variants.map((v) => v.width_mm).join(', ')}</Td>
                  <Td className="tabular">
                    {t.labour_hours} h{t.labour_extra ? ` + £${t.labour_extra}` : ''}
                  </Td>
                  <Td>
                    {!t.active ? (
                      <StatusTag>Off</StatusTag>
                    ) : t.problems.length ? (
                      <span title={t.problems.join(' ')}>
                        <StatusTag tone="warning">Not priced</StatusTag>
                      </span>
                    ) : (
                      <StatusTag tone="success">Ready</StatusTag>
                    )}
                    {t.active && t.problems.length ? <span className="mt-0.5 block max-w-xs text-xs text-ink-muted">{t.problems[0]}</span> : null}
                  </Td>
                  <Td>
                    <Toggle label={`${t.name} on`} hideLabel checked={t.active} onChange={(on) => void toggle(t, on)} />
                  </Td>
                </tr>
              ))}
            </tbody>
        </TableWrap>
      )}
      {editing ? (
        <TemplateEditor
          template={editing === 'new' ? null : editing}
          items={items}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await onChanged();
          }}
        />
      ) : null}
    </>
  );
}

/** What the library hands out, as the API takes it back (panel and size ids kept, so edits keep their place). */
function bodyOf(t: UnitTemplate): Body & { position: number } {
  const { slug, name, description, room_types, mount, elevation_mm, structure, slots, variants, hardware, labour_hours, labour_extra, active, position } = t;
  return structuredClone({ slug, name, description, room_types, mount, elevation_mm, structure, slots, variants, hardware, labour_hours, labour_extra, active, position });
}

function TemplateEditor({ template, items, onClose, onSaved }: { template: UnitTemplate | null; items: StockItem[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const toast = useToast();
  const [body, setBody] = useState<Body>(() => (template ? bodyOf(template) : structuredClone(NEW)));
  const [slugTouched, setSlugTouched] = useState(template !== null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Body>(key: K, value: Body[K]) => setBody((b) => ({ ...b, [key]: value }));
  const int = (value: string) => Math.max(0, Math.round(Number(value) || 0));
  const boards = items.filter((i) => i.active && i.type === 'Sheet');
  const fittings = items.filter((i) => i.active && i.type !== 'Sheet');
  const slotKeys = body.slots.map((s) => s.key);

  const setVariant = (index: number, patch: Partial<TemplateVariant>) =>
    set('variants', body.variants.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  const setPanel = (vi: number, pi: number, patch: Partial<TemplatePanel>) =>
    setVariant(vi, { panels: body.variants[vi]!.panels.map((p, i) => (i === pi ? { ...p, ...patch } : p)) });

  const standard = async (vi: number) => {
    const v = body.variants[vi]!;
    try {
      const panels = await api.post<TemplatePanel[]>('/quote-maker/panels', {
        structure: body.structure,
        width_mm: v.width_mm,
        height_mm: v.height_mm,
        depth_mm: v.depth_mm,
        slots: slotKeys,
      });
      setVariant(vi, { panels });
    } catch (caught) {
      toast.error(failed(caught));
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (template) await api.put(`/quote-maker/templates/${template.id}`, body);
      else await api.post('/quote-maker/templates', body);
      toast.success(template ? 'Unit saved.' : 'Unit added.');
      await onSaved();
    } catch (caught) {
      setError(failed(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      width="xl"
      onClose={onClose}
      title={template ? template.name : 'New unit'}
      description="Each size has its own cut list. Prices come from the boards and fittings in Inventory, never typed here."
      footer={
        <>
          {error ? <p role="alert" className="mr-auto text-sm text-danger">{error}</p> : null}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={() => void save()}>
            Save unit
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <aside aria-label="Preview" className="lg:order-2">
        <div className="lg:sticky lg:top-0">
          <h3 className="mb-2 text-sm font-semibold text-ink">Preview</h3>
          <UnitPreview unit={body} items={items} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-col gap-6 lg:order-1">
        <Group title="About">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Name"
              required
              maxLength={120}
              value={body.name}
              onChange={(e) => setBody((b) => ({ ...b, name: e.target.value, ...(slugTouched ? {} : { slug: slugOf(e.target.value) }) }))}
            />
            <Input
              label="Short name"
              hint="Lower-case and dashes; must be unique."
              required
              maxLength={60}
              value={body.slug}
              onChange={(e) => (setSlugTouched(true), set('slug', e.target.value))}
            />
            <Select label="Kind" value={body.mount} onChange={(e) => set('mount', e.target.value as Body['mount'])}>
              {MOUNTS.map((m) => <option key={m} value={m}>{MOUNT_LABEL[m]}</option>)}
            </Select>
            {body.mount === 'wall' ? (
              <Input label="Bottom off the floor (mm)" type="number" min={0} max={5000} value={body.elevation_mm} onChange={(e) => set('elevation_mm', int(e.target.value))} />
            ) : null}
            <Input label="Fitting hours, each" type="number" min={0} max={100} step={0.25} value={body.labour_hours} onChange={(e) => set('labour_hours', Number(e.target.value) || 0)} />
            <Input label="Fixed extra, each (£)" hint="LED, fire board, anything priced on its own." type="number" min={0} step={0.01} value={body.labour_extra} onChange={(e) => set('labour_extra', Number(e.target.value) || 0)} />
          </div>
          <Textarea label="Description" maxLength={500} rows={2} value={body.description ?? ''} onChange={(e) => set('description', e.target.value || null)} />
          <fieldset>
            <legend className="text-sm font-semibold text-ink">Rooms</legend>
            <div className="flex flex-wrap gap-x-4">
              {ROOM_TYPES.map((r) => (
                <Checkbox
                  key={r.id}
                  label={r.name}
                  checked={body.room_types.includes(r.id)}
                  onChange={(on) => set('room_types', on ? [...body.room_types, r.id] : body.room_types.filter((x) => x !== r.id))}
                />
              ))}
            </div>
          </fieldset>
          <Toggle label="On" description="Off = not offered in the editor or on the website." checked={body.active} onChange={(active) => set('active', active)} />
        </Group>

        {body.mount === 'gap' ? null : (
          <Group title="Build" hint="Used to draw it, and for the standard cut list.">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Input label="Doors" type="number" min={0} max={6} value={body.structure.doors} onChange={(e) => set('structure', { ...body.structure, doors: int(e.target.value) })} />
              <Input label="Drawers" type="number" min={0} max={8} value={body.structure.drawers} onChange={(e) => set('structure', { ...body.structure, drawers: int(e.target.value) })} />
              <Input label="Shelves" type="number" min={0} max={12} value={body.structure.shelves} onChange={(e) => set('structure', { ...body.structure, shelves: int(e.target.value) })} />
              <Input label="Plinth (mm)" type="number" min={0} max={300} value={body.structure.plinth_mm} onChange={(e) => set('structure', { ...body.structure, plinth_mm: int(e.target.value) })} />
            </div>
            <div className="flex flex-wrap gap-x-6">
              <Checkbox label="Back panel" checked={body.structure.back} onChange={(back) => set('structure', { ...body.structure, back })} />
              <Checkbox label="Worktop on top" checked={body.structure.worktop} onChange={(worktop) => set('structure', { ...body.structure, worktop })} />
            </div>
          </Group>
        )}

        {body.mount === 'gap' ? null : (
          <Group
            title="Boards"
            hint="Each slot is a board the customer may choose. Blank default = the role's default in Pricing."
            action={
              <Button
                className="min-h-8 px-2.5 text-[13px]"
                icon={<Plus size={14} aria-hidden="true" />}
                disabled={body.slots.length >= 6}
                onClick={() => set('slots', [...body.slots, { key: `slot_${body.slots.length + 1}`, label: 'Board', roles: ['carcass'], default_item_id: null }])}
              >
                Slot
              </Button>
            }
          >
            {body.slots.map((slot, si) => {
              const setSlot = (patch: Partial<typeof slot>) => set('slots', body.slots.map((s, i) => (i === si ? { ...s, ...patch } : s)));
              return (
                <div key={si} className="grid gap-3 rounded-control border border-border p-3 sm:grid-cols-[1fr_1fr_1.4fr_auto]">
                  <Input label="Key" value={slot.key} maxLength={30} onChange={(e) => setSlot({ key: e.target.value })} />
                  <Input label="Label" value={slot.label} maxLength={60} onChange={(e) => setSlot({ label: e.target.value })} />
                  <Select label="Default board" value={slot.default_item_id ?? ''} onChange={(e) => setSlot({ default_item_id: e.target.value || null })}>
                    <option value="">Role default</option>
                    {boards.filter((b) => b.board_role && slot.roles.includes(b.board_role)).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </Select>
                  <div className="flex items-end">
                    <Button variant="ghost" className="min-h-9 px-2" icon={<Trash size={16} aria-hidden="true" />} aria-label={`Remove ${slot.label}`} onClick={() => set('slots', body.slots.filter((_, i) => i !== si))} />
                  </div>
                  <fieldset className="sm:col-span-4">
                    <legend className="text-xs font-semibold text-ink-muted">Boards it can be</legend>
                    <div className="flex flex-wrap gap-x-4">
                      {BOARD_ROLES.map((r) => (
                        <Checkbox
                          key={r}
                          label={ROLE_LABEL[r]}
                          checked={slot.roles.includes(r)}
                          onChange={(on) => setSlot({ roles: on ? [...slot.roles, r] : slot.roles.filter((x) => x !== r) })}
                        />
                      ))}
                    </div>
                  </fieldset>
                </div>
              );
            })}
          </Group>
        )}

        <Group
          title="Sizes"
          action={
            <Button
              className="min-h-8 px-2.5 text-[13px]"
              icon={<Plus size={14} aria-hidden="true" />}
              disabled={body.variants.length >= 20}
              onClick={() => set('variants', [...body.variants, { ...structuredClone(body.variants.at(-1) ?? NEW.variants[0]!), id: undefined, panels: [] }])}
            >
              Size
            </Button>
          }
        >
          {body.variants.map((v, vi) => (
            <div key={v.id ?? `new-${vi}`} className="rounded-control border border-border p-3">
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <Input label="Width" type="number" min={10} value={v.width_mm} onChange={(e) => setVariant(vi, { width_mm: int(e.target.value) })} />
                <Input label="Height" type="number" min={10} value={v.height_mm} onChange={(e) => setVariant(vi, { height_mm: int(e.target.value) })} />
                <Input label="Depth" type="number" min={10} value={v.depth_mm} onChange={(e) => setVariant(vi, { depth_mm: int(e.target.value) })} />
                <div className="col-span-3 flex items-end gap-1 sm:col-span-1">
                  {body.mount === 'gap' ? null : (
                    <Button className="min-h-9 px-2.5 text-[13px]" icon={<ArrowsClockwise size={14} aria-hidden="true" />} onClick={() => void standard(vi)}>
                      Standard cut list
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    className="min-h-9 px-2"
                    disabled={body.variants.length === 1}
                    icon={<Trash size={16} aria-hidden="true" />}
                    aria-label={`Remove the ${v.width_mm} mm size`}
                    onClick={() => set('variants', body.variants.filter((_, i) => i !== vi))}
                  />
                </div>
              </div>
              {body.mount === 'gap' ? null : (
                <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[30rem] text-sm">
                  <caption className="mb-1 text-left text-xs font-semibold text-ink-muted">Cut list, {v.panels.length} pieces</caption>
                  <thead className="text-xs text-ink-muted">
                    <tr>
                      <th className="text-left font-semibold">Piece</th>
                      <th className="text-left font-semibold">Board</th>
                      <th className="text-left font-semibold">Length</th>
                      <th className="text-left font-semibold">Width</th>
                      <th className="text-left font-semibold">Qty</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {v.panels.map((p, pi) => (
                      <tr key={p.id ?? pi}>
                        <td className="pr-1"><input aria-label="Piece" className={CELL} value={p.label} maxLength={60} onChange={(e) => setPanel(vi, pi, { label: e.target.value })} /></td>
                        <td className="pr-1">
                          <select aria-label="Board slot" className={CELL} value={p.slot} onChange={(e) => setPanel(vi, pi, { slot: e.target.value })}>
                            {body.slots.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                          </select>
                        </td>
                        <td className="pr-1"><input aria-label="Length" type="number" min={1} className={CELL} value={p.length_mm} onChange={(e) => setPanel(vi, pi, { length_mm: int(e.target.value) })} /></td>
                        <td className="pr-1"><input aria-label="Width" type="number" min={1} className={CELL} value={p.width_mm} onChange={(e) => setPanel(vi, pi, { width_mm: int(e.target.value) })} /></td>
                        <td className="pr-1"><input aria-label="Quantity" type="number" min={1} max={50} className={CELL} value={p.qty} onChange={(e) => setPanel(vi, pi, { qty: int(e.target.value) })} /></td>
                        <td>
                          <button type="button" aria-label={`Remove ${p.label}`} className="flex h-9 w-9 items-center justify-center rounded-control text-ink-muted hover:bg-surface-muted hover:text-danger" onClick={() => setVariant(vi, { panels: v.panels.filter((_, i) => i !== pi) })}>
                            <Trash size={15} aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              )}
              {body.mount === 'gap' ? null : (
                <Button
                  variant="ghost"
                  className="mt-1 min-h-8 px-2 text-[13px]"
                  icon={<Plus size={14} aria-hidden="true" />}
                  disabled={v.panels.length >= 40 || !slotKeys.length}
                  onClick={() => setVariant(vi, { panels: [...v.panels, { label: 'Piece', slot: slotKeys[0]!, length_mm: v.height_mm, width_mm: v.depth_mm, qty: 1 }] })}
                >
                  Piece
                </Button>
              )}
            </div>
          ))}
        </Group>

        {body.mount === 'gap' ? null : (
          <Group
            title="Fittings, each"
            action={
              <Button
                className="min-h-8 px-2.5 text-[13px]"
                icon={<Plus size={14} aria-hidden="true" />}
                disabled={!fittings.length || body.hardware.length >= 30}
                onClick={() => set('hardware', [...body.hardware, { item_id: fittings[0]!.id, qty: 1 }])}
              >
                Fitting
              </Button>
            }
          >
            {body.hardware.length === 0 ? <p className="text-sm text-ink-muted">None. Hinges, runners and handles come from Inventory.</p> : null}
            {body.hardware.map((h, hi) => (
              <div key={hi} className="grid grid-cols-[1fr_6rem_auto] items-end gap-3">
                <Select label="Item" value={h.item_id} onChange={(e) => set('hardware', body.hardware.map((x, i) => (i === hi ? { ...x, item_id: e.target.value } : x)))}>
                  {fittings.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </Select>
                <Input label="Qty" type="number" min={1} max={100} value={h.qty} onChange={(e) => set('hardware', body.hardware.map((x, i) => (i === hi ? { ...x, qty: int(e.target.value) } : x)))} />
                <Button variant="ghost" className="min-h-9 px-2" icon={<Trash size={16} aria-hidden="true" />} aria-label="Remove fitting" onClick={() => set('hardware', body.hardware.filter((_, i) => i !== hi))} />
              </div>
            ))}
          </Group>
        )}
      </div>
      </div>
    </Modal>
  );
}

const CELL = 'tabular min-h-9 w-full rounded-[6px] border border-border bg-surface px-2 text-sm text-ink focus:border-green-900 focus-visible:outline-none focus:ring-[3px] focus:ring-focus-ring/35';

function Group({ title, hint, action, children }: { title: string; hint?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3 border-b border-border pb-1.5">
        <div>
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {hint ? <p className="text-xs text-ink-muted">{hint}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
