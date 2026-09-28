import type { BoardCategory, Mount } from "./types";

export const CATEGORY_LABELS: Record<BoardCategory, string> = {
  carcass: "Carcass",
  front: "Doors and fronts",
  worktop: "Worktops",
  back: "Backing",
};

export const CATEGORIES = Object.keys(CATEGORY_LABELS) as BoardCategory[];

export const MOUNT_LABELS: Record<Mount, string> = {
  floor: "Stands on the floor",
  wall: "Hung on the wall",
  tall: "Floor to ceiling",
};
