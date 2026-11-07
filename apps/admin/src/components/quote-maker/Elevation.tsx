import clsx from 'clsx';
import { useRef, type KeyboardEvent, type PointerEvent } from 'react';

import { bottomOf, clampX, overlaps, type PlanWall, type UnitTemplate } from './plan';

const WORKTOP_MM = 38;
const PAD = 160; // mm of room around the wall, for the dimension line

export interface ElevationProps {
  label: string;
  wall: PlanWall;
  ceiling_mm: number;
  templates: Map<string, UnitTemplate>;
  /** The colour a unit's fronts show: its front finish, else the default front board. */
  colourOf: (unit: PlanWall['units'][number], template: UnitTemplate) => string | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, x_mm: number) => void;
  onRemove: (id: string) => void;
}

/**
 * One run seen from the front, drawn to scale in millimetres. A unit is dragged along the wall (it
 * snaps to 10 mm and stays on it) or moved with the arrow keys once focused; Delete removes it.
 * Units that overlap in their band are outlined in red: the API only checks that each is on its wall.
 */
export function Elevation({ label, wall, ceiling_mm, templates, colourOf, selectedId, onSelect, onMove, onRemove }: ElevationProps) {
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; start: number; x: number; width: number } | null>(null);

  const drawn = wall.units.flatMap((unit) => {
    const template = templates.get(unit.template_id);
    const variant = template?.variants.find((v) => v.id === unit.variant_id);
    return template && variant ? [{ unit, template, variant }] : [];
  });
  const clash = overlaps(drawn.map(({ unit, template, variant }) => ({ id: unit.id, x: unit.x_mm, w: variant.width_mm, mount: template.mount })));

  const mmAt = (event: PointerEvent) => {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return 0;
    return new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()).x;
  };
  const down = (id: string, x: number, width: number) => (event: PointerEvent<SVGGElement>) => {
    event.stopPropagation();
    onSelect(id);
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    drag.current = { id, start: mmAt(event), x, width };
  };
  const move = (event: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const next = clampX(d.x + mmAt(event) - d.start, d.width, wall.length_mm);
    if (next !== wall.units.find((u) => u.id === d.id)?.x_mm) onMove(d.id, next);
  };
  const up = () => (drag.current = null);
  const key = (id: string, x: number, width: number) => (event: KeyboardEvent) => {
    const step = event.shiftKey ? 100 : 10;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      onMove(id, clampX(x + (event.key === 'ArrowLeft' ? -step : step), width, wall.length_mm));
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      onRemove(id);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(id);
    }
  };

  const W = wall.length_mm;
  const H = ceiling_mm;
  const y = (mm: number) => H - mm; // SVG y from millimetres above the floor
  const text = Math.max(70, Math.min(W, 6000) / 40);

  return (
    <figure className="m-0">
      <figcaption className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="font-semibold text-ink">{label}</span>
        <span className="tabular text-xs text-ink-muted">
          {W.toLocaleString('en-GB')} mm · {wall.units.length} {wall.units.length === 1 ? 'unit' : 'units'}
        </span>
      </figcaption>
      <svg
        ref={svg}
        viewBox={`${-PAD} ${-PAD / 2} ${W + PAD * 2} ${H + PAD * 2}`}
        className="h-auto max-h-[46vh] w-full touch-none select-none rounded-card bg-surface-muted"
        role="group"
        aria-label={`${label}, front view`}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerDown={() => onSelect(null)}
      >
        <rect x={0} y={0} width={W} height={H} className="fill-surface stroke-border" strokeWidth={6} />
        <line x1={-PAD / 2} x2={W + PAD / 2} y1={H} y2={H} className="stroke-ink/60" strokeWidth={10} />

        {drawn.map(({ unit, template, variant }) => {
          const bottom = bottomOf(template);
          const top = Math.min(H, bottom + variant.height_mm);
          const x = unit.x_mm;
          const w = variant.width_mm;
          const h = top - bottom;
          const s = template.structure;
          const gap = template.mount === 'gap';
          const colour = gap ? null : colourOf(unit, template);
          const selected = unit.id === selectedId;
          const front = h - (s.plinth_mm || 0);
          return (
            <g
              key={unit.id}
              tabIndex={0}
              role="button"
              aria-pressed={selected}
              aria-label={`${template.name}, ${w} mm, ${x} mm from the left${clash.has(unit.id) ? ', overlaps another unit' : ''}`}
              className="cursor-grab outline-none focus-visible:[&>rect.body]:stroke-focus-ring active:cursor-grabbing"
              onPointerDown={down(unit.id, x, w)}
              onKeyDown={key(unit.id, x, w)}
            >
              <rect
                className={clsx('body', gap ? 'fill-transparent stroke-ink/50' : 'stroke-ink/70', !colour && !gap && 'fill-green-100')}
                x={x + 3}
                y={y(top)}
                width={w - 6}
                height={h}
                fill={colour ?? undefined}
                strokeWidth={selected ? 14 : 5}
                strokeDasharray={gap ? '30 20' : undefined}
                style={selected ? { stroke: 'var(--focus-ring)' } : undefined}
              />
              {s.plinth_mm > 0 && !gap ? <rect x={x + 3} y={y(bottom + s.plinth_mm)} width={w - 6} height={s.plinth_mm} className="fill-ink/30" /> : null}
              {s.worktop && !gap ? <rect x={x} y={y(top + WORKTOP_MM)} width={w} height={WORKTOP_MM} className="fill-ink/45" /> : null}
              {!gap &&
                Array.from({ length: Math.max(0, s.doors - 1) }, (_, i) => (
                  <line key={`d${i}`} x1={x + (w * (i + 1)) / s.doors} x2={x + (w * (i + 1)) / s.doors} y1={y(top)} y2={y(top - front)} className="stroke-ink/50" strokeWidth={4} />
                ))}
              {!gap &&
                Array.from({ length: s.drawers }, (_, i) => {
                  const each = front / Math.max(1, s.drawers + (s.doors ? 1 : 0));
                  return <line key={`r${i}`} x1={x + 3} x2={x + w - 3} y1={y(top - each * (i + 1))} y2={y(top - each * (i + 1))} className="stroke-ink/50" strokeWidth={4} />;
                })}
              {clash.has(unit.id) ? <rect x={x + 3} y={y(top)} width={w - 6} height={h} className="fill-danger/15 stroke-danger" strokeWidth={10} /> : null}
              <text x={x + w / 2} y={y(bottom + h / 2)} textAnchor="middle" dominantBaseline="middle" fontSize={text} className="pointer-events-none fill-ink font-semibold">
                {w}
              </text>
            </g>
          );
        })}

        {/* Overall length */}
        <g className="pointer-events-none fill-ink-muted stroke-ink-muted">
          <line x1={0} x2={W} y1={H + PAD * 0.6} y2={H + PAD * 0.6} strokeWidth={4} />
          <line x1={0} x2={0} y1={H + PAD * 0.4} y2={H + PAD * 0.8} strokeWidth={4} />
          <line x1={W} x2={W} y1={H + PAD * 0.4} y2={H + PAD * 0.8} strokeWidth={4} />
        </g>
      </svg>
    </figure>
  );
}
