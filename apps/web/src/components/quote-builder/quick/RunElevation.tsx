// A wall run drawn in elevation: the main units standing on a floor line,
// the optional upper run hung above, and a dimension line with the length
// underneath. Drawn in millimetres, so it is to scale at any size.
import { slotColours } from "@/lib/quote-builder/pricing";
import type { Catalogue, SizeVariant, UnitTemplate } from "@/lib/quote-builder/types";
import { ElevationGlyph, glyphColours } from "../ElevationGlyph";

const INK = "#102E2D";

export interface Run {
  template: UnitTemplate;
  sizes: SizeVariant[];
  materials: Record<string, string>;
}

export function RunElevation({
  catalogue,
  main,
  upper,
  lengthMm,
  className,
}: {
  catalogue: Catalogue;
  main: Run | null;
  upper: Run | null;
  lengthMm: number;
  className?: string;
}) {
  const mainH = main ? Math.max(...main.sizes.map((s) => s.heightMm), 0) + (main.template.structure.worktop ? 38 : 0) : 900;
  const upperTop = upper ? upper.template.elevationMm + Math.max(...upper.sizes.map((s) => s.heightMm), 0) : 0;
  const top = Math.max(mainH, upperTop, 1000);
  const fs = Math.max(lengthMm, top) / 26;
  const span = Math.max(lengthMm, 600);
  const W = span + 240;
  const H = top + fs * 4.2;

  const place = (run: Run | null, bottomOf: (s: SizeVariant) => number) => {
    if (!run) return null;
    const colours = glyphColours(slotColours(catalogue, run.template, run.materials));
    let x = 0;
    return run.sizes.map((size, i) => {
      const extra = run.template.structure.worktop ? 38 : 0;
      const h = size.heightMm + extra;
      const node = (
        <svg key={i} x={x - 12} y={top - bottomOf(size) - h - 12} width={size.widthMm + 24} height={h + 24} overflow="visible">
          <ElevationGlyph template={run.template} variant={size} colours={colours} />
        </svg>
      );
      x += size.widthMm;
      return node;
    });
  };

  return (
    <svg viewBox={`-120 ${-fs} ${W} ${H}`} className={className} role="img" aria-label={`Elevation of a ${lengthMm} millimetre run`}>
      <line x1={-120} x2={span + 120} y1={top} y2={top} stroke={INK} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      {place(upper, () => (upper ? upper.template.elevationMm : 0))}
      {place(main, () => 0)}
      <g>
        <line x1={0} x2={lengthMm} y1={top + fs * 1.3} y2={top + fs * 1.3} stroke={INK} strokeOpacity={0.6} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <line x1={0} x2={0} y1={top + fs * 0.9} y2={top + fs * 1.7} stroke={INK} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
        <line x1={lengthMm} x2={lengthMm} y1={top + fs * 0.9} y2={top + fs * 1.7} stroke={INK} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
        <text x={lengthMm / 2} y={top + fs * 2.6} fontSize={fs} textAnchor="middle" fill={INK} className="font-display">
          {lengthMm.toLocaleString("en-GB")}
        </text>
      </g>
    </svg>
  );
}
