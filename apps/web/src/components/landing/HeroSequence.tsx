"use client";

// Hero v3 — three room frame sequences (Mediawall, Kitchen, Bedroom)
// connected by two transition videos, all driven by a single master
// ScrollTrigger pin+scrub (one continuous scroll-position timeline, same
// pattern as the old single-sequence hero, just with more segments).
//
// Frame segments are always fully scroll-scrubbed both directions. Video
// segments are asymmetric by design: scrolling *down* into one locks
// further forward scroll and auto-plays it in real time (so the transition
// gets its own cinematic pacing, not the user's scroll speed); scrolling
// *up* through one is a plain scroll-scrub in reverse, exactly like a frame
// segment. This needs one ScrollTrigger clamping its own scroll position
// during a forward video lock (via self.scroll()) rather than two separate
// systems.
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { HeroIntro } from "./HeroIntro";
import { HERO_ROOMS, HERO_TRANSITIONS, roomFrameUrl, transitionVideoUrl } from "./hero-rooms";

const FRAME_COUNT = HERO_ROOMS[0]!.frameCount;
const PX_PER_FRAME = 50;
const PX_PER_VIDEO = 550;
const MAX_DPR = 1.5;
const SCRUB_SMOOTHING = 1.1;

let scrollTriggerRegistered = false;

// One ordered list of segments makes up the master timeline: a room-scrub
// segment per room, a video segment per transition, interleaved in story
// order (room0, video0, room1, video1, room2).
type Segment =
  | { type: "room"; roomIndex: number; px: number }
  | { type: "video"; transitionIndex: number; px: number };

const SEGMENTS: Segment[] = HERO_ROOMS.flatMap((_, roomIndex) => {
  const segs: Segment[] = [{ type: "room", roomIndex, px: FRAME_COUNT * PX_PER_FRAME }];
  if (roomIndex < HERO_TRANSITIONS.length) {
    segs.push({ type: "video", transitionIndex: roomIndex, px: PX_PER_VIDEO });
  }
  return segs;
});
const TOTAL_PX = SEGMENTS.reduce((sum, s) => sum + s.px, 0);

function segmentStartPx(target: Segment): number {
  let acc = 0;
  for (const seg of SEGMENTS) {
    if (seg === target) return acc;
    acc += seg.px;
  }
  return 0;
}

