"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { slotColours } from "@/lib/pricing";
import type { Catalogue, RoomTypeId, UnitTemplate } from "@/lib/types";
import { ElevationGlyph, glyphColours } from "../ElevationGlyph";
import { DRAG_MIME } from "./PlanCanvas";

export function UnitPalette({
  catalogue,
  roomType,
  onAdd,
}: {
  catalogue: Catalogue;
  roomType: RoomTypeId;
  onAdd: (templateId: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const room = catalogue.roomTypes.find((r) => r.id === roomType);
  const units = catalogue.units.filter((u) => u.variants.length > 0 && (showAll || u.roomTypes.includes(roomType)));

  return (
    <section aria-labelledby="palette-heading" className="flex min-h-0 flex-col">
      <div className="px-5 pb-3 pt-5">
        <h2 id="palette-heading" className="font-sans text-[15px] font-semibold tracking-normal">
          {showAll ? "Every unit" : `Units for your ${room?.singular.toLowerCase() ?? "room"}`}
        </h2>
        <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">
          Drag onto the plan, or use the add button.
        </p>
      </div>
      <ul className="flex gap-2 overflow-x-auto px-5 pb-4 lg:min-h-0 lg:flex-1 lg:flex-col lg:gap-0 lg:overflow-y-auto">
        {units.map((unit) => (
          <PaletteItem key={unit.id} unit={unit} catalogue={catalogue} onAdd={onAdd} />
        ))}
        {units.length === 0 && (
          <li className="text-[13px] text-muted-foreground">No units are set up for this room yet.</li>
        )}
      </ul>
      <div className="border-t border-border/70 px-5 py-3">
        <button type="button" onClick={() => setShowAll((v) => !v)} className="touch-target text-[12.5px] text-primary underline underline-offset-4">
          {showAll ? `Only show ${room?.name.toLowerCase() ?? "room"} units` : "Show every unit"}
        </button>
      </div>
    </section>
  );
}

function PaletteItem({ unit, catalogue, onAdd }: { unit: UnitTemplate; catalogue: Catalogue; onAdd: (id: string) => void }) {
  const widths = unit.variants.map((v) => v.widthMm);
  const min = Math.min(...widths);
  const max = Math.max(...widths);
  const range = min === max ? `${min} mm wide` : `${min}–${max.toLocaleString("en-GB")} mm wide`;
  const preview = unit.variants.find((v) => v.widthMm >= 600) ?? unit.variants[0];
  const colours = glyphColours(slotColours(catalogue, unit, {}));

  return (
    <li
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(DRAG_MIME, unit.id);
        event.dataTransfer.effectAllowed = "copy";
      }}
      className="group flex w-[220px] shrink-0 cursor-grab items-center gap-3 rounded-xl border border-border/70 bg-card p-2.5 active:cursor-grabbing lg:w-auto lg:rounded-none lg:border-0 lg:border-t lg:bg-transparent lg:px-0 lg:py-3"
    >
      <span className="flex h-12 w-12 shrink-0 items-end justify-center">
        <ElevationGlyph template={unit} variant={preview} colours={colours} className="h-12 w-12" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-medium leading-snug">{unit.name}</span>
        <span className="block whitespace-nowrap font-display text-[11.5px] tabular-nums text-muted-foreground">{range}</span>
      </span>
      <button
        type="button"
        onClick={() => onAdd(unit.id)}
        aria-label={`Add ${unit.name} to the plan`}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-primary transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus size={15} aria-hidden="true" />
      </button>
    </li>
  );
}
