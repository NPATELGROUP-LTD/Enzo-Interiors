// Render settings for every composition in the package.
//
// Instagram re-encodes whatever it is given, so the master is made as clean
// as is practical — a high-quality H.264 master survives that second encode
// far better than one that is already at the edge of its bitrate.
import { Config } from "@remotion/cli/config";

Config.setEntryPoint("src/index.ts");

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setCodec("h264");
Config.setCrf(16);
Config.setPixelFormat("yuv420p");
// Tag the file as BT.709, which is what phones assume for HD video. Untagged
// output is read as BT.601 by some players and the forest green shifts.
Config.setColorSpace("bt709");
Config.setOverwriteOutput(true);

// Remotion downloads its own headless Chrome on first render. On a machine
// that cannot reach the download (a locked-down CI box, say), point this at
// an existing Chrome / chrome-headless-shell instead.
const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE;
if (browserExecutable) {
  Config.setBrowserExecutable(browserExecutable);
}
