"use client";

// The canvas for a service page's A3 model.
//
// One file, one context: the room, the lights and the camera rig are shared,
// and the only thing that changes per service is which unit is standing in
// the room. Dynamically imported by ModelViewer so three.js never reaches a
// visitor who does not scroll to it.
import { Canvas } from "@react-three/fiber";
import type { RefObject } from "react";
import { SAGE, SAND, type OrbitState, type Viewpoint } from "@/lib/scene-common";
import { CameraRig, Room } from "./sceneKit";
import { KitchenRun, MediaWall, WalkIn, WardrobeRun } from "./units";

export type UnitKind = "kitchen" | "bedroom" | "media" | "walkin";

const UNITS = {
  kitchen: KitchenRun,
  bedroom: WardrobeRun,
  media: MediaWall,
  walkin: WalkIn,
} as const;

export default function ServiceScene({
  kind,
  view,
  orbitRef,
  open,
  showcase = false,
}: {
  kind: UnitKind;
  view: Viewpoint;
  orbitRef: RefObject<OrbitState>;
  open: boolean;
  showcase?: boolean;
}) {
  const Unit = UNITS[kind];
  return (
    <Canvas
      camera={{ position: [0, 0, 6.2], fov: 36 }}
      // Showcase runs unattended on a phone, so it gets the cheaper buffer.
      dpr={showcase ? [1, 1.2] : [1, 1.75]}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.66} />
      <directionalLight position={[3.5, 5, 6]} intensity={1.4} />
      <directionalLight position={[-5, 2, 4]} intensity={0.55} color={SAND} />
      <directionalLight position={[0, -1.5, 4]} intensity={0.22} color={SAGE} />
      <CameraRig view={view} orbitRef={orbitRef} showcase={showcase} />
      <Room />
      <Unit open={open} showcase={showcase} />
    </Canvas>
  );
}
