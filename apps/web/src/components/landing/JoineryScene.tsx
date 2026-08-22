"use client";

// The page's 3D element — a wardrobe module you can actually read as
// joinery, not an abstract decorative solid.
//
// It is built from real parts: a five-panel carcass with a back, shelves
// and a hanging rail, two chamfered doors hung on their outer edges with a
// shadow gap between them, sand-toned handles and a recessed plinth. As the
// section scrolls, the module turns and the doors swing open to show the
// interior — which is the whole argument the section is making, so the
// motion carries meaning rather than just moving.
//
// Built on raw @react-three/fiber + three primitives (no drei) to keep the
// dependency surface small, and mounted only when the section is near the
// viewport (see WorkshopModule) so a homepage visit never spins up a WebGL
// context the visitor may not reach.
import { useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Group } from "three";

const FOREST = "#15352A";
const FOREST_LIGHT = "#24513F";
const SAGE = "#8A9E8C";
const SAND = "#D4C9B5";
const INTERIOR = "#CFC8B8";

/**
 * A chamfered flat panel — the bevel is what makes a cabinet door read as
 * a solid lump of material under raking light instead of as a cardboard
 * rectangle.
 */
function usePanelGeometry(width: number, height: number, depth: number, radius: number) {
  return useMemo(() => {
    const w = width / 2 - radius;
    const h = height / 2 - radius;
    const shape = new THREE.Shape();
    shape.moveTo(-w - radius, -h);
    shape.lineTo(-w - radius, h);
    shape.quadraticCurveTo(-w - radius, h + radius, -w, h + radius);
    shape.lineTo(w, h + radius);
    shape.quadraticCurveTo(w + radius, h + radius, w + radius, h);
    shape.lineTo(w + radius, -h);
    shape.quadraticCurveTo(w + radius, -h - radius, w, -h - radius);
    shape.lineTo(-w, -h - radius);
    shape.quadraticCurveTo(-w - radius, -h - radius, -w - radius, -h);

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.012,
      bevelSegments: 2,
      curveSegments: 6,
    });
    // ExtrudeGeometry grows along +z from the shape plane; recentre it so
    // the mesh's own origin sits in the middle of the panel.
    geometry.translate(0, 0, -depth / 2);
    return geometry;
  }, [width, height, depth, radius]);
}

function Module({ progressRef }: { progressRef: RefObject<number> }) {
  const groupRef = useRef<Group>(null);
  const leftDoorRef = useRef<Group>(null);
  const rightDoorRef = useRef<Group>(null);

  // Sized so the finished pair — bevels included — spans the 1.6 carcass
  // with a 20 mm shadow gap down the middle: (1.6 - 0.02) / 2 = 0.79 each,
  // minus the 0.012-per-side bevel the extrude adds back on.
  const doorGeometry = usePanelGeometry(0.766, 1.94, 0.05, 0.02);

  useFrame((state, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const progress = progressRef.current ?? 0;
    const time = state.clock.elapsedTime;

    // Scroll turns the module through three quarters of a slow sweep;
    // the pointer adds a small live offset on top so it feels held rather
    // than played back.
    const targetY = -0.48 + progress * 0.92 + state.pointer.x * 0.26;
    const targetX = 0.06 - state.pointer.y * 0.16;

    // Frame-rate independent smoothing — a fixed lerp factor would move at
    // different speeds on 60Hz and 144Hz displays.
    const ease = 1 - Math.pow(0.0015, delta);
    group.rotation.y += (targetY - group.rotation.y) * ease;
    group.rotation.x += (targetX - group.rotation.x) * ease;
    group.position.y = Math.sin(time * 0.55) * 0.025;

    const open = THREE.MathUtils.clamp((progress - 0.2) / 0.35, 0, 1) * 0.95;
    if (leftDoorRef.current) leftDoorRef.current.rotation.y = -open;
    if (rightDoorRef.current) rightDoorRef.current.rotation.y = open;
  });

  return (
    <group ref={groupRef} scale={1.02}>
      {/* Carcass — back, sides, top, bottom */}
      <mesh position={[0, 0, -0.255]}>
        <boxGeometry args={[1.6, 2, 0.04]} />
        <meshStandardMaterial color={FOREST} roughness={0.85} />
      </mesh>
      {[-0.78, 0.78].map((x) => (
        <mesh key={x} position={[x, 0, 0]}>
          <boxGeometry args={[0.04, 2, 0.55]} />
          <meshStandardMaterial color={FOREST_LIGHT} roughness={0.75} />
        </mesh>
      ))}
      {[0.98, -0.98].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[1.6, 0.04, 0.55]} />
          <meshStandardMaterial color={FOREST_LIGHT} roughness={0.75} />
        </mesh>
      ))}

      {/* Interior — shelf stack on the left bay, hanging rail on the right */}
      {[0.45, 0, -0.45].map((y) => (
        <mesh key={y} position={[-0.39, y, -0.02]}>
          <boxGeometry args={[0.74, 0.03, 0.5]} />
          <meshStandardMaterial color={INTERIOR} roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0.39, 0.74, -0.02]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.018, 0.018, 0.74, 12]} />
        <meshStandardMaterial color={SAND} roughness={0.3} metalness={0.5} />
      </mesh>
      <mesh position={[0.39, -0.55, -0.02]}>
        <boxGeometry args={[0.74, 0.03, 0.5]} />
        <meshStandardMaterial color={INTERIOR} roughness={0.9} />
      </mesh>

      {/* Doors, hung on their outer edges so they swing like real doors.
          The hinge is the group; the panel is offset inside it. */}
      <group ref={leftDoorRef} position={[-0.78, 0, 0.3]}>
        <mesh geometry={doorGeometry} position={[0.375, 0, 0]}>
          <meshStandardMaterial color={SAGE} roughness={0.55} metalness={0.05} />
        </mesh>
        <mesh position={[0.72, 0.08, 0.045]}>
          <boxGeometry args={[0.025, 0.34, 0.03]} />
          <meshStandardMaterial color={SAND} roughness={0.28} metalness={0.55} />
        </mesh>
      </group>
      <group ref={rightDoorRef} position={[0.78, 0, 0.3]}>
        <mesh geometry={doorGeometry} position={[-0.375, 0, 0]}>
          <meshStandardMaterial color={SAGE} roughness={0.55} metalness={0.05} />
        </mesh>
        <mesh position={[-0.72, 0.08, 0.045]}>
          <boxGeometry args={[0.025, 0.34, 0.03]} />
          <meshStandardMaterial color={SAND} roughness={0.28} metalness={0.55} />
        </mesh>
      </group>

      {/* Recessed plinth — the detail that makes fitted furniture look
          built-in rather than parked against a wall. */}
      <mesh position={[0, -1.07, -0.04]}>
        <boxGeometry args={[1.52, 0.14, 0.46]} />
        <meshStandardMaterial color={FOREST} roughness={0.9} />
      </mesh>
    </group>
  );
}

export default function JoineryScene({ progressRef }: { progressRef: RefObject<number> }) {
  return (
    <Canvas
      camera={{ position: [0, 0.05, 4.05], fov: 36 }}
      dpr={[1, 1.6]}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.55} />
      <directionalLight position={[3.5, 5, 4.5]} intensity={1.6} />
      <directionalLight position={[-4.5, 1.5, 2]} intensity={0.45} color={SAND} />
      <directionalLight position={[0, -2, -4]} intensity={0.35} color={SAGE} />
      <Module progressRef={progressRef} />
    </Canvas>
  );
}
