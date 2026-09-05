// Picks the A3 model for a service page.
//
// Four services, four units, one viewer. Everything that differs between the
// pages — which unit stands in the room, where the cameras sit, what the one
// control does, and the construction detail beside it — is data in this file,
// so a fifth service is one entry rather than a fifth component.
//
//   0  kitchen  a run, a tall bank and an island   · doors and drawers open
//   1  bedroom  a run of sliding-front wardrobes   · fronts slide apart
//   2  media    a panelled wall with a recess      · lighting comes on
//   3  walkin   two facing runs and an island      · the fronts come off
//
// See ./ModelViewer for why these are real three.js now and what that costs,
// and ./scene/units.tsx for the geometry.
import type { ServiceDetail } from "@/lib/content";
import { variantIndex } from "../variant";
import { ModelViewer, type ModelSpec } from "./ModelViewer";
import type { Viewpoint } from "./scene/sceneKit";
import type { UnitKind } from "./scene/ServiceScene";

interface ModelConfig {
  kind: UnitKind;
  label: string;
  lines: string[];
  lede: string;
  viewpoints: Viewpoint[];
  control: { off: string; on: string };
  specs: ModelSpec[];
}

const CONFIGS: ModelConfig[] = [
  {
    kind: "kitchen",
    label: "The model",
    lines: ["Turn it round.", "Open the doors."],
    lede: "The run, the tall bank and the island, drawn to the millimetre we would build them. Move the camera, or open it up and look inside a carcass.",
    viewpoints: [
      {
        id: "room",
        label: "The room",
        note: "Back far enough to read the run, the island and the walkway between them.",
        azimuth: 0,
        polar: 1.46,
        radius: 7.0,
        targetY: -0.15,
      },
      {
        id: "angle",
        label: "Three-quarter",
        note: "Turned, so the worktop return and the depth of the island read properly.",
        azimuth: -0.6,
        polar: 1.42,
        radius: 5.6,
        targetY: -0.1,
      },
      {
        id: "base",
        label: "Base cabinets",
        // Raised deliberately: the island stands between the camera and the
        // run, so a level shot at this radius frames the back of the island.
        // Looking down over it is the only line that reaches the doors.
        note: "Down at the run — open the doors and the bays behind them are genuinely empty.",
        azimuth: -0.18,
        polar: 1.14,
        radius: 4.6,
        targetY: -0.45,
      },
      {
        id: "island",
        label: "Island",
        note: "In close on the drawer bank, where the boxes run out on their runners.",
        azimuth: 0.46,
        polar: 1.3,
        radius: 3.9,
        targetY: -0.5,
      },
    ],
    control: { off: "Open the doors", on: "Close the doors" },
    specs: [
      { value: "18 mm", label: "Carcass", note: "Moisture-resistant board, edge-banded on every visible face." },
      { value: "40 mm", label: "Worktop", note: "Quartz or granite, mitred at the returns and polished on site." },
      { value: "Soft", label: "Close", note: "Every door and every drawer, on runners rated to 50 kg." },
      { value: "5 yr", label: "Guarantee", note: "On every joint, hinge and runner we fit." },
    ],
  },
  {
    kind: "bedroom",
    label: "The model",
    lines: ["Slide the fronts,", "see the inside."],
    lede: "A four-bay run with sliding fronts. Move the camera, or slide them apart and read the rails, the shelf stack and the drawer bank behind them.",
    viewpoints: [
      {
        id: "room",
        label: "The room",
        note: "Back across the room, where the run reads as one wall of it.",
        azimuth: 0,
        polar: 1.42,
        radius: 5.6,
        targetY: 0.02,
      },
      {
        id: "angle",
        label: "Three-quarter",
        note: "Turned, to read how little the run stands off the wall.",
        azimuth: -0.55,
        polar: 1.44,
        radius: 5.0,
        targetY: 0,
      },
      {
        id: "interior",
        label: "Interior",
        note: "In close on the bays — slide the fronts and the rails and shelves are all there.",
        azimuth: -0.15,
        polar: 1.5,
        radius: 3.2,
        targetY: 0.05,
      },
    ],
    control: { off: "Slide the fronts", on: "Close the fronts" },
    specs: [
      { value: "2.3 m", label: "Height", note: "Floor to ceiling, scribed to the plaster at both ends." },
      { value: "600 mm", label: "Depth", note: "Enough for a hanger to sit square without touching the front." },
      { value: "4 mm", label: "Shadow gap", note: "Consistent down the run and around every opening." },
      { value: "5 yr", label: "Guarantee", note: "On every runner, rail and soft-close we fit." },
    ],
  },
  {
    kind: "media",
    label: "The model",
    lines: ["Turn it round.", "Put the lights on."],
    lede: "The wall as we would build it — recess, fire slot, flank shelving and a base run. Move the camera, or switch the lighting on and see what it does to the room.",
    viewpoints: [
      {
        id: "room",
        label: "The room",
        note: "Back to the sofa, where the wall reads as part of a living room.",
        azimuth: 0,
        polar: 1.5,
        radius: 6.2,
        targetY: -0.1,
      },
      {
        id: "angle",
        label: "Three-quarter",
        note: "Turned, to read how far the unit stands off the wall.",
        azimuth: -0.52,
        polar: 1.44,
        radius: 5.4,
        targetY: -0.05,
      },
      {
        id: "recess",
        label: "The recess",
        note: "In close on the screen and the fire slot beneath it.",
        azimuth: -0.1,
        polar: 1.5,
        radius: 3.0,
        targetY: 0.3,
      },
      {
        id: "base",
        label: "Base run",
        note: "Down at the cabinets, where the cable routes are dropped before we fit.",
        azimuth: -0.3,
        polar: 1.34,
        radius: 3.4,
        targetY: -0.72,
      },
    ],
    control: { off: "Put the lights on", on: "Lights off" },
    specs: [
      { value: "18 mm", label: "Carcass", note: "Moisture-resistant board, edge-banded on every visible face." },
      { value: "4 mm", label: "Shadow gap", note: "Consistent across the run and scribed to the wall at both ends." },
      { value: "75 in", label: "Recess", note: "Cut to your screen, with cable routes dropped before we fit." },
      { value: "5 yr", label: "Guarantee", note: "On every joint, hinge and driver we fit." },
    ],
  },
  {
    kind: "walkin",
    label: "The model",
    lines: ["Take the fronts off.", "Walk into it."],
    lede: "Two facing runs and an island block. Move the camera, or take the fronts off the near run — a walk-in has no outside to look at, the inside is the product.",
    viewpoints: [
      {
        id: "room",
        label: "The room",
        note: "From the doorway, looking down the length of both runs.",
        azimuth: 0,
        polar: 1.48,
        radius: 6.0,
        targetY: -0.1,
      },
      {
        id: "inside",
        label: "Inside",
        note: "Standing in it, between the two runs, at the island.",
        azimuth: 0.05,
        polar: 1.52,
        radius: 3.4,
        targetY: -0.05,
      },
      {
        id: "run",
        label: "The run",
        note: "Along one side — rails above, shelf stack beside, shoe racks below.",
        azimuth: -0.75,
        polar: 1.46,
        radius: 4.2,
        targetY: 0,
      },
      {
        id: "island",
        label: "Island",
        note: "Down at the drawer block, where the jewellery and folded layers live.",
        azimuth: 0.2,
        polar: 1.3,
        radius: 3.2,
        targetY: -0.68,
      },
    ],
    control: { off: "Take the fronts off", on: "Put the fronts back" },
    specs: [
      { value: "2.3 m", label: "Height", note: "Floor to ceiling on both runs, scribed at every wall." },
      { value: "1.2 m", label: "Walkway", note: "Enough to open a drawer and still stand square to the rail." },
      { value: "Lit", label: "Rails", note: "LED over every hanging rail, on a sensor at the door." },
      { value: "5 yr", label: "Guarantee", note: "On every rail, runner and hinge we fit." },
    ],
  },
];

export function ServiceModel({
  service,
  position,
  id,
}: {
  service: ServiceDetail;
  position: number;
  id: string;
}) {
  const config =
    CONFIGS[variantIndex(position, CONFIGS.length, service.heroVariant)]!;

  return (
    <ModelViewer
      id={id}
      kind={config.kind}
      label={config.label}
      lines={config.lines}
      lede={config.lede}
      viewpoints={config.viewpoints}
      control={config.control}
      specs={config.specs}
      fallbackImage={service.image}
      fallbackAlt={`${service.title} — finished installation`}
    />
  );
}
