// Front elevation of a unit, drawn from its panel list: the carcass, the
// drawer fronts stacked from the top, doors side by side beneath them,
// plinth and worktop. It is the same drawing whether it is a 40px icon in
// the palette or a large preview, because it is drawn in millimetres.
import type { SizeVariant, UnitTemplate } from "@/lib/types";

const INK = "#102E2D";
const GAP = 3;
const WORKTOP = 38;

export interface GlyphColours {
  carcass: string;
  front: string;
  worktop?: string;
}

export function ElevationGlyph({
  template,
  variant,
  colours,
  className,
  label,
}: {
  template: Pick<UnitTemplate, "mount">;
  variant: SizeVariant;
  colours: GlyphColours;
  className?: string;
  /** Accessible name; omit when the glyph sits next to its own text. */
  label?: string;
}) {
  const { panels, widthMm: W, heightMm } = variant;
  const count = (role: string) => panels.filter((p) => p.role === role).reduce((n, p) => n + p.qty, 0);
  const plinth = panels.find((p) => p.role === "plinth");
  const plinthH = plinth ? plinth.widthMm : 0;
  const hasWorktop = count("worktop") > 0;
  const wt = hasWorktop ? WORKTOP : 0;
  const totalH = heightMm + wt;
  const carcassTop = wt;
  const carcassH = heightMm - plinthH;

  const drawer = panels.find((p) => p.role === "drawer");
  const drawers = count("drawer");
  const door = panels.find((p) => p.role === "door");
  const doors = count("door");
  const shelves = count("shelf");
  const hasBox = count("side") > 0;

  const handleAt = template.mount === "wall" ? "bottom" : template.mount === "tall" ? "middle" : "top";
  const stroke = { stroke: INK, strokeWidth: 1.25, vectorEffect: "non-scaling-stroke" as const };

  const fronts: React.ReactNode[] = [];
  let y = carcassTop + GAP;
  if (drawer) {
    for (let i = 0; i < drawers; i += 1) {
      const h = drawer.widthMm;
      fronts.push(
        <g key={`d${i}`}>
          <rect x={GAP} y={y} width={W - 2 * GAP} height={h} fill={colours.front} {...stroke} />
          <line x1={W * 0.36} x2={W * 0.64} y1={y + Math.min(40, h / 2)} y2={y + Math.min(40, h / 2)} {...stroke} strokeWidth={2} />
        </g>,
      );
      y += h + GAP;
    }
  }
  if (door && doors > 0) {
    const h = Math.min(door.lengthMm, carcassTop + carcassH - GAP - y);
    const dw = (W - 2 * GAP - GAP * (doors - 1)) / doors;
    for (let i = 0; i < doors; i += 1) {
      const x = GAP + i * (dw + GAP);
      const handleX = doors === 1 ? x + dw - 40 : i % 2 === 0 ? x + dw - 40 : x + 40;
      const hy = handleAt === "top" ? y + 40 : handleAt === "bottom" ? y + h - 140 : y + h / 2 - 50;
      fronts.push(
        <g key={`o${i}`}>
          <rect x={x} y={y} width={dw} height={h} fill={colours.front} {...stroke} />
          <line x1={handleX} x2={handleX} y1={hy} y2={hy + 100} {...stroke} strokeWidth={2} />
        </g>,
      );
    }
  }

  const open = fronts.length === 0;

  return (
    <svg
      viewBox={`-12 -12 ${W + 24} ${totalH + 24}`}
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      preserveAspectRatio="xMidYMax meet"
    >
      {hasWorktop && <rect x={-10} y={0} width={W + 20} height={wt} fill={colours.worktop ?? colours.carcass} {...stroke} />}
      {hasBox ? (
        <rect x={0} y={carcassTop} width={W} height={carcassH} fill={colours.carcass} {...stroke} />
      ) : (
        <rect x={0} y={carcassTop} width={W} height={carcassH} fill={colours.front} {...stroke} />
      )}
      {!hasBox &&
        Array.from({ length: Math.floor(W / 60) - 1 }, (_, i) => (
          <line key={i} x1={(i + 1) * 60} x2={(i + 1) * 60} y1={carcassTop} y2={carcassTop + carcassH} {...stroke} strokeOpacity={0.35} />
        ))}
      {hasBox && open &&
        Array.from({ length: shelves }, (_, i) => {
          const sy = carcassTop + ((i + 1) * carcassH) / (shelves + 1);
          return <line key={i} x1={18} x2={W - 18} y1={sy} y2={sy} {...stroke} />;
        })}
      {hasBox && open && (
        <rect x={18} y={carcassTop + 18} width={W - 36} height={carcassH - 36} fill="none" {...stroke} strokeOpacity={0.5} />
      )}
      {fronts}
      {plinthH > 0 && (
        <rect x={40} y={totalH - plinthH} width={W - 80} height={plinthH} fill={colours.front} {...stroke} fillOpacity={0.85} />
      )}
    </svg>
  );
}

/** Glyph colours from per-slot swatches; units without a carcass or front slot fall back to their first slot. */
export function glyphColours(colours: Record<string, string>): GlyphColours {
  const fallback = Object.values(colours)[0] ?? "#D4C9B5";
  return {
    carcass: colours.carcass ?? colours.back ?? fallback,
    front: colours.front ?? fallback,
    worktop: colours.worktop,
  };
}
