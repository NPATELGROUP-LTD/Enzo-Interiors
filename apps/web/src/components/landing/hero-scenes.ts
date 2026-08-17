export interface HeroScene {
  /** First frame (1-indexed, inclusive) this caption is shown for. */
  fromFrame: number;
  /** Last frame (1-indexed, inclusive) this caption is shown for. */
  toFrame: number;
  /** Short stage label shown next to the auto-numbered index. */
  label: string;
  heading: string;
  body: string;
}

/** Returns the index of the scene whose frame range contains `frame1` (1-indexed). */
export function findSceneIndex(scenes: HeroScene[], frame1: number): number {
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    if (s && frame1 >= s.fromFrame && frame1 <= s.toFrame) return i;
  }
  const first = scenes[0];
  if (first && frame1 < first.fromFrame) return 0;
  return scenes.length - 1;
}

// Narrative script for the hero caption card, mapped to the 97-frame
// sequence (public/frames/hero/). The footage is one continuous room
// transformation — a bespoke media wall assembling around the fireplace,
// then styling settling into place — so the copy stays grounded in what's
// actually on screen rather than naming unrelated room types.
export const HERO_SCENES: HeroScene[] = [
  {
    fromFrame: 1,
    toFrame: 16,
    label: "The Shell",
    heading: "Where Every Design Begins",
    body: "An empty room, true to its architecture. Before a single piece is fitted, we spend time understanding how the space will actually be lived in.",
  },
  {
    fromFrame: 17,
    toFrame: 31,
    label: "The Anchor",
    heading: "A Bespoke Media Wall Takes Form",
    body: "Hand-jointed timber, hidden cable runs, and integrated lighting come together around the fireplace — built to your room, not off a shelf.",
  },
  {
    fromFrame: 32,
    toFrame: 45,
    label: "Grounding The Space",
    heading: "Texture Rolls Into the Room",
    body: "Every finish is chosen to complement the joinery — softening the space and setting the tone for what's fitted around it.",
  },
  {
    fromFrame: 46,
    toFrame: 63,
    label: "Furniture Arrives",
    heading: "The Room Finds Its Footing",
    body: "Seating and surfaces settle into place, turning bespoke cabinetry into a room built for how you'll actually use it.",
  },
  {
    fromFrame: 64,
    toFrame: 80,
    label: "The Details",
    heading: "Finished Down to the Last Detail",
    body: "The details that make a house feel like home — the layer our fitting team takes as much care over as the joinery itself.",
  },
  {
    fromFrame: 81,
    toFrame: 97,
    label: "The Reveal",
    heading: "From Empty Shell to Finished Home",
    body: "This is what thoughtful, bespoke design can do with the right space — crafted and fitted by hand, here in Leicester.",
  },
];
