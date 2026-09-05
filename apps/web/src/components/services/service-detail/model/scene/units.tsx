"use client";

// The four things Enzo makes, modelled.
//
// Each unit is a real carcass rather than a facade: backs, decks, ends,
// dividers and a shelf per bay, so that when a door opens there is a genuine
// void behind it. That is the entire reason these are 3D at all — a
// photograph already shows a closed cabinet better than any renderer will,
// and the only thing a model can do that a photograph cannot is let you open
// it and look inside.
//
// Every unit takes the same `{ open, showcase }` and drives its own control
// off an eased ref, so the page never re-renders while something is moving.
import { useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";
import {
  BRASS,
  Books,
  CHARCOAL,
  CLAY,
  FLOOR_Y,
  FOREST,
  FOREST_DEEP,
  Garment,
  LINEN,
  SAGE,
  SAND,
  SCREEN,
  STONE,
  WALL_Z,
  useEasedOpen,
  usePanelGeometry,
  type UnitProps,
} from "./sceneKit";

// ───────────────────────────────────────────────────────── Bespoke Kitchens
/**
 * A run against the wall — base cabinets, worktop, upstand and open shelves —
 * with a tall bank at one end and an island in front of it. The control
 * opens the base doors and runs the island drawers out.
 */
export function KitchenRun({ open, showcase }: UnitProps) {
  const openRef = useRef(0);
  const doors = useRef<(Group | null)[]>([]);
  const drawers = useRef<(Group | null)[]>([]);
  useEasedOpen(open, showcase, openRef);

  const doorGeo = usePanelGeometry(0.56, 0.62, 0.022);
  const drawerGeo = usePanelGeometry(0.74, 0.2, 0.024);

  useFrameDoors(doors, drawers, openRef);

  const BASE_Y = FLOOR_Y + 0.44;
  const BASE_TOP = FLOOR_Y + 0.9;
  const BASE_Z = WALL_Z + 0.32;
  const DOOR_X = [-2.05, -1.45, -0.85, -0.25, 0.35];

  return (
    <group>
      {/* ── Tall bank, right-hand end ── */}
      <mesh position={[1.55, FLOOR_Y + 1.1, WALL_Z + 0.32]}>
        <boxGeometry args={[1.3, 2.2, 0.62]} />
        <meshStandardMaterial color={FOREST} roughness={0.72} />
      </mesh>
      {[-0.32, 0.32].map((dx) => (
        <mesh key={dx} position={[1.55 + dx, FLOOR_Y + 1.1, WALL_Z + 0.635]}>
          <boxGeometry args={[0.6, 2.14, 0.02]} />
          <meshStandardMaterial color={SAGE} roughness={0.5} />
        </mesh>
      ))}
      {[-0.02, 0.02].map((dx, i) => (
        <mesh key={i} position={[1.55 + dx * 8, FLOOR_Y + 1.1, WALL_Z + 0.66]}>
          <boxGeometry args={[0.016, 0.9, 0.02]} />
          <meshStandardMaterial color={BRASS} roughness={0.25} metalness={0.75} />
        </mesh>
      ))}

      {/* ── Base run carcass ── back, deck, ends and dividers, so the bays
          behind the doors are genuinely empty. ── */}
      <mesh position={[-0.85, BASE_Y, WALL_Z + 0.02]}>
        <boxGeometry args={[3.0, 0.9, 0.03]} />
        <meshStandardMaterial color={FOREST_DEEP} roughness={0.9} />
      </mesh>
      <mesh position={[-0.85, FLOOR_Y + 0.12, BASE_Z]}>
        <boxGeometry args={[3.0, 0.03, 0.6]} />
        <meshStandardMaterial color={STONE} roughness={0.94} />
      </mesh>
      {[-2.35, -1.75, -1.15, -0.55, 0.05, 0.65].map((x) => (
        <mesh key={x} position={[x, BASE_Y, BASE_Z - 0.02]}>
          <boxGeometry args={[0.022, 0.86, 0.56]} />
          <meshStandardMaterial color={STONE} roughness={0.94} />
        </mesh>
      ))}
      {DOOR_X.map((x) => (
        <mesh key={`sh-${x}`} position={[x, BASE_Y - 0.04, BASE_Z - 0.04]}>
          <boxGeometry args={[0.55, 0.02, 0.52]} />
          <meshStandardMaterial color={STONE} roughness={0.94} />
        </mesh>
      ))}
      {/* Something in two of the bays, so the void reads as storage. */}
      <mesh position={[-1.45, FLOOR_Y + 0.24, BASE_Z - 0.06]}>
        <boxGeometry args={[0.34, 0.2, 0.3]} />
        <meshStandardMaterial color={CLAY} roughness={0.82} />
      </mesh>
      <mesh position={[-0.25, FLOOR_Y + 0.22, BASE_Z - 0.06]}>
        <boxGeometry args={[0.4, 0.16, 0.3]} />
        <meshStandardMaterial color={CHARCOAL} roughness={0.45} metalness={0.3} />
      </mesh>

      {/* Doors — hinged on alternating sides so no leaf swings through its
          neighbour. */}
      {DOOR_X.map((x, i) => {
        const dir = i % 2 === 0 ? -1 : 1;
        return (
          <group
            key={x}
            ref={(node) => {
              doors.current[i] = node;
            }}
            position={[x + dir * 0.29, BASE_Y, BASE_Z + 0.3]}
            userData={{ dir }}
          >
            <mesh geometry={doorGeo} position={[-dir * 0.29, 0, 0]}>
              <meshStandardMaterial color={SAGE} roughness={0.5} />
            </mesh>
            <mesh position={[-dir * 0.52, 0.16, 0.026]}>
              <boxGeometry args={[0.018, 0.16, 0.02]} />
              <meshStandardMaterial color={BRASS} roughness={0.25} metalness={0.75} />
            </mesh>
          </group>
        );
      })}

      {/* ── Worktop and upstand ── */}
      <mesh position={[-0.85, BASE_TOP, BASE_Z + 0.01]}>
        <boxGeometry args={[3.08, 0.05, 0.66]} />
        <meshStandardMaterial color={STONE} roughness={0.32} metalness={0.05} />
      </mesh>
      <mesh position={[-0.85, BASE_TOP + 0.09, WALL_Z + 0.03]}>
        <boxGeometry args={[3.08, 0.14, 0.02]} />
        <meshStandardMaterial color={STONE} roughness={0.34} />
      </mesh>
      {/* Sink and tap. */}
      <mesh position={[-1.75, BASE_TOP + 0.005, BASE_Z + 0.02]}>
        <boxGeometry args={[0.52, 0.03, 0.4]} />
        <meshStandardMaterial color="#9AA0A0" roughness={0.28} metalness={0.7} />
      </mesh>
      <mesh position={[-1.75, BASE_TOP + 0.15, WALL_Z + 0.14]}>
        <cylinderGeometry args={[0.016, 0.016, 0.3, 12]} />
        <meshStandardMaterial color="#9AA0A0" roughness={0.22} metalness={0.85} />
      </mesh>
      {/* Hob. */}
      <mesh position={[-0.25, BASE_TOP + 0.03, BASE_Z + 0.02]}>
        <boxGeometry args={[0.58, 0.012, 0.44]} />
        <meshStandardMaterial color={SCREEN} roughness={0.2} metalness={0.4} />
      </mesh>

      {/* ── Open shelves over the run ── */}
      {[0.55, 0.9].map((y) => (
        <mesh key={y} position={[-1.45, BASE_TOP + y, WALL_Z + 0.15]}>
          <boxGeometry args={[1.9, 0.035, 0.26]} />
          <meshStandardMaterial color={SAND} roughness={0.62} />
        </mesh>
      ))}
      <Books position={[-2.15, BASE_TOP + 0.6, WALL_Z + 0.15]} />
      <mesh position={[-1.5, BASE_TOP + 0.66, WALL_Z + 0.15]}>
        <cylinderGeometry args={[0.05, 0.075, 0.2, 18]} />
        <meshStandardMaterial color={FOREST_DEEP} roughness={0.35} />
      </mesh>
      <mesh position={[-0.85, BASE_TOP + 1.0, WALL_Z + 0.15]} scale={[1, 0.5, 1]}>
        <sphereGeometry args={[0.11, 18, 12]} />
        <meshStandardMaterial color={BRASS} roughness={0.3} metalness={0.6} />
      </mesh>

      {/* ── Island, with drawers that run out ── */}
      <mesh position={[-0.4, FLOOR_Y + 0.44, 0.85]}>
        <boxGeometry args={[1.9, 0.88, 0.86]} />
        <meshStandardMaterial color={FOREST} roughness={0.72} />
      </mesh>
      <mesh position={[-0.4, FLOOR_Y + 0.91, 0.85]}>
        <boxGeometry args={[2.06, 0.06, 1.0]} />
        <meshStandardMaterial color={STONE} roughness={0.32} metalness={0.05} />
      </mesh>
      <mesh position={[-0.4, FLOOR_Y + 0.05, 0.85]}>
        <boxGeometry args={[1.76, 0.1, 0.76]} />
        <meshStandardMaterial color={FOREST_DEEP} roughness={0.9} />
      </mesh>
      {[0.26, 0.5, 0.74].map((t, i) => (
        <group
          key={t}
          ref={(node) => {
            drawers.current[i] = node;
          }}
          position={[-0.4, FLOOR_Y + 0.16 + i * 0.26, 1.29]}
        >
          <mesh geometry={drawerGeo}>
            <meshStandardMaterial color={SAGE} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0, 0.026]}>
            <boxGeometry args={[0.3, 0.016, 0.02]} />
            <meshStandardMaterial color={BRASS} roughness={0.25} metalness={0.75} />
          </mesh>
          {/* The box behind the front — visible only once it is out. */}
          <mesh position={[0, -0.02, -0.2]}>
            <boxGeometry args={[0.7, 0.14, 0.38]} />
            <meshStandardMaterial color={STONE} roughness={0.94} />
          </mesh>
        </group>
      ))}

      {/* Two stools, so the island has a scale. */}
      {[-1.0, 0.2].map((x) => (
        <group key={x} position={[x, 0, 1.75]}>
          <mesh position={[0, FLOOR_Y + 0.62, 0]}>
            <cylinderGeometry args={[0.16, 0.16, 0.05, 20]} />
            <meshStandardMaterial color={LINEN} roughness={0.85} />
          </mesh>
          <mesh position={[0, FLOOR_Y + 0.3, 0]}>
            <cylinderGeometry args={[0.03, 0.04, 0.62, 12]} />
            <meshStandardMaterial color={CHARCOAL} roughness={0.5} metalness={0.3} />
          </mesh>
        </group>
      ))}

      {/* Pendant over the island. */}
      {[-0.9, 0.1].map((x) => (
        <group key={x} position={[x, 0, 0.85]}>
          <mesh position={[0, FLOOR_Y + 1.9, 0]}>
            <cylinderGeometry args={[0.004, 0.004, 0.9, 6]} />
            <meshStandardMaterial color={CHARCOAL} />
          </mesh>
          <mesh position={[0, FLOOR_Y + 1.44, 0]}>
            <coneGeometry args={[0.13, 0.16, 20, 1, true]} />
            <meshStandardMaterial color={BRASS} roughness={0.3} metalness={0.6} side={2} />
          </mesh>
          <pointLight position={[0, FLOOR_Y + 1.3, 0]} intensity={1.4} distance={2.6} color="#F6E7C8" />
        </group>
      ))}
    </group>
  );
}

