"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { makeId } from "@/lib/ids";
import { MOUNT_LABELS } from "@/lib/labels";
import { generatePanels } from "@/lib/panels";
import { slotColours } from "@/lib/pricing";
import { catalogueStore } from "@/lib/store";
import type { Catalogue, UnitTemplate } from "@/lib/types";
import { ElevationGlyph, glyphColours } from "../ElevationGlyph";
import { Button } from "../ui";
import { UnitEditor } from "./UnitEditor";

function newUnit(catalogue: Catalogue): UnitTemplate {
  const carcass = catalogue.boards.find((b) => b.category === "carcass");
  const front = catalogue.boards.find((b) => b.category === "front");
  const slots = [
    { key: "carcass", label: "Carcass", categories: ["carcass" as const], defaultBoardId: carcass?.id ?? "" },
    { key: "front", label: "Doors & fronts", categories: ["front" as const], defaultBoardId: front?.id ?? "" },
  ];
  const structure = { doors: 1, drawers: 0, shelves: 1, back: true, plinthMm: 0, worktop: false };
  const size = { widthMm: 600, heightMm: 720, depthMm: 560 };
  return {
    id: makeId("unit"),
    name: "New unit",
    description: "",
    roomTypes: ["kitchens"],
    mount: "floor",
    elevationMm: 0,
    slots,
    extrasPence: 0,
    structure,
    variants: [{ id: makeId("size"), ...size, panels: generatePanels(structure, size, slots) }],
  };
}

export function UnitsPanel({ catalogue }: { catalogue: Catalogue }) {
  const [selectedId, setSelectedId] = useState<string | null>(catalogue.units[0]?.id ?? null);
  const selected = catalogue.units.find((u) => u.id === selectedId) ?? catalogue.units[0];

  const add = () => {
    const unit = newUnit(catalogue);
    catalogueStore.update((c) => ({ ...c, units: [...c.units, unit] }));
    setSelectedId(unit.id);
    toast.success("Unit added. Give it a name and its sizes.");
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
      <section aria-labelledby="units-heading" className="min-w-0">
        <div className="flex items-center justify-between gap-3">
          <h2 id="units-heading" className="text-[1.5rem]">
            Units
          </h2>
          <Button size="sm" onClick={add}>
            <Plus size={15} aria-hidden="true" />
            Add unit
          </Button>
        </div>
        <ul className="mt-5 flex flex-col border-b border-border/70 lg:max-h-[70vh] lg:overflow-y-auto">
          {catalogue.units.map((unit) => {
            const variant = unit.variants[0];
            const colours = slotColours(catalogue, unit, {});
            const active = unit.id === selected?.id;
            return (
              <li key={unit.id} className="border-t border-border/70">
                <button
                  type="button"
                  onClick={() => setSelectedId(unit.id)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 px-2 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    active ? "bg-card" : "hover:bg-card/60",
                  )}
                >
                  <span className="flex h-12 w-12 shrink-0 items-end justify-center">
                    {variant && (
                      <ElevationGlyph
                        template={unit}
                        variant={variant}
                        colours={glyphColours(colours)}
                        className="h-12 w-12"
                      />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className={cn("block truncate text-[14px] font-medium", active ? "text-primary" : "text-foreground")}>
                      {unit.name}
                    </span>
                    <span className="block text-[12px] text-muted-foreground">
                      {unit.variants.length} {unit.variants.length === 1 ? "size" : "sizes"}, {MOUNT_LABELS[unit.mount].toLowerCase()}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {selected ? (
        <UnitEditor key={selected.id} unit={selected} catalogue={catalogue} onDeleted={() => setSelectedId(null)} />
      ) : (
        <p className="text-[14px] text-muted-foreground">Add a unit to start the catalogue.</p>
      )}
    </div>
  );
}
