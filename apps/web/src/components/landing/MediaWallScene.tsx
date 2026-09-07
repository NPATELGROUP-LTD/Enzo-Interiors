"use client";

// The page's 3D element — a media wall, in a furnished room.
//
// Three things were wrong with the previous pass and are fixed here:
//
//  1. The flanking shelves ran across the TV recess. The unit is now zoned:
//     the recess owns the centre (x -1.05..1.05) and the display shelves sit
//     entirely on the flanks beyond it, so nothing overlaps the screen.
//  2. Opening the base doors revealed a solid block. The base run is now a
//     real carcass — back, deck, ends, three dividers and a shelf per bay —
//     so the void behind the doors is genuinely empty and you can see into it.
//  3. The wall floated in an empty room. There is now furniture: a rug, a
//     sofa read from behind, a coffee table, an armchair, a floor lamp and a
//     plant. All of it static — it exists to give the joinery a scale and a
//     context, not to animate.
//
// The unit is also larger (4.0m x 2.6m rather than 3.24 x 2.36) and carries
// styled shelves — books, a vase, a bowl, a leaning frame, candles — because
// an empty media wall reads as a rendering and a dressed one reads as a room.
//
// Raw @react-three/fiber + three primitives (no drei) keeps the dependency
// surface small.
import { useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Group } from "three";
import {
  AZIMUTH_LIMIT,
  BRASS,
  CHARCOAL,
  CLAY,
  FOREST,
  FOREST_DEEP,
  LINEN,
  LINEN_DEEP,
  neutralOrbit,
  OAK,
  PLASTER,
  PLASTER_DEEP,
  SAGE,
  SAND,
  SCREEN,
  ZOOM_MAX,
  ZOOM_MIN,
  type OrbitState,
  type Viewpoint,
} from "@/lib/scene-common";

export const VIEWPOINTS: Viewpoint[] = [
  {
    id: "room",
    label: "The room",
    note: "Back far enough to read the wall as part of a living room.",
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
    id: "base",
    label: "Base cabinets",
    note: "Down at the run — open the doors and the bays are genuinely empty.",
    azimuth: -0.3,
    polar: 1.34,
    radius: 3.5,
    targetY: -0.72,
  },
  {
    id: "shelf",
    label: "Display shelves",
    note: "In close on the flank shelving, clear of the screen.",
    azimuth: -0.42,
    polar: 1.5,
    radius: 2.5,
    targetY: 0.42,
  },
];

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

// ── Unit geometry, all in metres ────────────────────────────────────────────
const FLOOR_Y = -1.3;
const UNIT_W = 4.0;
const WALL_Z = -0.62;

/** Base run: a real box, so the doors have something empty to open onto. */
const BASE = { top: -0.52, bottom: -1.18, front: -0.06, back: -0.62 };
const BASE_MID = (BASE.top + BASE.bottom) / 2;
const BASE_H = BASE.top - BASE.bottom;
const BASE_D = BASE.front - BASE.back;
const BASE_Z = (BASE.front + BASE.back) / 2;

/** Four bays, four doors. Each pair meets in the middle and hinges outward. */
const BAY_X = [-1.5, -0.5, 0.5, 1.5];
const DIVIDER_X = [-1.0, 0, 1.0];
const DOOR_W = 0.97;
const DOOR_H = 0.6;

/**
 * Hinge lines for the four doors. Two pairs: doors 0/1 meet at x = -1.0 and
 * doors 2/3 meet at x = 1.0, each leaf hinged on the side away from that
 * meeting point so both open outward into free air rather than through a
 * neighbouring leaf or a divider.
 */
const DOOR_X_HINGES = [
  { hingeX: -1.985, offset: DOOR_W / 2, dir: 1 },
  { hingeX: -0.015, offset: -DOOR_W / 2, dir: -1 },
  { hingeX: 0.015, offset: DOOR_W / 2, dir: 1 },
  { hingeX: 1.985, offset: -DOOR_W / 2, dir: -1 },
];

