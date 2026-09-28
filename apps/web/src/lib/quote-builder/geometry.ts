// Plan geometry, in room millimetres with y running down the drawing.
//
// Rooms are orthogonal (a rectangle or an L), units only turn in quarter
// turns, so every footprint is an axis-aligned box and every wall is
// horizontal or vertical. That keeps snapping and clash checks exact.
import type { Corner, Mount, PlacedUnit, RoomSpec, Rotation, SizeVariant, UnitTemplate } from "./types";

export interface Point {
  x: number;
  y: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Wall {
  a: Point;
  b: Point;
  /** Unit vector pointing into the room. */
  inward: Point;
  horizontal: boolean;
  length: number;
}

export const MIN_ROOM_MM = 1200;
export const MIN_CUT_MM = 300;
const SNAP_DISTANCE = 260;
const BUTT_DISTANCE = 90;
const WORKTOP_ALLOWANCE = 40;

export function clampCut(room: RoomSpec): RoomSpec["cut"] {
  return {
    corner: room.cut.corner,
    widthMm: Math.min(Math.max(room.cut.widthMm, MIN_CUT_MM), room.widthMm - 600),
    depthMm: Math.min(Math.max(room.cut.depthMm, MIN_CUT_MM), room.depthMm - 600),
  };
}

/** Outline, listed clockwise as drawn (y down). */
export function roomOutline(room: RoomSpec): Point[] {
  const W = room.widthMm;
  const D = room.depthMm;
  if (room.shape !== "L") {
    return [
      { x: 0, y: 0 },
      { x: W, y: 0 },
      { x: W, y: D },
      { x: 0, y: D },
    ];
  }
  const { widthMm: cw, depthMm: cd, corner } = clampCut(room);
  const shapes: Record<Corner, Point[]> = {
    tl: [{ x: cw, y: 0 }, { x: W, y: 0 }, { x: W, y: D }, { x: 0, y: D }, { x: 0, y: cd }, { x: cw, y: cd }],
    tr: [{ x: 0, y: 0 }, { x: W - cw, y: 0 }, { x: W - cw, y: cd }, { x: W, y: cd }, { x: W, y: D }, { x: 0, y: D }],
    br: [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: D - cd }, { x: W - cw, y: D - cd }, { x: W - cw, y: D }, { x: 0, y: D }],
    bl: [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: D }, { x: cw, y: D }, { x: cw, y: D - cd }, { x: 0, y: D - cd }],
  };
  return shapes[corner];
}

