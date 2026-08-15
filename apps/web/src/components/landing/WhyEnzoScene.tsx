"use client";

// The redesign's single Three.js accent — a slowly rotating extruded shape
// evoking joinery/beveled cabinetry, built from raw @react-three/fiber +
// three primitives (no @react-three/drei) to keep the dependency surface
// small. Lazy-loaded via next/dynamic from WhyEnzoBento, desktop-only.
import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Mesh } from "three";

function JoineryShape() {
  const meshRef = useRef<Mesh>(null);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.x += delta * 0.15;
    meshRef.current.rotation.y += delta * 0.22;
  });

  return (
    <mesh ref={meshRef}>
      <torusKnotGeometry args={[1, 0.32, 128, 24, 2, 3]} />
      <meshStandardMaterial color="#8A9E8C" roughness={0.35} metalness={0.15} />
    </mesh>
  );
}

export default function WhyEnzoScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 4.5], fov: 45 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 4, 5]} intensity={1.2} />
      <directionalLight position={[-3, -2, -4]} intensity={0.3} color="#D4C9B5" />
      <JoineryShape />
    </Canvas>
  );
}
