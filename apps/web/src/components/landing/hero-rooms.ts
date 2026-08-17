// Data model for the Hero v3 multi-room scroll sequence
// (HeroSequence.tsx). Three independent 144-frame room sequences connected
// by two real transition videos — replaces the single continuous
// 97-frame model in the old hero-scenes.ts.

export interface GlassBlock {
  /** Corner/edge anchor for the floating card. */
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center-left";
  eyebrow: string;
  heading: string;
  body: string;
}

export interface HeroRoom {
  id: "mediawall" | "kitchen" | "bedroom";
  /** Display label used in the progress dots. */
  label: string;
  /** public/frames/hero/{framesDir}/frame_0001.webp..frame_0144.webp */
  framesDir: string;
  frameCount: number;
  /** Floating glassmorphism cards shown while paused on this room's last frame. */
  glassBlocks: GlassBlock[];
}

export interface HeroTransition {
  id: "mediawall-to-kitchen" | "kitchen-to-bedroom";
  /** public/videos/hero/{file} */
  file: string;
  fromRoomId: HeroRoom["id"];
  toRoomId: HeroRoom["id"];
}

export const FRAME_COUNT = 144;

export const HERO_ROOMS: HeroRoom[] = [
  {
    id: "mediawall",
    label: "Media Wall",
    framesDir: "mediawall",
    frameCount: FRAME_COUNT,
    glassBlocks: [
      {
        position: "top-left",
        eyebrow: "01 — The Anchor",
        heading: "A Bespoke Media Wall",
        body: "Hand-jointed timber and hidden cable runs, built around the fireplace to your exact room.",
      },
      {
        position: "bottom-right",
        eyebrow: "Integrated Detail",
        heading: "Lighting, Built In",
        body: "Every recess and shadow gap planned before a single panel is cut.",
      },
    ],
  },
  {
    id: "kitchen",
    label: "Kitchen",
    framesDir: "kitchen",
    frameCount: FRAME_COUNT,
    glassBlocks: [
      {
        position: "top-right",
        eyebrow: "02 — The Heart of the Home",
        heading: "A Kitchen Built to Live In",
        body: "Cabinetry, worktops and storage designed around how you actually cook and gather.",
      },
      {
        position: "bottom-left",
        eyebrow: "Fitted, Not Off-the-Shelf",
        heading: "Every Inch Accounted For",
        body: "From corner units to appliance housings — nothing wasted, nothing generic.",
      },
    ],
  },
  {
    id: "bedroom",
    label: "Bedroom",
    framesDir: "bedroom",
    frameCount: FRAME_COUNT,
    glassBlocks: [
      {
        position: "top-left",
        eyebrow: "03 — The Reveal",
        heading: "A Bedroom That Feels Finished",
        body: "Fitted wardrobes and considered styling — the last room in the story, not an afterthought.",
      },
      {
        position: "bottom-right",
        eyebrow: "Crafted in Leicester",
        heading: "From Empty Shell to Home",
        body: "This is what thoughtful, bespoke design can do with the right space.",
      },
    ],
  },
];

export const HERO_TRANSITIONS: HeroTransition[] = [
  {
    id: "mediawall-to-kitchen",
    file: "mediawall-to-kitchen.mp4",
    fromRoomId: "mediawall",
    toRoomId: "kitchen",
  },
  {
    id: "kitchen-to-bedroom",
    file: "kitchen-to-bedroom.mp4",
    fromRoomId: "kitchen",
    toRoomId: "bedroom",
  },
];

export function roomFrameUrl(room: HeroRoom, frameIndex1: number): string {
  return `/frames/hero/${room.framesDir}/frame_${String(frameIndex1).padStart(4, "0")}.webp`;
}

export function transitionVideoUrl(transition: HeroTransition): string {
  return `/videos/hero/${transition.file}`;
}
