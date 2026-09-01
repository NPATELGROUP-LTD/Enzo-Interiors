"use client";

// A3 model — bedrooms: THE SLIDING BAY.
//
// A full-height wardrobe carcass with a hanging rail, shelves and a drawer
// bank, behind two sliding doors. The control slides the doors apart rather
// than swinging them, because that is the mechanism this product actually
// uses and it is the difference people ask about most: sliding doors cost
// no floor space in front of the unit.
import { useState } from "react";
import { Box3D, MODEL } from "./Box3D";
import { ModelStage } from "./ModelStage";
import { ModelSection } from "./ModelSection";

const BAY_W = 300;
const BAY_H = 240;
const BAY_D = 84;
const DOOR_W = BAY_W / 2 - 3;

export function ModelWardrobeBay({ id }: { id: string }) {
  const [open, setOpen] = useState(false);

  return (
    <ModelSection
      id={id}
      label="Model"
      lines={["Slide it open."]}
      lede="A full-height bay with hanging, shelves and a drawer bank behind sliding doors. Sliding means no swing space in front of the unit — which in a bedroom is usually the whole argument."
      control={{
        label: open ? "Close the doors" : "Slide the doors",
        onClick: () => setOpen((value) => !value),
        pressed: open,
      }}
      caption="Full-height bay · sliding doors · internal layout shown"
      stage={
        <ModelStage
          label="A fitted wardrobe bay with sliding doors, a hanging rail, shelves and drawers."
          rest={{ rx: -10, ry: -26 }}
          scaleClassName="scale-[0.5] sm:scale-75 lg:scale-90"
        >
          {/* ── Carcass ── */}
          <Box3D
            w={BAY_W}
            h={BAY_H}
            d={BAY_D}
            color={MODEL.carcassShade}
            shade={MODEL.carcassShade}
            top={MODEL.carcass}
          />

          {/* ── Internals ──
              Left bay: long hang. Right bay: shelves over drawers. */}
          <Box3D
            w={BAY_W / 2 - 14}
            h={5}
            d={BAY_D - 22}
            x={-BAY_W / 4}
            y={-BAY_H / 2 + 46}
            z={4}
            color={MODEL.accent}
            shade="#71836F"
          />
          {[0, 1, 2].map((row) => (
            <Box3D
              key={`shelf-${row}`}
              w={BAY_W / 2 - 14}
              h={5}
              d={BAY_D - 22}
              x={BAY_W / 4}
              y={-BAY_H / 2 + 52 + row * 46}
              z={4}
              color={MODEL.surfaceShade}
              shade="#B4B0A7"
            />
          ))}
          {[0, 1].map((row) => (
            <Box3D
              key={`drawer-${row}`}
              w={BAY_W / 2 - 18}
              h={38}
              d={BAY_D - 26}
              x={BAY_W / 4}
              y={BAY_H / 2 - 30 - row * 42}
              z={6}
              color={MODEL.front}
              shade={MODEL.frontShade}
            >
              <span
                aria-hidden="true"
                className="absolute left-1/2 top-1/2 h-[4px] w-[40%] -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ background: "rgba(38,51,44,0.55)" }}
              />
            </Box3D>
          ))}

          {/* ── Sliding doors ──
              They pass each other on two tracks, so the front door sits a
              little proud of the back one. */}
          <Box3D
            w={DOOR_W}
            h={BAY_H - 8}
            d={7}
            x={open ? -DOOR_W * 0.98 : -DOOR_W / 2 - 1}
            z={BAY_D / 2 + 4}
            color={MODEL.front}
            shade={MODEL.frontShade}
            style={{ opacity: open ? 0.96 : 1 }}
          />
          <Box3D
            w={DOOR_W}
            h={BAY_H - 8}
            d={7}
            x={open ? DOOR_W * 0.98 : DOOR_W / 2 + 1}
            z={BAY_D / 2 - 6}
            color={MODEL.frontShade}
            shade="#A2977F"
          />

          {/* Plinth. */}
          <Box3D
            w={BAY_W - 10}
            h={14}
            d={BAY_D - 10}
            y={BAY_H / 2 + 6}
            color={MODEL.dark}
            shade={MODEL.dark}
          />
        </ModelStage>
      }
    />
  );
}
