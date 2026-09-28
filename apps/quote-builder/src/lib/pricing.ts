// The estimate: panels → pieces → whole boards → cost → price.
//
// Pure and synchronous (no React, no storage), the same stand-in pattern as
// src/lib/quote-estimate.ts: the signature is what a future
// `POST /quotes/estimate-3d` on apps/api would accept and return.
//
// Rules the client set:
//   - A board is charged whole even when only a strip of it is used.
//   - Pieces of the same material share boards across the whole room, not
//     just within one unit.
//   - Price = (boards + per-unit extras) marked up by the admin's margin.
import { nestPieces, type NestResult, type Piece } from "./nesting";
import type {
  Board,
  Catalogue,
  Pence,
  PlacedUnit,
  PricingSettings,
  SizeVariant,
  UnitTemplate,
} from "./types";

export type PricedUnit = Pick<PlacedUnit, "id" | "templateId" | "variantId" | "materials">;

export interface BoardUsage {
  board: Board;
  nest: NestResult;
  sheetCount: number;
  costPence: Pence;
  /** Total area of the pieces cut from this board, mm². */
  pieceArea: number;
}

export interface EstimateLine {
  unitId: string;
  name: string;
  widthMm: number;
  costPence: Pence;
  pricePence: Pence;
}

export interface Estimate {
  boards: BoardUsage[];
  lines: EstimateLine[];
  boardsCostPence: Pence;
  extrasCostPence: Pence;
  costPence: Pence;
  marginPence: Pence;
  pricePence: Pence;
  lowPence: Pence;
  highPence: Pence;
  sheetCount: number;
  warnings: string[];
}

export function findTemplate(catalogue: Catalogue, id: string): UnitTemplate | undefined {
  return catalogue.units.find((unit) => unit.id === id);
}

export function findVariant(template: UnitTemplate | undefined, id: string): SizeVariant | undefined {
  return template?.variants.find((variant) => variant.id === id) ?? template?.variants[0];
}

/** The board a slot resolves to: the customer's pick if it is still allowed, else the slot default. */
export function resolveBoard(
  catalogue: Catalogue,
  template: UnitTemplate,
  slotKey: string,
  chosen: Record<string, string>,
): Board | undefined {
  const slot = template.slots.find((s) => s.key === slotKey);
  const allowed = (board: Board | undefined) =>
    board && (!slot || slot.categories.includes(board.category)) ? board : undefined;
  const byId = (id: string | undefined) => catalogue.boards.find((b) => b.id === id);
  return (
    allowed(byId(chosen[slotKey])) ??
    allowed(byId(slot?.defaultBoardId)) ??
    catalogue.boards.find((b) => slot?.categories.includes(b.category))
  );
}

export function applyMargin(costPence: Pence, settings: PricingSettings): Pence {
  return costPence * (1 + settings.marginPct / 100);
}

export function roundToStep(pence: Pence, settings: PricingSettings): Pence {
  const step = Math.max(1, settings.roundToPounds) * 100;
  return Math.round(pence / step) * step;
}

export function computeEstimate(units: PricedUnit[], catalogue: Catalogue): Estimate {
  const { settings } = catalogue;
  const warnings = new Set<string>();
  const piecesByBoard = new Map<string, Piece[]>();
  const extrasByUnit = new Map<string, Pence>();
  const unitInfo = new Map<string, { name: string; widthMm: number }>();

  for (const unit of units) {
    const template = findTemplate(catalogue, unit.templateId);
    const variant = findVariant(template, unit.variantId);
    if (!template || !variant) {
      warnings.add("A unit in this plan has been removed from the catalogue and is not priced.");
      continue;
    }
    unitInfo.set(unit.id, { name: template.name, widthMm: variant.widthMm });
    extrasByUnit.set(unit.id, template.extrasPence);

    for (const panel of variant.panels) {
      const board = resolveBoard(catalogue, template, panel.slot, unit.materials);
      if (!board) {
        warnings.add(`No board is set up for "${panel.label}" on ${template.name}.`);
        continue;
      }
      const list = piecesByBoard.get(board.id) ?? [];
      for (let i = 0; i < panel.qty; i += 1) {
        list.push({
          key: `${unit.id}:${panel.id}:${i}`,
          label: panel.label,
          lengthMm: panel.lengthMm,
          widthMm: panel.widthMm,
          ownerId: unit.id,
        });
      }
      piecesByBoard.set(board.id, list);
    }
  }

  const boards: BoardUsage[] = [];
  const costByUnit = new Map<string, number>();

  for (const [boardId, pieces] of piecesByBoard) {
    const board = catalogue.boards.find((b) => b.id === boardId);
    if (!board) continue;
    const nest = nestPieces(pieces, board, settings);
    const costPence = nest.boardsCharged * board.pricePence;
    const pieceArea = pieces.reduce((sum, p) => sum + p.lengthMm * p.widthMm, 0);
    for (const o of nest.oversize) {
      warnings.add(
        `${o.piece.label} (${o.piece.lengthMm} × ${o.piece.widthMm} mm) is larger than a ${board.name} sheet and will need a joint.`,
      );
    }
    // Each unit carries the share of the board cost its pieces take up, so
    // the lines always add back up to the total.
    for (const p of pieces) {
      const share = pieceArea > 0 ? (p.lengthMm * p.widthMm) / pieceArea : 0;
      costByUnit.set(p.ownerId, (costByUnit.get(p.ownerId) ?? 0) + share * costPence);
    }
    boards.push({ board, nest, sheetCount: nest.boardsCharged, costPence, pieceArea });
  }

  boards.sort((a, b) => b.costPence - a.costPence || a.board.name.localeCompare(b.board.name));

  const boardsCostPence = boards.reduce((sum, b) => sum + b.costPence, 0);
  const extrasCostPence = [...extrasByUnit.values()].reduce((sum, v) => sum + v, 0);
  const costPence = boardsCostPence + extrasCostPence;
  const pricePence = Math.round(applyMargin(costPence, settings));

  const lines: EstimateLine[] = units
    .filter((unit) => unitInfo.has(unit.id))
    .map((unit) => {
      const info = unitInfo.get(unit.id)!;
      const cost = (costByUnit.get(unit.id) ?? 0) + (extrasByUnit.get(unit.id) ?? 0);
      return {
        unitId: unit.id,
        name: info.name,
        widthMm: info.widthMm,
        costPence: Math.round(cost),
        pricePence: Math.round(applyMargin(cost, settings)),
      };
    });

  return {
    boards,
    lines,
    boardsCostPence,
    extrasCostPence,
    costPence,
    marginPence: pricePence - costPence,
    pricePence,
    lowPence: roundToStep(pricePence * (1 - settings.rangeLowPct / 100), settings),
    highPence: roundToStep(pricePence * (1 + settings.rangeHighPct / 100), settings),
    sheetCount: boards.reduce((sum, b) => sum + b.sheetCount, 0),
    warnings: [...warnings],
  };
}

/** Swatch colour per material slot, for drawing a unit in the customer's finishes. */
export function slotColours(
  catalogue: Catalogue,
  template: UnitTemplate,
  materials: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    template.slots.map((slot) => [slot.key, resolveBoard(catalogue, template, slot.key, materials)?.swatch ?? "#D4C9B5"]),
  );
}
