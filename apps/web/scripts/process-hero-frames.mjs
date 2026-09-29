// Asset pipeline for the Hero v3 multi-room scroll sequence.
//
// Source: three 144-frame WebP room sequences (Mediawall, Kitchen, Bedroom,
// already 1280x720), from the "v3 of scroll animation" export. Frames are
// copied through as-is at their original quality (just renamed to the
// 4-digit padded output convention) — no re-encoding, no quality loss.
//
// The transition MP4s from that same export are no longer used — the hero
// replaced its video transitions with pure-CSS/GSAP parallax chapters, so
// there's nothing to copy for them here.
//
// Not part of the app build — run manually after (re)exporting new source
// frames: `node scripts/process-hero-frames.mjs`
import { readdir, mkdir, copyFile, rm } from "fs/promises";
import path from "path";

const FRAMES_SOURCE_ROOT =
  "D:\\NPATEL GROUP LTD\\Projects\\Enzo\\Assets\\v3 of scroll animation\\Frames";

const FRAMES_OUTPUT_ROOT = path.join(process.cwd(), "public", "frames", "hero");

const FRAME_COUNT = 144;

const ROOMS = [
  { id: "mediawall", sourceDir: "Mediawall Room" },
  { id: "kitchen", sourceDir: "Kitchen" },
  { id: "bedroom", sourceDir: "Bedroom" },
];

function sourceFrameName(n) {
  return `frame_${String(n).padStart(6, "0")}.webp`;
}

function outputFrameName(n) {
  return `frame_${String(n).padStart(4, "0")}.webp`;
}

async function processRoom(room) {
  const sourceDir = path.join(FRAMES_SOURCE_ROOT, room.sourceDir);
  const outputDir = path.join(FRAMES_OUTPUT_ROOT, room.id);
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  const files = await readdir(sourceDir);
  if (files.length < FRAME_COUNT) {
    throw new Error(`Expected ${FRAME_COUNT} frames in ${sourceDir}, found ${files.length}`);
  }

  for (let n = 1; n <= FRAME_COUNT; n++) {
    const inputPath = path.join(sourceDir, sourceFrameName(n));
    const outputPath = path.join(outputDir, outputFrameName(n));
    await copyFile(inputPath, outputPath);
    if (n % 24 === 0 || n === FRAME_COUNT) {
      console.log(`  [${room.id}] ${n}/${FRAME_COUNT} frames copied`);
    }
  }
}

async function main() {
  for (const room of ROOMS) {
    await processRoom(room);
  }
  console.log(`\nDone. Wrote ${ROOMS.length * FRAME_COUNT} frames to ${FRAMES_OUTPUT_ROOT}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
