import { describe, expect, it } from "vitest";
import { boxInsideRoom, findIssues, firstFreeSpot, footprint, roomOutline, snapPlacement } from "./geometry";
import { seedCatalogue } from "./seed";
import type { RoomSpec } from "./types";

const rect: RoomSpec = {
  type: "kitchens",
  shape: "rect",
  widthMm: 4000,
  depthMm: 3000,
  heightMm: 2400,
  cut: { widthMm: 1500, depthMm: 1000, corner: "br" },
};
const L: RoomSpec = { ...rect, shape: "L" };
const size = { widthMm: 600, depthMm: 560 };
const floorSpan = { bottom: 0, top: 910 };

describe("room geometry", () => {
  it("cuts the chosen corner out of an L-shaped room", () => {
    expect(roomOutline(L)).toContainEqual({ x: 2500, y: 2000 });
    expect(boxInsideRoom({ x: 3000, y: 2200, w: 500, h: 500 }, L)).toBe(false);
    expect(boxInsideRoom({ x: 3000, y: 2200, w: 500, h: 500 }, rect)).toBe(true);
  });

  it("rejects a box that straddles the inner corner of an L", () => {
    expect(boxInsideRoom({ x: 2300, y: 1800, w: 400, h: 400 }, L)).toBe(false);
  });

  it("snaps a unit dropped near a wall flush against it, facing into the room", () => {
    const top = snapPlacement({ x: 1000, y: 380 }, size, 0, rect, []);
    expect(top).toMatchObject({ x: 1000, y: 280, rotation: 0, snapped: true });

    const left = snapPlacement({ x: 350, y: 1500 }, size, 0, rect, []);
    expect(left).toMatchObject({ x: 280, rotation: 270, snapped: true });
    expect(footprint(left, size).x).toBe(0);
  });

  it("butts a unit up against its neighbour on the same wall", () => {
    const neighbour = { box: footprint({ x: 300, y: 280, rotation: 0 }, size), rotation: 0 as const };
    const placed = snapPlacement({ x: 950, y: 300 }, size, 0, rect, [neighbour]);
    expect(placed.x).toBe(900);
  });

  it("leaves a unit where it is dropped in the middle of the room", () => {
    expect(snapPlacement({ x: 2003, y: 1497 }, size, 90, rect, [])).toMatchObject({
      x: 2000,
      y: 1500,
      rotation: 90,
      snapped: false,
    });
  });

  it("finds the next free spot along a wall, ignoring units at another height", () => {
    const base = { box: footprint({ x: 300, y: 280, rotation: 0 }, size), span: floorSpan };
    expect(firstFreeSpot(size, floorSpan, rect, [base])).toMatchObject({ x: 900, y: 280 });
    expect(firstFreeSpot(size, { bottom: 1450, top: 2170 }, rect, [base])).toMatchObject({ x: 300 });
  });

  it("flags clashes only between units at the same height", () => {
    const catalogue = seedCatalogue();
    const find = (id: string) => catalogue.units.find((u) => u.id === id)!;
    const baseT = find("base-cabinet");
    const wallT = find("wall-cabinet");
    const item = (id: string, t: typeof baseT, x: number) => ({
      unit: { id, templateId: t.id, variantId: t.variants[3].id, x, y: 280, rotation: 0 as const, materials: {} },
      template: t,
      size: t.variants[3],
    });
    const stacked = findIssues([item("a", baseT, 300), item("b", wallT, 300)], rect);
    expect(stacked).toEqual([]);
    const clash = findIssues([item("a", baseT, 300), item("c", baseT, 500)], rect);
    expect(clash.map((i) => i.kind)).toEqual(["clash", "clash"]);
  });
});
