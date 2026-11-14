import { Copy, Cube, FloppyDisk, Package, Plus, Receipt, Sparkle, Trash } from '@phosphor-icons/react';
import clsx from 'clsx';
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Button, Checkbox, ConfirmDialog, Input, Modal, Select, Tabs, Toggle } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
import type { Project } from '@/types/api';

import { BreakdownPanel } from './BreakdownPanel';
import { Elevation } from './Elevation';
import {
  CUSTOM_ROOM,
  LAYOUTS,
  LIMITS,
  MOUNT_LABEL,
  MOUNTS,
  ROLE_LABEL,
  ROOM_TYPES,
  bottomOf,
  firstFree,
  newUnitId,
  planUnits,
  runs,
  wallLabel,
  withLayout,
  type Breakdown,
  type BoardRole,
  type Design,
  type Layout,
  type Plan,
  type PlanWall,
  type Pricing,
  type StockItem,
  type UnitTemplate,
} from './plan';

const Preview3D = lazy(() => import('./Preview3D'));
const failed = (caught: unknown) => (caught instanceof ApiError ? caught.message : 'That did not work. Please try again.');
const BLANK: Plan = { layout: 'single', height_mm: 2400, walls: [{ length_mm: 3000, units: [] }], island: null };

interface Questions {
  upper: boolean;
  finishes: Partial<Record<BoardRole, string>>;
  gaps: string[];
}

/**
 * One design: the room (walls, ceiling, island), the questions that fill it, each run drawn from the
 * front, the unit picked, and the API's price beside it. Saved designs are priced again on the server.
 */
