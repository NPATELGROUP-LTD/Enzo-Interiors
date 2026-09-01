"use client";

// A cuboid, in CSS 3D.
//
// The four service-page models are all built out of this. Writing the face
// maths once is the whole point: every face uses the same recipe — centre
// it on the box, rotate it, then push it out by half the box's extent along
// its own Z. Positioning faces from the top-left instead makes each one a
// different offset puzzle, which is exactly how the first version of the
// finish block got its worktop in the wrong place.
//
// CSS 3D rather than three.js on purpose: the landing page already spends a
// WebGL context on its media-wall viewer, and a second one on every service
// page would cost every visitor a renderer to look at a box. Transformed
// divs give the same object for no runtime and no canvas.
import type { CSSProperties, ReactNode } from "react";

export interface Box3DProps {
  /** Size in scene units (px at scale 1). */
  w: number;
  h: number;
  d: number;
  /** Position of the box's CENTRE, relative to the scene origin. */
  x?: number;
  y?: number;
  z?: number;
  /** Front face. */
  color: string;
  /** Left/right returns. Defaults to `color`. */
  shade?: string;
  /** Top face. Defaults to `shade`. */
  top?: string;
  /** Degrees about Y, applied before the translation is undone. */
  rotateY?: number;
  /** Moves the rotation pivot to an edge — used for doors. */
  origin?: string;
  radius?: number;
  /** Painted on the front face — a screen, a glow, a shadow gap. */
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
}

export function Box3D({
  w,
  h,
  d,
  x = 0,
  y = 0,
  z = 0,
  color,
  shade,
  top,
  rotateY = 0,
  origin,
  radius = 2,
  children,
  style,
  className,
}: Box3DProps) {
  const side = shade ?? color;
  const lid = top ?? side;

  const face = (extra: CSSProperties): CSSProperties => ({
    position: "absolute",
    left: "50%",
    top: "50%",
    borderRadius: radius,
    ...extra,
  });

  return (
    <div
      className={className}
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 0,
        height: 0,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z}px) rotateY(${rotateY}deg)`,
        transformOrigin: origin,
        transition: "transform 620ms cubic-bezier(0.22,1,0.36,1)",
        ...style,
      }}
    >
      {/* Front */}
      <div
        style={face({
          width: w,
          height: h,
          background: color,
          transform: `translate(-50%, -50%) translateZ(${d / 2}px)`,
          boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.16)",
        })}
      >
        {children}
      </div>
      {/* Right return */}
      <div
        style={face({
          width: d,
          height: h,
          background: side,
          transform: `translate(-50%, -50%) rotateY(90deg) translateZ(${w / 2}px)`,
          boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.2)",
        })}
      />
      {/* Left return */}
      <div
        style={face({
          width: d,
          height: h,
          background: side,
          transform: `translate(-50%, -50%) rotateY(-90deg) translateZ(${w / 2}px)`,
          boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.2)",
        })}
      />
      {/* Top */}
      <div
        style={face({
          width: w,
          height: d,
          background: lid,
          transform: `translate(-50%, -50%) rotateX(90deg) translateZ(${h / 2}px)`,
          boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.14)",
        })}
      />
    </div>
  );
}

/**
 * Model palette. Deliberately drawn from the brand tokens rather than from
 * a service's finish list — these sections show the *object*, not the
 * material options, so the colours stay constant across all four models and
 * the shapes are what differ.
 */
export const MODEL = {
  carcass: "#26332C",
  carcassShade: "#1C2621",
  front: "#D4C9B5",
  frontShade: "#B9AE99",
  surface: "#E8E5DE",
  surfaceShade: "#CFCBC2",
  accent: "#8A9E8C",
  dark: "#161A18",
  glow: "#F0D9A8",
} as const;
