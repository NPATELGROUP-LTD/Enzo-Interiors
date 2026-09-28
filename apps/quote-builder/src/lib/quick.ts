// The simplified estimate: "how much wall, which finish" instead of a plan.
//
// It still prices through the same catalogue and the same board maths as
// the planner. The run is filled with the room type's standard unit, widest
// sizes first, and turned into a real Plan so "continue in the planner"
// opens the same units the customer was just quoted for.
import { makeId } from "./ids";
import type { Catalogue, Plan, PlacedUnit, RoomTypeId, SizeVariant, UnitTemplate } from "./types";

export interface QuickInput {
  roomType: RoomTypeId;
  lengthMm: number;
  frontBoardId: string;
  includeUpper: boolean;
}

/** Widest-first fill of a wall run. Whatever is left under the narrowest size stays open. */
export function fillRun(template: UnitTemplate, lengthMm: number): SizeVariant[] {
  const sizes = [...template.variants].sort((a, b) => b.widthMm - a.widthMm);
  const run: SizeVariant[] = [];
  let remaining = lengthMm;
  for (const size of sizes) {
    while (remaining >= size.widthMm) {
      run.push(size);
      remaining -= size.widthMm;
    }
  }
  return run;
}

function materialsFor(template: UnitTemplate, frontBoardId: string, catalogue: Catalogue) {
  const front = catalogue.boards.find((b) => b.id === frontBoardId);
  const materials: Record<string, string> = {};
  for (const slot of template.slots) {
    if (front && slot.categories.includes(front.category)) materials[slot.key] = front.id;
  }
  return materials;
}

export function buildQuickPlan(catalogue: Catalogue, input: QuickInput): Plan {
  const roomType = catalogue.roomTypes.find((r) => r.id === input.roomType);
  const main = catalogue.units.find((u) => u.id === roomType?.quickFill.templateId);
  const upper = catalogue.units.find((u) => u.id === roomType?.quickFill.upperTemplateId);

  const widthMm = Math.max(2400, Math.ceil((input.lengthMm + 600) / 100) * 100);
  const units: PlacedUnit[] = [];

  const lay = (template: UnitTemplate | undefined) => {
    if (!template) return;
    let x = 0;
    const materials = materialsFor(template, input.frontBoardId, catalogue);
    for (const size of fillRun(template, input.lengthMm)) {
      units.push({
        id: makeId("u"),
        templateId: template.id,
        variantId: size.id,
        x: x + size.widthMm / 2,
        y: size.depthMm / 2,
        rotation: 0,
        materials: { ...materials },
      });
      x += size.widthMm;
    }
  };

  lay(main);
  if (input.includeUpper) lay(upper);

  return {
    room: {
      type: input.roomType,
      shape: "rect",
      widthMm,
      depthMm: 3400,
      heightMm: 2400,
      cut: { widthMm: 1400, depthMm: 1200, corner: "br" },
    },
    units,
  };
}