/** Decorative objects, kept off the centre so they never cross the screen. */
function ShelfStyling() {
  return (
    <group>
      {/* Left flank — stacked books and a vase */}
      <group position={[-1.62, 0.98, -0.36]}>
        {[0, 0.055, 0.11].map((y, i) => (
          <mesh key={y} position={[i * 0.012, y, 0]} rotation={[0, i * 0.06, 0]}>
            <boxGeometry args={[0.24, 0.05, 0.17]} />
            <meshStandardMaterial color={i === 1 ? CLAY : SAND} roughness={0.85} />
          </mesh>
        ))}
      </group>
      <mesh position={[-1.28, 1.06, -0.36]}>
        <cylinderGeometry args={[0.055, 0.085, 0.24, 18]} />
        <meshStandardMaterial color={FOREST_DEEP} roughness={0.35} />
      </mesh>

      {/* Left flank, middle shelf — a low bowl */}
      <mesh position={[-1.5, 0.5, -0.36]} scale={[1, 0.45, 1]}>
        <sphereGeometry args={[0.12, 20, 14]} />
        <meshStandardMaterial color={BRASS} roughness={0.3} metalness={0.6} />
      </mesh>

      {/* Right flank — a leaning frame and candles */}
      <mesh position={[1.42, 1.05, -0.4]} rotation={[0, 0, 0.04]}>
        <boxGeometry args={[0.3, 0.38, 0.02]} />
        <meshStandardMaterial color={CHARCOAL} roughness={0.6} />
      </mesh>
      <mesh position={[1.42, 1.05, -0.385]} rotation={[0, 0, 0.04]}>
        <boxGeometry args={[0.25, 0.32, 0.005]} />
        <meshStandardMaterial color={PLASTER_DEEP} roughness={0.9} />
      </mesh>
      {[1.72, 1.83].map((x, i) => (
        <mesh key={x} position={[x, 0.96 + i * 0.035, -0.36]}>
          <cylinderGeometry args={[0.035, 0.035, 0.14 + i * 0.07, 14]} />
          <meshStandardMaterial color={SAND} roughness={0.75} />
        </mesh>
      ))}

      {/* Right flank, middle shelf — a small trailing plant */}
      <mesh position={[1.55, 0.5, -0.36]}>
        <cylinderGeometry args={[0.08, 0.06, 0.14, 16]} />
        <meshStandardMaterial color={CLAY} roughness={0.8} />
      </mesh>
      {[-0.1, 0, 0.1].map((dx, i) => (
        <mesh key={dx} position={[1.55 + dx, 0.63 + (i === 1 ? 0.06 : 0), -0.36]} rotation={[0, 0, dx * 3]}>
          <sphereGeometry args={[0.07, 12, 10]} />
          <meshStandardMaterial color={SAGE} roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

/** Static room dressing. None of it moves — it exists to give the unit scale. */
function RoomFurniture() {
  return (
    <group>
      {/* Rug */}
      <mesh position={[0, FLOOR_Y + 0.006, 1.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4.4, 3.0]} />
        <meshStandardMaterial color={LINEN_DEEP} roughness={1} />
      </mesh>
      <mesh position={[0, FLOOR_Y + 0.008, 1.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.9, 2.5]} />
        <meshStandardMaterial color={LINEN} roughness={1} />
      </mesh>

      {/* Sofa, read from behind — the classic living-room framing device, and
          low enough that it never crosses the base run from any viewpoint. */}
      <group position={[0, 0, 2.95]}>
        <mesh position={[0, FLOOR_Y + 0.34, 0]}>
          <boxGeometry args={[2.5, 0.28, 0.95]} />
          <meshStandardMaterial color={LINEN} roughness={0.95} />
        </mesh>
        <mesh position={[0, FLOOR_Y + 0.52, 0.4]}>
          <boxGeometry args={[2.5, 0.66, 0.2]} />
          <meshStandardMaterial color={LINEN} roughness={0.95} />
        </mesh>
        {[-1.15, 1.15].map((x) => (
          <mesh key={x} position={[x, FLOOR_Y + 0.44, 0]}>
            <boxGeometry args={[0.2, 0.5, 0.95]} />
            <meshStandardMaterial color={LINEN} roughness={0.95} />
          </mesh>
        ))}
        {[-0.62, 0.62].map((x) => (
          <mesh key={x} position={[x, FLOOR_Y + 0.5, 0.12]} rotation={[0.12, 0, 0]}>
            <boxGeometry args={[0.85, 0.2, 0.6]} />
            <meshStandardMaterial color={LINEN_DEEP} roughness={0.95} />
          </mesh>
        ))}
        {[-0.95, 0.95].map((x) => (
          <mesh key={x} position={[x, FLOOR_Y + 0.62, 0.28]} rotation={[0, 0, x > 0 ? -0.2 : 0.2]}>
            <boxGeometry args={[0.34, 0.34, 0.12]} />
            <meshStandardMaterial color={CLAY} roughness={0.9} />
          </mesh>
        ))}
        {[-0.9, 0.9].map((x) => (
          <mesh key={x} position={[x, FLOOR_Y + 0.1, -0.3]}>
            <cylinderGeometry args={[0.035, 0.03, 0.2, 10]} />
            <meshStandardMaterial color={OAK} roughness={0.6} />
          </mesh>
        ))}
      </group>

      {/* Coffee table — oak top on a slim frame */}
      <group position={[0, 0, 1.45]}>
        <mesh position={[0, FLOOR_Y + 0.4, 0]}>
          <boxGeometry args={[1.25, 0.05, 0.62]} />
          <meshStandardMaterial color={OAK} roughness={0.55} />
        </mesh>
        {[
          [-0.55, -0.24],
          [0.55, -0.24],
          [-0.55, 0.24],
          [0.55, 0.24],
        ].map(([x, z]) => (
          <mesh key={`${x}-${z}`} position={[x!, FLOOR_Y + 0.19, z!]}>
            <cylinderGeometry args={[0.022, 0.022, 0.38, 10]} />
            <meshStandardMaterial color={CHARCOAL} roughness={0.45} metalness={0.3} />
          </mesh>
        ))}
        <mesh position={[-0.2, FLOOR_Y + 0.45, 0]}>
          <boxGeometry args={[0.26, 0.05, 0.18]} />
          <meshStandardMaterial color={SAND} roughness={0.85} />
        </mesh>
        <mesh position={[0.28, FLOOR_Y + 0.48, 0.04]}>
          <cylinderGeometry args={[0.06, 0.075, 0.12, 16]} />
          <meshStandardMaterial color={SAGE} roughness={0.7} />
        </mesh>
      </group>

      {/* Armchair, angled in from the right */}
      <group position={[2.35, 0, 1.55]} rotation={[0, -0.62, 0]}>
        <mesh position={[0, FLOOR_Y + 0.36, 0]}>
          <boxGeometry args={[0.82, 0.26, 0.8]} />
          <meshStandardMaterial color={LINEN_DEEP} roughness={0.95} />
        </mesh>
        <mesh position={[0, FLOOR_Y + 0.58, -0.32]}>
          <boxGeometry args={[0.82, 0.62, 0.18]} />
          <meshStandardMaterial color={LINEN_DEEP} roughness={0.95} />
        </mesh>
        {[-0.32, 0.32].map((x) => (
          <mesh key={x} position={[x, FLOOR_Y + 0.46, 0]}>
            <boxGeometry args={[0.16, 0.44, 0.8]} />
            <meshStandardMaterial color={LINEN_DEEP} roughness={0.95} />
          </mesh>
        ))}
      </group>

      {/* Floor lamp, left */}
      <group position={[-2.5, 0, 0.65]}>
        <mesh position={[0, FLOOR_Y + 0.02, 0]}>
          <cylinderGeometry args={[0.16, 0.18, 0.04, 20]} />
          <meshStandardMaterial color={CHARCOAL} roughness={0.4} metalness={0.4} />
        </mesh>
        <mesh position={[0, FLOOR_Y + 0.72, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 1.4, 10]} />
          <meshStandardMaterial color={CHARCOAL} roughness={0.4} metalness={0.4} />
        </mesh>
        <mesh position={[0, FLOOR_Y + 1.52, 0]}>
          <cylinderGeometry args={[0.17, 0.22, 0.28, 20, 1, true]} />
          <meshStandardMaterial color={SAND} roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
        <pointLight position={[0, FLOOR_Y + 1.45, 0]} intensity={1.6} distance={3} color="#F3E3C4" />
      </group>

      {/* Tall plant, right */}
      <group position={[2.72, 0, 0.15]}>
        <mesh position={[0, FLOOR_Y + 0.22, 0]}>
          <cylinderGeometry args={[0.19, 0.15, 0.44, 18]} />
          <meshStandardMaterial color={PLASTER_DEEP} roughness={0.9} />
        </mesh>
        {[
          [0, 0.62, 0.16],
          [0.16, 0.5, -0.1],
          [-0.15, 0.44, 0.06],
        ].map(([dx, h, dz], i) => (
          <mesh
            key={i}
            position={[dx!, FLOOR_Y + 0.44 + h! / 2, dz!]}
            rotation={[0, 0, dx! * 0.9]}
          >
            <cylinderGeometry args={[0.012, 0.02, h!, 8]} />
            <meshStandardMaterial color={SAGE} roughness={0.85} />
          </mesh>
        ))}
        {[
          [0, 0.78, 0.16],
          [0.22, 0.66, -0.1],
          [-0.2, 0.6, 0.06],
          [0.08, 0.86, -0.02],
        ].map(([dx, y, dz], i) => (
          <mesh key={`leaf-${i}`} position={[dx!, FLOOR_Y + 0.44 + y!, dz!]} scale={[1, 0.55, 0.7]}>
            <sphereGeometry args={[0.19, 12, 10]} />
            <meshStandardMaterial color={SAGE} roughness={0.88} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

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

  const doorGeometry = usePanelGeometry(DOOR_W, DOOR_H, 0.035, 0.012);
  const shelfGeometry = usePanelGeometry(0.8, 0.05, 0.3, 0.008);

  useFrame((state, delta) => {
    const ease = 1 - Math.pow(0.0025, delta);
    const time = state.clock.elapsedTime;

    // Showcase mode ignores the pointer entirely and plays a slow, hands-off
    // loop: a gentle turn plus doors easing open and shut.
    const orbit = showcase
      ? { azimuth: Math.sin(time * 0.2) * 0.3, polar: 0, zoom: 1 }
      : (orbitRef.current ?? neutralOrbit());
    const target = showcase ? (Math.sin(time * 0.38) > 0 ? 1 : 0) : doorsOpen ? 1 : 0;

    // Clamped here rather than in the handler so every input is bounded by
    // the same rule and the limit cannot be bypassed by writing the ref.
    const azimuth =
      view.azimuth +
      THREE.MathUtils.clamp(orbit.azimuth, -AZIMUTH_LIMIT, AZIMUTH_LIMIT);
    const polar = THREE.MathUtils.clamp(view.polar + orbit.polar, 1.05, 1.72);
    const r = view.radius * THREE.MathUtils.clamp(orbit.zoom, ZOOM_MIN, ZOOM_MAX);

    const targetPosition = new THREE.Vector3(
      r * Math.sin(polar) * Math.sin(azimuth),
      r * Math.cos(polar) + view.targetY,
      r * Math.sin(polar) * Math.cos(azimuth),
    );
    state.camera.position.lerp(targetPosition, ease);
    state.camera.lookAt(0, view.targetY, 0);

    openRef.current += (target - openRef.current) * (showcase ? ease * 0.3 : ease);
    doorRefs.current.forEach((door, index) => {
      if (!door) return;
      // Two pairs: each pair meets in its own middle and swings outward, so no
      // leaf ever passes through a neighbour or through a divider.
      const dir = index % 2 === 0 ? -1 : 1;
      door.rotation.y = dir * openRef.current * 1.3;
    });
  });

  return (
    <group>
      {/* ── Room shell ── warm plaster and oak. The light ground is the whole
          point: forest joinery needs something to read against. */}
      <mesh position={[0, 0.6, WALL_Z - 0.02]}>
        <planeGeometry args={[16, 8]} />
        <meshStandardMaterial color={PLASTER} roughness={0.97} />
      </mesh>
      <mesh position={[0, FLOOR_Y, 1.6]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[16, 9]} />
        <meshStandardMaterial color={OAK} roughness={0.7} />
      </mesh>
      <mesh position={[0, FLOOR_Y + 0.06, WALL_Z + 0.01]}>
        <boxGeometry args={[16, 0.12, 0.02]} />
        <meshStandardMaterial color={PLASTER_DEEP} roughness={0.9} />
      </mesh>

      <RoomFurniture />

      {/* ── Backboard ── the panelled field the unit hangs off */}
      <mesh position={[0, 0.05, WALL_Z + 0.04]}>
        <boxGeometry args={[UNIT_W, 2.6, 0.08]} />
        <meshStandardMaterial color={FOREST} roughness={0.72} />
      </mesh>
      {/* Slatted grooves on the flanks only — never across the screen */}
      {[-1.9, -1.78, -1.66, 1.66, 1.78, 1.9].map((x) => (
        <mesh key={x} position={[x, 0.05, WALL_Z + 0.085]}>
          <boxGeometry args={[0.018, 2.5, 0.014]} />
          <meshStandardMaterial color={FOREST_DEEP} roughness={0.85} />
        </mesh>
      ))}

      {/* ── TV recess ── owns the centre outright: x -1.05..1.05 */}
      <mesh position={[0, 0.6, WALL_Z + 0.09]}>
        <boxGeometry args={[2.1, 1.02, 0.03]} />
        <meshStandardMaterial color={FOREST_DEEP} roughness={0.92} />
      </mesh>
      <mesh position={[0, 0.6, WALL_Z + 0.115]}>
        <boxGeometry args={[1.98, 0.92, 0.025]} />
        <meshStandardMaterial color={SCREEN} roughness={0.26} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.6, WALL_Z + 0.131]}>
        <planeGeometry args={[1.92, 0.86]} />
        <meshStandardMaterial
          color={SCREEN}
          emissive="#1D2C34"
          emissiveIntensity={0.5}
          roughness={0.18}
        />
      </mesh>

      {/* ── Fire slot ── the warm line that anchors the wall */}
      <mesh position={[0, -0.06, WALL_Z + 0.09]}>
        <boxGeometry args={[1.86, 0.22, 0.035]} />
        <meshStandardMaterial color={FOREST_DEEP} roughness={0.92} />
      </mesh>
      <mesh position={[0, -0.06, WALL_Z + 0.112]}>
        <boxGeometry args={[1.76, 0.14, 0.02]} />
        <meshStandardMaterial color="#E8A25C" emissive="#EA8438" emissiveIntensity={2.6} />
      </mesh>
      <pointLight position={[0, -0.06, 0.25]} intensity={3} distance={3} color="#F2A868" />

      {/* ── Display shelves ── flanks only, clear of the recess by 0.15m */}
      {[-1.55, 1.55].map((x) =>
        [1.02, 0.46, -0.1].map((y) => (
          <mesh key={`${x}-${y}`} geometry={shelfGeometry} position={[x, y, WALL_Z + 0.2]}>
            <meshStandardMaterial color={SAND} roughness={0.62} />
          </mesh>
        )),
      )}
      <ShelfStyling />

      {/* ── LED cove ── washing the plaster above */}
      <mesh position={[0, 1.33, WALL_Z + 0.14]}>
        <boxGeometry args={[3.7, 0.022, 0.03]} />
        <meshStandardMaterial color={SAND} emissive={SAND} emissiveIntensity={1.5} />
      </mesh>
      <pointLight position={[0, 1.45, -0.2]} intensity={1.7} distance={3} color="#F5EAD2" />

      {/* ── Base run ── a genuine carcass. Back, deck, top, ends, dividers and
          a shelf per bay: the volume behind each door is actually empty, which
          is the entire point of being able to open them. */}
      <mesh position={[0, BASE_MID, BASE.back + 0.015]}>
        <boxGeometry args={[UNIT_W, BASE_H, 0.03]} />
        <meshStandardMaterial color={FOREST_DEEP} roughness={0.9} />
      </mesh>
      <mesh position={[0, BASE.bottom + 0.015, BASE_Z]}>
        <boxGeometry args={[UNIT_W, 0.03, BASE_D]} />
        <meshStandardMaterial color="#E6E0D2" roughness={0.94} />
      </mesh>
      <mesh position={[0, BASE.top - 0.02, BASE_Z]}>
        <boxGeometry args={[UNIT_W, 0.04, BASE_D]} />
        <meshStandardMaterial color={FOREST} roughness={0.7} />
      </mesh>
      {[-1.985, 1.985].map((x) => (
        <mesh key={x} position={[x, BASE_MID, BASE_Z]}>
          <boxGeometry args={[0.03, BASE_H, BASE_D]} />
          <meshStandardMaterial color={FOREST} roughness={0.75} />
        </mesh>
      ))}
      {DIVIDER_X.map((x) => (
        <mesh key={x} position={[x, BASE_MID, BASE_Z - 0.01]}>
          <boxGeometry args={[0.025, BASE_H - 0.06, BASE_D - 0.04]} />
          <meshStandardMaterial color="#E6E0D2" roughness={0.94} />
        </mesh>
      ))}
      {BAY_X.map((x) => (
        <mesh key={`shelf-${x}`} position={[x, BASE_MID - 0.02, BASE_Z - 0.02]}>
          <boxGeometry args={[0.94, 0.022, BASE_D - 0.08]} />
          <meshStandardMaterial color="#E6E0D2" roughness={0.94} />
        </mesh>
      ))}
      {/* A little kit in two of the bays, so the void reads as usable storage */}
      <mesh position={[-1.5, BASE.bottom + 0.09, BASE_Z - 0.04]}>
        <boxGeometry args={[0.6, 0.11, 0.34]} />
        <meshStandardMaterial color={CHARCOAL} roughness={0.42} metalness={0.3} />
      </mesh>
      <mesh position={[1.5, BASE.bottom + 0.11, BASE_Z - 0.04]}>
        <boxGeometry args={[0.44, 0.15, 0.3] } />
        <meshStandardMaterial color={CLAY} roughness={0.85} />
      </mesh>

      {DOOR_X_HINGES.map((hinge, index) => (
        <group
          key={hinge.hingeX}
          ref={(node) => {
            doorRefs.current[index] = node;
          }}
          position={[hinge.hingeX, BASE_MID, BASE.front + 0.03]}
        >
          <mesh geometry={doorGeometry} position={[hinge.offset, 0, 0]}>
            <meshStandardMaterial color={SAGE} roughness={0.5} metalness={0.05} />
          </mesh>
          <mesh position={[hinge.offset - hinge.dir * 0.36, 0.2, 0.03]}>
            <boxGeometry args={[0.2, 0.016, 0.022]} />
            <meshStandardMaterial color={BRASS} roughness={0.24} metalness={0.75} />
          </mesh>
        </group>
      ))}

      {/* ── Plinth ── recessed, so the run reads as built-in */}
      <mesh position={[0, BASE.bottom - 0.06, BASE_Z - 0.06]}>
        <boxGeometry args={[UNIT_W - 0.12, 0.12, BASE_D - 0.14]} />
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
      camera={{ position: [0, 0, 6.2], fov: 36 }}
      dpr={showcase ? [1, 1.2] : [1, 1.75]}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.66} />
      <directionalLight position={[3.5, 5, 6]} intensity={1.45} />
      <directionalLight position={[-5, 2, 4]} intensity={0.55} color={SAND} />
      <directionalLight position={[0, -1.5, 4]} intensity={0.22} color={SAGE} />
      <MediaWall view={view} orbitRef={orbitRef} doorsOpen={doorsOpen} showcase={showcase} />
    </Canvas>
  );
}
