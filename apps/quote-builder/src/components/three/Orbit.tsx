"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/**
 * Drag to turn, scroll or pinch to zoom. The canvas renders on demand, so
 * the controls ask for a frame whenever they move instead of the scene
 * spinning at 60fps while nobody is touching it.
 */
export function Orbit({
  target,
  minDistance,
  maxDistance,
}: {
  target: [number, number, number];
  minDistance: number;
  maxDistance: number;
}) {
  const camera = useThree((state) => state.camera);
  const domElement = useThree((state) => state.gl.domElement);
  const invalidate = useThree((state) => state.invalidate);
  const [tx, ty, tz] = target;

  useEffect(() => {
    const controls = new OrbitControls(camera, domElement);
    controls.target.set(tx, ty, tz);
    controls.minDistance = minDistance;
    controls.maxDistance = maxDistance;
    // Stay above the floor: looking up from under a room shows nothing useful.
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.enablePan = false;
    controls.update();
    const onChange = () => invalidate();
    controls.addEventListener("change", onChange);
    invalidate();
    return () => {
      controls.removeEventListener("change", onChange);
      controls.dispose();
    };
  }, [camera, domElement, invalidate, tx, ty, tz, minDistance, maxDistance]);

  return null;
}
