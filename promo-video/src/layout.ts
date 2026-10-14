// One storyboard, two frames: where everything sits in the 9:16 Reel and
// the 4:5 feed post. Scenes read positions from here and nothing else, so
// the two cuts stay in step when the story changes.
//
// Instagram draws its own interface over a Reel — the top bar, the caption
// and audio line along the bottom, the like/comment/share column on the
// right — so the Reel keeps anything that must be read inside
// y 236…1560 and clear of the right-hand 140px below y 1100. The grid
// crops a Reel to its centre 3:4 (y 240…1680) on the profile page.
import type { Rect } from "./components/Plate";

export type Format = "reel" | "feed";

export interface Layout {
  format: Format;
  width: number;
  height: number;
  padX: number;
  ruleTop: number;
  process: {
    plate: Rect;
    headTop: number;
    headSize: number;
    lede: { top: number; size: number; width: number; align: "left" | "right"; maxChars: number };
    /** Horizontal focal point of each room's crop. */
    focus: { kitchen: number; mediawall: number };
    captionScale: number;
  };
  site: {
    head: { top: number; left: number; size: number };
    phone: { width: number; left: number; top: number };
    /** The page index beside the phone — only where there is room for it. */
    pageIndex?: { left: number; bottom: number; width: number; size: number };
  };
  end: {
    logo: { top: number; width: number };
    badge: { top: number; size: number };
    headTop: number;
    headSize: number;
    pillTop: number;
    pillHeight: number;
    followTop: number;
    textSize: number;
    disciplinesTop: number;
  };
  frameThickness: number;
}

export const LAYOUTS: Record<Format, Layout> = {
  reel: {
    format: "reel",
    width: 1080,
    height: 1920,
    padX: 72,
    ruleTop: 236,
    process: {
      plate: { x: 72, y: 300, w: 936, h: 920 },
      headTop: 1252,
      headSize: 176,
      lede: { top: 1466, size: 34, width: 936, align: "left", maxChars: 60 },
      focus: { kitchen: 0.66, mediawall: 0.42 },
      captionScale: 1,
    },
    site: {
      head: { top: 300, left: 72, size: 96 },
      phone: { width: 680, left: 200, top: 580 },
    },
    end: {
      logo: { top: 330, width: 600 },
      badge: { top: 296, size: 236 },
      headTop: 760,
      headSize: 112,
      pillTop: 1044,
      pillHeight: 108,
      followTop: 1190,
      textSize: 34,
      disciplinesTop: 1468,
    },
    frameThickness: 18,
  },
  feed: {
    format: "feed",
    width: 1080,
    height: 1350,
    padX: 72,
    ruleTop: 60,
    process: {
      plate: { x: 72, y: 116, w: 936, h: 820 },
      headTop: 966,
      headSize: 160,
      lede: { top: 1156, size: 30, width: 936, align: "left", maxChars: 60 },
      focus: { kitchen: 0.62, mediawall: 0.45 },
      captionScale: 0.95,
    },
    site: {
      head: { top: 128, left: 72, size: 84 },
      phone: { width: 430, left: 578, top: 356 },
      pageIndex: { left: 72, bottom: 1350 - 1150, width: 440, size: 34 },
    },
    end: {
      logo: { top: 140, width: 520 },
      badge: { top: 116, size: 184 },
      headTop: 520,
      headSize: 100,
      pillTop: 790,
      pillHeight: 100,
      followTop: 930,
      textSize: 30,
      disciplinesTop: 1216,
    },
    frameThickness: 16,
  },
};

/** Greedy word wrap by character count — enough for short, known copy. */
export function wrapWords(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}