/** Doors swing, drawers run. Split out so KitchenRun stays readable. */
function useFrameDoors(
  doors: RefObject<(Group | null)[]>,
  drawers: RefObject<(Group | null)[]>,
  openRef: RefObject<number>,
) {
  useFrame(() => {
    doors.current?.forEach((door) => {
      if (!door) return;
      const dir = (door.userData.dir as number) ?? 1;
      door.rotation.y = dir * openRef.current * 1.15;
    });
    drawers.current?.forEach((drawer, i) => {
      if (!drawer) return;
      drawer.position.z = 1.29 + openRef.current * (0.34 - i * 0.05);
    });
  });
}

// ─────────────────────────────────────────────────────────── Fitted Bedrooms
/**
 * A run of full-height wardrobes with sliding fronts, a dressing bank and a
 * bed end for scale. The control slides the doors apart to show the interior:
 * hanging rails, shelves, a drawer bank and clothes on the rail.
 */
export function WardrobeRun({ open, showcase }: UnitProps) {
  const openRef = useRef(0);
  const left = useRef<Group>(null);
  const right = useRef<Group>(null);
  useEasedOpen(open, showcase, openRef);

  useFrame(() => {
    if (left.current) left.current.position.x = -0.86 - openRef.current * 0.84;
    if (right.current) right.current.position.x = 0.86 + openRef.current * 0.84;
  });

  const CARCASS_Y = FLOOR_Y + 1.15;
  const CARCASS_Z = WALL_Z + 0.31;

  return (
    <group>
      {/* Carcass: back, ends, deck, top, and four bays of internals. */}
      <mesh position={[0, CARCASS_Y, WALL_Z + 0.02]}>
        <boxGeometry args={[3.5, 2.3, 0.03]} />
        <meshStandardMaterial color={FOREST_DEEP} roughness={0.9} />
      </mesh>
      {[-1.74, 1.74].map((x) => (
        <mesh key={x} position={[x, CARCASS_Y, CARCASS_Z]}>
          <boxGeometry args={[0.03, 2.3, 0.6]} />
          <meshStandardMaterial color={FOREST} roughness={0.72} />
        </mesh>
      ))}
      <mesh position={[0, CARCASS_Y + 1.16, CARCASS_Z]}>
        <boxGeometry args={[3.5, 0.04, 0.6]} />
        <meshStandardMaterial color={FOREST} roughness={0.72} />
      </mesh>
      <mesh position={[0, FLOOR_Y + 0.02, CARCASS_Z]}>
        <boxGeometry args={[3.5, 0.04, 0.6]} />
        <meshStandardMaterial color={STONE} roughness={0.94} />
      </mesh>
      {[-0.87, 0, 0.87].map((x) => (
        <mesh key={x} position={[x, CARCASS_Y, CARCASS_Z - 0.01]}>
          <boxGeometry args={[0.022, 2.24, 0.58]} />
          <meshStandardMaterial color={STONE} roughness={0.94} />
        </mesh>
      ))}

      {/* Bay internals: rails with clothes, shelves and a drawer bank. */}
      {[-1.3, 0.44].map((x) => (
        <group key={x}>
          <mesh position={[x, FLOOR_Y + 1.6, CARCASS_Z - 0.04]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.014, 0.014, 0.8, 12]} />
            <meshStandardMaterial color={BRASS} roughness={0.28} metalness={0.7} />
          </mesh>
          {[-0.26, -0.09, 0.08, 0.25].map((dx, i) => (
            <Garment
              key={dx}
              position={[x + dx, FLOOR_Y + 1.24, CARCASS_Z - 0.04]}
              color={[LINEN, SAND, "#8E9BA6", CLAY][i] ?? LINEN}
              height={0.66}
            />
          ))}
          <mesh position={[x, FLOOR_Y + 0.62, CARCASS_Z - 0.04]}>
            <boxGeometry args={[0.82, 0.022, 0.52]} />
            <meshStandardMaterial color={STONE} roughness={0.94} />
          </mesh>
        </group>
      ))}
      {/* Drawer bank in bay 2. */}
      {[0.2, 0.44, 0.68].map((y) => (
        <mesh key={y} position={[-0.44, FLOOR_Y + y, CARCASS_Z + 0.22]}>
          <boxGeometry args={[0.78, 0.2, 0.02]} />
          <meshStandardMaterial color={SAND} roughness={0.7} />
        </mesh>
      ))}
      {/* Shelf stack in bay 4. */}
      {[0.35, 0.72, 1.09, 1.46].map((y) => (
        <mesh key={y} position={[1.3, FLOOR_Y + y, CARCASS_Z - 0.04]}>
          <boxGeometry args={[0.82, 0.022, 0.52]} />
          <meshStandardMaterial color={STONE} roughness={0.94} />
        </mesh>
      ))}
      <Books position={[1.15, FLOOR_Y + 0.75, CARCASS_Z - 0.04]} tint={SAGE} />
      <mesh position={[1.42, FLOOR_Y + 1.16, CARCASS_Z - 0.04]}>
        <boxGeometry args={[0.3, 0.12, 0.26]} />
        <meshStandardMaterial color={LINEN} roughness={0.88} />
      </mesh>

      {/* The two sliding fronts, on their track. */}
      <mesh position={[0, CARCASS_Y + 1.13, CARCASS_Z + 0.32]}>
        <boxGeometry args={[3.5, 0.03, 0.06]} />
        <meshStandardMaterial color={CHARCOAL} roughness={0.4} metalness={0.3} />
      </mesh>
      <group ref={left} position={[-0.86, CARCASS_Y, CARCASS_Z + 0.3]}>
        <mesh>
          <boxGeometry args={[1.72, 2.24, 0.03]} />
          <meshStandardMaterial color={SAGE} roughness={0.5} />
        </mesh>
        <mesh position={[0.78, 0, 0.02]}>
          <boxGeometry args={[0.02, 1.0, 0.02]} />
          <meshStandardMaterial color={BRASS} roughness={0.25} metalness={0.75} />
        </mesh>
      </group>
      <group ref={right} position={[0.86, CARCASS_Y, CARCASS_Z + 0.34]}>
        {/* Mirrored leaf — the second door on a fitted bedroom nearly always
            is, and it is what makes the two fronts readable as two.
            Metalness stays low: there is no environment map in this scene, so
            a properly metallic surface has nothing to reflect and renders as
            a black slab. A pale, barely-rough dielectric reads as glass
            under the same lights. */}
        <mesh>
          <boxGeometry args={[1.72, 2.24, 0.03]} />
          <meshStandardMaterial color="#C6D0CB" roughness={0.08} metalness={0.15} />
        </mesh>
        <mesh position={[-0.78, 0, 0.02]}>
          <boxGeometry args={[0.02, 1.0, 0.02]} />
          <meshStandardMaterial color={BRASS} roughness={0.25} metalness={0.75} />
        </mesh>
      </group>

      {/* Scale, without a wall of it. A bed here was a 1.7m-deep slab of
          one flat colour sitting across the bottom third of every shot: it
          told you the run was 2.3m tall and hid the bottom metre of it
          doing so. A bench and a lamp do the same job out of the way. */}
      <mesh position={[0, FLOOR_Y + 0.005, 1.7]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.2, 2.2]} />
        <meshStandardMaterial color={LINEN} roughness={0.95} />
      </mesh>
      <mesh position={[0, FLOOR_Y + 0.4, 1.85]}>
        <boxGeometry args={[1.5, 0.12, 0.44]} />
        <meshStandardMaterial color={SAND} roughness={0.9} />
      </mesh>
      {[-0.62, 0.62].map((x) =>
        [-0.16, 0.16].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, FLOOR_Y + 0.17, 1.85 + z]}>
            <cylinderGeometry args={[0.022, 0.022, 0.34, 10]} />
            <meshStandardMaterial color={CHARCOAL} roughness={0.5} metalness={0.3} />
          </mesh>
        )),
      )}
      <group position={[1.5, 0, 1.6]}>
        <mesh position={[0, FLOOR_Y + 0.72, 0]}>
          <cylinderGeometry args={[0.016, 0.016, 1.44, 8]} />
          <meshStandardMaterial color={CHARCOAL} roughness={0.5} metalness={0.3} />
        </mesh>
        <mesh position={[0, FLOOR_Y + 1.5, 0]}>
          <cylinderGeometry args={[0.16, 0.13, 0.24, 20, 1, true]} />
          <meshStandardMaterial color={LINEN} roughness={0.9} side={2} />
        </mesh>
        <pointLight position={[0, FLOOR_Y + 1.42, 0]} intensity={1.1} distance={2.6} color="#F6E7C8" />
      </group>
    </group>
  );
}

