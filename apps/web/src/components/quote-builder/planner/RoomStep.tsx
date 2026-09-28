"use client";

import { roomArea } from "@/lib/quote-builder/geometry";
import type { Catalogue, Corner, Plan, RoomShape, RoomSpec, RoomTypeId } from "@/lib/quote-builder/types";
import { cn } from "@/lib/utils";
import { Button, Field, NumberInput, Segmented } from "../ui";
import { PlanCanvas } from "./PlanCanvas";

const CORNERS: { value: Corner; label: string }[] = [
  { value: "tl", label: "Top left" },
  { value: "tr", label: "Top right" },
  { value: "bl", label: "Bottom left" },
  { value: "br", label: "Bottom right" },
];

function ShapeGlyph({ shape }: { shape: RoomShape }) {
  return (
    <svg viewBox="0 0 40 30" className="h-6 w-8" aria-hidden="true">
      <path
        d={shape === "rect" ? "M2 2 H38 V28 H2 Z" : "M2 2 H38 V16 H24 V28 H2 Z"}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      />
    </svg>
  );
}

export function RoomStep({
  plan,
  catalogue,
  onRoom,
  onNext,
}: {
  plan: Plan;
  catalogue: Catalogue;
  onRoom: (patch: Partial<RoomSpec>) => void;
  onNext: () => void;
}) {
  const { room } = plan;
  const area = roomArea(room) / 1_000_000;

  return (
    <div className="grid gap-10 p-5 md:p-8 lg:h-full lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:overflow-hidden">
      <div className="flex flex-col gap-6 lg:overflow-y-auto lg:pr-2" data-lenis-prevent>
        <div>
          <h1 className="text-[clamp(1.9rem,3vw,2.5rem)]">Your room</h1>
          <p className="mt-2 max-w-[48ch] text-[14.5px] leading-relaxed text-muted-foreground">
            A rough guess is fine. Measure wall to wall at floor level; we check everything properly at the survey.
          </p>
        </div>

        <fieldset>
          <legend className="text-[13px] font-medium">What are we fitting?</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {catalogue.roomTypes.map((type) => (
              <label
                key={type.id}
                className={cn(
                  "cursor-pointer rounded-xl border-2 px-4 py-3 text-[14px] transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                  room.type === type.id ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-secondary",
                )}
              >
                <input
                  type="radio"
                  name="room-type"
                  className="sr-only"
                  checked={room.type === type.id}
                  onChange={() => onRoom({ type: type.id as RoomTypeId })}
                />
                {type.singular}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium">Shape</span>
          <Segmented<RoomShape>
            label="Room shape"
            value={room.shape}
            onChange={(shape) => onRoom({ shape })}
            options={[
              { value: "rect", label: <span className="flex items-center gap-2"><ShapeGlyph shape="rect" />Rectangle</span> },
              { value: "L", label: <span className="flex items-center gap-2"><ShapeGlyph shape="L" />L-shaped</span> },
            ]}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Width" htmlFor="room-width" hint="Left to right on the plan">
            <NumberInput id="room-width" suffix="mm" min={1200} max={15000} value={room.widthMm} onChange={(v) => onRoom({ widthMm: v })} />
          </Field>
          <Field label="Length" htmlFor="room-depth" hint="Top to bottom on the plan">
            <NumberInput id="room-depth" suffix="mm" min={1200} max={15000} value={room.depthMm} onChange={(v) => onRoom({ depthMm: v })} />
          </Field>
          <Field label="Ceiling height" htmlFor="room-height">
            <NumberInput id="room-height" suffix="mm" min={2000} max={4500} value={room.heightMm} onChange={(v) => onRoom({ heightMm: v })} />
          </Field>
        </div>

        {room.shape === "L" && (
          <div className="grid gap-4 rounded-xl bg-card p-4">
            <p className="text-[13px] leading-snug text-muted-foreground">
              The part of the rectangle that isn&rsquo;t room — a hallway, a chimney breast, a neighbour&rsquo;s wall.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Cut-out width" htmlFor="cut-width">
                <NumberInput id="cut-width" suffix="mm" min={300} max={room.widthMm - 600} value={room.cut.widthMm} onChange={(v) => onRoom({ cut: { ...room.cut, widthMm: v } })} />
              </Field>
              <Field label="Cut-out length" htmlFor="cut-depth">
                <NumberInput id="cut-depth" suffix="mm" min={300} max={room.depthMm - 600} value={room.cut.depthMm} onChange={(v) => onRoom({ cut: { ...room.cut, depthMm: v } })} />
              </Field>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-medium">Which corner</span>
              <Segmented<Corner> label="Cut-out corner" value={room.cut.corner} onChange={(corner) => onRoom({ cut: { ...room.cut, corner } })} options={CORNERS} />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-4 border-t border-border/70 pt-5">
          <p className="font-display text-[13px] tabular-nums text-muted-foreground">{area.toFixed(1)} m² of floor</p>
          <Button onClick={onNext}>Next: place your units</Button>
        </div>
      </div>

      <div className="min-h-[320px] rounded-[20px] border border-border/70 bg-background p-4 lg:min-h-0" aria-hidden="true">
        <PlanCanvas room={room} items={[]} readOnly />
      </div>
    </div>
  );
}
