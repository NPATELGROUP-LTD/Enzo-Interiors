"use client";

// The page's 3D element — Enzo's finished media wall, modelled on the render
// the client approved (01) and the job's dimensioned drawing. Where the two
// disagree, the render wins: 3406 wide overall, chunky ~45 mm tower frames, a
// plain wood back panel, and a tall walnut TV panel standing clear of the
// worktop with an even border round the 75" screen.
//
//   L to R: 400 tower | 678 base | 1250 centre bay | 678 base | 400 tower.
//   Base 480 on an 18 plinth, 18 worktop at 516. Centre bay: soundbar shelf
//   over a linear fire behind black glass. Towers: four lit compartments.
//
// Finishes are procedural (canvas-drawn elm grain), so nothing is downloaded.
// Static joinery is merged into one mesh per material, and every glow (LED
// halo, bulkhead wash, tower downlights) is an additive gradient plane rather
// than a light — the scene runs a handful of draw calls and four point lights,
// with no shadow maps.
//
// Raw @react-three/fiber + three primitives (no drei) keeps the dependency
// surface small.
import { useEffect, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Group, PointLight, ShaderMaterial } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  AZIMUTH_LIMIT,
  neutralOrbit,
  ZOOM_MAX,
  ZOOM_MIN,
  type OrbitState,
  type Viewpoint,
} from "@/lib/scene-common";

// The named camera positions this scene is driven to are authored beside the
// section's other copy, in src/data/pages/home.json. This file owns geometry.

// ── World placement ─────────────────────────────────────────────────────────
// The unit is modelled in its own frame (x across from the centre line, y up
// from the floor, z out from the wall) and dropped into the world here, where
// the viewpoints in home.json expect it.
const FLOOR_Y = -1.3;
const WALL_Z = -0.62;
const ROOM_W = 9.2;

// ── The wall, in metres ─────────────────────────────────────────────────────
const T = 0.018; // board
const FR = 0.045; // tower frame, as it reads from the front
const TOP = 2.2; // underside of the bulkhead
const CEIL = 2.3;
const BULK_D = 0.45;
const BASE_D = 0.28;
const TOWER_D = 0.33;
const WT = 0.516; // worktop surface
const HALF = 1.703; // half the 3406 run
const TW = 0.31; // open tower, inside the frames
const SB = HALF - (2 * FR + TW); // outer edge of each base run
const CB = 0.625; // half the 1250 centre bay
const BAY = SB - CB; // each side base
const TX = SB + FR + TW / 2; // tower centre line
const SH = 0.025; // tower shelf
const TOWER_SHELVES = [0.098, WT, 1.07, 1.625]; // shelf tops: four compartments
const TV = { w: 1.67, h: 0.965 }; // 75", bezel included
const BORDER = 0.13; // even walnut border round the screen
// Stood off the back panel and clear of the worktop.
const PANEL = { w: TV.w + 2 * BORDER, h: TV.h + 2 * BORDER, y: 0.66, z: 0.06 };
const FIRE = { w: 1.19, h: 0.33, y: 0.012 };
const SHELF_Y = FIRE.y + FIRE.h; // soundbar shelf underside
const DOOR = { w: (BAY - 0.008) / 2, h: 0.474, y: 0.022, split: 0.158 };

// ── Palette ─────────────────────────────────────────────────────────────────
const LED = "#FFD9A8"; // 2700-3000K strip, seen head on
const LED_WARM = "#FFB46B";

/** Deterministic PRNG, so the grain is the same on every load. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Procedural textures ────────────────────────────────────────────────────
/** One texture tile = this much board, in metres (width × height). */
const GRAIN_TILE = { u: 0.5, v: 1.0 };

