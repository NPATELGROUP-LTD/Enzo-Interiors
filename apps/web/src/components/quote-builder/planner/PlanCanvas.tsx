"use client";

// The plan, drawn like a shop drawing in real millimetres: walls poured
// outside the room line, a 100mm grid on the floor, a dimension on every
// wall, and each unit in plan with its front edge in the chosen finish.
// Wall-hung units are dashed (they are above eye line in plan), full-height
// units carry a cross — the conventions a fitter reads without a key.
//
// Dragging is pointer events, so it works with a finger as well as a mouse.
// New units arrive by HTML drag-and-drop from the palette (or its add
// button, which is the touch path).
import { useCallback, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@/lib/utils";
import { inkFor } from "@/lib/quote-builder/format";
import {
  footprint,
  outlinePath,
  roomOutline,
  roomWalls,
  snapPlacement,
  type PlanIssue,
  type Point,
} from "@/lib/quote-builder/geometry";
import type { PlacedUnit, RoomSpec, Rotation, SizeVariant, UnitTemplate } from "@/lib/quote-builder/types";

export interface CanvasItem {
  unit: PlacedUnit;
  template: UnitTemplate;
  variant: SizeVariant;
  colours: Record<string, string>;
}

export const DRAG_MIME = "application/x-enzo-unit";

const INK = "#102E2D";
const LEVEL_ORDER = { floor: 0, tall: 1, wall: 2 } as const;

interface DragState {
  id: string;
  offset: Point;
  x: number;
  y: number;
  rotation: Rotation;
  moved: boolean;
}

export function PlanCanvas({
  room,
  items,
  selectedId,
  issues = [],
  onSelect,
  onMove,
  onDropTemplate,
  onKeyAction,
  readOnly = false,
  className,
}: {
  room: RoomSpec;
  items: CanvasItem[];
  selectedId?: string | null;
  issues?: PlanIssue[];
  onSelect?: (id: string | null) => void;
  onMove?: (id: string, x: number, y: number, rotation: Rotation) => void;
  onDropTemplate?: (templateId: string, point: Point) => void;
  onKeyAction?: (id: string, action: "rotate" | "delete" | "nudge", delta?: Point) => void;
  readOnly?: boolean;
  className?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dropHover, setDropHover] = useState(false);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");

  const W = room.widthMm;
  const D = room.depthMm;
  const pad = Math.max(W, D) * 0.13;
  const fs = Math.max(W, D) / 36;
  const outline = useMemo(() => roomOutline(room), [room]);
  const walls = useMemo(() => roomWalls(room), [room]);
  const path = outlinePath(outline);
  const paper = `M${-pad} ${-pad} H${W + pad} V${D + pad} H${-pad} Z`;

  const toPlan = useCallback((clientX: number, clientY: number): Point => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }, []);

  const issueFor = (id: string) => issues.filter((i) => i.unitId === id).map((i) => i.kind);

  const othersFor = (id: string) =>
    items
      .filter((item) => item.unit.id !== id)
      .map((item) => ({ box: footprint(item.unit, item.variant), rotation: item.unit.rotation }));

  const onUnitPointerDown = (event: PointerEvent<SVGGElement>, item: CanvasItem) => {
    if (readOnly) return;
    event.stopPropagation();
    onSelect?.(item.unit.id);
    const p = toPlan(event.clientX, event.clientY);
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    setDrag({
      id: item.unit.id,
      offset: { x: p.x - item.unit.x, y: p.y - item.unit.y },
      x: item.unit.x,
      y: item.unit.y,
      rotation: item.unit.rotation,
      moved: false,
    });
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    const item = items.find((i) => i.unit.id === drag.id);
    if (!item) return;
    const p = toPlan(event.clientX, event.clientY);
    const centre = { x: p.x - drag.offset.x, y: p.y - drag.offset.y };
    const moved = drag.moved || Math.hypot(centre.x - item.unit.x, centre.y - item.unit.y) > 15;
    if (!moved) return;
    const snapped = snapPlacement(centre, item.variant, item.unit.rotation, room, othersFor(drag.id));
    setDrag({ ...drag, ...snapped, moved: true });
  };

  const endDrag = () => {
    if (drag?.moved) onMove?.(drag.id, drag.x, drag.y, drag.rotation);
    setDrag(null);
  };

  const onUnitKey = (event: KeyboardEvent<SVGGElement>, item: CanvasItem) => {
    if (readOnly) return;
    const step = event.shiftKey ? 100 : 10;
    const nudges: Record<string, Point> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    if (event.key in nudges) {
      event.preventDefault();
      onSelect?.(item.unit.id);
      onKeyAction?.(item.unit.id, "nudge", nudges[event.key]);
    } else if (event.key === "r" || event.key === "R") {
      event.preventDefault();
      onKeyAction?.(item.unit.id, "rotate");
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      onKeyAction?.(item.unit.id, "delete");
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect?.(item.unit.id);
    } else if (event.key === "Escape") {
      onSelect?.(null);
    }
  };

  const coveredBelow = (id: string, box: ReturnType<typeof footprint>) =>
    items.some((other) => {
      if (other.unit.id === id || other.template.mount === "wall") return false;
      const o = footprint(other.unit, other.variant);
      return o.x < box.x + box.w && box.x < o.x + o.w && o.y < box.y + box.h && box.y < o.y + o.h;
    });

  const ordered = [...items].sort((a, b) => LEVEL_ORDER[a.template.mount] - LEVEL_ORDER[b.template.mount]);

  return (
    <svg
      ref={svgRef}
      viewBox={`${-pad} ${-pad} ${W + 2 * pad} ${D + 2 * pad}`}
      className={cn("block h-full w-full touch-none select-none", dropHover && "outline-2 outline-dashed outline-primary/40", className)}
      role="group"
      aria-label={`Plan of your room, ${W} by ${D} millimetres, with ${items.length} units`}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerDown={() => !readOnly && onSelect?.(null)}
      onDragOver={(event) => {
        if (readOnly || !event.dataTransfer.types.includes(DRAG_MIME)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setDropHover(true);
      }}
      onDragLeave={() => setDropHover(false)}
      onDrop={(event) => {
        setDropHover(false);
        const id = event.dataTransfer.getData(DRAG_MIME);
        if (!id || readOnly) return;
        event.preventDefault();
        onDropTemplate?.(id, toPlan(event.clientX, event.clientY));
      }}
    >
      <defs>
        <pattern id={`${uid}-minor`} width="100" height="100" patternUnits="userSpaceOnUse">
          <path d="M100 0 L0 0 0 100" fill="none" stroke="#C4B8A8" strokeOpacity="0.35" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        </pattern>
        <pattern id={`${uid}-major`} width="500" height="500" patternUnits="userSpaceOnUse">
          <rect width="500" height="500" fill={`url(#${uid}-minor)`} />
          <path d="M500 0 L0 0 0 500" fill="none" stroke="#C4B8A8" strokeOpacity="0.8" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        </pattern>
        <clipPath id={`${uid}-room`}>
          <path d={path} />
        </clipPath>
        <clipPath id={`${uid}-outside`}>
          <path d={`${paper} ${path}`} clipRule="evenodd" />
        </clipPath>
        <pattern id={`${uid}-clash`} width="60" height="60" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="60" height="60" fill="#D94040" fillOpacity="0.12" />
          <line x1="0" y1="0" x2="0" y2="60" stroke="#D94040" strokeOpacity="0.5" strokeWidth="14" />
        </pattern>
      </defs>

      <path d={path} fill="#FAFAF7" />
      <rect x={0} y={0} width={W} height={D} fill={`url(#${uid}-major)`} clipPath={`url(#${uid}-room)`} />
      <path d={path} fill="none" stroke={INK} strokeWidth={200} strokeLinejoin="miter" clipPath={`url(#${uid}-outside)`} />

      {walls.map((wall, i) => {
        // A rectangle's opposite walls are the same length; dimension each once.
        if (room.shape !== "L" && (i === 1 || i === 2)) return null;
        const off = 100 + fs * 1.6;
        const nx = -wall.inward.x * off;
        const ny = -wall.inward.y * off;
        const a = { x: wall.a.x + nx, y: wall.a.y + ny };
        const b = { x: wall.b.x + nx, y: wall.b.y + ny };
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const tick = fs * 0.35;
        const tx = wall.horizontal ? 0 : tick;
        const ty = wall.horizontal ? tick : 0;
        // Walls round an L's inner corner face each other across the notch;
        // their figures go on the wall side of the line so the two never meet.
        const inner = wall.horizontal ? wall.a.y !== 0 && wall.a.y !== D : wall.a.x !== 0 && wall.a.x !== W;
        const labelOff = fs * (inner ? -0.75 : 0.75);
        return (
          <g key={i} aria-hidden="true">
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={INK} strokeOpacity={0.55} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <line x1={a.x - tx} y1={a.y - ty} x2={a.x + tx} y2={a.y + ty} stroke={INK} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
            <line x1={b.x - tx} y1={b.y - ty} x2={b.x + tx} y2={b.y + ty} stroke={INK} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
            <text
              x={mid.x - wall.inward.x * labelOff}
              y={mid.y - wall.inward.y * labelOff}
              fontSize={fs}
              fill={INK}
              textAnchor="middle"
              dominantBaseline="middle"
              className="font-display"
              transform={wall.horizontal ? undefined : `rotate(-90 ${mid.x - wall.inward.x * labelOff} ${mid.y - wall.inward.y * labelOff})`}
            >
              {Math.round(wall.length).toLocaleString("en-GB")}
            </text>
          </g>
        );
      })}

      {ordered.map((item) => {
        const live = drag?.id === item.unit.id ? { ...item.unit, x: drag.x, y: drag.y, rotation: drag.rotation } : item.unit;
        const { widthMm: w, depthMm: d } = item.variant;
        const selected = selectedId === item.unit.id;
        const problems = issueFor(item.unit.id);
        const front = item.colours.front ?? Object.values(item.colours)[0] ?? "#D4C9B5";
        const top = item.colours.worktop ?? item.colours.carcass ?? front;
        const mount = item.template.mount;
        const fill = mount === "floor" ? top : front;
        const box = footprint(live, item.variant);
        const label = `${item.template.name}, ${w} millimetres wide${problems.length ? ", needs attention" : ""}`;

        return (
          <g
            key={item.unit.id}
            role={readOnly ? undefined : "button"}
            tabIndex={readOnly ? undefined : 0}
            aria-label={readOnly ? undefined : label}
            aria-pressed={readOnly ? undefined : selected}
            onPointerDown={(e) => onUnitPointerDown(e, item)}
            onKeyDown={(e) => onUnitKey(e, item)}
            onFocus={() => !readOnly && onSelect?.(item.unit.id)}
            className={cn("outline-none", !readOnly && (drag?.id === item.unit.id ? "cursor-grabbing" : "cursor-grab"))}
          >
            <title>{label}</title>
            {selected && (
              <rect
                x={box.x - 40}
                y={box.y - 40}
                width={box.w + 80}
                height={box.h + 80}
                rx={30}
                fill="#D4C9B5"
                fillOpacity={0.35}
                stroke="#B8A987"
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
            )}
            <g transform={`translate(${live.x} ${live.y}) rotate(${live.rotation})`}>
              <rect
                x={-w / 2}
                y={-d / 2}
                width={w}
                height={d}
                fill={fill}
                fillOpacity={mount === "wall" ? 0.4 : 0.92}
                stroke={INK}
                strokeWidth={selected ? 2 : 1.25}
                strokeDasharray={mount === "wall" ? "6 4" : undefined}
                vectorEffect="non-scaling-stroke"
              />
              {mount === "tall" && (
                <path
                  d={`M${-w / 2} ${-d / 2} L${w / 2} ${d / 2} M${w / 2} ${-d / 2} L${-w / 2} ${d / 2}`}
                  stroke={INK}
                  strokeOpacity={0.45}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {mount !== "wall" && d > 80 && (
                <rect x={-w / 2} y={d / 2 - Math.min(40, d * 0.12)} width={w} height={Math.min(40, d * 0.12)} fill={front} stroke={INK} strokeWidth={1} vectorEffect="non-scaling-stroke" />
              )}
              {problems.length > 0 && (
                <rect x={-w / 2} y={-d / 2} width={w} height={d} fill={`url(#${uid}-clash)`} stroke="#D94040" strokeWidth={2} vectorEffect="non-scaling-stroke" />
              )}
            </g>
          </g>
        );
      })}

      {/* Figures go on last, so a wall unit's dashes never cut through the
          width of the base unit beneath it. */}
      {ordered.map((item) => {
        const live = drag?.id === item.unit.id ? { ...item.unit, x: drag.x, y: drag.y, rotation: drag.rotation } : item.unit;
        const box = footprint(live, item.variant);
        const mount = item.template.mount;
        if (Math.min(box.w, box.h) <= fs * 1.2 || (mount === "wall" && coveredBelow(item.unit.id, box))) return null;
        const front = item.colours.front ?? Object.values(item.colours)[0] ?? "#D4C9B5";
        const fill = mount === "floor" ? (item.colours.worktop ?? item.colours.carcass ?? front) : front;
        return (
          <text
            key={`label-${item.unit.id}`}
            x={live.x}
            y={live.y}
            fontSize={fs * 0.82}
            fill={mount === "wall" ? INK : inkFor(fill)}
            textAnchor="middle"
            dominantBaseline="middle"
            aria-hidden="true"
            className="pointer-events-none font-display"
          >
            {item.variant.widthMm}
          </text>
        );
      })}
    </svg>
  );
}
