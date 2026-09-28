"use client";

import { Copy, RotateCw, Trash2, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { pounds } from "@/lib/quote-builder/format";
import type { PlanIssue } from "@/lib/quote-builder/geometry";
import { resolveBoard, slotColours } from "@/lib/quote-builder/pricing";
import type { Catalogue, PlacedUnit, UnitTemplate } from "@/lib/quote-builder/types";
import { ElevationGlyph, glyphColours } from "../ElevationGlyph";
import { Button, Swatch } from "../ui";

const ISSUE_TEXT: Record<PlanIssue["kind"], string> = {
  clash: "It overlaps another unit at the same height.",
  outside: "Part of it is outside the room.",
  ceiling: "It is taller than the ceiling height you gave.",
};

export function UnitInspector({
  unit,
  template,
  catalogue,
  issues,
  linePricePence,
  onChange,
  onRotate,
  onDuplicate,
  onRemove,
  onApplyFinishesToAll,
}: {
  unit: PlacedUnit;
  template: UnitTemplate;
  catalogue: Catalogue;
  issues: PlanIssue["kind"][];
  linePricePence?: number;
  onChange: (patch: Partial<PlacedUnit>) => void;
  onRotate: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onApplyFinishesToAll: () => void;
}) {
  const variant = template.variants.find((v) => v.id === unit.variantId) ?? template.variants[0];
  const colours = slotColours(catalogue, template, unit.materials);

  return (
    <section aria-labelledby="inspector-heading" className="flex flex-col gap-5">
      <div className="flex items-start gap-4">
        <ElevationGlyph template={template} variant={variant} colours={glyphColours(colours)} className="h-20 w-20 shrink-0" />
        <div className="min-w-0">
          <h2 id="inspector-heading" className="font-sans text-[17px] font-semibold tracking-normal">
            {template.name}
          </h2>
          {template.description && <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{template.description}</p>}
          {linePricePence !== undefined && (
            <p className="mt-2 text-[13px]">
              About <span className="font-display font-medium tabular-nums text-primary">{pounds(Math.round(linePricePence / 1000) * 1000)}</span> in this plan
            </p>
          )}
        </div>
      </div>

      {issues.length > 0 && (
        <ul className="flex flex-col gap-1.5 rounded-xl bg-destructive/8 p-3">
          {issues.map((kind) => (
            <li key={kind} className="flex gap-2 text-[12.5px] leading-snug text-destructive">
              <TriangleAlert size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
              {ISSUE_TEXT[kind]}
            </li>
          ))}
        </ul>
      )}

      <fieldset>
        <legend className="text-[13px] font-medium">Width</legend>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {template.variants.map((v) => (
            <label
              key={v.id}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1.5 font-display text-[12.5px] tabular-nums transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                v.id === variant.id ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary",
              )}
            >
              <input
                type="radio"
                name={`width-${unit.id}`}
                className="sr-only"
                checked={v.id === variant.id}
                onChange={() => onChange({ variantId: v.id })}
              />
              {v.widthMm}
            </label>
          ))}
        </div>
        <p className="mt-2 font-display text-[12px] tabular-nums text-muted-foreground">
          {variant.heightMm} high, {variant.depthMm} deep
          {template.mount === "wall" ? `, hung ${template.elevationMm} above the floor` : ""}
        </p>
      </fieldset>

      {template.slots.map((slot) => {
        const chosen = resolveBoard(catalogue, template, slot.key, unit.materials);
        const options = catalogue.boards.filter((b) => slot.categories.includes(b.category));
        return (
          <fieldset key={slot.key}>
            <legend className="flex w-full items-baseline justify-between gap-3 text-[13px]">
              <span className="font-medium">{slot.label}</span>
              <span className="truncate text-muted-foreground">{chosen?.name}</span>
            </legend>
            <div className="mt-2 grid grid-cols-6 gap-1.5">
              {options.map((board) => {
                const on = chosen?.id === board.id;
                return (
                  <label
                    key={board.id}
                    title={board.name}
                    className={cn(
                      "relative aspect-square cursor-pointer rounded-lg p-0.5 ring-offset-2 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                      on ? "ring-2 ring-primary" : "hover:ring-1 hover:ring-border",
                    )}
                  >
                    <input
                      type="radio"
                      name={`${unit.id}-${slot.key}`}
                      className="sr-only"
                      checked={on}
                      onChange={() => onChange({ materials: { ...unit.materials, [slot.key]: board.id } })}
                      aria-label={board.name}
                    />
                    <Swatch board={board} className="h-full w-full" />
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}

      <button type="button" onClick={onApplyFinishesToAll} className="touch-target self-start text-[12.5px] text-primary underline underline-offset-4">
        Use these finishes on every unit
      </button>

      <div className="flex flex-wrap gap-2 border-t border-border/70 pt-4">
        <Button variant="secondary" size="sm" onClick={onRotate}>
          <RotateCw size={14} aria-hidden="true" />
          Turn
        </Button>
        <Button variant="secondary" size="sm" onClick={onDuplicate}>
          <Copy size={14} aria-hidden="true" />
          Duplicate
        </Button>
        <Button variant="danger" size="sm" onClick={onRemove}>
          <Trash2 size={14} aria-hidden="true" />
          Remove
        </Button>
      </div>
    </section>
  );
}
