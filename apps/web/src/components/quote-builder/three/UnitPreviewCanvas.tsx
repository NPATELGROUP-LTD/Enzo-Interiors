"use client";

// A single unit on a patch of floor, for the studio editor and the planner
// inspector. Default export so callers can load it with next/dynamic and
// keep three.js out of the first paint.
import { useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OAK, PLASTER, SAGE, SAND } from "@/lib/scene-common";
import type { SizeVariant } from "@/lib/quote-builder/types";
import { Orbit } from "./Orbit";
import { UnitModel } from "./UnitModel";

export default function UnitPreviewCanvas({
  variant,
  colourFor,
  elevationMm = 0,
}: {
  variant: SizeVariant;
  colourFor: (slot: string) => string;
  elevationMm?: number;
}) {
  const lift = elevationMm / 1000;
  const size = Math.max(variant.widthMm, variant.heightMm, variant.depthMm) / 1000;
  const centreY = lift + variant.heightMm / 2000;
  const distance = size * 2.1 + 0.6;

  return (
    <Canvas
      frameloop="demand"
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [distance * 0.55, centreY + distance * 0.35, distance * 0.85], fov: 38 }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight
        position={[2.5, 4.5, 3.5]}
        intensity={1.5}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
      />
      <directionalLight position={[-4, 2, 2]} intensity={0.5} color={SAND} />
      <directionalLight position={[0, -1, 3]} intensity={0.2} color={SAGE} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[size * 1.4 + 0.4, 48]} />
        <meshStandardMaterial color={OAK} roughness={0.8} />
      </mesh>
      {lift > 0 && (
        <mesh position={[0, lift + variant.heightMm / 2000, -variant.depthMm / 2000 - 0.01]} receiveShadow>
          <planeGeometry args={[variant.widthMm / 1000 + 0.8, variant.heightMm / 1000 + 0.8]} />
          <meshStandardMaterial color={PLASTER} roughness={0.95} />
        </mesh>
      )}
      <group position={[0, lift, 0]}>
        <UnitModel variant={variant} colourFor={colourFor} />
      </group>
      <Frame x={distance * 0.55} y={centreY + distance * 0.35} z={distance * 0.85} />
      <Orbit target={[0, centreY, 0]} minDistance={size * 0.8 + 0.3} maxDistance={size * 4 + 2} />
    </Canvas>
  );
}

/** Re-frames the camera when the unit changes size, without a new WebGL context. */
function Frame({ x, y, z }: { x: number; y: number; z: number }) {
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    camera.position.set(x, y, z);
    invalidate();
  }, [camera, invalidate, x, y, z]);
  return null;
}