export function roomWalls(room: RoomSpec): Wall[] {
  const points = roomOutline(room);
  return points.map((a, i) => {
    const b = points[(i + 1) % points.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    return {
      a,
      b,
      inward: { x: -dy / length, y: dx / length },
      horizontal: Math.abs(dy) < Math.abs(dx),
      length,
    };
  });
}

export function outlinePath(points: Point[]): string {
  return `${points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ")} Z`;
}

export function roomArea(room: RoomSpec): number {
  const full = room.widthMm * room.depthMm;
  if (room.shape !== "L") return full;
  const cut = clampCut(room);
  return full - cut.widthMm * cut.depthMm;
}

/** Plan footprint of a unit: width along the wall, depth into the room. */
export function footprint(unit: Pick<PlacedUnit, "x" | "y" | "rotation">, size: Pick<SizeVariant, "widthMm" | "depthMm">): Box {
  const turned = unit.rotation === 90 || unit.rotation === 270;
  const w = turned ? size.depthMm : size.widthMm;
  const h = turned ? size.widthMm : size.depthMm;
  return { x: unit.x - w / 2, y: unit.y - h / 2, w, h };
}

/** Rotation that puts a unit's back against a wall with the given inward direction. */
export function rotationFacing(inward: Point): Rotation {
  if (inward.y > 0.5) return 0;
  if (inward.y < -0.5) return 180;
  if (inward.x > 0.5) return 270;
  return 90;
}

/** Direction the front of a unit faces, for drawing the front edge. */
export function frontDirection(rotation: Rotation): Point {
  switch (rotation) {
    case 90:
      return { x: -1, y: 0 };
    case 180:
      return { x: 0, y: -1 };
    case 270:
      return { x: 1, y: 0 };
    default:
      return { x: 0, y: 1 };
  }
}

function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/** True when the whole box sits inside the room. Flush against a wall counts as inside. */
export function boxInsideRoom(box: Box, room: RoomSpec): boolean {
  const outline = roomOutline(room);
  const e = 1;
  const corners = [
    { x: box.x + e, y: box.y + e },
    { x: box.x + box.w - e, y: box.y + e },
    { x: box.x + box.w - e, y: box.y + box.h - e },
    { x: box.x + e, y: box.y + box.h - e },
  ];
  if (!corners.every((c) => pointInPolygon(c, outline))) return false;
  // An L's inner corner can poke into a box whose four corners are all inside.
  return !outline.some(
    (p) => p.x > box.x + e && p.x < box.x + box.w - e && p.y > box.y + e && p.y < box.y + box.h - e,
  );
}

export function boxesOverlap(a: Box, b: Box): boolean {
  const e = 1;
  return a.x + a.w - e > b.x && b.x + b.w - e > a.x && a.y + a.h - e > b.y && b.y + b.h - e > a.y;
}

/** Height band a unit occupies, floor to top (worktops included). */
export function verticalSpan(template: Pick<UnitTemplate, "mount" | "elevationMm" | "structure">, size: Pick<SizeVariant, "heightMm">) {
  const bottom = template.mount === "wall" ? template.elevationMm : 0;
  const top = bottom + size.heightMm + (template.structure.worktop ? WORKTOP_ALLOWANCE : 0);
  return { bottom, top };
}

export const isWallHung = (mount: Mount) => mount === "wall";

interface Resolved {
  unit: PlacedUnit;
  template: UnitTemplate;
  size: SizeVariant;
}

export interface PlanIssue {
  unitId: string;
  kind: "outside" | "clash" | "ceiling";
}

export function findIssues(items: Resolved[], room: RoomSpec): PlanIssue[] {
  const issues: PlanIssue[] = [];
  const boxes = items.map((item) => footprint(item.unit, item.size));
  const spans = items.map((item) => verticalSpan(item.template, item.size));

  items.forEach((item, i) => {
    if (!boxInsideRoom(boxes[i], room)) issues.push({ unitId: item.unit.id, kind: "outside" });
    if (spans[i].top > room.heightMm) issues.push({ unitId: item.unit.id, kind: "ceiling" });
    for (let j = 0; j < items.length; j += 1) {
      if (i === j) continue;
      const verticalOverlap = spans[i].bottom < spans[j].top && spans[j].bottom < spans[i].top;
      if (verticalOverlap && boxesOverlap(boxes[i], boxes[j])) {
        issues.push({ unitId: item.unit.id, kind: "clash" });
        break;
      }
    }
  });
  return issues;
}

/**
 * Where a unit dragged to `center` should land.
 *
 * Near a wall it turns to face into the room and sits flush against it,
 * slid along to butt up against any neighbour on the same wall. Away from
 * the walls it stays where it is dropped, on a 10mm grid, keeping its turn.
 */
export function snapPlacement(
  center: Point,
  size: Pick<SizeVariant, "widthMm" | "depthMm">,
  rotation: Rotation,
  room: RoomSpec,
  others: { box: Box; rotation: Rotation }[],
): { x: number; y: number; rotation: Rotation; snapped: boolean } {
  let best: { x: number; y: number; rotation: Rotation; distance: number; wall: Wall } | null = null;

  for (const wall of roomWalls(room)) {
    const toPoint = { x: center.x - wall.a.x, y: center.y - wall.a.y };
    const perpendicular = toPoint.x * wall.inward.x + toPoint.y * wall.inward.y;
    if (perpendicular < -SNAP_DISTANCE) continue;
    const along = { x: (wall.b.x - wall.a.x) / wall.length, y: (wall.b.y - wall.a.y) / wall.length };
    const t = toPoint.x * along.x + toPoint.y * along.y;
    if (t < -size.widthMm / 2 || t > wall.length + size.widthMm / 2) continue;

    const half = size.widthMm / 2;
    const clamped = wall.length >= size.widthMm ? Math.min(Math.max(t, half), wall.length - half) : wall.length / 2;
    const x = wall.a.x + along.x * clamped + wall.inward.x * (size.depthMm / 2);
    const y = wall.a.y + along.y * clamped + wall.inward.y * (size.depthMm / 2);
    const distance = Math.hypot(center.x - x, center.y - y);
    if (distance < SNAP_DISTANCE + size.depthMm / 2 && (!best || distance < best.distance)) {
      best = { x, y, rotation: rotationFacing(wall.inward), distance, wall };
    }
  }

  if (!best) {
    return { x: Math.round(center.x / 10) * 10, y: Math.round(center.y / 10) * 10, rotation, snapped: false };
  }

  // Butt against neighbours along the wall: compare extents on the wall's axis.
  const mine = footprint({ x: best.x, y: best.y, rotation: best.rotation }, size);
  const horizontal = best.wall.horizontal;
  let start = horizontal ? mine.x : mine.y;
  const length = horizontal ? mine.w : mine.h;
  const across = horizontal ? mine.y : mine.x;
  for (const other of others) {
    const oStart = horizontal ? other.box.x : other.box.y;
    const oLength = horizontal ? other.box.w : other.box.h;
    const oAcross = horizontal ? other.box.y : other.box.x;
    if (Math.abs(oAcross - across) > 400) continue;
    if (Math.abs(start - (oStart + oLength)) < BUTT_DISTANCE) start = oStart + oLength;
    else if (Math.abs(start + length - oStart) < BUTT_DISTANCE) start = oStart - length;
  }
  const x = horizontal ? start + length / 2 : best.x;
  const y = horizontal ? best.y : start + length / 2;
  return { x: Math.round(x), y: Math.round(y), rotation: best.rotation, snapped: true };
}

/** First free spot along the walls for a unit added by click rather than drag. */
export function firstFreeSpot(
  size: Pick<SizeVariant, "widthMm" | "depthMm">,
  span: { bottom: number; top: number },
  room: RoomSpec,
  occupied: { box: Box; span: { bottom: number; top: number } }[],
): { x: number; y: number; rotation: Rotation } {
  const blocking = occupied.filter((o) => o.span.bottom < span.top && span.bottom < o.span.top);
  for (const wall of roomWalls(room)) {
    if (wall.length < size.widthMm) continue;
    const along = { x: (wall.b.x - wall.a.x) / wall.length, y: (wall.b.y - wall.a.y) / wall.length };
    const rotation = rotationFacing(wall.inward);
    for (let t = size.widthMm / 2; t <= wall.length - size.widthMm / 2; t += 50) {
      const x = wall.a.x + along.x * t + wall.inward.x * (size.depthMm / 2);
      const y = wall.a.y + along.y * t + wall.inward.y * (size.depthMm / 2);
      const box = footprint({ x, y, rotation }, size);
      if (boxInsideRoom(box, room) && !blocking.some((o) => boxesOverlap(o.box, box))) {
        return { x: Math.round(x), y: Math.round(y), rotation };
      }
    }
  }
  return { x: room.widthMm / 2, y: room.depthMm / 2, rotation: 0 };
}
