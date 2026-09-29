// A room building itself: the homepage hero's frame sequences (empty room →
// fitted → furnished, 144 frames each), played as footage.
import { useEffect } from "react";
import { AbsoluteFill, Easing, getRemotionEnvironment, Img, interpolate, prefetch, staticFile, useCurrentFrame } from "remotion";
import { roomCaptions } from "../brand/copy";
import { font } from "../brand/fonts";
import { color, EASE, sec } from "../brand/tokens";

export type Room = "kitchen" | "mediawall" | "bedroom";

export const ROOM_FRAMES = 144;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const roomFrameSrc = (room: Room, n: number) =>
  staticFile(`frames/${room}/frame_${String(n).padStart(4, "0")}.webp`);

// In the Studio, pull a room's frames down once up front so scrubbing does
// not stall on every frame. Renders load each frame on demand anyway.
const prefetched = new Set<Room>();
function usePrefetchRoom(room: Room) {
  useEffect(() => {
    if (!getRemotionEnvironment().isStudio || prefetched.has(room)) return;
    prefetched.add(room);
    for (let n = 1; n <= ROOM_FRAMES; n++) prefetch(roomFrameSrc(room, n));
  }, [room]);
}

export function RoomBuild({
  room,
  from,
  duration,
  focusX = 0.5,
  zoom = [1, 1.07],
  captionAt,
  captionScale = 1,
}: {
  room: Room;
  /** Frame the build starts playing. Before it, the empty room holds. */
  from: number;
  /** Frames the full build takes; the finished room holds after. */
  duration: number;
  /** Horizontal focal point for the crop, 0 (left) to 1 (right). */
  focusX?: number;
  /** A slow push-in across the build, for depth. */
  zoom?: [number, number];
  /** When to letter the room's caption in, if at all. */
  captionAt?: number;
  captionScale?: number;
}) {
  const frame = useCurrentFrame();
  usePrefetchRoom(room);

  // Eased so the empty room reads first and the finished one settles.
  const t = interpolate(frame, [from, from + duration], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const n = 1 + Math.round(t * (ROOM_FRAMES - 1));
  const scale = interpolate(frame, [from, from + duration + sec(1)], zoom, { ...clamp, easing: EASE.drift });

  return (
    <AbsoluteFill style={{ background: color.dark }}>
      <Img
        src={roomFrameSrc(room, n)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: `${focusX * 100}% 50%`,
          transform: `scale(${scale})`,
          transformOrigin: `${focusX * 100}% 55%`,
        }}
      />
      {captionAt !== undefined && <RoomCaption room={room} at={captionAt} scale={captionScale} />}
    </AbsoluteFill>
  );
}

/** The hero's "hold" caption, lettered in once the room is finished. */
function RoomCaption({ room, at, scale }: { room: Room; at: number; scale: number }) {
  const frame = useCurrentFrame();
  const caption = roomCaptions[room];
  const scrim = interpolate(frame, [at - 6, at + sec(0.6)], [0, 1], clamp);
  const rise = (delay: number) => interpolate(frame, [at + delay, at + delay + sec(0.9)], [100, 0], { ...clamp, easing: EASE.editorial });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end" }}>
      <AbsoluteFill
        style={{
          opacity: scrim,
          background: "linear-gradient(180deg, transparent 55%, rgba(15,15,17,0.72) 100%)",
        }}
      />
      <div style={{ position: "relative", padding: `0 ${40 * scale}px ${38 * scale}px` }}>
        <div style={{ overflow: "hidden" }}>
          <div
            style={{
              transform: `translateY(${rise(0)}%)`,
              fontFamily: font.display,
              fontWeight: 600,
              fontSize: 20 * scale,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: color.sand,
            }}
          >
            {caption.label}
          </div>
        </div>
        <div style={{ overflow: "hidden", paddingBottom: "0.12em", marginTop: 10 * scale }}>
          <div
            style={{
              transform: `translateY(${rise(3)}%)`,
              fontFamily: font.heading,
              fontWeight: 600,
              fontSize: 46 * scale,
              letterSpacing: "-0.035em",
              lineHeight: 1.05,
              color: color.cream,
            }}
          >
            {caption.heading}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}