// ────────────────────────────────────────────────────────────── Media Walls
/**
 * A panelled wall with a screen recess, a fire slot, flank shelving and a
 * base run. The control is the lighting: cove, recess wash and fire.
 */
export function MediaWall({ open, showcase }: UnitProps) {
  const openRef = useRef(0);
  const cove = useRef<Mesh>(null);
  const fire = useRef<Mesh>(null);
  const glow = useRef<Mesh>(null);
  useEasedOpen(open, showcase, openRef);

  useFrame(() => {
    const t = openRef.current;
    const set = (mesh: Mesh | null, base: number) => {
      if (!mesh) return;
      const material = mesh.material as { emissiveIntensity?: number };
      if (material && typeof material.emissiveIntensity === "number") {
        material.emissiveIntensity = base * t;
      }
    };
    set(cove.current, 2.2);
    set(fire.current, 3.2);
    set(glow.current, 0.9);
  });

  const BASE_Y = FLOOR_Y + 0.36;

  return (
    <group>
      {/* Backboard and slatted flanks. */}
      <mesh position={[0, FLOOR_Y + 1.25, WALL_Z + 0.04]}>
        <boxGeometry args={[4.0, 2.5, 0.08]} />
        <meshStandardMaterial color={FOREST} roughness={0.72} />
      </mesh>
      {[-1.9, -1.78, -1.66, 1.66, 1.78, 1.9].map((x) => (
        <mesh key={x} position={[x, FLOOR_Y + 1.25, WALL_Z + 0.085]}>
          <boxGeometry args={[0.018, 2.4, 0.014]} />
          <meshStandardMaterial color={FOREST_DEEP} roughness={0.85} />
        </mesh>
      ))}

      {/* Screen recess. */}
      <mesh position={[0, FLOOR_Y + 1.75, WALL_Z + 0.09]}>
        <boxGeometry args={[2.1, 1.02, 0.03]} />
        <meshStandardMaterial color={FOREST_DEEP} roughness={0.92} />
      </mesh>
      <mesh position={[0, FLOOR_Y + 1.75, WALL_Z + 0.115]}>
        <boxGeometry args={[1.98, 0.92, 0.025]} />
        <meshStandardMaterial color={SCREEN} roughness={0.26} metalness={0.4} />
      </mesh>
      <mesh ref={glow} position={[0, FLOOR_Y + 1.75, WALL_Z + 0.131]}>
        <planeGeometry args={[1.92, 0.86]} />
        <meshStandardMaterial
          color={SCREEN}
          emissive="#1D2C34"
          emissiveIntensity={0}
          roughness={0.18}
        />
      </mesh>

      {/* Fire slot. */}
      <mesh position={[0, FLOOR_Y + 1.09, WALL_Z + 0.09]}>
        <boxGeometry args={[1.86, 0.22, 0.035]} />
        <meshStandardMaterial color={FOREST_DEEP} roughness={0.92} />
      </mesh>
      <mesh ref={fire} position={[0, FLOOR_Y + 1.09, WALL_Z + 0.112]}>
        <boxGeometry args={[1.76, 0.14, 0.02]} />
        <meshStandardMaterial color="#E8A25C" emissive="#EA8438" emissiveIntensity={0} />
      </mesh>

      {/* Flank shelving, clear of the recess. */}
      {[-1.55, 1.55].map((x) =>
        [2.15, 1.6, 1.05].map((y) => (
          <mesh key={`${x}-${y}`} position={[x, FLOOR_Y + y, WALL_Z + 0.2]}>
            <boxGeometry args={[0.78, 0.035, 0.28]} />
            <meshStandardMaterial color={SAND} roughness={0.62} />
          </mesh>
        )),
      )}
      <Books position={[-1.72, FLOOR_Y + 2.19, WALL_Z + 0.2]} />
      <mesh position={[-1.3, FLOOR_Y + 2.28, WALL_Z + 0.2]}>
        <cylinderGeometry args={[0.05, 0.08, 0.22, 18]} />
        <meshStandardMaterial color={FOREST_DEEP} roughness={0.35} />
      </mesh>
      <mesh position={[1.42, FLOOR_Y + 2.27, WALL_Z + 0.17]} rotation={[0, 0, 0.04]}>
        <boxGeometry args={[0.3, 0.38, 0.02]} />
        <meshStandardMaterial color={CHARCOAL} roughness={0.6} />
      </mesh>
      <mesh position={[1.62, FLOOR_Y + 1.68, WALL_Z + 0.2]} scale={[1, 0.45, 1]}>
        <sphereGeometry args={[0.11, 18, 12]} />
        <meshStandardMaterial color={BRASS} roughness={0.3} metalness={0.6} />
      </mesh>

      {/* LED cove. */}
      <mesh ref={cove} position={[0, FLOOR_Y + 2.48, WALL_Z + 0.14]}>
        <boxGeometry args={[3.7, 0.022, 0.03]} />
        <meshStandardMaterial color={SAND} emissive={SAND} emissiveIntensity={0} />
      </mesh>

      {/* Base run with a real carcass and four doors. */}
      <mesh position={[0, BASE_Y, WALL_Z + 0.02]}>
        <boxGeometry args={[4.0, 0.68, 0.03]} />
        <meshStandardMaterial color={FOREST_DEEP} roughness={0.9} />
      </mesh>
      <mesh position={[0, BASE_Y + 0.32, WALL_Z + 0.32]}>
        <boxGeometry args={[4.0, 0.04, 0.6]} />
        <meshStandardMaterial color={FOREST} roughness={0.7} />
      </mesh>
      <mesh position={[0, FLOOR_Y + 0.04, WALL_Z + 0.32]}>
        <boxGeometry args={[4.0, 0.03, 0.6]} />
        <meshStandardMaterial color={STONE} roughness={0.94} />
      </mesh>
      {[-1.0, 0, 1.0].map((x) => (
        <mesh key={x} position={[x, BASE_Y, WALL_Z + 0.31]}>
          <boxGeometry args={[0.025, 0.62, 0.56]} />
          <meshStandardMaterial color={STONE} roughness={0.94} />
        </mesh>
      ))}
      {[-1.5, -0.5, 0.5, 1.5].map((x) => (
        <mesh key={`d-${x}`} position={[x, BASE_Y, WALL_Z + 0.61]}>
          <boxGeometry args={[0.96, 0.6, 0.022]} />
          <meshStandardMaterial color={SAGE} roughness={0.5} />
        </mesh>
      ))}
      {[-1.5, -0.5, 0.5, 1.5].map((x) => (
        <mesh key={`h-${x}`} position={[x, BASE_Y + 0.2, WALL_Z + 0.63]}>
          <boxGeometry args={[0.2, 0.016, 0.02]} />
          <meshStandardMaterial color={BRASS} roughness={0.24} metalness={0.75} />
        </mesh>
      ))}

      {/* Plinth. */}
      <mesh position={[0, FLOOR_Y + 0.03, WALL_Z + 0.26]}>
        <boxGeometry args={[3.88, 0.06, 0.46]} />
        <meshStandardMaterial color={FOREST_DEEP} roughness={0.9} />
      </mesh>

      {/* Sofa back and a table, so the wall has a room in front of it. */}
      <mesh position={[0, FLOOR_Y + 0.3, 2.6]}>
        <boxGeometry args={[2.3, 0.6, 0.85]} />
        <meshStandardMaterial color={LINEN} roughness={0.95} />
      </mesh>
      <mesh position={[0, FLOOR_Y + 0.22, 1.45]}>
        <boxGeometry args={[1.2, 0.045, 0.55]} />
        <meshStandardMaterial color={CHARCOAL} roughness={0.55} />
      </mesh>
      {[-0.5, 0.5].map((x) => (
        <mesh key={x} position={[x, FLOOR_Y + 0.1, 1.45]}>
          <cylinderGeometry args={[0.02, 0.02, 0.2, 8]} />
          <meshStandardMaterial color={CHARCOAL} roughness={0.5} metalness={0.3} />
        </mesh>
      ))}

      {/* Lamps follow the control. */}
      <pointLight
        position={[0, FLOOR_Y + 1.09, 0.3]}
        intensity={open || showcase ? 2.6 : 0}
        distance={3}
        color="#F2A868"
      />
      <pointLight
        position={[0, FLOOR_Y + 2.6, -0.1]}
        intensity={open || showcase ? 1.8 : 0}
        distance={3}
        color="#F5EAD2"
      />
    </group>
  );
}