export function DesignEditor({ design, onSaved }: { design: Design | null; onSaved: (design: Design) => void }) {
  const toast = useToast();
  const navigate = useNavigate();
  const templates = useQuery<UnitTemplate[]>('/quote-maker/templates');
  const stock = useQuery<StockItem[]>('/inventory/items');
  const pricing = useQuery<Pricing>('/quote-maker/pricing');

  const [title, setTitle] = useState(design?.title ?? '');
  const [room, setRoom] = useState(design?.room_type ?? 'kitchen');
  const [plan, setPlan] = useState<Plan>(design?.design ?? BLANK);
  const [questions, setQuestions] = useState<Questions>({ upper: true, finishes: {}, gaps: [] });
  const [run, setRun] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [dirty, setDirty] = useState(design === null);
  const [saving, setSaving] = useState(false);
  const [filling, setFilling] = useState(false);
  const [show3d, setShow3d] = useState(false);
  const [breakdown, setBreakdown] = useState<{ data: Breakdown | null; error: string | null }>({ data: null, error: null });
  const [project, setProject] = useState<'quote' | 'materials' | null>(null);
  const [deleting, setDeleting] = useState(false);

  const byId = useMemo(() => new Map((templates.data ?? []).map((t) => [t.id, t])), [templates.data]);
  const items = useMemo(() => new Map((stock.data ?? []).map((i) => [i.id, i])), [stock.data]);
  const forRoom = useMemo(() => (templates.data ?? []).filter((t) => t.active && (room === CUSTOM_ROOM.id || t.room_types.includes(room))), [templates.data, room]);
  const boards = (roles: BoardRole[]) => (stock.data ?? []).filter((i) => i.active && i.type === 'Sheet' && i.board_role && roles.includes(i.board_role));

  const change = (next: Plan | ((p: Plan) => Plan)) => {
    setPlan(next);
    setDirty(true);
  };

  // Leaving with unsaved work asks first (the browser's own prompt).
  useEffect(() => {
    if (!dirty) return;
    const stop = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', stop);
    return () => window.removeEventListener('beforeunload', stop);
  }, [dirty]);

  // The API prices every change, a moment after the last one.
  useEffect(() => {
    const units = planUnits(plan).map(({ template_id, variant_id, finishes }) => ({ template_id, variant_id, ...(finishes ? { finishes } : {}) }));
    if (!units.length) {
      setBreakdown({ data: null, error: null });
      return;
    }
    let live = true;
    const timer = window.setTimeout(() => {
      api
        .post<Breakdown>('/quote-maker/breakdown', { units })
        .then((data) => live && setBreakdown({ data, error: null }))
        .catch((caught) => live && setBreakdown({ data: null, error: failed(caught) }));
    }, 350);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [plan]);

  const colourOf = useCallback(
    (unit: PlanWall['units'][number], template: UnitTemplate) => {
      const slot = template.slots.find((s) => s.roles.includes('front')) ?? template.slots[0];
      if (!slot) return null;
      const id = unit.finishes?.[slot.key] ?? slot.default_item_id ?? slot.roles.map((r) => pricing.data?.defaults[r]).find(Boolean);
      return (id && items.get(id)?.swatch) || null;
    },
    [items, pricing.data],
  );

  const all = runs(plan);
  const active = Math.min(run, all.length - 1);
  const wall = all[active]!;
  const setRunAt = (index: number, update: (wall: PlanWall) => PlanWall) =>
    change((p) =>
      index < p.walls.length ? { ...p, walls: p.walls.map((w, i) => (i === index ? update(w) : w)) } : { ...p, island: p.island ? update(p.island) : p.island },
    );
  const located = (() => {
    for (const [index, w] of all.entries()) {
      const unit = w.units.find((u) => u.id === selected);
      if (unit) return { index, unit };
    }
    return null;
  })();

  // Units that run past their wall after it was shortened: the API refuses the save, so say so here.
  const offWall = all.flatMap((w, i) =>
    w.units.flatMap((u) => {
      const width = byId.get(u.template_id)?.variants.find((v) => v.id === u.variant_id)?.width_mm ?? 0;
      return u.x_mm + width > w.length_mm ? [`${byId.get(u.template_id)?.name ?? 'A unit'} on ${wallLabel(plan, i)}`] : [];
    }),
  );

  const add = (template: UnitTemplate) => {
    const variant = template.variants.find((v) => v.width_mm === 600) ?? template.variants[0]!;
    const others = wall.units.flatMap((u): Array<[number, number, UnitTemplate['mount']]> => {
      const t = byId.get(u.template_id);
      const w = t?.variants.find((v) => v.id === u.variant_id)?.width_mm;
      return t && w ? [[u.x_mm, w, t.mount]] : [];
    });
    const x = firstFree(others, variant.width_mm, template.mount, wall.length_mm);
    if (x === null) {
      toast.error(`No room for a ${variant.width_mm} mm ${template.name.toLowerCase()} on ${wallLabel(plan, active)}.`);
      return;
    }
    const unit = { id: newUnitId(), template_id: template.id, variant_id: variant.id, x_mm: x };
    setRunAt(active, (w) => ({ ...w, units: [...w.units, unit] }));
    setSelected(unit.id);
  };
  const updateUnit = (id: string, patch: Partial<PlanWall['units'][number]>) => {
    if (!located) return;
    setRunAt(located.index, (w) => ({ ...w, units: w.units.map((u) => (u.id === id ? { ...u, ...patch } : u)) }));
  };
  const removeUnit = (id: string) => {
    const index = all.findIndex((w) => w.units.some((u) => u.id === id));
    if (index < 0) return;
    setRunAt(index, (w) => ({ ...w, units: w.units.filter((u) => u.id !== id) }));
    setSelected(null);
  };

  const fill = async () => {
    if (planUnits(plan).length && !window.confirm('Replace the units in this design with the ones from the answers?')) return;
    setFilling(true);
    try {
      const finishes = Object.fromEntries(Object.entries(questions.finishes).filter(([, v]) => v));
      const filled = await api.post<Plan>('/quote-maker/fill', {
        room_type: room,
        layout: plan.layout,
        walls: plan.walls.map((w) => w.length_mm),
        height_mm: plan.height_mm,
        island_mm: plan.island?.length_mm ?? null,
        upper: questions.upper,
        finishes: slotFinishes(finishes),
        gaps: questions.gaps,
      });
      change(filled);
      setSelected(null);
      toast.success(`Filled with ${planUnits(filled).length} units. Move, resize or remove any of them.`);
    } catch (caught) {
      toast.error(failed(caught));
    } finally {
      setFilling(false);
    }
  };
  /** The questions pick a finish per role; the API applies it per slot key, which the starter units name after their role. */
  const slotFinishes = (byRole: Record<string, string>) => {
    const out: Record<string, string> = {};
    for (const t of forRoom) for (const s of t.slots) for (const r of s.roles) if (byRole[r] && !out[s.key]) out[s.key] = byRole[r]!;
    return out;
  };

  const save = async () => {
    setSaving(true);
    try {
      const body = { title: title.trim() || null, room_type: room, design: plan };
      const saved = design ? await api.put<Design>(`/quote-maker/designs/${design.id}`, body) : await api.post<Design>('/quote-maker/designs', body);
      setDirty(false);
      toast.success(design ? 'Design saved.' : `Saved as ${saved.ref}.`);
      onSaved(saved);
      return saved;
    } catch (caught) {
      toast.error(failed(caught));
      return null;
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!design) return;
    try {
      await api.delete(`/quote-maker/designs/${design.id}`);
      setDirty(false);
      toast.success(`${design.ref} deleted.`);
      navigate('/quotes');
    } catch (caught) {
      toast.error(failed(caught));
      setDeleting(false);
    }
  };

  if (templates.error || stock.error || pricing.error)
    return <p className="p-6 text-sm text-danger">{templates.error ?? stock.error ?? pricing.error}</p>;
  if (!templates.data || !stock.data || !pricing.data) return <p className="p-6 text-sm text-ink-muted">Loading the unit library…</p>;

  const gapsForRoom = forRoom.filter((t) => t.mount === 'gap');
  const selectedTemplate = located ? byId.get(located.unit.template_id) : undefined;

  return (
    <div className="px-5 pb-16 pt-6 sm:px-8 lg:pt-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1 sm:max-w-md">
          <Input label="Design name" value={title} maxLength={120} placeholder={design?.ref ?? 'e.g. Smith kitchen, option A'} onChange={(e) => (setTitle(e.target.value), setDirty(true))} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {design ? (
            <>
              <Button icon={<Receipt size={16} aria-hidden="true" />} disabled={dirty} title={dirty ? 'Save first' : undefined} onClick={() => setProject('quote')}>
                Make quote
              </Button>
              <Button icon={<Package size={16} aria-hidden="true" />} disabled={dirty} title={dirty ? 'Save first' : undefined} onClick={() => setProject('materials')}>
                Add to project stock
              </Button>
              <Button variant="ghost" icon={<Trash size={16} aria-hidden="true" />} aria-label="Delete design" onClick={() => setDeleting(true)} />
            </>
          ) : null}
          <Button variant="primary" loading={saving} disabled={offWall.length > 0} icon={<FloppyDisk size={16} aria-hidden="true" />} onClick={() => void save()}>
            {dirty ? 'Save' : 'Saved'}
          </Button>
        </div>
      </header>

      {design?.enquiry || design?.quotes.length ? (
        <div className="mb-5 flex flex-wrap gap-x-6 gap-y-1 rounded-card bg-surface p-3 text-sm shadow-soft">
          {design.enquiry ? (
            <span>
              From the website: <strong>{design.enquiry.name}</strong> ({design.enquiry.email}),{' '}
              <Link className="font-semibold text-green-900 hover:underline" to={`/enquiries?id=${design.enquiry.id}`}>
                enquiry
              </Link>
            </span>
          ) : null}
          {design.quotes.length ? (
            <span>
              Quotes:{' '}
              {design.quotes.map((q, i) => (
                <span key={q.id}>
                  {i ? ', ' : ''}
                  <Link className="font-semibold text-green-900 hover:underline" to={`/quotes/${q.id}`}>
                    {q.number}
                  </Link>{' '}
                  ({q.status})
                </span>
              ))}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* The room, and the questions that fill it */}
          <section aria-labelledby="qm-room" className="rounded-card bg-surface p-4 shadow-soft">
            <h2 id="qm-room" className="mb-3 text-base font-semibold text-ink">Room</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Select label="Room type" value={room} onChange={(e) => (setRoom(e.target.value), setDirty(true))}>
                {[...ROOM_TYPES, CUSTOM_ROOM].map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </Select>
              <Select label="Layout" value={plan.layout} onChange={(e) => (change((p) => withLayout(p, e.target.value as Layout)), setRun(0))}>
                {LAYOUTS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </Select>
              <Input
                label="Ceiling (mm)"
                type="number"
                inputMode="numeric"
                min={LIMITS.height_min}
                max={LIMITS.height_max}
                value={plan.height_mm}
                onChange={(e) => change((p) => ({ ...p, height_mm: Number(e.target.value) || 0 }))}
              />
              {plan.walls.map((w, i) => (
                <Input
                  key={i}
                  label={`${wallLabel(plan, i)} length (mm)`}
                  type="number"
                  inputMode="numeric"
                  min={LIMITS.wall_min}
                  max={LIMITS.wall_max}
                  value={w.length_mm}
                  onChange={(e) => setRunAt(i, (wall) => ({ ...wall, length_mm: Number(e.target.value) || 0 }))}
                />
              ))}
              <div className="flex flex-col justify-end gap-1.5">
                <Toggle
                  label="Island"
                  checked={plan.island !== null}
                  onChange={(on) => change((p) => ({ ...p, island: on ? { length_mm: 1800, units: [] } : null }))}
                />
              </div>
              {plan.island ? (
                <Input
                  label="Island length (mm)"
                  type="number"
                  inputMode="numeric"
                  min={LIMITS.island_min}
                  max={LIMITS.island_max}
                  value={plan.island.length_mm}
                  onChange={(e) => setRunAt(plan.walls.length, (w) => ({ ...w, length_mm: Number(e.target.value) || 0 }))}
                />
              ) : null}
            </div>

            <details className="mt-4 rounded-control border border-border p-3 [&[open]>summary]:mb-3">
              <summary className="cursor-pointer text-sm font-semibold text-ink">Fill from questions</summary>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(['front', 'carcass', 'worktop'] as const).map((role) => (
                  <Select
                    key={role}
                    label={ROLE_LABEL[role]}
                    value={questions.finishes[role] ?? ''}
                    onChange={(e) => setQuestions((q) => ({ ...q, finishes: { ...q.finishes, [role]: e.target.value } }))}
                  >
                    <option value="">Default</option>
                    {boards([role]).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </Select>
                ))}
                <div className="flex flex-col justify-end">
                  <Toggle label="Wall units above" checked={questions.upper} onChange={(upper) => setQuestions((q) => ({ ...q, upper }))} />
                </div>
                {gapsForRoom.length ? (
                  <fieldset className="sm:col-span-2">
                    <legend className="text-sm font-semibold text-ink">Spaces to leave on {wallLabel(plan, 0)}</legend>
                    <div className="flex flex-wrap gap-x-4">
                      {gapsForRoom.map((g) => (
                        <Checkbox
                          key={g.id}
                          label={g.name}
                          checked={questions.gaps.includes(g.id)}
                          onChange={(on) => setQuestions((q) => ({ ...q, gaps: on ? [...q.gaps, g.id].slice(0, 6) : q.gaps.filter((id) => id !== g.id) }))}
                        />
                      ))}
                    </div>
                  </fieldset>
                ) : null}
              </div>
              <Button className="mt-3" loading={filling} icon={<Sparkle size={16} aria-hidden="true" />} onClick={() => void fill()}>
                Fill the room
              </Button>
            </details>
          </section>

          {/* The runs, from the front */}
          <section aria-labelledby="qm-runs" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="qm-runs" className="text-base font-semibold text-ink">Front view</h2>
              {all.length > 1 ? (
                <Tabs tabs={all.map((w, i) => ({ id: String(i), label: wallLabel(plan, i), count: w.units.length }))} active={String(active)} onChange={(id) => setRun(Number(id))} />
              ) : null}
            </div>
            {offWall.length ? (
              <p role="alert" className="rounded-card bg-danger-bg p-3 text-sm text-danger">
                Past the end of its wall: {offWall.join(', ')}. Move or remove it, or lengthen the wall, to save.
              </p>
            ) : null}
            <Elevation
              label={wallLabel(plan, active)}
              wall={wall}
              ceiling_mm={plan.height_mm}
              templates={byId}
              colourOf={colourOf}
              selectedId={selected}
              onSelect={setSelected}
              onMove={(id, x_mm) => setRunAt(active, (w) => ({ ...w, units: w.units.map((u) => (u.id === id ? { ...u, x_mm } : u)) }))}
              onRemove={removeUnit}
            />
            <p className="text-xs text-ink-muted">Drag a unit along the wall, or select it and use the arrow keys (Shift for 100 mm). Delete removes it.</p>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-card bg-surface p-4 shadow-soft">
                <h3 className="mb-2 text-sm font-semibold text-ink">Add to {wallLabel(plan, active)}</h3>
                {forRoom.length === 0 ? (
                  <p className="text-sm text-ink-muted">No active units for this room type. Add some in the Unit library.</p>
                ) : (
                  MOUNTS.map((mount) => {
                    const list = forRoom.filter((t) => t.mount === mount);
                    return list.length ? (
                      <div key={mount} className="mb-2">
                        <p className="mb-1 text-xs font-semibold text-ink-muted">{MOUNT_LABEL[mount]}s</p>
                        <div className="flex flex-wrap gap-1.5">
                          {list.map((t) => (
                            <Button
                              key={t.id}
                              className={clsx('min-h-9 px-2.5 text-[13px]', t.problems.length && 'border-warning/60')}
                              title={t.problems.join(' ') || undefined}
                              icon={<Plus size={14} aria-hidden="true" />}
                              onClick={() => add(t)}
                            >
                              {t.name}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ) : null;
                  })
                )}
              </div>

              <div className="rounded-card bg-surface p-4 shadow-soft">
                {located && selectedTemplate ? (
                  <UnitInspector
                    key={located.unit.id}
                    unit={located.unit}
                    template={selectedTemplate}
                    wallLength={all[located.index]!.length_mm}
                    boards={boards}
                    defaults={pricing.data.defaults}
                    items={items}
                    onChange={(patch) => updateUnit(located.unit.id, patch)}
                    onRemove={() => removeUnit(located.unit.id)}
                    onDuplicate={() => {
                      const width = selectedTemplate.variants.find((v) => v.id === located.unit.variant_id)?.width_mm ?? 0;
                      const copy = { ...located.unit, id: newUnitId(), x_mm: located.unit.x_mm + width };
                      if (copy.x_mm + width > all[located.index]!.length_mm) return toast.error('No room to the right of it.');
                      setRunAt(located.index, (w) => ({ ...w, units: [...w.units, copy] }));
                      setSelected(copy.id);
                    }}
                  />
                ) : (
                  <p className="text-sm text-ink-muted">Select a unit to change its size, position or finishes.</p>
                )}
              </div>
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-4 xl:self-start">
          <div className="rounded-card bg-surface p-4 shadow-soft">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink">3D view</h2>
              <Button variant="ghost" className="min-h-8 px-2 text-[13px]" icon={<Cube size={16} aria-hidden="true" />} aria-pressed={show3d} onClick={() => setShow3d((v) => !v)}>
                {show3d ? 'Hide' : 'Show'}
              </Button>
            </div>
            {show3d ? (
              <Suspense fallback={<div className="aspect-[4/3] animate-pulse rounded-card bg-surface-muted" />}>
                <Preview3D plan={plan} templates={byId} colourOf={colourOf} />
              </Suspense>
            ) : null}
          </div>
          <div className="rounded-card bg-surface p-4 shadow-soft">
            <h2 className="mb-3 text-base font-semibold text-ink">Price</h2>
            <BreakdownPanel breakdown={breakdown.data} error={breakdown.error} items={items} />
          </div>
        </aside>
      </div>

      {design ? (
        <ProjectPicker
          mode={project}
          onClose={() => setProject(null)}
          onDone={async (projectId) => {
            if (project === 'quote') {
              const quote = await api.post<{ id: string; number: string }>(`/quote-maker/designs/${design.id}/quote`, { project_id: projectId });
              toast.success(`Draft quote ${quote.number} made. Check it, then send it.`);
              navigate(`/quotes/${quote.id}`);
            } else {
              const result = await api.post<{ changed: number; lines: number }>(`/quote-maker/designs/${design.id}/materials`, { project_id: projectId });
              toast.success(result.changed ? `${result.changed} of ${result.lines} items added to the project's needs.` : 'The project already needs all of it.');
              setProject(null);
            }
          }}
        />
      ) : null}
      <ConfirmDialog
        open={deleting}
        title={`Delete ${design?.ref ?? 'design'}?`}
        message="The design goes for good. Quotes made from it stay, without the link."
        onConfirm={() => void remove()}
        onCancel={() => setDeleting(false)}
      />
    </div>
  );
}

function UnitInspector({
  unit,
  template,
  wallLength,
  boards,
  defaults,
  items,
  onChange,
  onRemove,
  onDuplicate,
}: {
  unit: PlanWall['units'][number];
  template: UnitTemplate;
  wallLength: number;
  boards: (roles: BoardRole[]) => StockItem[];
  defaults: Pricing['defaults'];
  items: Map<string, StockItem>;
  onChange: (patch: Partial<PlanWall['units'][number]>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const variant = template.variants.find((v) => v.id === unit.variant_id);
  const setFinish = (key: string, id: string) => {
    const next = { ...(unit.finishes ?? {}) };
    if (id) next[key] = id;
    else delete next[key];
    onChange({ finishes: Object.keys(next).length ? next : undefined });
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">{template.name}</h3>
          <p className="tabular text-xs text-ink-muted">
            {MOUNT_LABEL[template.mount]}
            {variant ? ` · ${variant.width_mm} × ${variant.height_mm} × ${variant.depth_mm} mm` : ''}
            {template.mount === 'wall' ? ` · ${bottomOf(template)} mm off the floor` : ''}
          </p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" className="min-h-8 px-2" icon={<Copy size={16} aria-hidden="true" />} aria-label="Duplicate to the right" onClick={onDuplicate} />
          <Button variant="ghost" className="min-h-8 px-2" icon={<Trash size={16} aria-hidden="true" />} aria-label="Remove unit" onClick={onRemove} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select label="Width" value={unit.variant_id} onChange={(e) => onChange({ variant_id: e.target.value })}>
          {template.variants.map((v) => (
            <option key={v.id} value={v.id} disabled={unit.x_mm + v.width_mm > wallLength}>
              {v.width_mm} mm
            </option>
          ))}
        </Select>
        <Input
          label="From left (mm)"
          type="number"
          inputMode="numeric"
          min={0}
          step={10}
          max={Math.max(0, wallLength - (variant?.width_mm ?? 0))}
          value={unit.x_mm}
          onChange={(e) => onChange({ x_mm: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
        />
      </div>
      {template.mount === 'gap'
        ? null
        : template.slots.map((slot) => {
            const fallback = slot.default_item_id ?? slot.roles.map((r) => defaults[r]).find(Boolean) ?? null;
            return (
              <Select key={slot.key} label={slot.label} value={unit.finishes?.[slot.key] ?? ''} onChange={(e) => setFinish(slot.key, e.target.value)}>
                <option value="">Default{fallback && items.get(fallback) ? ` (${items.get(fallback)!.name})` : ''}</option>
                {boards(slot.roles).map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                    {i.show_on_site ? '' : ' · trade only'}
                  </option>
                ))}
              </Select>
            );
          })}
    </div>
  );
}

function ProjectPicker({ mode, onClose, onDone }: { mode: 'quote' | 'materials' | null; onClose: () => void; onDone: (projectId: string) => Promise<void> }) {
  const projects = useQuery<Project[]>(mode ? '/projects' : null);
  const [projectId, setProjectId] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setPending(true);
    setError(null);
    try {
      await onDone(projectId);
    } catch (caught) {
      setError(failed(caught));
    } finally {
      setPending(false);
    }
  };
  return (
    <Modal
      open={mode !== null}
      onClose={onClose}
      title={mode === 'quote' ? 'Make a quote' : 'Add to project stock'}
      description={
        mode === 'quote'
          ? 'A Draft quote for this project: one line per kind of unit, with its cost and your margin. Edit it in Quotes before sending.'
          : 'Whole sheets per board and each fitting, as needs on the project. A need already as big is left as it is.'
      }
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={pending} disabled={!projectId} onClick={() => void submit()}>
            {mode === 'quote' ? 'Make Draft quote' : 'Add needs'}
          </Button>
        </>
      }
    >
      <Select label="Project" required value={projectId} onChange={(e) => setProjectId(e.target.value)} error={error ?? projects.error ?? undefined}>
        <option value="">{projects.data ? 'Choose a project' : 'Loading projects…'}</option>
        {(projects.data ?? []).map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.client_name ? ` · ${p.client_name}` : ''}
          </option>
        ))}
      </Select>
      {mode === 'quote' ? <p className="mt-2 text-xs text-ink-muted">Need a new project? Add it on the client's page first.</p> : null}
    </Modal>
  );
}

