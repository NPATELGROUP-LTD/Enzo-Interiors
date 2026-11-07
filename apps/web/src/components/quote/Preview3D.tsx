"use client";

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { bottomOf, runs, type CatalogueTemplate as UnitTemplate, type Plan, type PlanWall } from '@/lib/quote-maker';

/* Ported from the admin editor. Loaded on demand (next/dynamic, no SSR) so three.js stays out of the main bundle. Simple boxes at the true
   sizes and colours; no photoreal rendering (CLAUDE.md: browser-only, nothing rendered on a server). */

const M = 0.001; // mm -> metres
const WORKTOP_MM = 38;
const GALLEY_GAP = 2400;

interface Frame {
  origin: THREE.Vector3;
  /** Along the wall, left to right as seen standing in front of it. */
  along: THREE.Vector3;
  /** Away from the wall, into the room. */
  inward: THREE.Vector3;
}

/** Where each run sits. In an L or a U each wall's left end meets the previous wall's right end. */
function frames(plan: Plan): Frame[] {
  const [a, b] = plan.walls.map((w) => w.length_mm);
  const f = (x: number, z: number, along: [number, number], inward: [number, number]): Frame => ({
    origin: new THREE.Vector3(x * M, 0, z * M),
    along: new THREE.Vector3(along[0], 0, along[1]),
    inward: new THREE.Vector3(inward[0], 0, inward[1]),
  });
  const out: Frame[] = [f(0, 0, [1, 0], [0, 1])];
  if (plan.layout === 'galley') out.push(f(b ?? 0, GALLEY_GAP, [-1, 0], [0, -1]));
  if (plan.layout === 'L' || plan.layout === 'U') out.push(f(a ?? 0, 0, [0, 1], [-1, 0]));
  if (plan.layout === 'U') out.push(f(a ?? 0, b ?? 0, [-1, 0], [0, -1]));
  if (plan.island) {
    const depth = plan.layout === 'galley' ? GALLEY_GAP : Math.max(1800, Math.min(b ?? 2400, 4000));
    out.push(f(((a ?? 0) - plan.island.length_mm) / 2, depth / 2 + 300, [1, 0], [0, -1]));
  }
  return out;
}

export default function Preview3D({
  plan,
  templates,
  colourOf,
}: {
  plan: Plan;
  templates: Map<string, UnitTemplate>;
  colourOf: (unit: PlanWall['units'][number], template: UnitTemplate) => string | null;
}) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<{ render: () => void; group: THREE.Group; fit: (box: THREE.Box3) => void } | null>(null);

  // One renderer for the component's life; the plan only rebuilds the boxes.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-hidden', 'true');
    const world = new THREE.Scene();
    world.add(new THREE.HemisphereLight(0xffffff, 0x8a8170, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(3, 6, 5);
    world.add(sun);
    const group = new THREE.Group();
    world.add(group);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 100);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    const render = () => renderer.render(world, camera);
    controls.addEventListener('change', render);
    const resize = () => {
      const { width, height } = el.getBoundingClientRect();
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
      render();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    const fit = (box: THREE.Box3) => {
      const centre = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3()).length() || 3;
      controls.target.copy(centre);
      // From the open corner of the room (wall A's left, away from it), looking down: every run faces it.
      camera.position.set(centre.x - size * 0.35, centre.y + size * 0.7, centre.z + size * 0.85);
      controls.update();
      render();
    };
    scene.current = { render, group, fit };
    resize();
    return () => {
      observer.disconnect();
      controls.dispose();
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      scene.current = null;
    };
  }, []);

  useEffect(() => {
    const s = scene.current;
    if (!s) return;
    s.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    s.group.clear();
    const box = (w: number, h: number, d: number, colour: THREE.ColorRepresentation, frame: Frame, x: number, y: number, z: number, opacity = 1) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w * M, h * M, d * M),
        new THREE.MeshStandardMaterial({ color: colour, roughness: 0.75, transparent: opacity < 1, opacity }),
      );
      mesh.position.copy(frame.origin).addScaledVector(frame.along, x * M).addScaledVector(frame.inward, z * M);
      mesh.position.y = y * M;
      mesh.rotation.y = Math.atan2(-frame.along.z, frame.along.x);
      s.group.add(mesh);
    };

    const all = frames(plan);
    runs(plan).forEach((wall, i) => {
      const frame = all[i]!;
      const isIsland = i >= plan.walls.length;
      if (!isIsland) box(wall.length_mm, plan.height_mm, 20, '#ece8e0', frame, wall.length_mm / 2, plan.height_mm / 2, -10, 0.3);
      for (const unit of wall.units) {
        const template = templates.get(unit.template_id);
        const variant = template?.variants.find((v) => v.id === unit.variant_id);
        if (!template || !variant) continue;
        const { width_mm: w, height_mm: h, depth_mm: d } = variant;
        const bottom = bottomOf(template);
        const cx = unit.x_mm + w / 2;
        if (template.mount === 'gap') {
          box(w - 10, h, d, '#b9b4aa', frame, cx, bottom + h / 2, d / 2, 0.35);
          continue;
        }
        const plinth = template.structure.plinth_mm;
        box(w - 4, h - plinth, d, colourOf(unit, template) ?? '#d9e4dc', frame, cx, bottom + plinth + (h - plinth) / 2, d / 2);
        if (plinth > 0) box(w - 4, plinth, d - 60, '#3a3a36', frame, cx, bottom + plinth / 2, (d - 60) / 2);
        if (template.structure.worktop) box(w, WORKTOP_MM, d + 20, '#6f6a62', frame, cx, bottom + h + WORKTOP_MM / 2, (d + 20) / 2);
      }
    });
    const floor = new THREE.Box3().setFromObject(s.group);
    if (!floor.isEmpty()) {
      const size = floor.getSize(new THREE.Vector3());
      const centre = floor.getCenter(new THREE.Vector3());
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size.x + 1.5, size.z + 1.5), new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 1 }));
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(centre.x, 0, centre.z);
      s.group.add(mesh);
      s.fit(floor);
    } else s.render();
  }, [plan, templates, colourOf]);

  return (
    <div className="relative">
      <div ref={host} className="aspect-[4/3] w-full cursor-grab overflow-hidden rounded-2xl border border-border bg-card active:cursor-grabbing [&>canvas]:h-full [&>canvas]:w-full" />
      <p className="mt-2 text-[13px] text-muted-foreground">Drag to turn, scroll or pinch to zoom. A simple model at true sizes and colours, not a photo of the finished room.</p>
    </div>
  );
}
