"use client";

// One whole board with the pieces cut from it. The hatched ground is what
// is left over — the offcut the customer still pays for, which is the whole
// reason an estimate is counted in sheets rather than square metres.
import { useId } from "react";
import { inkFor, mm } from "@/lib/format";
import type { Sheet } from "@/lib/nesting";
import type { Board } from "@/lib/types";

export function SheetDiagram({
  board,
  sheet,
  caption,
  showLabels = true,
}: {
  board: Board;
  sheet: Sheet;
  caption: string;
  showLabels?: boolean;
}) {
  const hatch = `hatch${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const L = board.lengthMm;
  const W = board.widthMm;
  const ink = inkFor(board.swatch);
  const used = Math.round((sheet.usedArea / (L * W)) * 100);
  const text = Math.max(34, L / 42);

  return (
    <figure className="min-w-0">
      <svg
        viewBox={`0 0 ${L} ${W}`}
        className="block h-auto w-full"
        role="img"
        aria-label={`${caption}: ${sheet.placements.length} pieces, ${used}% of the sheet used`}
      >
        <defs>
          <pattern id={hatch} width="36" height="36" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="36" height="36" fill="#EAE7E0" />
            <line x1="0" y1="0" x2="0" y2="36" stroke="#C4B8A8" strokeWidth="7" />
          </pattern>
        </defs>
        <rect x={0} y={0} width={L} height={W} fill={`url(#${hatch})`} stroke="#102E2D" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        {sheet.placements.map((p) => {
          const fits = showLabels && p.w > text * 5 && p.h > text * 2.4;
          return (
            <g key={p.piece.key}>
              <rect
                x={p.x}
                y={p.y}
                width={p.w}
                height={p.h}
                fill={board.swatch}
                stroke="#102E2D"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              {fits && (
                <text
                  x={p.x + p.w / 2}
                  y={p.y + p.h / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={ink}
                  fontSize={text}
                  className="font-display"
                >
                  <tspan x={p.x + p.w / 2} dy={-text * 0.55}>
                    {p.piece.label}
                  </tspan>
                  <tspan x={p.x + p.w / 2} dy={text * 1.2} fillOpacity={0.75}>
                    {p.piece.lengthMm} × {p.piece.widthMm}
                  </tspan>
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 flex items-baseline justify-between gap-3 text-[12px] text-muted-foreground">
        <span>{caption}</span>
        <span className="font-display tabular-nums">
          {mm(L)} × {mm(W)}, {used}% used
        </span>
      </figcaption>
    </figure>
  );
}
