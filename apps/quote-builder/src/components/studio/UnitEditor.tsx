"use client";

// One unit's full definition. Edits save as you make them — the planner in
// another tab reprices immediately — so there is no draft to lose.
//
// The panel list per size is what gets priced and what the 3D model is built
// from. The recipe underneath is only a generator: sizes whose panels still
// match it are rebuilt automatically when the size or recipe changes; sizes
// edited by hand are left alone and say so.
import dynamic from "next/dynamic";
import { Copy, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { mm, plural, pounds } from "@/lib/format";
import { makeId } from "@/lib/ids";
import { CATEGORIES, CATEGORY_LABELS, MOUNT_LABELS } from "@/lib/labels";
import { PANEL_ROLES, generatePanels, matchesRecipe, panelArea, slotForRole } from "@/lib/panels";
import { computeEstimate, slotColours } from "@/lib/pricing";
import { catalogueStore } from "@/lib/store";
import type {
  BoardCategory,
  Catalogue,
  MaterialSlot,
  Mount,
  PanelRole,
  PanelSpec,
  RoomTypeId,
  SizeVariant,
  UnitStructure,
  UnitTemplate,
} from "@/lib/types";
import { ElevationGlyph, glyphColours } from "../ElevationGlyph";
import { Button, Field, NumberInput, Segmented, Toggle, inputClass } from "../ui";

const UnitPreviewCanvas = dynamic(() => import("../three/UnitPreviewCanvas"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-muted/60" />,
});

type Size = Pick<SizeVariant, "widthMm" | "heightMm" | "depthMm">;

export function UnitEditor({
  unit,
  catalogue,
  onDeleted,
}: {
  unit: UnitTemplate;
  catalogue: Catalogue;
  onDeleted: () => void;
}) {
  const [variantId, setVariantId] = useState(unit.variants[0]?.id ?? "");
  const variant = unit.variants.find((v) => v.id === variantId) ?? unit.variants[0];

  const save = (fn: (u: UnitTemplate) => UnitTemplate) =>
    catalogueStore.update((c) => ({ ...c, units: c.units.map((u) => (u.id === unit.id ? fn(u) : u)) }));

  const set = <K extends keyof UnitTemplate>(key: K, value: UnitTemplate[K]) => save((u) => ({ ...u, [key]: value }));

  const colours = slotColours(catalogue, unit, {});
  const colourFor = (slot: string) => colours[slot] ?? "#D4C9B5";

  const single = useMemo(
    () =>
      variant
        ? computeEstimate([{ id: "preview", templateId: unit.id, variantId: variant.id, materials: {} }], catalogue)
        : null,
    [catalogue, unit.id, variant],
  );

  const duplicate = () => {
    const copy: UnitTemplate = {
      ...structuredClone(unit),
      id: makeId("unit"),
      name: `${unit.name} (copy)`,
      variants: unit.variants.map((v) => ({
        ...structuredClone(v),
        id: makeId("size"),
        panels: v.panels.map((p) => ({ ...p, id: makeId("pnl") })),
      })),
    };
    catalogueStore.update((c) => ({ ...c, units: [...c.units, copy] }));
    toast.success(`${copy.name} created`);
  };

  const remove = () => {
    if (!window.confirm(`Delete ${unit.name}? It disappears from the palette, and plans that use it lose it from their price.`)) return;
    catalogueStore.update((c) => ({ ...c, units: c.units.filter((u) => u.id !== unit.id) }));
    onDeleted();
    toast.success("Unit deleted");
  };

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-[1.75rem]">{unit.name || "Untitled unit"}</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">Changes save automatically.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={duplicate}>
              <Copy size={14} aria-hidden="true" />
              Duplicate
            </Button>
            <Button variant="danger" size="sm" onClick={remove}>
              <Trash2 size={14} aria-hidden="true" />
              Delete
            </Button>
          </div>
        </div>

        <Ledger title="About this unit">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Name" htmlFor="unit-name">
              <input id="unit-name" className={inputClass} value={unit.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="Hardware and fitting, per unit" htmlFor="unit-extras" hint="Hinges, runners, handles, fixings and fitting time. Added before margin.">
              <NumberInput
                id="unit-extras"
                prefix="£"
                step={0.01}
                value={unit.extrasPence / 100}
                onChange={(v) => set("extrasPence", Math.round(v * 100))}
              />
            </Field>
            <Field label="Description" htmlFor="unit-description" className="md:col-span-2">
              <input
                id="unit-description"
                className={inputClass}
                value={unit.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Shown to customers under the unit's name"
              />
            </Field>
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <span className="text-[13px] font-medium">Where it goes</span>
              <Segmented<Mount>
                label="Where it goes"
                value={unit.mount}
                onChange={(mount) => save((u) => ({ ...u, mount, elevationMm: mount === "wall" ? u.elevationMm || 1450 : 0 }))}
                options={(Object.keys(MOUNT_LABELS) as Mount[]).map((m) => ({ value: m, label: MOUNT_LABELS[m] }))}
              />
            </div>
            {unit.mount === "wall" && (
              <Field label="Height of its underside above the floor" htmlFor="unit-elevation">
                <NumberInput id="unit-elevation" suffix="mm" min={0} max={3000} value={unit.elevationMm} onChange={(v) => set("elevationMm", v)} />
              </Field>
            )}
            <fieldset className="md:col-span-2">
              <legend className="text-[13px] font-medium">Offered in</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {catalogue.roomTypes.map((room) => {
                  const on = unit.roomTypes.includes(room.id);
                  return (
                    <label
                      key={room.id}
                      className={cn(
                        "cursor-pointer rounded-full border px-3.5 py-1.5 text-[13px] transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                        on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={on}
                        onChange={() =>
                          set(
                            "roomTypes",
                            on ? unit.roomTypes.filter((r) => r !== room.id) : [...unit.roomTypes, room.id as RoomTypeId],
                          )
                        }
                      />
                      {room.name}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </div>
        </Ledger>

        <SlotsLedger unit={unit} catalogue={catalogue} save={save} />

        <SizesLedger unit={unit} variant={variant} onSelect={setVariantId} save={save} />
      </div>

      <aside aria-label="Preview" className="xl:sticky xl:top-6 xl:self-start">
        <div className="overflow-hidden rounded-[20px] border border-border/70 bg-card">
          <div className="relative h-[300px]">
            {variant && <UnitPreviewCanvas variant={variant} colourFor={colourFor} elevationMm={unit.mount === "wall" ? unit.elevationMm : 0} />}
            <p className="pointer-events-none absolute bottom-3 left-4 text-[12px] text-muted-foreground">Drag to turn, scroll to zoom</p>
          </div>
          {variant && (
            <div className="flex items-end gap-5 border-t border-border/70 p-5">
              <ElevationGlyph template={unit} variant={variant} colours={glyphColours(colours)} className="h-24 w-24 shrink-0" />
              <div className="min-w-0 text-[13px]">
                <p className="font-medium text-foreground">Front elevation</p>
                <p className="mt-1 font-display tabular-nums text-muted-foreground">
                  {variant.widthMm} wide, {variant.heightMm} high, {variant.depthMm} deep
                </p>
              </div>
            </div>
          )}
          {single && variant && (
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 border-t border-border/70 p-5 text-[13px]">
              <dt className="col-span-2 pb-1 font-medium text-foreground">One on its own, in default finishes</dt>
              <dt className="text-muted-foreground">Boards ({plural(single.sheetCount, "sheet")})</dt>
              <dd className="text-right font-display tabular-nums">{pounds(single.boardsCostPence)}</dd>
              <dt className="text-muted-foreground">Hardware and fitting</dt>
              <dd className="text-right font-display tabular-nums">{pounds(single.extrasCostPence)}</dd>
              <dt className="text-muted-foreground">Cost</dt>
              <dd className="text-right font-display tabular-nums">{pounds(single.costPence)}</dd>
              <dt className="font-medium text-primary">Customer price</dt>
              <dd className="text-right font-display font-medium tabular-nums text-primary">{pounds(single.pricePence)}</dd>
              <dd className="col-span-2 pt-2 text-[12px] leading-snug text-muted-foreground">
                In a real plan, pieces share sheets with other units, so each unit costs less than this.
              </dd>
            </dl>
          )}
        </div>
      </aside>
    </div>
  );
}

function Ledger({ title, description, children, action }: { title: string; description?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="mt-8 border-t border-border/70 pt-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-[64ch]">
          <h3 className="text-[1.15rem]">{title}</h3>
          {description && <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function slugKey(label: string, taken: string[]): string {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "slot";
  let key = base;
  let n = 2;
  while (taken.includes(key)) key = `${base}-${n++}`;
  return key;
}

function SlotsLedger({
  unit,
  catalogue,
  save,
}: {
  unit: UnitTemplate;
  catalogue: Catalogue;
  save: (fn: (u: UnitTemplate) => UnitTemplate) => void;
}) {
  const setSlot = (key: string, patch: Partial<MaterialSlot>) =>
    save((u) => ({ ...u, slots: u.slots.map((s) => (s.key === key ? { ...s, ...patch } : s)) }));

  const toggleCategory = (slot: MaterialSlot, category: BoardCategory) => {
    const categories = slot.categories.includes(category)
      ? slot.categories.filter((c) => c !== category)
      : [...slot.categories, category];
    if (categories.length === 0) return;
    const current = catalogue.boards.find((b) => b.id === slot.defaultBoardId);
    const defaultBoardId =
      current && categories.includes(current.category)
        ? slot.defaultBoardId
        : (catalogue.boards.find((b) => categories.includes(b.category))?.id ?? slot.defaultBoardId);
    setSlot(slot.key, { categories, defaultBoardId });
  };

  const addSlot = () =>
    save((u) => {
      const key = slugKey("Extra material", u.slots.map((s) => s.key));
      const board = catalogue.boards.find((b) => b.category === "carcass");
      return {
        ...u,
        slots: [...u.slots, { key, label: "Extra material", categories: ["carcass"], defaultBoardId: board?.id ?? "" }],
      };
    });

  const removeSlot = (key: string) =>
    save((u) => {
      const slots = u.slots.filter((s) => s.key !== key);
      const fallback = slots[0]?.key ?? "";
      return {
        ...u,
        slots,
        variants: u.variants.map((v) => ({
          ...v,
          panels: v.panels.map((p) => (p.slot === key ? { ...p, slot: fallback } : p)),
        })),
      };
    });

  return (
    <Ledger
      title="Material choices"
      description="Each choice is a set of panels the customer picks one board for, such as the carcass or the doors. The default is used until they choose."
      action={
        <Button variant="secondary" size="sm" onClick={addSlot}>
          <Plus size={14} aria-hidden="true" />
          Add a choice
        </Button>
      }
    >
      <div className="flex flex-col">
        {unit.slots.map((slot) => {
          const options = catalogue.boards.filter((b) => slot.categories.includes(b.category));
          return (
            <div key={slot.key} className="grid gap-3 border-t border-border/60 py-4 md:grid-cols-[1fr_1.2fr_1.2fr_auto] md:items-end">
              <Field label="Name" htmlFor={`slot-${slot.key}-label`}>
                <input
                  id={`slot-${slot.key}-label`}
                  className={inputClass}
                  value={slot.label}
                  onChange={(e) => setSlot(slot.key, { label: e.target.value })}
                />
              </Field>
              <fieldset>
                <legend className="mb-1.5 text-[13px] font-medium">Board kinds allowed</legend>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((c) => {
                    const on = slot.categories.includes(c);
                    return (
                      <label
                        key={c}
                        className={cn(
                          "cursor-pointer rounded-full border px-2.5 py-1 text-[12px] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                          on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
                        )}
                      >
                        <input type="checkbox" className="sr-only" checked={on} onChange={() => toggleCategory(slot, c)} />
                        {CATEGORY_LABELS[c]}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <Field label="Default board" htmlFor={`slot-${slot.key}-default`}>
                <select
                  id={`slot-${slot.key}-default`}
                  className={inputClass}
                  value={slot.defaultBoardId}
                  onChange={(e) => setSlot(slot.key, { defaultBoardId: e.target.value })}
                >
                  {options.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </Field>
              <button
                type="button"
                onClick={() => removeSlot(slot.key)}
                disabled={unit.slots.length === 1}
                aria-label={`Remove ${slot.label}`}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-30"
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </Ledger>
  );
}

function SizesLedger({
  unit,
  variant,
  onSelect,
  save,
}: {
  unit: UnitTemplate;
  variant: SizeVariant | undefined;
  onSelect: (id: string) => void;
  save: (fn: (u: UnitTemplate) => UnitTemplate) => void;
}) {
  const [draft, setDraft] = useState<Size>({
    widthMm: variant?.widthMm ?? 600,
    heightMm: variant?.heightMm ?? 720,
    depthMm: variant?.depthMm ?? 560,
  });

  const standard = variant ? matchesRecipe(variant.panels, unit.structure, variant, unit.slots) : true;

  const saveVariant = (id: string, fn: (v: SizeVariant) => SizeVariant) =>
    save((u) => ({ ...u, variants: u.variants.map((v) => (v.id === id ? fn(v) : v)) }));

  const resize = (patch: Partial<Size>) => {
    if (!variant) return;
    saveVariant(variant.id, (v) => {
      const next = { ...v, ...patch };
      return matchesRecipe(v.panels, unit.structure, v, unit.slots)
        ? { ...next, panels: generatePanels(unit.structure, next, unit.slots) }
        : next;
    });
  };

  const setStructure = (patch: Partial<UnitStructure>) =>
    save((u) => {
      const structure = { ...u.structure, ...patch };
      return {
        ...u,
        structure,
        variants: u.variants.map((v) =>
          matchesRecipe(v.panels, u.structure, v, u.slots) ? { ...v, panels: generatePanels(structure, v, u.slots) } : v,
        ),
      };
    });

  const addSize = () => {
    if (unit.variants.some((v) => v.widthMm === draft.widthMm && v.heightMm === draft.heightMm && v.depthMm === draft.depthMm)) {
      toast.error("That size already exists.");
      return;
    }
    const next: SizeVariant = { id: makeId("size"), ...draft, panels: generatePanels(unit.structure, draft, unit.slots) };
    save((u) => ({ ...u, variants: [...u.variants, next].sort((a, b) => a.widthMm - b.widthMm) }));
    onSelect(next.id);
    toast.success(`${draft.widthMm} mm size added`);
  };

  const removeSize = () => {
    if (!variant || unit.variants.length === 1) return;
    save((u) => ({ ...u, variants: u.variants.filter((v) => v.id !== variant.id) }));
    onSelect(unit.variants.find((v) => v.id !== variant.id)?.id ?? "");
  };

  const rebuild = () => {
    if (!variant) return;
    if (!standard && !window.confirm("Replace the hand-edited panels for this size with the standard recipe?")) return;
    saveVariant(variant.id, (v) => ({ ...v, panels: generatePanels(unit.structure, v, unit.slots) }));
  };

  const setPanel = (id: string, patch: Partial<PanelSpec>) =>
    variant && saveVariant(variant.id, (v) => ({ ...v, panels: v.panels.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));

  const addPanel = () =>
    variant &&
    saveVariant(variant.id, (v) => ({
      ...v,
      panels: [
        ...v.panels,
        { id: makeId("pnl"), role: "other", label: "New piece", slot: slotForRole("other", unit.slots), lengthMm: 600, widthMm: 300, qty: 1 },
      ],
    }));

  const removePanel = (id: string) => variant && saveVariant(variant.id, (v) => ({ ...v, panels: v.panels.filter((p) => p.id !== id) }));

  const pieces = variant?.panels.reduce((n, p) => n + p.qty, 0) ?? 0;
  const area = (variant?.panels.reduce((n, p) => n + panelArea(p), 0) ?? 0) / 1_000_000;

  return (
    <>
      <Ledger
        title="Standard panel recipe"
        description="How the panel list is built for a new size. Sizes you haven't edited by hand are rebuilt when you change this."
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <Field label="Doors (most)" htmlFor="st-doors" hint="One per 600 mm of width, up to this.">
            <NumberInput id="st-doors" min={0} max={6} value={unit.structure.doors} onChange={(v) => setStructure({ doors: v })} />
          </Field>
          <Field label="Drawers" htmlFor="st-drawers">
            <NumberInput id="st-drawers" min={0} max={8} value={unit.structure.drawers} onChange={(v) => setStructure({ drawers: v })} />
          </Field>
          <Field label="Shelves" htmlFor="st-shelves">
            <NumberInput id="st-shelves" min={0} max={12} value={unit.structure.shelves} onChange={(v) => setStructure({ shelves: v })} />
          </Field>
          <Field label="Plinth height" htmlFor="st-plinth">
            <NumberInput id="st-plinth" suffix="mm" min={0} max={300} value={unit.structure.plinthMm} onChange={(v) => setStructure({ plinthMm: v })} />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-6">
          <Toggle id="st-back" checked={unit.structure.back} onChange={(v) => setStructure({ back: v })} label={<span className="text-[13.5px]">Back panel</span>} />
          <Toggle id="st-worktop" checked={unit.structure.worktop} onChange={(v) => setStructure({ worktop: v })} label={<span className="text-[13.5px]">Worktop section on top</span>} />
        </div>
      </Ledger>

      <Ledger title="Sizes and panels" description="Every size the customer can pick, and the pieces cut to make one.">
        <div role="tablist" aria-label="Sizes" className="flex flex-wrap gap-2">
          {unit.variants.map((v) => (
            <button
              key={v.id}
              role="tab"
              type="button"
              aria-selected={v.id === variant?.id}
              onClick={() => onSelect(v.id)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 font-display text-[13px] tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                v.id === variant?.id ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary",
              )}
            >
              {v.widthMm} wide
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-3 rounded-xl bg-card p-4 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto] sm:items-end">
          <Field label="New size: width" htmlFor="new-w">
            <NumberInput id="new-w" suffix="mm" min={100} max={3000} value={draft.widthMm} onChange={(v) => setDraft((d) => ({ ...d, widthMm: v }))} />
          </Field>
          <Field label="Height" htmlFor="new-h">
            <NumberInput id="new-h" suffix="mm" min={100} max={3000} value={draft.heightMm} onChange={(v) => setDraft((d) => ({ ...d, heightMm: v }))} />
          </Field>
          <Field label="Depth" htmlFor="new-d">
            <NumberInput id="new-d" suffix="mm" min={20} max={1200} value={draft.depthMm} onChange={(v) => setDraft((d) => ({ ...d, depthMm: v }))} />
          </Field>
          <Button variant="secondary" onClick={addSize}>
            <Plus size={15} aria-hidden="true" />
            Add size
          </Button>
        </div>

        {variant && (
          <div className="mt-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="grid grid-cols-3 gap-3">
                <Field label="Width" htmlFor="v-w">
                  <NumberInput id="v-w" suffix="mm" min={100} max={3000} value={variant.widthMm} onChange={(v) => resize({ widthMm: v })} />
                </Field>
                <Field label="Height" htmlFor="v-h">
                  <NumberInput id="v-h" suffix="mm" min={100} max={3000} value={variant.heightMm} onChange={(v) => resize({ heightMm: v })} />
                </Field>
                <Field label="Depth" htmlFor="v-d">
                  <NumberInput id="v-d" suffix="mm" min={20} max={1200} value={variant.depthMm} onChange={(v) => resize({ depthMm: v })} />
                </Field>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={rebuild}>
                  <RotateCcw size={14} aria-hidden="true" />
                  Rebuild from recipe
                </Button>
                <Button variant="danger" size="sm" onClick={removeSize} disabled={unit.variants.length === 1}>
                  Remove this size
                </Button>
              </div>
            </div>
            {!standard && (
              <p className="mt-3 rounded-lg bg-accent/40 px-3 py-2 text-[12.5px] text-foreground">
                These panels were edited by hand, so they won&rsquo;t change when the size or recipe does.
              </p>
            )}

            <div className="relative mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="text-[12px] text-muted-foreground">
                    <th scope="col" className="py-2 pr-2 font-normal">Part</th>
                    <th scope="col" className="py-2 pr-2 font-normal">Name</th>
                    <th scope="col" className="py-2 pr-2 font-normal">Cut from</th>
                    <th scope="col" className="py-2 pr-2 font-normal">Length</th>
                    <th scope="col" className="py-2 pr-2 font-normal">Width</th>
                    <th scope="col" className="py-2 pr-2 font-normal">Qty</th>
                    <th scope="col" className="py-2 font-normal"><span className="sr-only">Remove</span></th>
                  </tr>
                </thead>
                <tbody>
                  {variant.panels.map((panel) => (
                    <tr key={panel.id} className="border-t border-border/60 align-top">
                      <td className="py-2 pr-2">
                        <select
                          aria-label="Part"
                          className={cn(inputClass, "py-2")}
                          value={panel.role}
                          onChange={(e) => setPanel(panel.id, { role: e.target.value as PanelRole })}
                        >
                          {PANEL_ROLES.map((r) => (
                            <option key={r.role} value={r.role}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-2">
                        <input aria-label="Name" className={cn(inputClass, "py-2")} value={panel.label} onChange={(e) => setPanel(panel.id, { label: e.target.value })} />
                      </td>
                      <td className="py-2 pr-2">
                        <select aria-label="Cut from" className={cn(inputClass, "py-2")} value={panel.slot} onChange={(e) => setPanel(panel.id, { slot: e.target.value })}>
                          {unit.slots.map((s) => (
                            <option key={s.key} value={s.key}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="w-28 py-2 pr-2">
                        <NumberInput ariaLabel="Length in mm" min={1} max={6000} value={panel.lengthMm} onChange={(v) => setPanel(panel.id, { lengthMm: v })} />
                      </td>
                      <td className="w-28 py-2 pr-2">
                        <NumberInput ariaLabel="Width in mm" min={1} max={3000} value={panel.widthMm} onChange={(v) => setPanel(panel.id, { widthMm: v })} />
                      </td>
                      <td className="w-20 py-2 pr-2">
                        <NumberInput ariaLabel="Quantity" min={1} max={50} value={panel.qty} onChange={(v) => setPanel(panel.id, { qty: v })} />
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removePanel(panel.id)}
                          aria-label={`Remove ${panel.label}`}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-destructive"
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-3">
              <Button variant="ghost" size="sm" onClick={addPanel}>
                <Plus size={14} aria-hidden="true" />
                Add a piece
              </Button>
              <p className="font-display text-[12.5px] tabular-nums text-muted-foreground">
                {plural(pieces, "piece")}, {area.toFixed(2)} m² of board, largest {mm(Math.max(0, ...variant.panels.map((p) => p.lengthMm)))}
              </p>
            </div>
          </div>
        )}
      </Ledger>
    </>
  );
}
