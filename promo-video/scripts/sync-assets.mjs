// Copies the brand assets the videos use out of the website.
//
// apps/web/public is the single source for Enzo's logo, the room photography
// and the three room-build sequences from the homepage hero. They are copied
// rather than committed a second time (the frames alone are ~95 MB), and
// copied rather than symlinked so the package works the same on Windows.
//
// Runs automatically before `npm run dev` and every render. Files that are
// already up to date are skipped, so after the first run it is instant.
import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE_PUBLIC = path.join(ROOT, "..", "apps", "web", "public");
const OUT = path.join(ROOT, "public");

const FILES = [
  ["logo/enzo-white.png", "brand/enzo-white.png"],
  ["logo/enzo-forest.png", "brand/enzo-forest.png"],
  ["centeredKitchen.jpeg", "photos/kitchen.jpeg"],
  ["fireplaceMediawall.jpeg", "photos/media-wall.jpeg"],
  ["Bedroom.jpeg", "photos/bedroom.jpeg"],
  ["Wardrobes.jpeg", "photos/wardrobes.jpeg"],
];

// The homepage hero's room sequences: 144 frames each, empty room to finished.
const ROOMS = ["kitchen", "mediawall", "bedroom"];

async function upToDate(from, to) {
  try {
    const [a, b] = await Promise.all([stat(from), stat(to)]);
    return a.size === b.size && b.mtimeMs >= a.mtimeMs;
  } catch {
    return false;
  }
}

async function sync(from, to) {
  if (await upToDate(from, to)) return 0;
  await mkdir(path.dirname(to), { recursive: true });
  await copyFile(from, to);
  return 1;
}

async function main() {
  try {
    await stat(SITE_PUBLIC);
  } catch {
    console.error(`Cannot find the website's public folder at ${SITE_PUBLIC}.`);
    console.error("promo-video expects to live beside apps/ in the Enzo Interiors repo.");
    process.exit(1);
  }

  let copied = 0;
  for (const [from, to] of FILES) {
    copied += await sync(path.join(SITE_PUBLIC, from), path.join(OUT, to));
  }
  for (const room of ROOMS) {
    const dir = path.join(SITE_PUBLIC, "frames", "hero", room);
    const frames = (await readdir(dir)).filter((f) => f.endsWith(".webp"));
    for (const frame of frames) {
      copied += await sync(path.join(dir, frame), path.join(OUT, "frames", room, frame));
    }
  }
  console.log(copied ? `sync-assets: copied ${copied} file(s) from apps/web/public` : "sync-assets: up to date");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