export function HeroSequence() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([null, null]);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const loaderFillRef = useRef<HTMLDivElement | null>(null);
  const loaderPctRef = useRef<HTMLSpanElement | null>(null);

  const [isRevealed, setIsRevealed] = useState(false);
  const [activeRoomIndex, setActiveRoomIndex] = useState(0);
  const [activeVideoIndex, setActiveVideoIndex] = useState<number | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    if (!section || !canvas) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;

    if (!scrollTriggerRegistered) {
      gsap.registerPlugin(ScrollTrigger);
      scrollTriggerRegistered = true;
    }
    ScrollTrigger.config({ ignoreMobileResize: true });

    let disposed = false;
    let dpr = 1;
    let lastDrawnKey = "";
    let lastRoomIndex = -1;
    let lastVideoIndex: number | null = null;

    const images: HTMLImageElement[][] = HERO_ROOMS.map(() => new Array(FRAME_COUNT));
    const loaded: boolean[][] = HERO_ROOMS.map(() => new Array(FRAME_COUNT).fill(false));
    let room0LoadedCount = 0;
    let revealed = false;
    let trigger: ScrollTrigger | null = null;

    // Per-transition runtime state for the forward-lock/backward-scrub split.
    const videoStates = HERO_TRANSITIONS.map(() => ({ forwardDone: false }));
    let lockedTransitionIndex: number | null = null;

    function drawImageCover(img: HTMLImageElement) {
      const cw = canvas!.width / dpr;
      const ch = canvas!.height / dpr;
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      if (!iw || !ih) return;
      const scale = Math.max(cw / iw, ch / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = (cw - dw) / 2;
      const dy = (ch - dh) / 2;
      ctx2d!.clearRect(0, 0, cw, ch);
      ctx2d!.drawImage(img, dx, dy, dw, dh);
    }

    function renderRoomFrame(roomIndex: number, frame1: number) {
      const key = `${roomIndex}:${frame1}`;
      if (key === lastDrawnKey) return;
      const idx = Math.max(0, Math.min(FRAME_COUNT - 1, Math.round(frame1) - 1));
      let drawIdx = idx;
      if (!loaded[roomIndex]![drawIdx]) {
        let found = -1;
        for (let i = idx; i >= 0; i--) {
          if (loaded[roomIndex]![i]) {
            found = i;
            break;
          }
        }
        if (found === -1) {
          for (let j = idx; j < FRAME_COUNT; j++) {
            if (loaded[roomIndex]![j]) {
              found = j;
              break;
            }
          }
        }
        if (found === -1) return;
        drawIdx = found;
      }
      const img = images[roomIndex]![drawIdx];
      if (img) {
        lastDrawnKey = key;
        drawImageCover(img);
      }
    }

    function preloadRoom(roomIndex: number, onProgress?: () => void): Promise<void> {
      const room = HERO_ROOMS[roomIndex]!;
      return new Promise((resolve) => {
        let remaining = FRAME_COUNT;
        for (let i = 0; i < FRAME_COUNT; i++) {
          const frameIndex = i;
          const img = new Image();
          img.decoding = "async";
          const onDone = () => {
            if (disposed) return;
            loaded[roomIndex]![frameIndex] = true;
            remaining--;
            onProgress?.();
            if (remaining === 0) resolve();
          };
          img.onload = onDone;
          img.onerror = onDone;
          img.src = roomFrameUrl(room, frameIndex + 1);
          images[roomIndex]![frameIndex] = img;
        }
      });
    }

    function preloadTransitionVideo(transitionIndex: number) {
      const video = videoRefs.current[transitionIndex];
      const transition = HERO_TRANSITIONS[transitionIndex]!;
      if (!video || video.src) return;
      video.src = transitionVideoUrl(transition);
      video.load();
    }

    function updateLoaderProgress() {
      const pct = Math.round((room0LoadedCount / FRAME_COUNT) * 100);
      if (loaderFillRef.current) loaderFillRef.current.style.width = pct + "%";
      if (loaderPctRef.current) loaderPctRef.current.textContent = String(pct);
    }

    function revealIfReady() {
      if (revealed) return;
      revealed = true;
      setIsRevealed(true);
      ScrollTrigger.refresh();
      // Background-warm the rest of the journey once the first room is
      // interactive, so later rooms/videos are ready by the time scroll
      // reaches them without blocking first paint on ~21MB of assets.
      preloadTransitionVideo(0);
      preloadRoom(1).then(() => {
        preloadTransitionVideo(1);
        void preloadRoom(2);
      });
    }

    function setActiveRoom(roomIndex: number) {
      if (roomIndex === lastRoomIndex) return;
      lastRoomIndex = roomIndex;
      setActiveRoomIndex(roomIndex);
    }

    function setActiveVideo(transitionIndex: number | null) {
      if (transitionIndex === lastVideoIndex) return;
      lastVideoIndex = transitionIndex;
      setActiveVideoIndex(transitionIndex);
    }

    function updateProgressUI(px: number) {
      if (progressBarRef.current) {
        progressBarRef.current.style.width = Math.max(0, Math.min(100, (px / TOTAL_PX) * 100)) + "%";
      }
    }

    function findSegmentAt(px: number) {
      let acc = 0;
      for (const seg of SEGMENTS) {
        if (px <= acc + seg.px || seg === SEGMENTS[SEGMENTS.length - 1]) {
          const localPx = Math.max(0, Math.min(seg.px, px - acc));
          return { seg, localProgress: seg.px === 0 ? 0 : localPx / seg.px };
        }
        acc += seg.px;
      }
      const last = SEGMENTS[SEGMENTS.length - 1]!;
      return { seg: last, localProgress: 1 };
    }

    // Engages the forward auto-play lock for a video segment: clamps the
    // master ScrollTrigger's scroll position at the segment's start and
    // plays the video in real time. On completion, snaps the scroll
    // position forward past the segment and releases the lock so ordinary
    // scrubbing continues into the next room.
    function lockAndPlayForward(transitionIndex: number, seg: Segment) {
      const video = videoRefs.current[transitionIndex];
      if (!video || !trigger) return;
      const start = segmentStartPx(seg);
      lockedTransitionIndex = transitionIndex;
      setActiveRoom(transitionIndex);
      setActiveVideo(transitionIndex);
      video.currentTime = 0;
      void video.play();
      trigger.scroll(trigger.start + start);
      updateProgressUI(start);

      const onEnded = () => {
        video.removeEventListener("ended", onEnded);
        videoStates[transitionIndex]!.forwardDone = true;
        lockedTransitionIndex = null;
        if (trigger) trigger.scroll(trigger.start + start + seg.px);
      };
      video.addEventListener("ended", onEnded);
    }

    // Master render: resolves the current segment from raw scroll pixels
    // and either draws a frame or scrubs/locks the relevant video.
    function handleUpdate(self: ScrollTrigger) {
      const rawPx = self.progress * TOTAL_PX;

      if (lockedTransitionIndex !== null) {
        if (self.direction === -1) {
          // User reversed mid-playback — release the lock, pause, and let
          // the normal scrub logic below take over from wherever it is.
          videoRefs.current[lockedTransitionIndex]?.pause();
          lockedTransitionIndex = null;
        } else {
          // Still locked: hold the scroll position, the video plays itself.
          const lockedSeg = SEGMENTS.find(
            (s) => s.type === "video" && s.transitionIndex === lockedTransitionIndex,
          )!;
          const start = segmentStartPx(lockedSeg);
          if (trigger && rawPx > start) trigger.scroll(trigger.start + start);
          updateProgressUI(start);
          return;
        }
      }

      // Re-arm any video the user has scrolled back above, so approaching
      // it forward again re-triggers the locked auto-play from the start.
      for (let i = 0; i < HERO_TRANSITIONS.length; i++) {
        const videoSeg = SEGMENTS.find((s) => s.type === "video" && s.transitionIndex === i)!;
        if (rawPx < segmentStartPx(videoSeg)) videoStates[i]!.forwardDone = false;
      }

      const { seg, localProgress } = findSegmentAt(rawPx);

      if (seg.type === "room") {
        setActiveRoom(seg.roomIndex);
        setActiveVideo(null);
        renderRoomFrame(seg.roomIndex, 1 + localProgress * (FRAME_COUNT - 1));
      } else {
        const ti = seg.transitionIndex;
        const video = videoRefs.current[ti];
        const state = videoStates[ti]!;
        if (!video || !video.duration) {
          setActiveRoom(ti);
          setActiveVideo(null);
          renderRoomFrame(ti, FRAME_COUNT);
        } else if (self.direction === 1 && !state.forwardDone) {
          lockAndPlayForward(ti, seg);
          return;
        } else {
          setActiveRoom(ti);
          setActiveVideo(ti);
          video.currentTime = localProgress * video.duration;
        }
      }

      updateProgressUI(rawPx);
    }

    function resizeCanvas() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      canvas!.style.width = w + "px";
      canvas!.style.height = h + "px";
      ctx2d!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx2d!.imageSmoothingEnabled = true;
      ctx2d!.imageSmoothingQuality = "high";
      lastDrawnKey = "";
      if (trigger) handleUpdate(trigger);
    }

    let resizeTimer: number | null = null;
    function onWindowResize() {
      if (resizeTimer) cancelAnimationFrame(resizeTimer);
      resizeTimer = requestAnimationFrame(() => {
        resizeCanvas();
        ScrollTrigger.refresh();
      });
    }

    trigger = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: "+=" + TOTAL_PX,
      pin: true,
      pinSpacing: true,
      scrub: SCRUB_SMOOTHING,
      anticipatePin: 1,
      onUpdate: handleUpdate,
    });

    resizeCanvas();

    window.addEventListener("resize", onWindowResize);
    window.addEventListener("orientationchange", onWindowResize);

    void preloadRoom(0, () => {
      room0LoadedCount++;
      updateLoaderProgress();
    }).then(revealIfReady);

    return () => {
      disposed = true;
      window.removeEventListener("resize", onWindowResize);
      window.removeEventListener("orientationchange", onWindowResize);
      if (resizeTimer) cancelAnimationFrame(resizeTimer);
      trigger?.kill();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative h-screen w-full overflow-hidden bg-enzo-dark"
    >
      <div
        ref={progressBarRef}
        className="fixed left-0 top-0 z-[100] h-[3px] w-0 bg-gradient-to-r from-primary to-enzo-forest-light transition-[width] duration-100 ease-out"
      />

      <canvas
        ref={canvasRef}
        className="absolute inset-0 block h-full w-full"
        style={{ opacity: activeVideoIndex === null ? 1 : 0 }}
      />

      {HERO_TRANSITIONS.map((transition, i) => (
        <video
          key={transition.id}
          ref={(el) => {
            videoRefs.current[i] = el;
          }}
          muted
          playsInline
          preload="auto"
          className="absolute inset-0 block h-full w-full object-cover"
          style={{ opacity: activeVideoIndex === i ? 1 : 0 }}
        />
      ))}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-black/45 via-black/10 to-black/40"
      />

      <div className="absolute inset-x-0 top-0 z-[2] flex justify-center px-6 pt-28 md:pt-32">
        <HeroIntro />
      </div>

      <div
        className="absolute inset-x-0 bottom-8 z-[3] flex justify-center gap-2"
        role="presentation"
      >
        {HERO_ROOMS.map((room, i) => (
          <span
            key={room.id}
            className="h-[3px] w-8 overflow-hidden rounded-full bg-enzo-cream/25"
          >
            <span
              className="block h-full bg-enzo-cream transition-transform duration-300 ease-out"
              style={{
                transform: `scaleX(${i <= activeRoomIndex ? 1 : 0})`,
                transformOrigin: "left",
                opacity: i === activeRoomIndex ? 1 : i < activeRoomIndex ? 0.7 : 0.25,
              }}
            />
          </span>
        ))}
      </div>

      <div
        aria-live="polite"
        aria-hidden={isRevealed}
        className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-[18px] bg-enzo-dark transition-[opacity,transform] duration-700 ease-out"
        style={{
          opacity: isRevealed ? 0 : 1,
          transform: isRevealed ? "scale(1.03)" : "scale(1)",
          pointerEvents: isRevealed ? "none" : "auto",
        }}
      >
        <div className="flex items-baseline gap-0.5 tabular-nums text-enzo-cream">
          <span ref={loaderPctRef} className="text-[15px] font-semibold tracking-[-0.01em]">
            0
          </span>
          <span className="text-[12px] opacity-55">%</span>
        </div>
        <div className="h-0.5 w-[140px] overflow-hidden rounded-full bg-enzo-cream/20">
          <div
            ref={loaderFillRef}
            className="h-full w-0 bg-enzo-sage transition-[width] duration-150 ease-linear"
          />
        </div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-enzo-cream/55">
          Preparing your space
        </div>
      </div>
    </section>
  );
}
