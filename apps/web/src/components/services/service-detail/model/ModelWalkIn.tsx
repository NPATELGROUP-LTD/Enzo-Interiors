"use client";

// A3 model — wardrobes: THE WALK-IN.
//
// Two runs meeting at a right angle with an island between them: the corner
// arrangement, which is the one that is genuinely hard to picture from a
// photograph because no single camera position shows both runs.
//
// The control strips the doors away to show the internal configuration —
// rails, shelves, shoe racks — because on a walk-in the internals *are* the
// product; the doors are almost incidental.
//
// The return run is a second group of boxes rotated 90° about Y and pushed
// out on Z, which is why this model reads as a room rather than an
// elevation like the other three.
import { useState } from "react";
import { Box3D, MODEL } from "./Box3D";
import { ModelStage } from "./ModelStage";
import { ModelSection } from "./ModelSection";

const RUN_W = 300;
const RUN_H = 220;
const RUN_D = 68;

export function ModelWalkIn({ id }: { id: string }) {
  const [stripped, setStripped] = useState(false);

  /** One run of tall units, with rails and shelves inside. */
  const run = (key: string, rotate: number, x: number, z: number) => (
    <div
      key={key}
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 0,
        height: 0,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, 0px, ${z}px) rotateY(${rotate}deg)`,
      }}
    >
      <Box3D
        w={RUN_W}
        h={RUN_H}
        d={RUN_D}
        color={MODEL.carcassShade}
        shade={MODEL.carcassShade}
        top={MODEL.carcass}
      />
      {/* Hanging rail. */}
      <Box3D
        w={RUN_W - 40}
        h={5}
        d={RUN_D - 26}
        y={-RUN_H / 2 + 44}
        z={4}
        color={MODEL.accent}
        shade="#71836F"
      />
      {/* Shelves over the right third. */}
      {[0, 1, 2].map((row) => (
        <Box3D
          key={`${key}-shelf-${row}`}
          w={RUN_W / 3 - 12}
          h={5}
          d={RUN_D - 26}
          x={RUN_W / 3}
          y={-RUN_H / 2 + 84 + row * 40}
          z={4}
          color={MODEL.surfaceShade}
          shade="#B4B0A7"
        />
      ))}
      {/* Shoe rack, angled shelves at the foot. */}
      {[0, 1].map((row) => (
        <Box3D
          key={`${key}-shoe-${row}`}
          w={RUN_W / 3 - 12}
          h={4}
          d={RUN_D - 30}
          x={-RUN_W / 3}
          y={RUN_H / 2 - 30 - row * 30}
          z={4}
          color={MODEL.surfaceShade}
          shade="#B4B0A7"
        />
      ))}
      {/* Doors — faded out when the internals are being shown. */}
      <Box3D
        w={RUN_W - 6}
        h={RUN_H - 8}
        d={6}
        z={RUN_D / 2 + 3}
        color={MODEL.front}
        shade={MODEL.frontShade}
        style={{
          opacity: stripped ? 0 : 1,
          transition: "opacity 520ms cubic-bezier(0.22,1,0.36,1), transform 620ms",
        }}
      />
    </div>
  );

  return (
    <ModelSection
      id={id}
      label="Model"
      lines={["Walk into", "the corner."]}
      lede="Two runs meeting at a right angle with an island between them. No photograph shows both runs at once, which is exactly why this is worth turning by hand."
      control={{
        label: stripped ? "Put the doors back" : "Show the internals",
        onClick: () => setStripped((value) => !value),
        pressed: stripped,
      }}
      caption="Corner walk-in · two runs and an island"
      stage={
        <ModelStage
          label="A walk-in wardrobe: two runs of units meeting at a right angle with an island between them."
          rest={{ rx: -22, ry: -38 }}
          scaleClassName="scale-[0.46] sm:scale-[0.66] lg:scale-[0.82]"
        >
          {run("back", 0, 0, -120)}
          {run("side", 90, -RUN_W / 2, 30)}

          {/* ── Island ── */}
          <Box3D
            w={150}
            h={78}
            d={80}
            y={RUN_H / 2 - 39}
            z={60}
            color={MODEL.carcass}
            shade={MODEL.carcassShade}
          />
          <Box3D
            w={166}
            h={9}
            d={96}
            y={RUN_H / 2 - 82}
            z={60}
            color={MODEL.surface}
            shade={MODEL.surfaceShade}
          />
          {/* Island drawers. */}
          {[0, 1].map((row) => (
            <Box3D
              key={`island-${row}`}
              w={138}
              h={30}
              d={6}
              y={RUN_H / 2 - 58 + row * 34}
              z={101}
              color={MODEL.front}
              shade={MODEL.frontShade}
            >
              <span
                aria-hidden="true"
                className="absolute left-1/2 top-1/2 h-[4px] w-[34%] -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ background: "rgba(38,51,44,0.55)" }}
              />
            </Box3D>
          ))}

          {/* Floor plane, so the runs read as standing in a room. */}
          <Box3D
            w={520}
            h={6}
            d={420}
            y={RUN_H / 2 + 6}
            z={-40}
            color={MODEL.dark}
            shade={MODEL.dark}
            top="#1E2320"
          />
        </ModelStage>
      }
    />
  );
}
