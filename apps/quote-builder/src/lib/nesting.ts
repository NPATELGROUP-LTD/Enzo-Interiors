// How many whole boards a set of pieces needs.
//
// A guillotine packer: every cut runs edge to edge across whatever part of
// the sheet it is made in, which is how a panel saw actually works. Pieces
// are placed largest-first into the free rectangle they fit most snugly
// (best short-side fit), across every sheet already opened, before a new
// sheet is started. It is an estimate of a cutting plan, not an optimiser —
// good enough to price from, and deterministic, so the same layout always
// prices the same.
//
// Sheet coordinates: x runs along the board's length, y along its width.

export interface Piece {
  /** Stable identity for rendering. */
  key: string;
  label: string;
  lengthMm: number;
  widthMm: number;
  /** The placed unit this piece belongs to, for per-unit price attribution. */
  ownerId: string;
}

export interface Placement {
  piece: Piece;
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
}

export interface Sheet {
  placements: Placement[];
  usedArea: number;
}

export interface OversizePiece {
  piece: Piece;
  /** Boards charged to make this piece up with joints. */
  boards: number;
}

export interface NestResult {
  sheets: Sheet[];
  oversize: OversizePiece[];
  boardsCharged: number;
}

export interface SheetSpec {
  lengthMm: number;
  widthMm: number;
  grain: boolean;
}

export interface NestOptions {
  kerfMm: number;
  edgeTrimMm: number;
}

interface FreeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface WorkingSheet extends Sheet {
  free: FreeRect[];
}

function orientations(piece: Piece, grain: boolean): { w: number; h: number; rotated: boolean }[] {
  const along = { w: piece.lengthMm, h: piece.widthMm, rotated: false };
  if (grain || piece.lengthMm === piece.widthMm) return [along];
  return [along, { w: piece.widthMm, h: piece.lengthMm, rotated: true }];
}

function splitFree(rect: FreeRect, w: number, h: number, kerf: number): FreeRect[] {
  const rightW = rect.w - w - kerf;
  const belowH = rect.h - h - kerf;
  // Give the full-length strip to whichever leftover is larger, so one
  // generous offcut survives rather than two narrow ones.
  const horizontalFirst = rect.w * belowH >= rect.h * rightW;
  const out: FreeRect[] = [];
  if (horizontalFirst) {
    if (rightW > 0) out.push({ x: rect.x + w + kerf, y: rect.y, w: rightW, h });
    if (belowH > 0) out.push({ x: rect.x, y: rect.y + h + kerf, w: rect.w, h: belowH });
  } else {
    if (rightW > 0) out.push({ x: rect.x + w + kerf, y: rect.y, w: rightW, h: rect.h });
    if (belowH > 0) out.push({ x: rect.x, y: rect.y + h + kerf, w, h: belowH });
  }
  return out;
}

export function nestPieces(pieces: Piece[], sheet: SheetSpec, options: NestOptions): NestResult {
  const trim = Math.max(0, options.edgeTrimMm);
  const kerf = Math.max(0, options.kerfMm);
  const usableL = sheet.lengthMm - 2 * trim;
  const usableW = sheet.widthMm - 2 * trim;

  const sorted = [...pieces].sort(
    (a, b) =>
      Math.max(b.lengthMm, b.widthMm) - Math.max(a.lengthMm, a.widthMm) ||
      b.lengthMm * b.widthMm - a.lengthMm * a.widthMm ||
      a.key.localeCompare(b.key),
  );

  const sheets: WorkingSheet[] = [];
  const oversize: OversizePiece[] = [];

  const newSheet = (): WorkingSheet => ({
    placements: [],
    usedArea: 0,
    free: usableL > 0 && usableW > 0 ? [{ x: trim, y: trim, w: usableL, h: usableW }] : [],
  });

  for (const piece of sorted) {
    const turns = orientations(piece, sheet.grain);
    const fitsAtAll = turns.some((o) => o.w <= usableL && o.h <= usableW);

    if (!fitsAtAll) {
      const boards = Math.min(
        ...turns.map(
          (o) => Math.ceil(o.w / Math.max(usableL, 1)) * Math.ceil(o.h / Math.max(usableW, 1)),
        ),
      );
      oversize.push({ piece, boards });
      continue;
    }

    let best: { sheet: WorkingSheet; rect: FreeRect; o: (typeof turns)[number]; score: number } | null = null;
    for (const candidate of sheets) {
      for (const rect of candidate.free) {
        for (const o of turns) {
          if (o.w > rect.w || o.h > rect.h) continue;
          const score = Math.min(rect.w - o.w, rect.h - o.h);
          if (!best || score < best.score) best = { sheet: candidate, rect, o, score };
        }
      }
    }

    if (!best) {
      const fresh = newSheet();
      sheets.push(fresh);
      const rect = fresh.free[0];
      const o = turns.find((opt) => opt.w <= rect.w && opt.h <= rect.h) ?? turns[0];
      best = { sheet: fresh, rect, o, score: 0 };
    }

    const { sheet: target, rect, o } = best;
    target.placements.push({ piece, x: rect.x, y: rect.y, w: o.w, h: o.h, rotated: o.rotated });
    target.usedArea += o.w * o.h;
    target.free = target.free.filter((f) => f !== rect).concat(splitFree(rect, o.w, o.h, kerf));
  }

  const resultSheets: Sheet[] = sheets.map(({ placements, usedArea }) => ({ placements, usedArea }));
  return {
    sheets: resultSheets,
    oversize,
    boardsCharged: resultSheets.length + oversize.reduce((sum, o) => sum + o.boards, 0),
  };
}
