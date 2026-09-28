"use client";

// The customer's room in 3D: their floor outline, walls at their ceiling
// height, and every placed unit where the plan put it.
//
// Walls are single planes facing into the room, so from outside the ones
// nearest the camera are back-facing and simply are not drawn — the
// dollhouse view, with no wall ever standing between you and the units.
import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { OAK, PLASTER, SAGE, SAND } from "@/lib/palette";
import { roomOutline, roomWalls } from "@/lib/geometry";
import type { RoomSpec, Rotation, SizeVariant } from "@/lib/types";
import { Orbit } from "./Orbit";
import { UnitModel } from "./UnitModel";

export interface RoomItem {
  id: string;
  variant: SizeVariant;
  x: number;
  y: number;
  rotation: Rotation;
  elevationMm: number;
  colours: Record<string, string>;
}

function Floor({ room }: { room: RoomSpec }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    roomOutline(room).forEach((p, i) => {
      const x = (p.x - room.widthMm / 2) / 1000;
      const y = (p.y - room.depthMm / 2) / 1000;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    });
    return new THREE.ShapeGeometry(shape);
  }, [room]);
  // Shape is drawn in x/y; laying it flat maps shape-y onto world +z, which
  // is the plan's "down", so the floor matches the drawing.
  return (
    <mesh geometry={geometry} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
      <meshStandardMaterial color={OAK} roughness={0.78} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Walls({ room }: { room: RoomSpec }) {
  const height = room.heightMm / 1000;
  return (
    <group>
      {roomWalls(room).map((wall, i) => {
        const mid = {
          x: ((wall.a.x + wall.b.x) / 2 - room.widthMm / 2) / 1000,
          z: ((wall.a.y + wall.b.y) / 2 - room.depthMm / 2) / 1000,
        };
        // A plane faces +z; turn it so it faces the wall's inward direction.
        const angle = Math.atan2(wall.inward.x, wall.inward.y);
        return (
          <mesh key={i} position={[mid.x, height / 2, mid.z]} rotation={[0, angle, 0]} receiveShadow>
            <planeGeometry args={[wall.length / 1000, height]} />
            <meshStandardMaterial color={PLASTER} roughness={0.95} side={THREE.FrontSide} />
          </mesh>
        );
      })}
    </group>
  );
}

export default function RoomCanvas({
  room,
  items,
  selectedId,
}: {
  room: RoomSpec;
  items: RoomItem[];
  selectedId: string | null;
}) {
  const span = Math.max(room.widthMm, room.depthMm) / 1000;
  const distance = span * 1.35 + 1.5;
  const shadowReach = span / 2 + 1;

  return (
    <Canvas
      frameloop="demand"
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [distance * 0.5, distance * 0.75, distance * 0.9], fov: 40 }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.62} />
      <directionalLight
        position={[span * 0.6, 6, span * 0.8]}
        intensity={1.45}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-shadowReach}
        shadow-camera-right={shadowReach}
        shadow-camera-top={shadowReach}
        shadow-camera-bottom={-shadowReach}
      />
      <directionalLight position={[-5, 3, 2]} intensity={0.45} color={SAND} />
      <directionalLight position={[0, 2, -5]} intensity={0.2} color={SAGE} />
      <Floor room={room} />
      <Walls room={room} />
      {items.map((item) => (
        <group
          key={item.id}
          position={[(item.x - room.widthMm / 2) / 1000, item.elevationMm / 1000, (item.y - room.depthMm / 2) / 1000]}
          rotation={[0, (-item.rotation * Math.PI) / 180, 0]}
        >
          <UnitModel
            variant={item.variant}
            colourFor={(slot) => item.colours[slot] ?? SAND}
            highlight={item.id === selectedId}
          />
        </group>
      ))}
      <Orbit target={[0, 0.9, 0]} minDistance={1.5} maxDistance={span * 3 + 4} />
    </Canvas>
  );
}