// ──────────────────────────────────────────────────────── Fitted Wardrobes
/**
 * A walk-in: two facing runs and an island drawer block. The control takes
 * the fronts off the left-hand run, which is the only way to show a
 * walk-in's interior — there is nothing to open, the whole thing is the
 * inside.
 */
export function WalkIn({ open, showcase }: UnitProps) {
  const openRef = useRef(0);
  const fronts = useRef<(Group | null)[]>([]);
  useEasedOpen(open, showcase, openRef);

  useFrame(() => {
    fronts.current?.forEach((front, i) => {
      if (!front) return;
      const t = openRef.current;
      front.position.z = 1.05 + t * (0.7 + i * 0.12);
      front.rotation.y = t * 0.5;
      const child = front.children[0] as Mesh | undefined;
      const material = child?.material as { opacity?: number; transparent?: boolean };
      if (material) {
        material.transparent = true;
        material.opacity = 1 - t * 0.72;
      }
    });
  });

  return (
    <group>
      {/* Left run — open shelving, rails and clothes. */}
      <group position={[-1.35, 0, 0.4]} rotation={[0, Math.PI / 2, 0]}>
        <RunOfBays />
      </group>
      {/* Right run — mirrored. */}
      <group position={[1.35, 0, 0.4]} rotation={[0, -Math.PI / 2, 0]}>
        <RunOfBays mirrored />
      </group>

      {/* Back wall run. */}
      <mesh position={[0, FLOOR_Y + 1.15, WALL_Z + 0.16]}>
        <boxGeometry args={[2.4, 2.3, 0.32]} />
        <meshStandardMaterial color={FOREST} roughness={0.72} />
      </mesh>
      <mesh position={[0, FLOOR_Y + 1.6, WALL_Z + 0.34]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.014, 0.014, 2.1, 12]} />
        <meshStandardMaterial color={BRASS} roughness={0.28} metalness={0.7} />
      </mesh>
      {[-0.8, -0.5, -0.2, 0.1, 0.4, 0.7].map((x, i) => (
        <Garment
          key={x}
          position={[x, FLOOR_Y + 1.24, WALL_Z + 0.34]}
          color={[LINEN, SAND, "#8E9BA6", CLAY, LINEN, SAGE][i] ?? LINEN}
          height={0.66}
        />
      ))}
      {[0.4, 0.78].map((y) => (
        <mesh key={y} position={[0, FLOOR_Y + y, WALL_Z + 0.3]}>
          <boxGeometry args={[2.3, 0.022, 0.4]} />
          <meshStandardMaterial color={STONE} roughness={0.94} />
        </mesh>
      ))}

      {/* Island drawer block with a stone top. */}
      <mesh position={[0, FLOOR_Y + 0.4, 1.35]}>
        <boxGeometry args={[1.5, 0.8, 0.72]} />
        <meshStandardMaterial color={FOREST} roughness={0.72} />
      </mesh>
      <mesh position={[0, FLOOR_Y + 0.83, 1.35]}>
        <boxGeometry args={[1.64, 0.06, 0.86]} />
        <meshStandardMaterial color={STONE} roughness={0.32} />
      </mesh>
      {[0.18, 0.42, 0.66].map((y) => (
        <group key={y}>
          <mesh position={[0, FLOOR_Y + y, 1.72]}>
            <boxGeometry args={[1.4, 0.2, 0.02]} />
            <meshStandardMaterial color={SAGE} roughness={0.5} />
          </mesh>
          <mesh position={[0, FLOOR_Y + y, 1.735]}>
            <boxGeometry args={[0.34, 0.014, 0.02]} />
            <meshStandardMaterial color={BRASS} roughness={0.25} metalness={0.75} />
          </mesh>
        </group>
      ))}

      {/* The fronts that come off the left-hand run. */}
      {[-0.5, 0.35].map((z, i) => (
        <group
          key={z}
          ref={(node) => {
            fronts.current[i] = node;
          }}
          position={[-1.35 + 0.32, FLOOR_Y + 1.15, 1.05]}
        >
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <boxGeometry args={[0.84, 2.24, 0.026]} />
            <meshStandardMaterial color={SAGE} roughness={0.5} transparent />
          </mesh>
        </group>
      ))}

      {/* Rug and a mirror at the end of the run. */}
      <mesh position={[0, FLOOR_Y + 0.005, 1.0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.0, 3.0]} />
        <meshStandardMaterial color={LINEN} roughness={0.95} />
      </mesh>
      <pointLight position={[0, FLOOR_Y + 2.3, 0.9]} intensity={1.5} distance={4} color="#F5EAD2" />
    </group>
  );
}

