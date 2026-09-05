"use client";

// Everything the four service-page models share: the palette, the room they
// stand in, the camera rig, and the panel geometry every carcass is built
// from.
//
// The A3 models used to be CSS 3D — transformed divs on a hand-rolled
// `Box3D`. That was a deliberate trade (no WebGL context per service page)
// and it bought exactly what it cost: four boxes with flat faces, no light,
// no depth, nothing to look into and nothing to look at. The landing page's
// media-wall viewer is real three.js and is the thing people actually stop
// on, so the service pages now get the same treatment.
//
// The cost is honest and bounded: one WebGL context on one service page, the
// same as the landing page already spends, held back by an IntersectionObserver
// until the section is nearby and skipped entirely under reduced motion.
import { useMemo, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export const FOREST = "#1B4335";
export const FOREST_DEEP = "#122A22";
export const SAGE = "#8A9E8C";
export const SAND = "#D4C9B5";
export const BRASS = "#C4A87A";
export const SCREEN = "#0B0E0D";
export const PLASTER = "#D2CABB";
export const PLASTER_DEEP = "#BCB3A3";
export const OAK = "#A98F6A";
export const LINEN = "#C3B9A6";
export const CLAY = "#A8785E";
export const CHARCOAL = "#3B3B39";
export const STONE = "#E6E0D2";

/** Room shell, shared so all four units stand in the same place. */
export const FLOOR_Y = -1.3;
export const WALL_Z = -0.62;

export interface Viewpoint {
  id: string;
  label: string;
  note: string;
  azimuth: number;
  /** Radians from +Y. Below PI/2 looks down at the unit, above looks up. */
  polar: number;
  radius: number;
  targetY: number;
}

/** Live drag offsets, written by the section's pointer handlers. */
export interface OrbitState {
  azimuth: number;
  polar: number;
}

/** Props every unit receives. `open` drives whatever that unit's one control does. */
export interface UnitProps {
  open: boolean;
  showcase: boolean;
}

/**
 * Rounded, chamfered flat panel — reads as solid material under raking
 * light, where a plain box reads as a rectangle.
 */
export function usePanelGeometry(
  width: number,
  height: number,
  depth: number,
  radius = 0.012,
) {
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

/**
 * Eases a 0–1 value toward its target every frame and hands it back through
 * a ref, so opening a door costs no React render at 60fps.
 */
export function useEasedOpen(
  target: boolean,
  showcase: boolean,
  ref: RefObject<number>,
) {
  useFrame((state, delta) => {
    const ease = 1 - Math.pow(0.0025, delta);
    // Showcase mode ignores the control and cycles slowly on its own.
    const want = showcase
      ? Math.sin(state.clock.elapsedTime * 0.34) > 0
        ? 1
        : 0
      : target
        ? 1
        : 0;
    ref.current += (want - ref.current) * (showcase ? ease * 0.3 : ease);
  });
}

/**
 * The camera. Flies to the selected viewpoint and adds the visitor's drag
 * offset on top, so a named view and a hand-turned one are the same
 * mechanism rather than two competing ones.
 */
export function CameraRig({
  view,
  orbitRef,
  showcase,
}: {
  view: Viewpoint;
  orbitRef: RefObject<OrbitState>;
  showcase: boolean;
}) {
  useFrame((state, delta) => {
    const ease = 1 - Math.pow(0.0025, delta);
    const time = state.clock.elapsedTime;

    const orbit = showcase
      ? { azimuth: Math.sin(time * 0.2) * 0.32, polar: 0 }
      : (orbitRef.current ?? { azimuth: 0, polar: 0 });

    const azimuth = view.azimuth + orbit.azimuth;
    const polar = THREE.MathUtils.clamp(view.polar + orbit.polar, 1.02, 1.74);
    const r = view.radius;

    const targetPosition = new THREE.Vector3(
      r * Math.sin(polar) * Math.sin(azimuth),
      r * Math.cos(polar) + view.targetY,
      r * Math.sin(polar) * Math.cos(azimuth),
    );
    state.camera.position.lerp(targetPosition, ease);
    state.camera.lookAt(0, view.targetY, 0);
  });
  return null;
}

/**
 * Plaster wall, oak floor and a skirting. Light ground on purpose: forest
 * joinery needs something to read against, and every one of these units is
 * forest.
 */
export function Room({ width = 16 }: { width?: number }) {
  return (
    <group>
      <mesh position={[0, 0.6, WALL_Z - 0.02]}>
        <planeGeometry args={[width, 8]} />
        <meshStandardMaterial color={PLASTER} roughness={0.97} />
      </mesh>
      <mesh position={[0, FLOOR_Y, 1.8]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, 10]} />
        <meshStandardMaterial color={OAK} roughness={0.7} />
      </mesh>
      <mesh position={[0, FLOOR_Y + 0.06, WALL_Z + 0.01]}>
        <boxGeometry args={[width, 0.12, 0.02]} />
        <meshStandardMaterial color={PLASTER_DEEP} roughness={0.9} />
      </mesh>
    </group>
  );
}

/** A stack of books — the cheapest way to make a shelf read as lived-in. */
export function Books({
  position,
  tint = CLAY,
}: {
  position: [number, number, number];
  tint?: string;
}) {
  return (
    <group position={position}>
      {[0, 0.055, 0.11].map((y, i) => (
        <mesh key={y} position={[i * 0.012, y, 0]} rotation={[0, i * 0.06, 0]}>
          <boxGeometry args={[0.22, 0.05, 0.16]} />
          <meshStandardMaterial color={i === 1 ? tint : SAND} roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

/** A hanging garment, for the wardrobe units. */
export function Garment({
  position,
  color,
  height = 0.62,
  width = 0.16,
}: {
  position: [number, number, number];
  color: string;
  height?: number;
  width?: number;
}) {
  return (
    <group position={position}>
      {/* Hanger hook over the rail. */}
      <mesh position={[0, height / 2 + 0.03, 0]}>
        <torusGeometry args={[0.024, 0.004, 6, 14, Math.PI * 1.4]} />
        <meshStandardMaterial color={BRASS} roughness={0.3} metalness={0.7} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[width, height, 0.05]} />
        <meshStandardMaterial color={color} roughness={0.88} />
      </mesh>
    </group>
  );
}
