"use client";

// The page's 3D element — a media wall, in a room.
//
// It was a free-floating wardrobe carcass on a dark green ground, which had
// two problems: the box read as an abstract shape rather than as fitted
// furniture, and forest joinery against a forest backdrop gave the eye nothing
// to separate. So this is a media wall — the most recognisably "fitted" thing
// Enzo makes — set against a warm plaster wall and an oak floor, which is what
// makes the green cabinetry legible.
//
// Everything is bounded by the backboard: nothing protrudes past the unit, and
// the base doors swing forward into open air rather than through a neighbour.
//
// Raw @react-three/fiber + three primitives (no drei) keeps the dependency
// surface small.
import { useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Group } from "three";

const FOREST = "#1B4335";
const FOREST_DEEP = "#132E25";
const SAGE = "#8A9E8C";
const SAND = "#D4C9B5";
const BRASS = "#C4A87A";
const SCREEN = "#0C0F0E";
const PLASTER = "#CFC7B8";
const PLASTER_DEEP = "#B9B0A0";
const OAK = "#A08A66";

export interface Viewpoint {
  id: string;
  label: string;
  note: string;
  azimuth: number;
  polar: number;
  radius: number;
  targetY: number;
}

export const VIEWPOINTS: Viewpoint[] = [
  {
    id: "front",
    label: "Elevation",
    note: "Square on — the TV recess, the fire slot and a continuous base run.",
    azimuth: 0,
    polar: 1.54,
    radius: 4.6,
    targetY: 0,
  },
  {
    id: "angle",
    label: "Three-quarter",
    note: "Turned, to read how far the unit stands off the wall.",
    azimuth: -0.55,
    polar: 1.44,
    radius: 4.4,
    targetY: 0,
  },
  {
    id: "base",
    label: "Base cabinets",
    note: "Down at the run — soft-close doors and the AV bay behind them.",
    azimuth: -0.34,
    polar: 1.74,
    radius: 3.1,
    targetY: -0.55,
  },
  {
    id: "fire",
    label: "Fire detail",
    note: "In close on the fire slot and the shadow gap around the recess.",
    azimuth: -0.16,
    polar: 1.5,
    radius: 1.9,
    targetY: 0.06,
  },
];

/** Live drag offsets, written by the parent's pointer handlers. */
export interface OrbitState {
  azimuth: number;
  polar: number;
}

/** Rounded, chamfered flat panel — reads as solid material under raking light. */
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
      bevelThickness: 0.008,
      bevelSize: 0.008,
      bevelSegments: 2,
      curveSegments: 5,
    });
    geometry.translate(0, 0, -depth / 2);
    return geometry;
  }, [width, height, depth, radius]);
}

/** x positions of the four base doors; each hinges on its outer edge. */
const DOOR_X = [-1.2, -0.4, 0.4, 1.2];
const DOOR_W = 0.76;

