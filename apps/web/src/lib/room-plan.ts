// Procedural plan-view geometry, seeded by a service slug.
//
// The /services hero shows a shop-drawn plan of the room behind whichever
// service you are pointing at, with the photograph clipped inside the
// room's footprint — the drawing filled with the real thing, which is the
// studio's whole pitch in one image.
//
// That only works if every service has a drawing, and the client adds
// services themselves — nobody is going to draw a plan in the Content
// Manager. So the geometry is *generated* from the slug: same slug, same
// drawing, forever, and a brand-new service gets a plausible, distinct room
// the moment it is saved. Nothing here is a claim about the visitor's
// actual room, which is why the dimension lines carry ticks but no figures.
//
// Pure and framework-free (no React, no DOM) so it can run during a server
// render and be unit-tested directly.

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface RoomPlan {
  width: number;
  height: number;
  /** Closed path for the room footprint — used as both stroke and clip. */
  outline: string;
  /** Fitted furniture modules hugging the two longest walls. */
  units: Rect[];
  /** Hairlines between adjacent modules — the joints in the run. */
  joints: Segment[];
  /** Quarter-circle door swing plus its leaf. */
  door: { arc: string; leaf: Segment };
  /** Window runs, drawn as a doubled line on the wall. */
  windows: Segment[];
  /** Unlabelled dimension lines with end ticks, below and left of the plan. */
  dimensions: { line: Segment; ticks: Segment[] }[];
}

const VIEW_W = 480;
const VIEW_H = 340;
const PAD_X = 46;
const PAD_Y = 36;
/** Depth of a fitted run in plan — carcass depth, at the plan's own scale. */
const UNIT_DEPTH = 21;

/** FNV-1a — a short, stable string hash. Same slug always seeds the same room. */
function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32 — tiny deterministic PRNG, seeded from the slug hash. */
function makeRandom(seed: number) {
  let state = seed;
  return function random(): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function polygonPath(points: Point[]): string {
  return `${points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ")} Z`;
}

function centroid(points: Point[]): Point {
  const sum = points.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 },
  );
  return { x: sum.x / points.length, y: sum.y / points.length };
}

/**
 * Builds the footprint: a rectangle, or a rectangle with one corner
 * squared off into an L. Roughly a third of slugs get the plain rectangle,
 * which keeps the set from looking like every room is the same clever
 * shape.
 */
function buildFootprint(random: () => number): Point[] {
  const x0 = PAD_X;
  const y0 = PAD_Y;
  const x1 = VIEW_W - PAD_X;
  const y1 = VIEW_H - PAD_Y;

  if (random() < 0.34) {
    return [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ];
  }

  const notchW = Math.round((x1 - x0) * (0.24 + random() * 0.16));
  const notchH = Math.round((y1 - y0) * (0.24 + random() * 0.18));
  const corner = Math.floor(random() * 4);

  switch (corner) {
    case 0: // top-left
      return [
        { x: x0 + notchW, y: y0 },
        { x: x1, y: y0 },
        { x: x1, y: y1 },
        { x: x0, y: y1 },
        { x: x0, y: y0 + notchH },
        { x: x0 + notchW, y: y0 + notchH },
      ];
    case 1: // top-right
      return [
        { x: x0, y: y0 },
        { x: x1 - notchW, y: y0 },
        { x: x1 - notchW, y: y0 + notchH },
        { x: x1, y: y0 + notchH },
        { x: x1, y: y1 },
        { x: x0, y: y1 },
      ];
    case 2: // bottom-right
      return [
        { x: x0, y: y0 },
        { x: x1, y: y0 },
        { x: x1, y: y1 - notchH },
        { x: x1 - notchW, y: y1 - notchH },
        { x: x1 - notchW, y: y1 },
        { x: x0, y: y1 },
      ];
    default: // bottom-left
      return [
        { x: x0, y: y0 },
        { x: x1, y: y0 },
        { x: x1, y: y1 },
        { x: x0 + notchW, y: y1 },
        { x: x0 + notchW, y: y1 - notchH },
        { x: x0, y: y1 - notchH },
      ];
  }
}

interface Edge {
  a: Point;
  b: Point;
  horizontal: boolean;
  length: number;
}

function buildEdges(points: Point[]): Edge[] {
  return points.map((a, i) => {
    const b = points[(i + 1) % points.length];
    const horizontal = Math.abs(a.y - b.y) < Math.abs(a.x - b.x);
    return {
      a,
      b,
      horizontal,
      length: horizontal ? Math.abs(b.x - a.x) : Math.abs(b.y - a.y),
    };
  });
}

/**
 * Lays a run of fitted modules against one wall, on the interior side. The
 * module count follows the wall length rather than being fixed, so a short
 * return wall gets two units and a long one gets six — the same rule the
 * workshop uses.
 */
