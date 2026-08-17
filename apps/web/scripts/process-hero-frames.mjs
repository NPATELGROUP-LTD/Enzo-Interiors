// One-time asset pipeline for the Hero scroll-sequence component.
//
// Source: 192 full-resolution PNG frames (~139MB) from the standalone
// "Video Scroll Effect" project. We keep every 2nd frame (96 total),
// downscale to a max width of 1920px, and re-encode as WebP — cutting the
// payload by ~90% before it ships to `apps/web/public/frames/hero/`.
//
// Not part of the app build — run manually after (re)exporting new source
// frames: `node scripts/process-hero-frames.mjs`
import { readdir, mkdir } from "fs/promises";
import path from "path";
import sharp from "sharp";

const SOURCE_DIR =
  "D:\\NPATEL GROUP LTD\\Projects\\Enzo\\Standalone Designs\\Video Scroll Effect\\public\\frames";
const OUTPUT_DIR = path.join(process.cwd(), "public", "frames", "hero");
const SOURCE_FRAME_COUNT = 192;
const OUTPUT_WIDTH = 1920;
const WEBP_QUALITY = 75;

function sourceFrameName(n) {
  return `frame_${String(n).padStart(6, "0")}.png`;
}

function outputFrameName(n) {
  return `frame_${String(n).padStart(4, "0")}.webp`;
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const files = await readdir(SOURCE_DIR);
  if (files.length < SOURCE_FRAME_COUNT) {
    throw new Error(
      `Expected ${SOURCE_FRAME_COUNT} source frames in ${SOURCE_DIR}, found ${files.length}`,
    );
  }

  // Keep every 2nd frame (1, 3, 5, ...) but always keep the last frame so
  // the sequence still ends on the fully-styled final scene.
  const keep = [];
  for (let i = 1; i <= SOURCE_FRAME_COUNT; i += 2) keep.push(i);
  if (keep[keep.length - 1] !== SOURCE_FRAME_COUNT) keep.push(SOURCE_FRAME_COUNT);

  let outIndex = 0;
  for (const sourceN of keep) {
    outIndex++;
    const inputPath = path.join(SOURCE_DIR, sourceFrameName(sourceN));
    const outputPath = path.join(OUTPUT_DIR, outputFrameName(outIndex));
    await sharp(inputPath)
      .resize({ width: OUTPUT_WIDTH, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toFile(outputPath);
    if (outIndex % 16 === 0 || outIndex === keep.length) {
      console.log(`  ${outIndex}/${keep.length} frames processed`);
    }
  }

  console.log(
    `\nDone. Wrote ${keep.length} frames to ${OUTPUT_DIR} (source frame ${SOURCE_FRAME_COUNT} -> output frame ${keep.length}).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
