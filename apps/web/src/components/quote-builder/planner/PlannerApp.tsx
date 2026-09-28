"use client";

// The customer's planner: room → layout → estimate. The plan is saved to
// the browser on every change, so closing the tab loses nothing.
import dynamic from "next/dynamic";
import { Box, Check, Map as MapIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { findIssues, firstFreeSpot, footprint, snapPlacement, verticalSpan, type Point } from "@/lib/quote-builder/geometry";
import { makeId, makeReference } from "@/lib/quote-builder/ids";
import { findTemplate, findVariant, slotColours } from "@/lib/quote-builder/pricing";
import { estimatesStore, planStore, useCatalogue, useHydrated, usePlan } from "@/lib/quote-builder/store";
import type { Catalogue, PlacedUnit, Plan, RoomSpec, Rotation, UnitTemplate } from "@/lib/quote-builder/types";
import { CompactSlip, EstimateDetail, MobilePriceBar } from "../EstimateSlip";
import { ToolShell } from "../ToolShell";
import { Button, Segmented } from "../ui";
import { useEstimate } from "../useEstimate";
import { EstimateStep } from "./EstimateStep";
import { PlanCanvas, type CanvasItem } from "./PlanCanvas";
import { RoomStep } from "./RoomStep";
import { UnitInspector } from "./UnitInspector";
import { UnitPalette } from "./UnitPalette";

const RoomCanvas = dynamic(() => import("../three/RoomCanvas"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-[13px] text-muted-foreground">Setting up the 3D view…</div>,
});

export type Step = "room" | "layout" | "estimate";

const STEPS: { id: Step; label: string }[] = [
  { id: "room", label: "Your room" },
  { id: "layout", label: "Layout and finishes" },
  { id: "estimate", label: "Estimate" },
];

/** The size a new unit starts at: the one nearest the standard 600mm. */
function startingSize(template: UnitTemplate) {
  return [...template.variants].sort((a, b) => Math.abs(a.widthMm - 600) - Math.abs(b.widthMm - 600))[0];
}

/** New units pick up the finishes of the last unit placed, where the same choice exists. */
function inheritedMaterials(plan: Plan, template: UnitTemplate, catalogue: Catalogue): Record<string, string> {
  const last = plan.units[plan.units.length - 1];
  if (!last) return {};
  const materials: Record<string, string> = {};
  for (const slot of template.slots) {
    const board = catalogue.boards.find((b) => b.id === last.materials[slot.key]);
    if (board && slot.categories.includes(board.category)) materials[slot.key] = board.id;
  }
  return materials;
}

export function PlannerApp({ studio, initialStep }: { studio: boolean; initialStep?: Step }) {
  const plan = usePlan();
  const catalogue = useCatalogue();
  const hydrated = useHydrated();
  const [chosenStep, setChosenStep] = useState<Step | null>(initialStep ?? null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"plan" | "3d">("plan");
  const [savedReference, setSavedReference] = useState<string | null>(null);

  const step: Step = chosenStep ?? (plan.units.length > 0 ? "layout" : "room");

  const items: CanvasItem[] = useMemo(
    () =>
      plan.units.flatMap((unit) => {
        const template = findTemplate(catalogue, unit.templateId);
        const variant = findVariant(template, unit.variantId);
        if (!template || !variant) return [];
        return [{ unit, template, variant, colours: slotColours(catalogue, template, unit.materials) }];
      }),
    [plan.units, catalogue],
  );
  const estimate = useEstimate(plan.units, catalogue);
  const issues = useMemo(
    () => findIssues(items.map((i) => ({ unit: i.unit, template: i.template, size: i.variant })), plan.room),
    [items, plan.room],
  );

  const update = (fn: (p: Plan) => Plan) => {
    if (!planStore.update(fn)) toast.error("Your browser would not save the plan. Check it isn't in private mode.");
    setSavedReference(null);
  };
  const patchUnit = (id: string, patch: Partial<PlacedUnit>) =>
    update((p) => ({ ...p, units: p.units.map((u) => (u.id === id ? { ...u, ...patch } : u)) }));

  const occupiedExcept = (id?: string) =>
    items
      .filter((i) => i.unit.id !== id)
      .map((i) => ({ box: footprint(i.unit, i.variant), span: verticalSpan(i.template, i.variant), rotation: i.unit.rotation }));

  const addUnit = (templateId: string, point?: Point) => {
    const template = findTemplate(catalogue, templateId);
    if (!template || template.variants.length === 0) return;
    const size = startingSize(template);
    const placement = point
      ? snapPlacement(point, size, 0, plan.room, occupiedExcept())
      : firstFreeSpot(size, verticalSpan(template, size), plan.room, occupiedExcept());
    const unit: PlacedUnit = {
      id: makeId("u"),
      templateId,
      variantId: size.id,
      x: placement.x,
      y: placement.y,
      rotation: placement.rotation,
      materials: inheritedMaterials(plan, template, catalogue),
    };
    update((p) => ({ ...p, units: [...p.units, unit] }));
    setSelectedId(unit.id);
  };

  const removeUnit = (id: string) => {
    update((p) => ({ ...p, units: p.units.filter((u) => u.id !== id) }));
    setSelectedId(null);
  };

  const rotateUnit = (id: string) => {
    const unit = plan.units.find((u) => u.id === id);
    if (unit) patchUnit(id, { rotation: (((unit.rotation + 90) % 360) as Rotation) });
  };

  const duplicateUnit = (id: string) => {
    const item = items.find((i) => i.unit.id === id);
    if (!item) return;
    const spot = firstFreeSpot(item.variant, verticalSpan(item.template, item.variant), plan.room, occupiedExcept());
    const copy: PlacedUnit = { ...item.unit, id: makeId("u"), ...spot };
    update((p) => ({ ...p, units: [...p.units, copy] }));
    setSelectedId(copy.id);
  };

  const applyFinishesToAll = (id: string) => {
    const source = plan.units.find((u) => u.id === id);
    const sourceTemplate = source && findTemplate(catalogue, source.templateId);
    if (!source || !sourceTemplate) return;
    update((p) => ({
      ...p,
      units: p.units.map((u) => {
        const template = findTemplate(catalogue, u.templateId);
        if (!template) return u;
        const materials = { ...u.materials };
        for (const slot of template.slots) {
          const board = catalogue.boards.find(
            (b) => b.id === source.materials[slot.key] || (!source.materials[slot.key] && b.id === sourceTemplate.slots.find((s) => s.key === slot.key)?.defaultBoardId),
          );
          if (board && slot.categories.includes(board.category)) materials[slot.key] = board.id;
        }
        return { ...u, materials };
      }),
    }));
    toast.success("Finishes applied to every unit that offers them");
  };

  const clearPlan = () => {
    if (!window.confirm("Remove every unit from the plan? Your room size stays.")) return;
    update((p) => ({ ...p, units: [] }));
    setSelectedId(null);
  };

  const saveEstimate = () => {
    const reference = makeReference();
    const ok = estimatesStore.update((list) => [
      {
        id: makeId("est"),
        reference,
        createdAt: new Date().toISOString(),
        source: "planner",
        plan: structuredClone(plan),
        lowPence: estimate.lowPence,
        highPence: estimate.highPence,
        pricePence: estimate.pricePence,
        costPence: estimate.costPence,
        sheetCount: estimate.sheetCount,
      },
      ...list,
    ]);
    if (!ok) {
      toast.error("The estimate could not be saved in this browser.");
      return;
    }
    setSavedReference(reference);
    toast.success(`Estimate saved as ${reference}`);
  };

  const selected = items.find((i) => i.unit.id === selectedId);
  const goto = (s: Step) => {
    setChosenStep(s);
    if (s !== "layout") setSelectedId(null);
  };

  return (
    <ToolShell section="Room planner" fixedHeight badge={studio ? "Staff view, costs shown" : undefined}>
      <div className="flex flex-col lg:h-full">
        <nav aria-label="Planner steps" className="border-b border-border/70 px-5 py-3 md:px-8">
          <ol className="flex items-center gap-2 overflow-x-auto">
            {STEPS.map((s, i) => {
              const active = s.id === step;
              const done = STEPS.findIndex((x) => x.id === step) > i;
              return (
                <li key={s.id} className="flex shrink-0 items-center gap-2">
                  {i > 0 && <span aria-hidden="true" className="h-px w-5 bg-border" />}
                  <button
                    type="button"
                    onClick={() => goto(s.id)}
                    aria-current={active ? "step" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-primary",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full font-display text-[11px]",
                        active ? "bg-enzo-cream text-primary" : done ? "bg-primary text-primary-foreground" : "border border-border",
                      )}
                    >
                      {done ? <Check size={11} aria-hidden="true" /> : i + 1}
                    </span>
                    {s.label}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {!hydrated ? (
          <p className="p-8 text-[14px] text-muted-foreground">Opening your plan…</p>
        ) : step === "room" ? (
          <div className="lg:min-h-0 lg:flex-1">
            <RoomStep
              plan={plan}
              catalogue={catalogue}
              onRoom={(patch: Partial<RoomSpec>) => update((p) => ({ ...p, room: { ...p.room, ...patch } }))}
              onNext={() => goto("layout")}
            />
          </div>
        ) : step === "estimate" ? (
          <div className="lg:min-h-0 lg:flex-1">
            <EstimateStep
              plan={plan}
              catalogue={catalogue}
              estimate={estimate}
              items={items}
              studio={studio}
              savedReference={savedReference}
              onSave={saveEstimate}
              onBack={() => goto("layout")}
            />
          </div>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] pb-20 lg:min-h-0 lg:flex-1 lg:grid-cols-[280px_minmax(0,1fr)_360px] lg:pb-0">
            <MobilePriceBar estimate={estimate} unitCount={plan.units.length} onOpen={() => goto("estimate")} />
            <aside className="min-w-0 border-b border-border/70 lg:flex lg:min-h-0 lg:flex-col lg:border-b-0 lg:border-r">
              <UnitPalette catalogue={catalogue} roomType={plan.room.type} onAdd={(id) => addUnit(id)} />
            </aside>

            <section aria-label="Plan" className="flex min-w-0 flex-col lg:min-h-0">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <Segmented<"plan" | "3d">
                  label="View"
                  value={view}
                  onChange={setView}
                  options={[
                    { value: "plan", label: <span className="flex items-center gap-1.5"><MapIcon size={14} aria-hidden="true" />Plan</span> },
                    { value: "3d", label: <span className="flex items-center gap-1.5"><Box size={14} aria-hidden="true" />3D</span> },
                  ]}
                />
                {plan.units.length > 0 && (
                  <button type="button" onClick={clearPlan} className="touch-target text-[12.5px] text-muted-foreground hover:text-destructive">
                    Clear plan
                  </button>
                )}
              </div>
              <div className="relative aspect-[5/4] px-3 lg:aspect-auto lg:min-h-0 lg:flex-1" data-lenis-prevent>
                {view === "plan" ? (
                  <PlanCanvas
                    room={plan.room}
                    items={items}
                    selectedId={selectedId}
                    issues={issues}
                    onSelect={setSelectedId}
                    onMove={(id, x, y, rotation) => patchUnit(id, { x, y, rotation })}
                    onDropTemplate={addUnit}
                    onKeyAction={(id, action, delta) => {
                      if (action === "rotate") rotateUnit(id);
                      else if (action === "delete") removeUnit(id);
                      else if (delta) {
                        const u = plan.units.find((x) => x.id === id);
                        if (u) patchUnit(id, { x: u.x + delta.x, y: u.y + delta.y });
                      }
                    }}
                  />
                ) : (
                  <RoomCanvas
                    room={plan.room}
                    selectedId={selectedId}
                    items={items.map((i) => ({
                      id: i.unit.id,
                      variant: i.variant,
                      x: i.unit.x,
                      y: i.unit.y,
                      rotation: i.unit.rotation,
                      elevationMm: i.template.mount === "wall" ? i.template.elevationMm : 0,
                      colours: i.colours,
                    }))}
                  />
                )}
                {plan.units.length === 0 && view === "plan" && (
                  <p className="pointer-events-none absolute inset-x-0 top-1/2 mx-auto max-w-xs -translate-y-1/2 rounded-xl bg-background/90 p-4 text-center text-[14px] leading-relaxed text-muted-foreground">
                    Drag a unit from the list onto your room. Near a wall it turns and sits flush against it.
                  </p>
                )}
              </div>
              <p className="hidden px-5 py-3 text-[12px] text-muted-foreground lg:block">
                {view === "plan"
                  ? "Drag to move. With a unit selected: arrow keys nudge it (hold Shift for 100 mm), R turns it, Delete removes it."
                  : "Drag to look around, scroll to zoom. Switch back to the plan to move units."}
              </p>
            </section>

            <aside className="flex flex-col border-t border-border/70 lg:min-h-0 lg:border-l lg:border-t-0">
              <div className="flex flex-col gap-6 p-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto" data-lenis-prevent>
                {selected ? (
                  <UnitInspector
                    unit={selected.unit}
                    template={selected.template}
                    catalogue={catalogue}
                    issues={issues.filter((i) => i.unitId === selected.unit.id).map((i) => i.kind)}
                    linePricePence={estimate.lines.find((l) => l.unitId === selected.unit.id)?.pricePence}
                    onChange={(patch) => patchUnit(selected.unit.id, patch)}
                    onRotate={() => rotateUnit(selected.unit.id)}
                    onDuplicate={() => duplicateUnit(selected.unit.id)}
                    onRemove={() => removeUnit(selected.unit.id)}
                    onApplyFinishesToAll={() => applyFinishesToAll(selected.unit.id)}
                  />
                ) : (
                  <>
                    <p className="rounded-xl bg-card p-4 text-[13.5px] leading-relaxed text-muted-foreground">
                      {plan.units.length > 0
                        ? "Select a unit on the plan to change its width and finishes."
                        : "Your estimate builds as you add units."}
                    </p>
                    <EstimateDetail estimate={estimate} />
                  </>
                )}
              </div>
              <div className="border-t border-border/70 p-4">
                <CompactSlip estimate={estimate} settings={catalogue.settings} studio={studio} unitCount={plan.units.length}>
                  {plan.units.length > 0 && (
                    <Button variant="cream" size="sm" onClick={() => goto("estimate")}>
                      See the full estimate and cutting plan
                    </Button>
                  )}
                </CompactSlip>
              </div>
            </aside>
          </div>
        )}
      </div>
    </ToolShell>
  );
}