function runAlongEdge(edge: Edge, inside: Point, random: () => number) {
  const units: Rect[] = [];
  const joints: Segment[] = [];

  const margin = 10;
  const usable = edge.length - margin * 2;
  if (usable < 40) return { units, joints };

  const count = Math.max(2, Math.min(6, Math.round(usable / 68)));
  const moduleSize = usable / count;

  for (let i = 0; i < count; i += 1) {
    // A couple of modules are deliberately shallower — a run is rarely one
    // uninterrupted depth, and the step is what makes it read as furniture
    // rather than a border.
    const depth = UNIT_DEPTH * (random() < 0.25 ? 0.62 : 1);

    if (edge.horizontal) {
      const startX = Math.min(edge.a.x, edge.b.x) + margin + i * moduleSize;
      const wallY = edge.a.y;
      const y = inside.y > wallY ? wallY : wallY - depth;
      units.push({ x: startX, y, w: moduleSize, h: depth });
      if (i > 0) {
        joints.push({ x1: startX, y1: y, x2: startX, y2: y + depth });
      }
    } else {
      const startY = Math.min(edge.a.y, edge.b.y) + margin + i * moduleSize;
      const wallX = edge.a.x;
      const x = inside.x > wallX ? wallX : wallX - depth;
      units.push({ x, y: startY, w: depth, h: moduleSize });
      if (i > 0) {
        joints.push({ x1: x, y1: startY, x2: x + depth, y2: startY });
      }
    }
  }

  return { units, joints };
}

/** Windows: a doubled line set into the middle third of a wall. */
function windowOnEdge(edge: Edge): Segment {
  const t0 = 0.32;
  const t1 = 0.68;
  if (edge.horizontal) {
    const left = Math.min(edge.a.x, edge.b.x);
    return {
      x1: left + edge.length * t0,
      y1: edge.a.y,
      x2: left + edge.length * t1,
      y2: edge.a.y,
    };
  }
  const top = Math.min(edge.a.y, edge.b.y);
  return {
    x1: edge.a.x,
    y1: top + edge.length * t0,
    x2: edge.a.x,
    y2: top + edge.length * t1,
  };
}

export function buildRoomPlan(seedKey: string): RoomPlan {
  const random = makeRandom(hashString(seedKey));
  const points = buildFootprint(random);
  const inside = centroid(points);
  const edges = buildEdges(points);

  // Longest walls carry the furniture; that is simply where a fitted run
  // goes, and it means the drawing changes shape with the footprint rather
  // than pasting the same run into every room.
  const ranked = [...edges].sort((a, b) => b.length - a.length);
  const runEdges = ranked.slice(0, 2);
  const units: Rect[] = [];
  const joints: Segment[] = [];
  for (const edge of runEdges) {
    const run = runAlongEdge(edge, inside, random);
    units.push(...run.units);
    joints.push(...run.joints);
  }

  // Windows go on walls the furniture does not occupy, so the drawing never
  // puts a window behind a cabinet run.
  const freeEdges = ranked.slice(2).filter((edge) => edge.length > 70);
  const windows = freeEdges.slice(0, 2).map(windowOnEdge);

  // Door swing, hinged off the corner nearest the plan's bottom-left.
  const doorEdge = freeEdges[0] ?? ranked[2] ?? ranked[0];
  const swing = 34;
  const hingeX = doorEdge.horizontal
    ? Math.min(doorEdge.a.x, doorEdge.b.x) + 14
    : doorEdge.a.x;
  const hingeY = doorEdge.horizontal
    ? doorEdge.a.y
    : Math.min(doorEdge.a.y, doorEdge.b.y) + 14;
  const towardX = inside.x > hingeX ? 1 : -1;
  const towardY = inside.y > hingeY ? 1 : -1;
  const endX = doorEdge.horizontal ? hingeX + swing : hingeX + swing * towardX;
  const endY = doorEdge.horizontal ? hingeY + swing * towardY : hingeY + swing;

  const door = {
    arc: `M${hingeX + (doorEdge.horizontal ? swing : 0)} ${
      hingeY + (doorEdge.horizontal ? 0 : swing)
    } A${swing} ${swing} 0 0 ${towardX * towardY > 0 ? 1 : 0} ${endX} ${endY}`,
    leaf: { x1: hingeX, y1: hingeY, x2: endX, y2: endY },
  };

  // Dimension lines: draughting furniture, deliberately unlabelled. A
  // figure here would read as a promise about the visitor's own room.
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  const offset = 20;

  const dimensions = [
    {
      line: { x1: minX, y1: maxY + offset, x2: maxX, y2: maxY + offset },
      ticks: [
        { x1: minX, y1: maxY + offset - 5, x2: minX, y2: maxY + offset + 5 },
        { x1: maxX, y1: maxY + offset - 5, x2: maxX, y2: maxY + offset + 5 },
      ],
    },
    {
      line: { x1: minX - offset, y1: minY, x2: minX - offset, y2: maxY },
      ticks: [
        { x1: minX - offset - 5, y1: minY, x2: minX - offset + 5, y2: minY },
        { x1: minX - offset - 5, y1: maxY, x2: minX - offset + 5, y2: maxY },
      ],
    },
  ];

  return {
    width: VIEW_W,
    height: VIEW_H,
    outline: polygonPath(points),
    units,
    joints,
    door,
    windows,
    dimensions,
  };
}
