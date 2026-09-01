"use client";

// A3 model — media walls: THE LIT WALL.
//
// A panelled wall with a recessed screen, a fire slot, floating shelves and
// a low console. The control turns the ambient lighting on, which is the
// one thing that changes what a media wall looks like more than any finish
// does — and the reason people buy one instead of hanging a TV on a hook.
//
// The glow is done with box-shadow and a brightened face rather than any
// real light model: at this scale a believable falloff is all that reads,
// and it costs nothing.
import { useState } from "react";
import { Box3D, MODEL } from "./Box3D";
import { ModelStage } from "./ModelStage";
import { ModelSection } from "./ModelSection";

const WALL_W = 380;
const WALL_H = 250;

export function ModelMediaWall({ id }: { id: string }) {
  const [lit, setLit] = useState(false);

  return (
    <ModelSection
      id={id}
      label="Model"
      lines={["Turn the", "lighting on."]}
      lede="A recessed screen, a fire slot, floating shelves and a console, all in one plane. Lighting is what separates a media wall from a television on a bracket — so that is the control."
      control={{
        label: lit ? "Lights off" : "Lights on",
        onClick: () => setLit((value) => !value),
        pressed: lit,
      }}
      caption="Panelled wall · recessed screen · integrated lighting"
      stage={
        <ModelStage
          label="A media wall with a recessed screen, a fire slot, shelves and a console."
          rest={{ rx: -8, ry: -24 }}
          scaleClassName="scale-[0.55] sm:scale-75 lg:scale-95"
        >
          {/* ── Wall panel ── */}
          <Box3D
            w={WALL_W}
            h={WALL_H}
            d={26}
            color={lit ? "#33423A" : MODEL.carcass}
            shade={MODEL.carcassShade}
            style={{ transition: "transform 620ms, background 620ms" }}
          />

          {/* Vertical panel joints. */}
          {[-1, 1].map((side) => (
            <Box3D
              key={`joint-${side}`}
              w={3}
              h={WALL_H - 10}
              d={4}
              x={side * (WALL_W / 2 - 58)}
              z={14}
              color={MODEL.carcassShade}
            />
          ))}

          {/* ── Recessed screen ── */}
          <Box3D
            w={224}
            h={126}
            d={10}
            y={-42}
            z={6}
            radius={3}
            color={MODEL.dark}
            shade={MODEL.dark}
          >
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-[3px]"
              style={{
                background: lit
                  ? "linear-gradient(140deg, rgba(240,217,168,0.20), rgba(0,0,0,0.5))"
                  : "linear-gradient(140deg, rgba(255,255,255,0.06), rgba(0,0,0,0.45))",
                transition: "background 620ms",
              }}
            />
          </Box3D>

          {/* Light wash above the screen. */}
          <Box3D
            w={224}
            h={5}
            d={8}
            y={-112}
            z={16}
            color={lit ? MODEL.glow : MODEL.carcassShade}
            shade={lit ? MODEL.glow : MODEL.carcassShade}
            style={{
              boxShadow: lit
                ? "0 0 34px 12px rgba(240,217,168,0.42)"
                : "0 0 0 0 rgba(0,0,0,0)",
              transition: "box-shadow 620ms, transform 620ms",
            }}
          />

          {/* ── Fire slot ── */}
          <Box3D
            w={150}
            h={26}
            d={12}
            y={34}
            z={8}
            radius={3}
            color={MODEL.dark}
            shade={MODEL.dark}
          >
            <span
              aria-hidden="true"
              className="absolute inset-[2px] rounded-[2px]"
              style={{
                background: lit
                  ? "linear-gradient(to top, #E07A3C, #F0D9A8)"
                  : "#101312",
                transition: "background 620ms",
              }}
            />
          </Box3D>

          {/* ── Floating shelves ── */}
          {[0, 1].map((row) => (
            <Box3D
              key={`shelf-${row}`}
              w={92}
              h={7}
              d={30}
              x={WALL_W / 2 - 62}
              y={-70 + row * 54}
              z={18}
              color={MODEL.front}
              shade={MODEL.frontShade}
              style={{
                boxShadow: lit
                  ? "0 8px 22px 2px rgba(240,217,168,0.28)"
                  : "0 0 0 0 rgba(0,0,0,0)",
                transition: "box-shadow 620ms, transform 620ms",
              }}
            />
          ))}

          {/* ── Console ── */}
          <Box3D
            w={WALL_W - 70}
            h={44}
            d={48}
            y={WALL_H / 2 - 14}
            z={26}
            color={MODEL.front}
            shade={MODEL.frontShade}
            top={MODEL.surface}
          />
        </ModelStage>
      }
    />
  );
}
