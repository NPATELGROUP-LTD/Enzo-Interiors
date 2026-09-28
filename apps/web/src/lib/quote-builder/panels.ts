// Standard cut-list for a box carcass, from a unit's structure and size.
//
// This is the admin's "build standard panels" helper. The output is only a
// starting point: the panel list stored on each size variant is the source
// of truth for pricing, and the admin can edit, add or remove rows freely.
import { makeId } from "./ids";
import type { MaterialSlot, PanelRole, PanelSpec, UnitStructure } from "./types";

/** Nominal board thickness the cut-list is drawn around. */
export const NOMINAL_THICKNESS = 18;
/** Gap left around and between doors and drawer fronts. */
const FRONT_GAP = 3;
const WORKTOP_OVERHANG = 20;
const SHELF_SETBACK = 20;
const DRAWER_LINE_MM = 170;

export const PANEL_ROLES: { role: PanelRole; label: string }[] = [
  { role: "side", label: "Side" },
  { role: "top", label: "Top" },
  { role: "bottom", label: "Bottom" },
  { role: "back", label: "Back" },
  { role: "shelf", label: "Shelf" },
  { role: "divider", label: "Divider" },
  { role: "door", label: "Door" },
  { role: "drawer", label: "Drawer front" },
  { role: "plinth", label: "Plinth" },
  { role: "end", label: "End panel" },
  { role: "worktop", label: "Worktop" },
  { role: "other", label: "Other piece" },
];

const FRONT_ROLES = new Set<PanelRole>(["door", "drawer", "plinth", "end"]);

/** Which slot a panel of this role is cut from by default. */
export function slotForRole(role: PanelRole, slots: MaterialSlot[]): string {
  const has = (key: string) => slots.some((slot) => slot.key === key);
  if (role === "worktop" && has("worktop")) return "worktop";
  if (FRONT_ROLES.has(role) && has("front")) return "front";
  if (role === "back" && has("back")) return "back";
  if (has("carcass")) return "carcass";
  return slots[0]?.key ?? "carcass";
}

/** Doors per unit: never more than the structure asks for, one per 600mm of width. */
export function doorCount(structure: UnitStructure, widthMm: number): number {
  if (structure.doors <= 0) return 0;
  return Math.max(1, Math.min(structure.doors, Math.ceil(widthMm / 600)));
}

export function generatePanels(
  structure: UnitStructure,
  size: { widthMm: number; heightMm: number; depthMm: number },
  slots: MaterialSlot[],
  /** Deterministic ids for seed data, so server and client renders agree. */
  idPrefix?: string,
): PanelSpec[] {
  const T = NOMINAL_THICKNESS;
  const W = Math.round(size.widthMm);
  const D = Math.round(size.depthMm);
  const carcassH = Math.max(T * 3, Math.round(size.heightMm - structure.plinthMm));
  const innerW = W - 2 * T;
  const panels: PanelSpec[] = [];

  const add = (role: PanelRole, label: string, lengthMm: number, widthMm: number, qty = 1) => {
    if (qty <= 0 || lengthMm <= 0 || widthMm <= 0) return;
    panels.push({
      id: idPrefix ? `${idPrefix}-${role}-${panels.length}` : makeId("pnl"),
      role,
      label,
      slot: slotForRole(role, slots),
      lengthMm: Math.round(lengthMm),
      widthMm: Math.round(widthMm),
      qty,
    });
  };

  add("side", "Side", carcassH, D, 2);
  add("top", "Top", innerW, D);
  add("bottom", "Bottom", innerW, D);
  if (structure.back) add("back", "Back", carcassH - 2 * T, innerW);
  add("shelf", "Shelf", innerW, D - SHELF_SETBACK - (structure.back ? T : 0), structure.shelves);

  const doors = doorCount(structure, W);
  const drawers = Math.max(0, structure.drawers);
  const drawerH =
    drawers === 0
      ? 0
      : doors > 0
        ? DRAWER_LINE_MM
        : Math.floor((carcassH - FRONT_GAP * (drawers + 1)) / drawers);
  add("drawer", "Drawer front", W - 2 * FRONT_GAP, drawerH, drawers);

  if (doors > 0) {
    const doorH = carcassH - FRONT_GAP - drawers * (drawerH + FRONT_GAP) - FRONT_GAP;
    const doorW = (W - 2 * FRONT_GAP - FRONT_GAP * (doors - 1)) / doors;
    // Door length runs up the door, so a grained front keeps a vertical grain.
    add("door", "Door", doorH, doorW, doors);
  }

  if (structure.plinthMm > 0) add("plinth", "Plinth", W, structure.plinthMm);
  if (structure.worktop) add("worktop", "Worktop", W, D + WORKTOP_OVERHANG);

  return panels;
}

export function panelArea(panel: Pick<PanelSpec, "lengthMm" | "widthMm" | "qty">): number {
  return panel.lengthMm * panel.widthMm * panel.qty;
}

/** True when a panel list is exactly what the recipe would build, so it is safe to rebuild on a size change. */
export function matchesRecipe(
  panels: PanelSpec[],
  structure: UnitStructure,
  size: { widthMm: number; heightMm: number; depthMm: number },
  slots: MaterialSlot[],
): boolean {
  const shape = (list: PanelSpec[]) =>
    list
      .map((p) => `${p.role}|${p.label}|${p.slot}|${p.lengthMm}|${p.widthMm}|${p.qty}`)
      .sort()
      .join(";");
  return shape(panels) === shape(generatePanels(structure, size, slots, "cmp"));
}