function woodTexture(base: string, dark: string, light: string, seed: number) {
  const W = 512;
  const H = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d")!;
  const r = rng(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);

  // Drawn three times across so every stroke wraps the tile seamlessly.
  const wrapped = (draw: (dx: number) => void) => [-W, 0, W].forEach(draw);

  // Broad tonal bands — the boards a veneer is laid up from.
  for (let i = 0; i < 26; i++) {
    const x = r() * W;
    const w = 12 + r() * 70;
    g.globalAlpha = 0.05 + r() * 0.09;
    g.fillStyle = r() > 0.5 ? dark : light;
    wrapped((dx) => g.fillRect(x + dx, 0, w, H));
  }

  // Grain lines. Periods are whole fractions of the tile height, so the
  // waves meet themselves at the top and bottom edges.
  for (let i = 0; i < 260; i++) {
    const x0 = r() * W;
    const amp = 2 + r() * (r() > 0.85 ? 26 : 9);
    const k1 = 1 + Math.floor(r() * 3);
    const k2 = 3 + Math.floor(r() * 5);
    const p1 = r() * Math.PI * 2;
    const p2 = r() * Math.PI * 2;
    const darkLine = r() > 0.28;
    g.globalAlpha = darkLine ? 0.06 + r() * 0.22 : 0.05 + r() * 0.12;
    g.strokeStyle = darkLine ? dark : light;
    g.lineWidth = 0.5 + r() * (darkLine ? 2.4 : 1.6);
    wrapped((dx) => {
      g.beginPath();
      for (let y = 0; y <= H; y += 8) {
        const t = (y / H) * Math.PI * 2;
        const x = x0 + dx + Math.sin(t * k1 + p1) * amp + Math.sin(t * k2 + p2) * amp * 0.25;
        if (y === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    });
  }

  // Pores and flecks — elm's open grain.
  g.fillStyle = dark;
  for (let i = 0; i < 5200; i++) {
    g.globalAlpha = 0.12 + r() * 0.28;
    g.fillRect(r() * W, r() * H, 0.8 + r() * 0.9, 3 + r() * 12);
  }
  g.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function carpetTexture() {
  const S = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const g = canvas.getContext("2d")!;
  const r = rng(7);
  g.fillStyle = "#ABA9A5";
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 9000; i++) {
    const v = r();
    g.fillStyle = v > 0.5 ? "#CDCBC6" : "#7A7874";
    g.globalAlpha = 0.18 + r() * 0.3;
    g.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2);
  }
  g.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.repeat.set(40, 26);
  texture.anisotropy = 8;
  return texture;
}

/** Glow around a rectangle — the TV panel's halo strip. */
function haloTexture(planeW: number, planeH: number) {
  const W = 512;
  const H = Math.round((W * planeH) / planeW);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, W, H);
  const px = W / planeW;
  const x = ((planeW - PANEL.w) / 2) * px;
  const y = ((planeH - PANEL.h) / 2) * px;
  g.fillStyle = "#fff";
  g.shadowColor = "#fff";
  // Two passes: a tight hot edge and a wide soft spill.
  g.shadowBlur = 0.22 * px;
  g.fillRect(x, y, PANEL.w * px, PANEL.h * px);
  g.shadowBlur = 0.06 * px;
  g.fillRect(x, y, PANEL.w * px, PANEL.h * px);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Vertical fade, bright at the top. Bulkhead wash. */
function washTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 256;
  const g = canvas.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#fff");
  grad.addColorStop(0.08, "rgba(255,255,255,0.75)");
  grad.addColorStop(0.4, "rgba(255,255,255,0.22)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = "#000";
  g.fillRect(0, 0, 4, 256);
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** A downlight's cone on the board behind it. */
function coneTexture() {
  const S = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, S, S);
  g.save();
  g.scale(1, 1.7);
  const grad = g.createRadialGradient(S / 2, 0, 4, S / 2, 0, S * 0.62);
  grad.addColorStop(0, "#fff");
  grad.addColorStop(0.35, "rgba(255,255,255,0.55)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  g.restore();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** The TV's dead screen: near black, with a soft sheen from the room. */
function screenTexture() {
  const W = 512;
  const H = 296;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d")!;
  const base = g.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, "#0E0F10");
  base.addColorStop(1, "#060606");
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);
  const sheen = g.createLinearGradient(0, 0, W * 0.7, H);
  sheen.addColorStop(0, "rgba(255,255,255,0.10)");
  sheen.addColorStop(0.32, "rgba(255,255,255,0.035)");
  sheen.addColorStop(0.55, "rgba(255,255,255,0)");
  g.fillStyle = sheen;
  g.fillRect(0, 0, W, H);
  // The fire, caught low in the glass.
  const fire = g.createRadialGradient(W / 2, H * 1.25, 10, W / 2, H * 1.25, H * 0.75);
  fire.addColorStop(0, "rgba(255,120,40,0.10)");
  fire.addColorStop(1, "rgba(255,120,40,0)");
  g.fillStyle = fire;
  g.fillRect(0, 0, W, H);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// ── Geometry builders ──────────────────────────────────────────────────────
/**
 * A board, centred at (x, y, z), with UVs in real metres so the grain keeps
 * one scale across every part. Faces that lie flat get their grain turned to
 * run along the width — a worktop's grain runs its length.
 */
function board(w: number, h: number, d: number, x: number, y: number, z: number, seed = 0) {
  const geometry = new THREE.BoxGeometry(w, h, d);
  const uv = geometry.attributes.uv as THREE.BufferAttribute;
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z; four vertices each.
  const spans: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  const r = rng(seed * 977 + 13);
  const ou = r() * 4;
  const ov = r() * 4;
  for (let face = 0; face < 6; face++) {
    const [su, sv] = spans[face]!;
    for (let k = 0; k < 4; k++) {
      const i = face * 4 + k;
      let u = uv.getX(i) * su;
      let v = uv.getY(i) * sv;
      if (face === 2 || face === 3) [u, v] = [v, u];
      uv.setXY(i, u / GRAIN_TILE.u + ou, v / GRAIN_TILE.v + ov);
    }
  }
  geometry.translate(x, y, z);
  return geometry;
}

/** A flat plane facing +z, as a box-compatible indexed geometry. */
function plane(w: number, h: number, x: number, y: number, z: number) {
  const geometry = new THREE.PlaneGeometry(w, h);
  geometry.translate(x, y, z);
  return geometry;
}

/** Vertex-coloured, non-indexed — so props of any shape merge into one mesh. */
function tinted(geometry: THREE.BufferGeometry, color: string) {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  const c = new THREE.Color(color);
  const count = flat.attributes.position!.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) colors.set([c.r, c.g, c.b], i * 3);
  flat.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return flat;
}

function merge(parts: THREE.BufferGeometry[]) {
  const merged = mergeGeometries(parts, false)!;
  parts.forEach((part) => part.dispose());
  return merged;
}

function plant(x: number, y: number, z: number, seed: number, scale = 1) {
  const r = rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  const pot = new THREE.CylinderGeometry(0.062 * scale, 0.048 * scale, 0.12 * scale, 20);
  pot.translate(x, y + 0.06 * scale, z);
  parts.push(tinted(pot, "#E9E4DA"));
  for (let i = 0; i < 14; i++) {
    const leaf = new THREE.IcosahedronGeometry((0.032 + r() * 0.02) * scale, 0);
    const a = r() * Math.PI * 2;
    const rad = r() * 0.07 * scale;
    leaf.scale(1, 0.6, 1);
    leaf.rotateZ(r() * Math.PI);
    leaf.translate(
      x + Math.cos(a) * rad,
      y + (0.15 + r() * 0.1) * scale,
      z + Math.sin(a) * rad,
    );
    parts.push(tinted(leaf, r() > 0.5 ? "#4F6E3B" : "#6A8A48"));
  }
  return parts;
}

function bookStack(x: number, y: number, z: number, colors: string[], seed: number) {
  const r = rng(seed);
  let top = y;
  return colors.map((color) => {
    const h = 0.026 + r() * 0.012;
    const w = 0.17 + r() * 0.05;
    const book = new THREE.BoxGeometry(w, h, 0.13 + r() * 0.03);
    book.rotateY((r() - 0.5) * 0.12);
    book.translate(x + (r() - 0.5) * 0.015, top + h / 2, z);
    top += h;
    return tinted(book, color);
  });
}

function bookRow(x: number, y: number, z: number, colors: string[], seed: number) {
  const r = rng(seed);
  let left = x;
  return colors.map((color) => {
    const w = 0.022 + r() * 0.016;
    const h = 0.19 + r() * 0.05;
    const book = new THREE.BoxGeometry(w, h, 0.15);
    book.translate(left + w / 2, y + h / 2, z);
    left += w + 0.002;
    return tinted(book, color);
  });
}

// ── The fire ───────────────────────────────────────────────────────────────
const FIRE_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FIRE_FRAGMENT = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
// No sin(): its precision varies by GPU and shows up as blocky noise cells.
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
// One row of flame tongues, "count" across the box, each with its own height,
// sway and flicker. Returns (mask, how far up its own tongue this pixel is).
vec2 tongues(vec2 uv, float count, float seed) {
  float x = uv.x * count + seed;
  float id = floor(x);
  float r = hash(vec2(id, seed));
  float base = 0.4;
  float lick = noise(vec2(id * 0.71 + seed, uTime * (0.7 + r * 0.6)));
  float tip = base + 0.05 + 0.26 * lick * lick;
  float t = (uv.y - base) / (tip - base);
  float tc = clamp(t, 0.0, 1.0);
  float fx = fract(x) - 0.5 + 0.08 * sin(uTime * (2.2 + r * 2.0) + uv.y * 10.0 + r * 6.28) * tc;
  float w = max(0.4 * pow(1.0 - tc, 0.75), 0.001);
  float m = smoothstep(w, w * 0.15, abs(fx)) * smoothstep(base - 0.14, base - 0.02, uv.y) * (1.0 - step(1.0, t));
  return vec2(m * (1.0 - tc * 0.45), tc);
}

void main() {
  vec2 uv = vUv;
  float h = uv.y;
  float ends = smoothstep(0.0, 0.04, uv.x) * smoothstep(1.0, 0.96, uv.x);

  // Ember bed: crushed red coals along the bottom, breathing slowly.
  float bed = smoothstep(0.55, 0.36, h);
  float coal = fbm(vec2(uv.x * 70.0, h * 16.0));
  float breathe = 0.65 + 0.35 * noise(vec2(uv.x * 14.0, uTime * 0.7));
  vec3 bedCol = mix(vec3(0.42, 0.04, 0.0), vec3(1.0, 0.30, 0.05), smoothstep(0.34, 0.66, coal));
  bedCol += vec3(1.0, 0.62, 0.2) * smoothstep(0.68, 0.84, coal) * 0.6;
  // Logs: dark lozenges lying in the bed.
  float logBand = smoothstep(0.5, 0.4, h) * smoothstep(0.12, 0.22, h);
  float logN = noise(vec2(uv.x * 8.0 + 2.0, h * 4.0));
  float logs = smoothstep(0.6, 0.66, logN) * logBand;
  // Charred logs glow along the edges where they meet the coals.
  float rim = smoothstep(0.42, 0.6, logN) * (1.0 - logs) * logBand;

  // Flames: two rows of tongues, broken up by a fast flicker.
  vec2 a = tongues(uv, 28.0, 0.0);
  vec2 b = tongues(uv, 17.0, 3.7);
  float flame = min(a.x + b.x * 0.8, 1.0);
  float up = (a.x * a.y + b.x * b.y) / max(a.x + b.x, 0.001);
  flame *= (0.7 + 0.4 * noise(vec2(uv.x * 34.0, h * 7.0 - uTime * 4.0))) * ends;

  vec3 col = vec3(0.012, 0.006, 0.004);
  col += bedCol * bed * breathe * ends;
  col += vec3(1.0, 0.36, 0.06) * rim * 0.45 * ends;
  col = mix(col, vec3(0.05, 0.022, 0.014), logs * 0.9);
  vec3 flameCol = mix(vec3(1.0, 0.74, 0.32), vec3(1.0, 0.4, 0.04), smoothstep(0.0, 0.55, up));
  flameCol = mix(flameCol, vec3(0.85, 0.16, 0.02), smoothstep(0.6, 1.0, up));
  col += flameCol * clamp(flame, 0.0, 1.0) * 1.0;
  gl_FragColor = vec4(col, 1.0);
}`;

// ── The unit ───────────────────────────────────────────────────────────────
function useWall() {
  return useMemo(() => {
    const textures = {
      // Fox Grey Tossini Elm — the carcass, back panel and tower backs.
      fox: woodTexture("#7C6858", "#4A3A2E", "#A58F7A", 11),
      // Grain Carbon Frozen Wood — TV panel, tower frames, worktop, slats.
      carbon: woodTexture("#4A3B30", "#251B15", "#6E5948", 23),
      // The lighter grey elm on the doors.
      door: woodTexture("#B5A897", "#7F7263", "#D3C8B9", 37),
      carpet: carpetTexture(),
      halo: haloTexture(PANEL.w + 0.7, PANEL.h + 0.7),
      wash: washTexture(),
      cone: coneTexture(),
      screen: screenTexture(),
    };

    const carbon: THREE.BufferGeometry[] = [];
    const fox: THREE.BufferGeometry[] = [];
    const black: THREE.BufferGeometry[] = [];
    let seed = 1;

    for (const s of [-1, 1]) {
      // ── Tower: chunky inner side and end frame, top, shelves, recessed kick.
      carbon.push(board(FR, TOP, TOWER_D, s * (SB + FR / 2), TOP / 2, TOWER_D / 2, seed++));
      carbon.push(board(FR, TOP, TOWER_D, s * (SB + FR + TW + FR / 2), TOP / 2, TOWER_D / 2, seed++));
      carbon.push(board(TW, FR, TOWER_D, s * TX, TOP - FR / 2, TOWER_D / 2, seed++));
      for (const y of TOWER_SHELVES) {
        carbon.push(board(TW, SH, TOWER_D - 0.012, s * TX, y - SH / 2, (TOWER_D - 0.012) / 2 + 0.012, seed++));
      }
      black.push(board(TW, 0.08, T, s * TX, 0.04, TOWER_D - 0.03));
      fox.push(board(TW, TOP, T, s * TX, TOP / 2, T / 2, seed++));

      // ── Side base carcass: back, bottom, a shelf; the divider to the fire bay.
      const bx = s * (CB + BAY / 2);
      fox.push(board(BAY, 0.48, T, bx, T + 0.24, T / 2, seed++));
      fox.push(board(BAY, T, BASE_D - T, bx, T * 1.5, BASE_D / 2, seed++));
      fox.push(board(BAY - 2 * T, T, BASE_D - 0.06, bx, 0.255, (BASE_D - 0.06) / 2 + T, seed++));
      fox.push(board(T, 0.48, BASE_D - T, s * (CB - T / 2), T + 0.24, BASE_D / 2 - T / 2, seed++));
      black.push(board(BAY, T, T, bx, T / 2, BASE_D - 0.03));

      // ── Worktop, in two lengths meeting on the centre line.
      carbon.push(board(SB - 0.001, T, BASE_D + 0.01, s * (SB / 2 + 0.0005), WT - T / 2, (BASE_D + 0.01) / 2, seed++));
    }

    // ── Back panel and the stood-off TV panel.
    fox.push(board(2 * SB, TOP - WT, T, 0, (TOP + WT) / 2, T / 2, seed++));
    carbon.push(board(PANEL.w, PANEL.h, T, 0, PANEL.y + PANEL.h / 2, PANEL.z + T / 2, seed++));
    // The stand-off frame behind it, visible from an angle.
    black.push(board(PANEL.w - 0.12, PANEL.h - 0.12, PANEL.z - T, 0, PANEL.y + PANEL.h / 2, T + (PANEL.z - T) / 2));

    // ── Centre bay: soundbar shelf, the open slot behind it, the fire box.
    fox.push(board(2 * CB, 0.5, T, 0, 0.25, T / 2, seed++));
    fox.push(board(2 * CB, T, BASE_D - T, 0, SHELF_Y + T / 2, BASE_D / 2 + T / 2, seed++));
    const fz = BASE_D - T / 2;
    const fy = FIRE.y + FIRE.h / 2;
    black.push(board(FIRE.w, 0.022, T, 0, FIRE.y + FIRE.h - 0.011, fz));
    black.push(board(FIRE.w, 0.022, T, 0, FIRE.y + 0.011, fz));
    black.push(board(0.022, FIRE.h, T, -FIRE.w / 2 + 0.011, fy, fz));
    black.push(board(0.022, FIRE.h, T, FIRE.w / 2 - 0.011, fy, fz));
    black.push(board(FIRE.w, FIRE.h, T, 0, fy, 0.09)); // firebox back
    black.push(board(2 * CB, T, BASE_D - 0.03, 0, T / 2, (BASE_D - 0.03) / 2)); // plinth

    // ── TV: bezel and wall bracket.
    black.push(board(TV.w, TV.h, 0.03, 0, PANEL.y + PANEL.h / 2, PANEL.z + T + 0.015));

    // ── LEDs: tower edge strips, pucks, bulkhead strip, the halo strip.
    const leds: THREE.BufferGeometry[] = [];
    for (const s of [-1, 1]) {
      for (const x of [SB + FR + 0.003, SB + FR + TW - 0.003]) {
        leds.push(board(0.005, TOP - 0.12, 0.007, s * x, TOP / 2 + 0.02, TOWER_D - 0.02));
      }
      for (const y of [...TOWER_SHELVES.slice(1).map((top) => top - SH), TOP - FR]) {
        const puck = new THREE.CylinderGeometry(0.024, 0.024, 0.004, 18);
        puck.translate(s * TX, y - 0.002, TOWER_D * 0.55);
        leds.push(puck);
      }
    }
    leds.push(board(2 * SB, 0.008, 0.012, 0, TOP - 0.006, 0.035));

    // ── Additive glows. All share material settings; one mesh per texture.
    const cones: THREE.BufferGeometry[] = [];
    for (const s of [-1, 1]) {
      const roofs = [...TOWER_SHELVES.slice(1).map((top) => top - SH), TOP - FR];
      TOWER_SHELVES.forEach((shelf, i) => {
        const roof = roofs[i]!;
        const h = roof - shelf;
        cones.push(plane(TW, h, s * TX, shelf + h / 2, T + 0.001));
      });
    }

    // ── Props: sparse, and only what the finished job carried.
    const props = [
      ...plant(-1.13, WT, 0.15, 3),
      ...plant(1.13, WT, 0.15, 5),
      // Left tower, top down: plant, books, a slim stack, books.
      ...plant(-TX, TOWER_SHELVES[3]!, 0.17, 9, 1.05),
      ...bookStack(-TX, TOWER_SHELVES[2]!, 0.16, ["#E6DFD2", "#3A3634", "#B9A88E"], 21),
      ...bookStack(-TX, TOWER_SHELVES[1]!, 0.16, ["#2B2B2A", "#D9D0BF"], 24),
      ...bookStack(-TX, TOWER_SHELVES[0]!, 0.16, ["#C9B79B", "#2E3A37", "#E6DFD2", "#8E7B62"], 22),
      // Right tower: plant, upright books, the glass bauble (below), plant.
      ...plant(TX, TOWER_SHELVES[3]!, 0.17, 12, 1.05),
      ...bookRow(TX - 0.08, TOWER_SHELVES[2]!, 0.15, ["#1E2426", "#2B2B2A", "#1F2A33", "#3B3B39", "#2A2622", "#20262B"], 23),
      ...plant(TX, TOWER_SHELVES[0]!, 0.17, 15, 0.9),
      tinted(board(0.22, 0.05, 0.2, 0, WT + 0.025, 0.13), "#B8B6B1"), // AV box
      tinted(board(0.98, 0.07, 0.1, 0, SHELF_Y + T + 0.035, 0.12), "#141414"), // soundbar
    ];

    const room = [
      tinted(board(ROOM_W, 0.1, BULK_D, 0, TOP + 0.05, BULK_D / 2), "#E2DCD0"),
      tinted(board(ROOM_W, 0.11, 0.016, 0, 0.055, 0.008), "#E4DED2"),
    ];

    const geometries = {
      carbon: merge(carbon),
      fox: merge(fox),
      black: merge(black),
      leds: merge(leds.map((g) => (g.index ? g.toNonIndexed() : g))),
      cones: merge(cones),
      props: merge(props),
      room: merge(room),
    };

    // ── Doors: four, push-to-open, each two slabs with the split line between.
    const doors = [-1, 1].flatMap((s) =>
      [0, 1].map((leaf) => {
        // Each pair meets in the middle of its bay and hinges outward.
        const outer = leaf === 0 ? s * (SB - 0.002) : s * (CB + 0.002);
        const dir = leaf === 0 ? -s : s;
        const cx = dir * (DOOR.w / 2);
        const lower = DOOR.h - DOOR.split - 0.004;
        const geometry = merge([
          board(DOOR.w, lower, T, cx, DOOR.y + lower / 2, T / 2, seed++),
          board(DOOR.w, DOOR.split, T, cx, DOOR.y + DOOR.h - DOOR.split / 2, T / 2, seed++),
        ]);
        // dir = +1 means the leaf extends to the right of its hinge.
        return { hingeX: outer, geometry, swing: dir > 0 ? -1 : 1 };
      }),
    );

    return { textures, geometries, doors };
  }, []);
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
  const { textures, geometries, doors } = useWall();
  const doorRefs = useRef<(Group | null)[]>([]);
  const openRef = useRef(0);
  const fireRef = useRef<ShaderMaterial>(null);
  const fireLightRef = useRef<PointLight>(null);
  const fireUniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useEffect(
    () => () => {
      Object.values(textures).forEach((texture) => texture.dispose());
      Object.values(geometries).forEach((geometry) => geometry.dispose());
      doors.forEach((door) => door.geometry.dispose());
    },
    [textures, geometries, doors],
  );

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
    const targetX = view.targetX ?? 0;

    const targetPosition = new THREE.Vector3(
      targetX + r * Math.sin(polar) * Math.sin(azimuth),
      r * Math.cos(polar) + view.targetY,
      r * Math.sin(polar) * Math.cos(azimuth),
    );
    state.camera.position.lerp(targetPosition, ease);
    state.camera.lookAt(targetX, view.targetY, 0);

    openRef.current += (target - openRef.current) * (showcase ? ease * 0.3 : ease);
    doorRefs.current.forEach((door, index) => {
      if (door) door.rotation.y = doors[index]!.swing * openRef.current * 1.3;
    });

    if (fireRef.current) fireRef.current.uniforms.uTime!.value = time;
    if (fireLightRef.current) {
      const flicker = Math.sin(time * 7.3) * 0.5 + Math.sin(time * 13.1 + 1.7) * 0.3 + Math.sin(time * 3.1) * 0.4;
      fireLightRef.current.intensity = 1.1 + flicker * 0.12;
    }
  });

  return (
    <group>
      {/* ── Room shell ── a 9m room, so no turn of the camera finds its edge.
          Single-sided planes facing in: from outside the room they vanish. */}
      <mesh position={[0, 1.4, WALL_Z - 0.002]}>
        <planeGeometry args={[ROOM_W, 9]} />
        <meshStandardMaterial color="#B1ACA4" roughness={0.96} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (ROOM_W / 2), 1.4, WALL_Z + 5]} rotation={[0, -s * (Math.PI / 2), 0]}>
          <planeGeometry args={[10, 9]} />
          <meshStandardMaterial color="#A6A19A" roughness={0.96} />
        </mesh>
      ))}
      <mesh position={[0, FLOOR_Y, WALL_Z + 5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ROOM_W, 10]} />
        <meshStandardMaterial map={textures.carpet} roughness={1} />
      </mesh>
      <mesh position={[0, FLOOR_Y + CEIL, WALL_Z + 5]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ROOM_W, 10]} />
        <meshStandardMaterial color="#D9D3C7" emissive="#5E554A" roughness={0.97} />
      </mesh>

      <group position={[0, FLOOR_Y, WALL_Z]}>
        <mesh geometry={geometries.room}>
          <meshStandardMaterial vertexColors roughness={0.95} />
        </mesh>

        <mesh geometry={geometries.carbon}>
          <meshStandardMaterial map={textures.carbon} roughness={0.62} />
        </mesh>
        <mesh geometry={geometries.fox}>
          <meshStandardMaterial map={textures.fox} roughness={0.66} />
        </mesh>
        <mesh geometry={geometries.black}>
          <meshStandardMaterial color="#0C0C0C" roughness={0.45} />
        </mesh>

        {/* Screen, dead and glossy */}
        <mesh position={[0, PANEL.y + PANEL.h / 2, PANEL.z + T + 0.0305]}>
          <planeGeometry args={[TV.w - 0.016, TV.h - 0.016]} />
          <meshBasicMaterial map={textures.screen} />
        </mesh>

        {/* Linear fire */}
        {/* Close behind the glass, so the ember bed reads over the frame */}
        <mesh position={[0, FIRE.y + FIRE.h / 2, BASE_D - 0.05]}>
          <planeGeometry args={[FIRE.w - 0.04, FIRE.h - 0.04]} />
          <shaderMaterial
            ref={fireRef}
            vertexShader={FIRE_VERTEX}
            fragmentShader={FIRE_FRAGMENT}
            uniforms={fireUniforms}
          />
        </mesh>
        {/* Black glass in front of the fire: darkens it and catches the room */}
        <mesh position={[0, FIRE.y + FIRE.h / 2, BASE_D - 0.006]}>
          <planeGeometry args={[FIRE.w - 0.044, FIRE.h - 0.044]} />
          <meshBasicMaterial map={textures.screen} transparent opacity={0.38} depthWrite={false} />
        </mesh>
        <pointLight
          ref={fireLightRef}
          position={[0, 0.2, 0.55]}
          intensity={1.1}
          distance={2.6}
          color="#FF8A3D"
        />

        {/* LEDs and their glow */}
        <mesh geometry={geometries.leds}>
          <meshBasicMaterial color={LED} toneMapped={false} />
        </mesh>
        <mesh position={[0, PANEL.y + PANEL.h / 2, PANEL.z - 0.012]}>
          <planeGeometry args={[PANEL.w + 0.7, PANEL.h + 0.7]} />
          <meshBasicMaterial
            map={textures.halo}
            color={LED_WARM}
            blending={THREE.AdditiveBlending}
            transparent
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <mesh position={[0, TOP - 0.4, 0.032]}>
          <planeGeometry args={[2 * SB, 0.8]} />
          <meshBasicMaterial
            map={textures.wash}
            color={LED_WARM}
            opacity={0.6}
            blending={THREE.AdditiveBlending}
            transparent
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <mesh geometry={geometries.cones}>
          <meshBasicMaterial
            map={textures.cone}
            color={LED_WARM}
            opacity={0.9}
            blending={THREE.AdditiveBlending}
            transparent
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        {[-1, 1].map((s) => (
          <pointLight
            key={s}
            position={[s * TX, 1.5, 0.22]}
            intensity={0.55}
            distance={1.8}
            color={LED_WARM}
          />
        ))}

        <mesh geometry={geometries.props}>
          <meshStandardMaterial vertexColors roughness={0.72} />
        </mesh>
        <mesh position={[TX, TOWER_SHELVES[1]! + 0.075, 0.16]}>
          <sphereGeometry args={[0.075, 24, 16]} />
          <meshStandardMaterial color="#E9B979" roughness={0.12} transparent opacity={0.55} />
        </mesh>

        {/* Doors */}
        {doors.map((door, index) => (
          <group
            key={door.hingeX}
            ref={(node) => {
              doorRefs.current[index] = node;
            }}
            position={[door.hingeX, 0, BASE_D - T]}
          >
            <mesh geometry={door.geometry}>
              <meshStandardMaterial map={textures.door} roughness={0.58} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

export default function MediaWallScene({
  view,
  orbitRef,
  doorsOpen,
  showcase = false,
  onReady,
}: {
  view: Viewpoint;
  orbitRef: RefObject<OrbitState>;
  doorsOpen: boolean;
  showcase?: boolean;
  /** Called once the first frame is on screen. */
  onReady?: () => void;
}) {
  return (
    <Canvas
      onCreated={() => requestAnimationFrame(() => onReady?.())}
      camera={{ position: [0, 0, 6.2], fov: 36 }}
      dpr={showcase ? [1, 1.2] : [1, 1.75]}
      gl={{ antialias: true, alpha: true }}
    >
      <hemisphereLight args={["#F4E6D2", "#3E362F", 0.75]} />
      <directionalLight position={[2.5, 3.5, 6]} intensity={0.9} color="#FFF1DE" />
      <directionalLight position={[-4, 1, 3]} intensity={0.2} color="#FFE2BF" />
      <MediaWall view={view} orbitRef={orbitRef} doorsOpen={doorsOpen} showcase={showcase} />
    </Canvas>
  );
}
