// Data model for the Hero v3 multi-room scroll sequence
// (HeroSequence.tsx). Three independently scroll-scrubbed 144-frame room
// sequences, connected by two bespoke parallax "chapters" (no video, no
// glassmorphism cards — copy now lives inside the parallax transitions
// themselves), ending in a parallax CTA.

export interface HeroRoom {
  id: "mediawall" | "kitchen" | "bedroom";
  /** Display label used in the progress dots. */
  label: string;
  /** public/frames/hero/{framesDir}/frame_0001.webp..frame_0144.webp */
  framesDir: string;
  frameCount: number;
}

interface TransitionCopy {
  eyebrow: string;
  heading: string;
  body: string;
}

interface HeroTransition {
  id: "mediawall-to-kitchen" | "kitchen-to-bedroom";
  fromRoomId: HeroRoom["id"];
  toRoomId: HeroRoom["id"];
  copy: TransitionCopy;
}

export const FRAME_COUNT = 144;

export const HERO_ROOMS: HeroRoom[] = [
  { id: "mediawall", label: "Media Wall", framesDir: "mediawall", frameCount: FRAME_COUNT },
  { id: "kitchen", label: "Kitchen", framesDir: "kitchen", frameCount: FRAME_COUNT },
  { id: "bedroom", label: "Bedroom", framesDir: "bedroom", frameCount: FRAME_COUNT },
];

export const HERO_TRANSITIONS: HeroTransition[] = [
  {
    id: "mediawall-to-kitchen",
    fromRoomId: "mediawall",
    toRoomId: "kitchen",
    copy: {
      eyebrow: "01 → 02",
      heading: "From the Anchor, to the Heart of the Home",
      body: "Hand-jointed timber and hidden cable runs settle into place — then the story moves to where the household actually gathers.",
    },
  },
  {
    id: "kitchen-to-bedroom",
    fromRoomId: "kitchen",
    toRoomId: "bedroom",
    copy: {
      eyebrow: "02 → 03",
      heading: "From Built to Cook In, to Where the Day Ends",
      body: "The same care that shapes cabinetry and worktops carries through to the room where the household actually rests.",
    },
  },
];

export function roomFrameUrl(room: HeroRoom, frameIndex1: number): string {
  return `/frames/hero/${room.framesDir}/frame_${String(frameIndex1).padStart(4, "0")}.webp`;
}