/** One side of the walk-in: carcass, three bays, rails, shelves, clothes. */
function RunOfBays({ mirrored = false }: { mirrored?: boolean }) {
  return (
    <group>
      <mesh position={[0, FLOOR_Y + 1.15, -0.3]}>
        <boxGeometry args={[3.0, 2.3, 0.03]} />
        <meshStandardMaterial color={FOREST_DEEP} roughness={0.9} />
      </mesh>
      <mesh position={[0, FLOOR_Y + 2.3, 0]}>
        <boxGeometry args={[3.0, 0.04, 0.6]} />
        <meshStandardMaterial color={FOREST} roughness={0.72} />
      </mesh>
      <mesh position={[0, FLOOR_Y + 0.02, 0]}>
        <boxGeometry args={[3.0, 0.04, 0.6]} />
        <meshStandardMaterial color={STONE} roughness={0.94} />
      </mesh>
      {[-1.0, 0, 1.0].map((x) => (
        <mesh key={x} position={[x, FLOOR_Y + 1.15, -0.01]}>
          <boxGeometry args={[0.022, 2.26, 0.58]} />
          <meshStandardMaterial color={STONE} roughness={0.94} />
        </mesh>
      ))}
      {[-0.5, 1.5].map((x) => (
        <group key={x}>
          <mesh position={[x, FLOOR_Y + 1.68, -0.06]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.014, 0.014, 0.94, 12]} />
            <meshStandardMaterial color={BRASS} roughness={0.28} metalness={0.7} />
          </mesh>
          {[-0.3, -0.1, 0.1, 0.3].map((dx, i) => (
            <Garment
              key={dx}
              position={[x + dx, FLOOR_Y + 1.32, -0.06]}
              color={[LINEN, SAND, CLAY, "#8E9BA6"][i] ?? LINEN}
              height={0.62}
            />
          ))}
        </group>
      ))}
      {[0.36, 0.72, 1.08, 1.44, 1.8].map((y) => (
        <mesh key={y} position={[0.5, FLOOR_Y + y, -0.06]}>
          <boxGeometry args={[0.94, 0.022, 0.5]} />
          <meshStandardMaterial color={STONE} roughness={0.94} />
        </mesh>
      ))}
      {!mirrored && <Books position={[0.3, FLOOR_Y + 0.75, -0.06]} tint={SAGE} />}
      {[-1.5, -0.5].map((x) => (
        <mesh key={`shoe-${x}`} position={[x + 0.5, FLOOR_Y + 0.3, -0.06]}>
          <boxGeometry args={[0.2, 0.1, 0.32]} />
          <meshStandardMaterial color={CHARCOAL} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

