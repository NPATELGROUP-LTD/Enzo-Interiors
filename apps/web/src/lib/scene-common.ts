// What the two three.js scenes agree on.
//
// The landing page's media-wall viewer (components/landing/MediaWallScene)
// and the service pages' model viewer (components/services/service-detail/
// model/scene/sceneKit) are separate scenes with separate geometry, but they
// are the same product photographed twice: the same materials, the same
// camera vocabulary, the same limits on what a visitor may do to the view.
// Both files carried their own copy of all of it and had already started to
// drift — one had a colour the other lacked, in both directions.
//
// Plain values and types only: no React, no three. Either scene can import
// this without pulling the other's machinery into its bundle, which is why
// this lives here rather than one scene importing the other.

// ── The palette ──
// Every finish either viewer can render. Both scenes draw from the whole set;
// a colour used by only one today is still the brand's colour, not that
// file's.
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
export const LINEN_DEEP = "#AEA391";
export const CLAY = "#A8785E";
export const CHARCOAL = "#3B3B39";
export const STONE = "#E6E0D2";

/** A named camera position a viewer can jump to. */
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

/**
 * Live camera offsets, written directly by the viewer's pointer/keyboard
 * handlers and read by the render loop — never through React state, so
 * turning the model costs no renders.
 *
 * All three are *offsets from the current viewpoint*, not absolute values.
 * `zoom` is a multiplier on the viewpoint's own radius rather than a distance,
 * so a viewpoint set close to the unit and one set across the room both zoom
 * by the same proportion and neither can be pushed through the wall.
 */
export interface OrbitState {
  azimuth: number;
  polar: number;
  zoom: number;
}

/**
 * How far the visitor may turn the unit off its viewpoint, in radians.
 *
 * Clamped, and this is the fix for the single most confusing thing the old
 * viewer did: azimuth was unbounded, so a long drag walked the camera round
 * behind the wall and left you looking at the *back* of a plasterboard plane
 * with the joinery hidden — no error, no way to tell what had happened, and
 * "Recentre" the only way out. Every one of these units is a run fixed to a
 * wall; there is nothing behind it to see. Just over a quarter-turn each way
 * is enough to read the depth of a return without ever leaving the room.
 */
export const AZIMUTH_LIMIT = 0.95;
/** Multiplier bounds on a viewpoint's radius. */
export const ZOOM_MIN = 0.62;
export const ZOOM_MAX = 1.35;

/** The rest state — also what "recentre" restores. */
export function neutralOrbit(): OrbitState {
  return { azimuth: 0, polar: 0, zoom: 1 };
}
