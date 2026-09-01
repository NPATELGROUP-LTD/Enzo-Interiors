"use client";

// A3 model — kitchens: A RUN AND AN ISLAND.
//
// Three base units under a continuous worktop, a tall unit at one end, and
// an island in front of it. The control opens every door at once, which is
// the thing you cannot see in a photograph and the thing people actually
// want to know about a kitchen: what the inside is like.
//
// Doors are hinged boxes — the pivot is moved to the leading edge with
// `origin`, so they swing rather than slide.
import { useState } from "react";
import { Box3D, MODEL } from "./Box3D";
import { ModelStage } from "./ModelStage";
import { ModelSection } from "./ModelSection";

const UNIT_W = 92;
const UNIT_H = 96;
const UNIT_D = 74;

export function ModelKitchenRun({ id }: { id: string }) {
  const [open, setOpen] = useState(false);

  return (
    <ModelSection
      id={id}
      label="Model"
      lines={["Look inside", "the run."]}
      lede="Three base units, a continuous worktop and an island. Open the doors — the inside of a kitchen is the part a photograph never shows you, and the part that decides whether it works."
      control={{
        label: open ? "Close the doors" : "Open the doors",
        onClick: () => setOpen((value) => !value),
        pressed: open,
      }}
      caption="Base run with island · doors shown open"
      stage={
        <ModelStage
          label="A three-unit kitchen run with a worktop and an island."
          rest={{ rx: -16, ry: -30 }}
        >
          {/* ── Base run ── */}
          {[-1, 0, 1].map((slot) => (
            <Box3D
              key={`base-${slot}`}
              w={UNIT_W}
              h={UNIT_H}
              d={UNIT_D}
              x={slot * (UNIT_W + 2)}
              y={20}
              color={MODEL.carcass}
              shade={MODEL.carcassShade}
            />
          ))}

          {/* Doors, hinged on their left edge. */}
          {[-1, 0, 1].map((slot) => (
            <Box3D
              key={`door-${slot}`}
              w={UNIT_W - 4}
              h={UNIT_H - 6}
              d={5}
              x={slot * (UNIT_W + 2)}
              y={20}
              z={UNIT_D / 2}
              rotateY={open ? -105 : 0}
              origin={`${-(UNIT_W - 4) / 2}px 50%`}
              color={MODEL.front}
              shade={MODEL.frontShade}
            >
              {/* Rail handle. */}
              <span
                aria-hidden="true"
                className="absolute left-1/2 top-3 h-[4px] w-[52%] -translate-x-1/2 rounded-full"
                style={{ background: "rgba(38,51,44,0.6)" }}
              />
            </Box3D>
          ))}

          {/* Shelf inside the middle unit, visible once the doors swing. */}
          <Box3D
            w={UNIT_W - 10}
            h={4}
            d={UNIT_D - 10}
            y={20}
            color={MODEL.accent}
            shade="#71836F"
          />

          {/* ── Worktop ── */}
          <Box3D
            w={UNIT_W * 3 + 14}
            h={9}
            d={UNIT_D + 8}
            y={-34}
            color={MODEL.surface}
            shade={MODEL.surfaceShade}
            top={MODEL.surface}
          />

          {/* ── Tall unit ── */}
          <Box3D
            w={72}
            h={190}
            d={UNIT_D}
            x={-(UNIT_W * 1.5 + 38)}
            y={-24}
            color={MODEL.front}
            shade={MODEL.frontShade}
          />

          {/* ── Island ── */}
          <Box3D
            w={150}
            h={90}
            d={62}
            y={26}
            z={140}
            color={MODEL.carcass}
            shade={MODEL.carcassShade}
          />
          <Box3D
            w={166}
            h={9}
            d={76}
            y={-24}
            z={140}
            color={MODEL.surface}
            shade={MODEL.surfaceShade}
          />
        </ModelStage>
      }
    />
  );
}
