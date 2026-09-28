"use client";

// A unit in 3D, assembled from the same panel list that prices it. Each
// panel's role says where it goes — sides at the ends, shelves spread up the
// inside, drawer fronts stacked from the top, doors below them — so when the
// admin adds a shelf row, the model grows a shelf. Nothing here is a
// separately authored mesh that could drift from the cut-list.
import type { SizeVariant } from "@/lib/types";

const T = 0.018;
const GAP = 0.003;
const WORKTOP_T = 0.038;
const BRASS = "#C4A87A";

export type SlotColours = Record<string, string>;

interface Part {
  key: string;
  size: [number, number, number];
  position: [number, number, number];
  colour: string;
  handle?: boolean;
}

export function buildParts(variant: SizeVariant, colourFor: (slot: string) => string): Part[] {
  const W = variant.widthMm / 1000;
  const H = variant.heightMm / 1000;
  const D = variant.depthMm / 1000;
  const parts: Part[] = [];
  const byRole = (role: string) => variant.panels.filter((p) => p.role === role);
  const qty = (role: string) => byRole(role).reduce((n, p) => n + p.qty, 0);
  const first = (role: string) => byRole(role)[0];

  const plinth = first("plinth");
  const P = plinth ? plinth.widthMm / 1000 : 0;
  const Hc = H - P;
  const hasBox = qty("side") > 0;

  if (hasBox) {
    const side = first("side")!;
    const sides = qty("side");
    parts.push({ key: "side-l", size: [T, Hc, D], position: [-W / 2 + T / 2, P + Hc / 2, 0], colour: colourFor(side.slot) });
    if (sides > 1) {
      parts.push({ key: "side-r", size: [T, Hc, D], position: [W / 2 - T / 2, P + Hc / 2, 0], colour: colourFor(side.slot) });
    }
    const top = first("top");
    if (top) parts.push({ key: "top", size: [W - 2 * T, T, D], position: [0, H - T / 2, 0], colour: colourFor(top.slot) });
    const bottom = first("bottom");
    if (bottom) parts.push({ key: "bottom", size: [W - 2 * T, T, D], position: [0, P + T / 2, 0], colour: colourFor(bottom.slot) });
  }

  const back = first("back");
  if (back) {
    parts.push(
      hasBox
        ? { key: "back", size: [W - 2 * T, Hc - 2 * T, T], position: [0, P + Hc / 2, -D / 2 + T / 2], colour: colourFor(back.slot) }
        : { key: "back", size: [W, Hc, Math.min(D, T)], position: [0, P + Hc / 2, 0], colour: colourFor(back.slot) },
    );
  }

  const shelf = first("shelf");
  const shelves = qty("shelf");
  for (let i = 0; i < shelves && shelf; i += 1) {
    const y = P + T + ((i + 1) * (Hc - 2 * T)) / (shelves + 1);
    parts.push({ key: `shelf-${i}`, size: [W - 2 * T, T, D - 0.02 - T], position: [0, y, (T - 0.02) / 2], colour: colourFor(shelf.slot) });
  }

  const divider = first("divider");
  const dividers = qty("divider") + Math.max(0, qty("side") - 2);
  for (let i = 0; i < dividers; i += 1) {
    const x = -W / 2 + T + ((i + 1) * (W - 2 * T)) / (dividers + 1);
    parts.push({ key: `div-${i}`, size: [T, Hc - 2 * T, D - 0.02], position: [x, P + Hc / 2, -0.01], colour: colourFor((divider ?? first("side"))!.slot) });
  }

  const frontZ = D / 2 + T / 2;
  let y = H - GAP;
  const drawer = first("drawer");
  for (let i = 0; i < qty("drawer") && drawer; i += 1) {
    const h = drawer.widthMm / 1000;
    parts.push({ key: `drawer-${i}`, size: [W - 2 * GAP, h, T], position: [0, y - h / 2, frontZ], colour: colourFor(drawer.slot), handle: true });
    y -= h + GAP;
  }

  const door = first("door");
  const doors = qty("door");
  if (door && doors > 0) {
    const h = Math.min(door.lengthMm / 1000, y - P - GAP);
    const dw = (W - 2 * GAP - GAP * (doors - 1)) / doors;
    for (let i = 0; i < doors; i += 1) {
      const x = -W / 2 + GAP + dw / 2 + i * (dw + GAP);
      parts.push({ key: `door-${i}`, size: [dw, h, T], position: [x, y - h / 2, frontZ], colour: colourFor(door.slot), handle: true });
    }
  }

  if (plinth) {
    parts.push({ key: "plinth", size: [W - 0.06, P, T], position: [0, P / 2, D / 2 - 0.05], colour: colourFor(plinth.slot) });
  }

  const end = first("end");
  if (end) parts.push({ key: "end", size: [T, H, D], position: [W / 2 + T / 2, H / 2, 0], colour: colourFor(end.slot) });

  const worktop = first("worktop");
  if (worktop) {
    parts.push({ key: "worktop", size: [W, WORKTOP_T, D + 0.02], position: [0, H + WORKTOP_T / 2, 0.01], colour: colourFor(worktop.slot) });
  }

  return parts;
}

export function UnitModel({
  variant,
  colourFor,
  highlight = false,
}: {
  variant: SizeVariant;
  colourFor: (slot: string) => string;
  highlight?: boolean;
}) {
  const parts = buildParts(variant, colourFor);
  return (
    <group>
      {parts.map((part) => (
        <group key={part.key} position={part.position}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={part.size} />
            <meshStandardMaterial
              color={part.colour}
              roughness={0.72}
              emissive={highlight ? "#D4C9B5" : "#000000"}
              emissiveIntensity={highlight ? 0.28 : 0}
            />
          </mesh>
          {part.handle && (
            <mesh position={[0, part.size[1] / 2 - Math.min(0.05, part.size[1] / 3), part.size[2] / 2 + 0.008]} castShadow>
              <boxGeometry args={[Math.min(0.16, part.size[0] * 0.4), 0.012, 0.012]} />
              <meshStandardMaterial color={BRASS} roughness={0.32} metalness={0.75} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}
