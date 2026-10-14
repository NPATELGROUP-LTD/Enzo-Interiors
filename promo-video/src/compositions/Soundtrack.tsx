import { Html5Audio, interpolate, staticFile, useVideoConfig } from "remotion";

/**
 * Optional music. Silent by default: posting with a track picked from
 * Instagram's own library is licensed for the platform and helps reach, so
 * the master ships without one. Point `soundtrack` at a file you hold the
 * rights to (under public/) to bake it in instead.
 */
export function Soundtrack({ src, fadeIn = 12, fadeOut = 36 }: { src: string; fadeIn?: number; fadeOut?: number }) {
  const { durationInFrames } = useVideoConfig();
  if (!src.trim()) return null;
  return (
    <Html5Audio
      src={staticFile(src.trim())}
      volume={(f) =>
        interpolate(f, [0, fadeIn, durationInFrames - fadeOut, durationInFrames - 1], [fadeIn ? 0 : 1, 1, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      }
    />
  );
}
