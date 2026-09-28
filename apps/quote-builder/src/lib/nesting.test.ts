import { describe, expect, it } from "vitest";
import { nestPieces, type Piece } from "./nesting";

const MFC = { lengthMm: 2800, widthMm: 2070, grain: false };
const VENEER = { lengthMm: 2440, widthMm: 1220, grain: true };
const OPTS = { kerfMm: 4, edgeTrimMm: 10 };

const piece = (lengthMm: number, widthMm: number, key = `${lengthMm}x${widthMm}`): Piece => ({
  key,
  label: key,
  lengthMm,
  widthMm,
  ownerId: "u1",
});

describe("nestPieces", () => {
  it("charges a whole board for a single small piece", () => {
    const result = nestPieces([piece(300, 200)], MFC, OPTS);
    expect(result.sheets).toHaveLength(1);
    expect(result.boardsCharged).toBe(1);
  });

  it("cuts several pieces from the same board when they fit", () => {
    const four = [1, 2, 3, 4].map((i) => piece(1000, 1000, `p${i}`));
    expect(nestPieces(four, MFC, OPTS).boardsCharged).toBe(1);

    const five = [...four, piece(1000, 1000, "p5")];
    expect(nestPieces(five, MFC, OPTS).boardsCharged).toBe(2);
  });

  it("allows turning a piece on plain boards but not against the grain", () => {
    const tall = piece(1100, 2000);
    expect(nestPieces([tall], { ...VENEER, grain: false }, OPTS).oversize).toHaveLength(0);
    const grained = nestPieces([tall], VENEER, OPTS);
    expect(grained.oversize).toHaveLength(1);
    expect(grained.sheets).toHaveLength(0);
  });

  it("charges enough boards to joint a piece longer than any sheet", () => {
    const result = nestPieces([piece(3500, 500)], MFC, OPTS);
    expect(result.oversize).toEqual([expect.objectContaining({ boards: 2 })]);
    expect(result.boardsCharged).toBe(2);
  });

  it("keeps every placement inside the trimmed sheet with no overlaps", () => {
    let seed = 7;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const pieces = Array.from({ length: 60 }, (_, i) =>
      piece(Math.round(150 + rand() * 1800), Math.round(100 + rand() * 900), `r${i}`),
    );
    const result = nestPieces(pieces, MFC, OPTS);
    const placed = result.sheets.flatMap((s) => s.placements).length;
    expect(placed + result.oversize.length).toBe(pieces.length);

    for (const sheet of result.sheets) {
      for (const a of sheet.placements) {
        expect(a.x).toBeGreaterThanOrEqual(10);
        expect(a.y).toBeGreaterThanOrEqual(10);
        expect(a.x + a.w).toBeLessThanOrEqual(2790);
        expect(a.y + a.h).toBeLessThanOrEqual(2060);
        for (const b of sheet.placements) {
          if (a === b) continue;
          const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
          expect(apart).toBe(true);
        }
      }
    }
  });

  it("is deterministic", () => {
    const pieces = [piece(700, 560, "a"), piece(564, 560, "b"), piece(564, 560, "c"), piece(2000, 600, "d")];
    expect(nestPieces(pieces, MFC, OPTS)).toEqual(nestPieces([...pieces].reverse(), MFC, OPTS));
  });
});