function MediaWall({
  view,
  orbitRef,
  doorsOpen,
  showcase,
}: {
  view: Viewpoint;
  orbitRef: RefObject<OrbitState>;
  doorsOpen: boolean;
  showcase: boolean;
}) {
  const doorRefs = useRef<(Group | null)[]>([]);
  const openRef = useRef(0);

  const doorGeometry = usePanelGeometry(DOOR_W, 0.56, 0.035, 0.012);
  const shelfGeometry = usePanelGeometry(0.62, 0.05, 0.26, 0.008);

  useFrame((state, delta) => {
    const ease = 1 - Math.pow(0.0025, delta);
    const time = state.clock.elapsedTime;

    // Showcase mode ignores the pointer entirely and plays a slow, hands-off
    // loop: a gentle turn plus doors easing open and shut. It is what mobile
    // gets, where there is no room for a drag surface and no expectation of one.
    const orbit = showcase ? { azimuth: Math.sin(time * 0.22) * 0.34, polar: 0 } : (orbitRef.current ?? { azimuth: 0, polar: 0 });
    const target = showcase ? (Math.sin(time * 0.42) > 0 ? 1 : 0) : doorsOpen ? 1 : 0;

    const azimuth = view.azimuth + orbit.azimuth;
    const polar = THREE.MathUtils.clamp(view.polar + orbit.polar, 1.05, 1.95);
    const r = view.radius;

    const targetPosition = new THREE.Vector3(
      r * Math.sin(polar) * Math.sin(azimuth),
      r * Math.cos(polar) + view.targetY,
      r * Math.sin(polar) * Math.cos(azimuth),
    );
    state.camera.position.lerp(targetPosition, ease);
    state.camera.lookAt(0, view.targetY, 0);

    openRef.current += (target - openRef.current) * (showcase ? ease * 0.35 : ease);
    doorRefs.current.forEach((door, index) => {
      if (!door) return;
      // Outer two swing outward, inner two swing toward the centre gap, so no
      // leaf ever passes through its neighbour.
      const dir = index < 2 ? -1 : 1;
      door.rotation.y = dir * openRef.current * 1.25;
    });
  });

  return (
    <group>
      {/* ── Room ── warm plaster wall and an oak floor. The whole point of the
          light ground is that forest-green joinery has something to read against. */}
      <mesh position={[0, 0.35, -0.62]} receiveShadow>
        <planeGeometry args={[11, 6.5]} />
        <meshStandardMaterial color={PLASTER} roughness={0.96} />
      </mesh>
      <mesh position={[0, -1.28, 0.6]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[11, 5]} />
        <meshStandardMaterial color={OAK} roughness={0.72} />
      </mesh>
      {/* Skirting return, so the wall and floor do not simply butt together */}
      <mesh position={[0, -1.22, -0.6]}>
        <boxGeometry args={[11, 0.12, 0.03]} />
        <meshStandardMaterial color={PLASTER_DEEP} roughness={0.9} />
      </mesh>

      {/* ── Backboard ── the panelled field the whole unit hangs off */}
      <mesh position={[0, 0.02, -0.5]}>
        <boxGeometry args={[3.24, 2.36, 0.08]} />
        <meshStandardMaterial color={FOREST} roughness={0.72} />
      </mesh>
      {/* Vertical grooves — the slatted detail that reads as joinery, not drywall */}
      {[-1.44, -1.08, 1.08, 1.44].map((x) => (
        <mesh key={x} position={[x, 0.02, -0.45]}>
          <boxGeometry args={[0.02, 2.3, 0.012]} />
          <meshStandardMaterial color={FOREST_DEEP} roughness={0.85} />
        </mesh>
      ))}

      {/* ── TV recess ── inset panel, rim, and the screen itself */}
      <mesh position={[0, 0.42, -0.47]}>
        <boxGeometry args={[1.78, 1.04, 0.03]} />
        <meshStandardMaterial color={FOREST_DEEP} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.42, -0.44]}>
        <boxGeometry args={[1.7, 0.96, 0.02]} />
        <meshStandardMaterial color={SCREEN} roughness={0.28} metalness={0.35} />
      </mesh>
      <mesh position={[0, 0.42, -0.428]}>
        <planeGeometry args={[1.64, 0.9]} />
        <meshStandardMaterial
          color={SCREEN}
          emissive="#20313A"
          emissiveIntensity={0.45}
          roughness={0.2}
        />
      </mesh>

      {/* ── Fire slot ── the warm line that anchors the whole wall */}
      <mesh position={[0, -0.3, -0.46]}>
        <boxGeometry args={[1.36, 0.2, 0.04]} />
        <meshStandardMaterial color={FOREST_DEEP} roughness={0.9} />
      </mesh>
      <mesh position={[0, -0.3, -0.44]}>
        <boxGeometry args={[1.28, 0.13, 0.02]} />
        <meshStandardMaterial color="#E8A25C" emissive="#E8853C" emissiveIntensity={2.4} />
      </mesh>
      <pointLight position={[0, -0.3, -0.1]} intensity={2.6} distance={2.4} color="#F0A868" />

      {/* ── Floating shelves ── either side of the recess */}
      {[-1.16, 1.16].map((x) => (
        <group key={x}>
          <mesh geometry={shelfGeometry} position={[x, 0.32, -0.35]}>
            <meshStandardMaterial color={SAND} roughness={0.62} />
          </mesh>
          <mesh geometry={shelfGeometry} position={[x, -0.22, -0.35]}>
            <meshStandardMaterial color={SAND} roughness={0.62} />
          </mesh>
        </group>
      ))}

      {/* ── LED cove ── washing the plaster above the unit */}
      <mesh position={[0, 1.22, -0.42]}>
        <boxGeometry args={[3.0, 0.025, 0.03]} />
        <meshStandardMaterial color={SAND} emissive={SAND} emissiveIntensity={1.5} />
      </mesh>
      <pointLight position={[0, 1.3, -0.2]} intensity={1.6} distance={2.6} color="#F5EAD2" />

      {/* ── Base run ── carcass, interior, and four doors on outer hinges */}
      <mesh position={[0, -0.86, -0.22]}>
        <boxGeometry args={[3.24, 0.62, 0.52]} />
        <meshStandardMaterial color={FOREST} roughness={0.7} />
      </mesh>
      {/* Interior — only visible once the doors swing */}
      <mesh position={[0, -0.86, -0.3]}>
        <boxGeometry args={[3.1, 0.54, 0.36]} />
        <meshStandardMaterial color="#E4DED0" roughness={0.95} />
      </mesh>
      {[-0.8, 0.8].map((x) => (
        <mesh key={x} position={[x, -0.96, -0.2]}>
          <boxGeometry args={[0.5, 0.16, 0.3]} />
          <meshStandardMaterial color={SCREEN} roughness={0.4} metalness={0.3} />
        </mesh>
      ))}

      {DOOR_X.map((x, index) => {
        // Hinge on the outer edge of each leaf: the panel is offset inside a
        // group placed at the hinge line.
        const hingeX = index < 2 ? x - DOOR_W / 2 : x + DOOR_W / 2;
        const offset = index < 2 ? DOOR_W / 2 : -DOOR_W / 2;
        return (
          <group
            key={x}
            ref={(node) => {
              doorRefs.current[index] = node;
            }}
            position={[hingeX, -0.86, 0.06]}
          >
            <mesh geometry={doorGeometry} position={[offset, 0, 0]}>
              <meshStandardMaterial color={SAGE} roughness={0.5} metalness={0.05} />
            </mesh>
            <mesh position={[offset + (index < 2 ? 0.3 : -0.3), 0.19, 0.03]}>
              <boxGeometry args={[0.16, 0.016, 0.02]} />
              <meshStandardMaterial color={BRASS} roughness={0.24} metalness={0.75} />
            </mesh>
          </group>
        );
      })}

      {/* ── Plinth ── recessed, so the run reads as built-in */}
      <mesh position={[0, -1.21, -0.26]}>
        <boxGeometry args={[3.14, 0.12, 0.44]} />
        <meshStandardMaterial color={FOREST_DEEP} roughness={0.9} />
      </mesh>
    </group>
  );
}

export default function MediaWallScene({
  view,
  orbitRef,
  doorsOpen,
  showcase = false,
}: {
  view: Viewpoint;
  orbitRef: RefObject<OrbitState>;
  doorsOpen: boolean;
  showcase?: boolean;
}) {
  return (
    <Canvas
      camera={{ position: [0, 0.05, 4.6], fov: 34 }}
      dpr={showcase ? [1, 1.2] : [1, 1.75]}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.62} />
      <directionalLight position={[3.2, 4.4, 5]} intensity={1.5} />
      <directionalLight position={[-4, 1.6, 3]} intensity={0.55} color={SAND} />
      <directionalLight position={[0, -1.5, 3.4]} intensity={0.25} color={SAGE} />
      <MediaWall view={view} orbitRef={orbitRef} doorsOpen={doorsOpen} showcase={showcase} />
    </Canvas>
  );
}
