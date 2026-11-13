import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { bottomOf, runs, type Plan, type PlanWall, type UnitTemplate } from './plan';

/* Loaded on demand (React.lazy) so three.js stays out of the main bundle. Boxes at the true sizes and
   colours, with the walls, the floor, door and drawer lines and soft shadows; no photoreal rendering
   (CLAUDE.md: browser-only, nothing rendered on a server). It fills whatever box the parent gives it. */

const M = 0.001; // mm -> metres
const WORKTOP_MM = 38;
const GALLEY_GAP = 2400;
const LINE = '#2b2b28';

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

/** Everything that changes the room's shape (not what stands in it): the camera is only refitted when this does. */
const roomKey = (plan: Plan) => JSON.stringify([plan.layout, plan.height_mm, plan.walls.map((w) => w.length_mm), plan.island?.length_mm ?? 0]);

const free = (o: THREE.Object3D) => {
  if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
    o.geometry.dispose();
    (o.material as THREE.Material).dispose();
  }
};

export default function Preview3D({
  plan,
  templates,
  colourOf,
  hint = true,
}: {
  plan: Plan;
  templates: Map<string, UnitTemplate>;
  colourOf: (unit: PlanWall['units'][number], template: UnitTemplate) => string | null;
  hint?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<{ render: () => void; group: THREE.Group; fit: (box: THREE.Box3, refit: boolean) => void } | null>(null);
  const fitted = useRef('');

  // One renderer for the component's life; the plan only rebuilds the boxes.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-hidden', 'true');
    const world = new THREE.Scene();
    world.add(new THREE.HemisphereLight(0xffffff, 0x8a8170, 1.25));
    const sun = new THREE.DirectionalLight(0xffffff, 1.9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.radius = 5;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.01;
    world.add(sun, sun.target);
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
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      render();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    const fit = (box: THREE.Box3, refit: boolean) => {
      const centre = box.getCenter(new THREE.Vector3());
      const radius = box.getSize(new THREE.Vector3()).length() / 2 || 1.5;
      sun.position.set(centre.x - radius * 0.6, centre.y + radius * 1.6, centre.z + radius * 0.9);
      sun.target.position.copy(centre);
      const cam = sun.shadow.camera;
      cam.left = cam.bottom = -radius * 1.3;
      cam.right = cam.top = radius * 1.3;
      cam.near = 0.1;
      cam.far = radius * 6;
      cam.updateProjectionMatrix();
      if (refit) {
        const vertical = THREE.MathUtils.degToRad(camera.fov) / 2;
        const horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
        const distance = (radius / Math.sin(Math.min(vertical, horizontal))) * 0.72;
        // From the open corner of the room (wall A's left, away from it), looking down: every run faces it.
        const direction = new THREE.Vector3(-0.22, 0.5, 0.9).normalize();
        controls.target.copy(centre);
        camera.position.copy(centre).addScaledVector(direction, distance);
        controls.update();
      }
      render();
    };
    scene.current = { render, group, fit };
    resize();
    return () => {
      observer.disconnect();
      controls.dispose();
      group.traverse(free);
      sun.shadow.map?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      scene.current = null;
      fitted.current = '';
    };
  }, []);

  useEffect(() => {
    const s = scene.current;
    if (!s) return;
    s.group.traverse(free);
    s.group.clear();

    /** A box at (x along, y up, z out from the wall) in the run's own frame, `z` being its centre. */
    const box = (w: number, h: number, d: number, colour: THREE.ColorRepresentation, frame: Frame, x: number, y: number, z: number, edges = true) => {
      const geometry = new THREE.BoxGeometry(w * M, h * M, d * M);
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: colour, roughness: 0.7 }));
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.position.copy(frame.origin).addScaledVector(frame.along, x * M).addScaledVector(frame.inward, z * M);
      mesh.position.y = y * M;
      mesh.rotation.y = Math.atan2(-frame.along.z, frame.along.x);
      if (edges) {
        const outline = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: LINE, transparent: true, opacity: 0.35 }));
        mesh.add(outline);
      }
      s.group.add(mesh);
    };
    /** A thin dark line proud of a front face: a door split or a drawer edge. */
    const line = (w: number, h: number, frame: Frame, x: number, y: number, depth: number) =>
      box(w, h, 3, LINE, frame, x, y, depth + 1.5, false);

    const all = frames(plan);
    runs(plan).forEach((wall, i) => {
      const frame = all[i]!;
      const isIsland = i >= plan.walls.length;
      if (!isIsland) {
        // One plane facing into the room: seen from behind it is culled, so a far wall never hides the units in front of it.
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(wall.length_mm * M, plan.height_mm * M), new THREE.MeshStandardMaterial({ color: '#faf8f3', roughness: 1 }));
        mesh.receiveShadow = true;
        mesh.position.copy(frame.origin).addScaledVector(frame.along, (wall.length_mm / 2) * M).addScaledVector(frame.inward, -0.002);
        mesh.position.y = (plan.height_mm / 2) * M;
        mesh.rotation.y = Math.atan2(-frame.along.z, frame.along.x);
        s.group.add(mesh);
      }
      for (const unit of wall.units) {
        const template = templates.get(unit.template_id);
        const variant = template?.variants.find((v) => v.id === unit.variant_id);
        if (!template || !variant) continue;
        const { width_mm: w, height_mm: h, depth_mm: d } = variant;
        const bottom = bottomOf(template);
        const cx = unit.x_mm + w / 2;
        if (template.mount === 'gap') {
          const gap = new THREE.Mesh(new THREE.BoxGeometry((w - 10) * M, h * M, d * M), new THREE.MeshStandardMaterial({ color: '#b9b4aa', transparent: true, opacity: 0.35 }));
          gap.position.copy(frame.origin).addScaledVector(frame.along, cx * M).addScaledVector(frame.inward, (d / 2) * M);
          gap.position.y = (bottom + h / 2) * M;
          gap.rotation.y = Math.atan2(-frame.along.z, frame.along.x);
          s.group.add(gap);
          continue;
        }
        const st = template.structure;
        const plinth = st.plinth_mm;
        const front = h - plinth;
        const colour = colourOf(unit, template) ?? '#d9e4dc';
        box(w - 4, front, d, colour, frame, cx, bottom + plinth + front / 2, d / 2);
        if (plinth > 0) box(w - 4, plinth, d - 60, '#3a3a36', frame, cx, bottom + plinth / 2, (d - 60) / 2 - 0, false);
        if (st.worktop) box(w, WORKTOP_MM, d + 20, '#8d887e', frame, cx, bottom + h + WORKTOP_MM / 2, (d + 20) / 2);
        // Doors split the front evenly; drawers stack above them, each with the door area below sharing the rest.
        const frontBottom = bottom + plinth;
        for (let k = 1; k < st.doors; k += 1) line(4, front, frame, unit.x_mm + (w * k) / st.doors, frontBottom + front / 2, d);
        const rows = st.drawers + (st.doors ? 1 : 0);
        for (let k = 1; k <= st.drawers; k += 1) line(w - 4, 4, frame, cx, frontBottom + front - (front / Math.max(1, rows)) * k, d);
      }
    });
    const room = new THREE.Box3().setFromObject(s.group);
    if (room.isEmpty()) return s.render();
    const size = room.getSize(new THREE.Vector3());
    const centre = room.getCenter(new THREE.Vector3());
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(size.x + 1, size.z + 1), new THREE.MeshStandardMaterial({ color: '#d8d2c6', roughness: 1 }));
    floor.receiveShadow = true;
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(centre.x, 0, centre.z);
    s.group.add(floor);
    const key = roomKey(plan);
    const refit = fitted.current !== key;
    fitted.current = key;
    s.fit(room, refit);
  }, [plan, templates, colourOf]);

  return (
    <div className="relative h-full w-full">
      <div ref={host} className="h-full w-full cursor-grab overflow-hidden rounded-card bg-surface-muted active:cursor-grabbing [&>canvas]:h-full [&>canvas]:w-full" />
      {hint ? (
        <p className="pointer-events-none absolute inset-x-0 bottom-1.5 px-3 text-center text-xs text-ink-muted">
          Drag to turn, scroll or pinch to zoom. Sizes and colours are true; it is not a render.
        </p>
      ) : null}
    </div>
  );
}
