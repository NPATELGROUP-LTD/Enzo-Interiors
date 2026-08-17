// Asset pipeline for the Hero v3 multi-room scroll sequence.
//
// Source: three 144-frame WebP room sequences (Mediawall, Kitchen, Bedroom,
// already 1280x720) plus two MP4 transition videos connecting them, from the
// "v3 of scroll animation" export. Frames are re-encoded at a lower WebP
// quality to trim payload (no resize needed, source is already web-sized);
// videos are copied through as-is since they're already small.
//
// Not part of the app build — run manually after (re)exporting new source
// assets: `node scripts/process-hero-frames.mjs`
import { readdir, mkdir, copyFile, rm } from "fs/promises";
import path from "path";
import sharp from "sharp";

const FRAMES_SOURCE_ROOT =
  "D:\\NPATEL GROUP LTD\\Projects\\Enzo\\Assets\\v3 of scroll animation\\Frames";
const VIDEO_SOURCE_ROOT =
  "D:\\NPATEL GROUP LTD\\Projects\\Enzo\\Assets\\v3 of scroll animation\\Scene transistion";

const FRAMES_OUTPUT_ROOT = path.join(process.cwd(), "public", "frames", "hero");
const VIDEO_OUTPUT_ROOT = path.join(process.cwd(), "public", "videos", "hero");

const FRAME_COUNT = 144;
const WEBP_QUALITY = 72;

const ROOMS = [
  { id: "mediawall", sourceDir: "Mediawall Room" },
  { id: "kitchen", sourceDir: "Kitchen" },
  { id: "bedroom", sourceDir: "Bedroom" },
];

const VIDEOS = [
  { sourceFile: "mediawall to kitchen.mp4", outputFile: "mediawall-to-kitchen.mp4" },
  { sourceFile: "kitchen to bedroom.mp4", outputFile: "kitchen-to-bedroom.mp4" },
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
    await sharp(inputPath).webp({ quality: WEBP_QUALITY }).toFile(outputPath);
    if (n % 24 === 0 || n === FRAME_COUNT) {
      console.log(`  [${room.id}] ${n}/${FRAME_COUNT} frames processed`);
    }
  }
}

async function copyVideos() {
  await mkdir(VIDEO_OUTPUT_ROOT, { recursive: true });
  for (const video of VIDEOS) {
    const inputPath = path.join(VIDEO_SOURCE_ROOT, video.sourceFile);
    const outputPath = path.join(VIDEO_OUTPUT_ROOT, video.outputFile);
    await copyFile(inputPath, outputPath);
    console.log(`  copied ${video.sourceFile} -> videos/hero/${video.outputFile}`);
  }
}

async function main() {
  for (const room of ROOMS) {
    await processRoom(room);
  }
  await copyVideos();
  console.log(
    `\nDone. Wrote ${ROOMS.length * FRAME_COUNT} frames to ${FRAMES_OUTPUT_ROOT} and ${VIDEOS.length} videos to ${VIDEO_OUTPUT_ROOT}.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
