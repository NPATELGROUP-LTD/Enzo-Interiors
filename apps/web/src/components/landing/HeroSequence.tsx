"use client";

// Hero v3 — three independently scroll-scrubbed room sequences (Mediawall,
// Kitchen, Bedroom), connected by two real transition videos. Unlike the old
// single-sequence hero (one continuous ScrollTrigger scrub), the videos here
// must NOT be scroll-scrubbed: they auto-play in real time once triggered,
// and are only reversible by scroll *direction*, not distance. That mix
// (position-driven frame scrub + direction-driven real-time video) needs
// native page scroll trapped for the section's whole duration rather than a
// single ScrollTrigger pin+scrub — see plan: apps/hero-frame-scroll-v3.
import { useEffect, useRef, useState } from "react";
import { HeroGlassBlocks } from "./HeroGlassBlocks";
import { HeroIntro } from "./HeroIntro";
import { HERO_ROOMS, HERO_TRANSITIONS, roomFrameUrl, transitionVideoUrl } from "./hero-rooms";

const ROOM_COUNT = HERO_ROOMS.length;
const FRAME_COUNT = HERO_ROOMS[0]!.frameCount;
const LAST_ROOM_INDEX = ROOM_COUNT - 1;

const PX_PER_FRAME = 46;
const MAX_DELTA = 120;
const PAUSE_THRESHOLD = 90;
const MAX_DPR = 1.5;
const ROOM_WEIGHT = FRAME_COUNT;
const VIDEO_WEIGHT = 60;
const TOTAL_UNITS = ROOM_COUNT * ROOM_WEIGHT + (ROOM_COUNT - 1) * VIDEO_WEIGHT;

type PhaseKind = "scrub" | "pause" | "video";

// A flat mutable struct rather than a discriminated union — this is written
// in place many times per second during scrub/reverse, and re-allocating a
// new union-typed object (or narrowing-then-casting an existing one) on
// every wheel tick is both slower and messier than reading only the fields
// that apply to the current `kind`.
interface Phase {
  kind: PhaseKind;
  roomIndex: number; // meaningful for "scrub" / "pause"
  frame: number; // meaningful for "scrub" (1..FRAME_COUNT)
  transitionIndex: number; // meaningful for "video"
  direction: 1 | -1; // meaningful for "video"
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
  const [isPaused, setIsPaused] = useState(false);
  const [activeVideoIndex, setActiveVideoIndex] = useState<number | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    if (!section || !canvas) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;

    let disposed = false;
    let dpr = 1;
    let lastDrawnKey = "";

    // images[roomIndex][frameIndex0]
    const images: HTMLImageElement[][] = HERO_ROOMS.map(() => new Array(FRAME_COUNT));
    const loaded: boolean[][] = HERO_ROOMS.map(() => new Array(FRAME_COUNT).fill(false));
    let room0LoadedCount = 0;
    let revealed = false;

    const phase: Phase = { kind: "scrub", roomIndex: 0, frame: 1, transitionIndex: 0, direction: 1 };
    let pauseForwardAccum = 0;
    let released = false;
    let reverseRaf: number | null = null;

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
            if (roomIndex === 0 && phase.roomIndex === 0) {
              renderRoomFrame(0, phase.kind === "scrub" ? phase.frame : FRAME_COUNT);
            }
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
      // Background-warm the rest of the journey once the first room is
      // interactive, so later rooms/videos are ready by the time the user
      // scrolls that far without blocking first paint on ~21MB of assets.
      preloadTransitionVideo(0);
      preloadRoom(1).then(() => {
        preloadTransitionVideo(1);
        void preloadRoom(2);
      });
    }

    function updateProgressUI(units: number) {
      const pct = Math.max(0, Math.min(100, (units / TOTAL_UNITS) * 100));
      if (progressBarRef.current) progressBarRef.current.style.width = pct + "%";
    }

    function unitsForPhase(): number {
      const roomStride = ROOM_WEIGHT + VIDEO_WEIGHT;
      if (phase.kind === "scrub") return phase.roomIndex * roomStride + (phase.frame - 1);
      if (phase.kind === "pause") return phase.roomIndex * roomStride + (ROOM_WEIGHT - 1);
      const video = videoRefs.current[phase.transitionIndex];
      const fraction = video && video.duration ? video.currentTime / video.duration : 0;
      return phase.transitionIndex * roomStride + ROOM_WEIGHT + VIDEO_WEIGHT * fraction;
    }

    function syncUI() {
      updateProgressUI(unitsForPhase());
    }

    function setActiveRoom(roomIndex: number) {
      setActiveRoomIndex((prev) => (prev === roomIndex ? prev : roomIndex));
    }

    function enterPause(roomIndex: number) {
      phase.kind = "pause";
      phase.roomIndex = roomIndex;
      pauseForwardAccum = 0;
      setActiveRoom(roomIndex);
      setIsPaused(true);
      setActiveVideoIndex(null);
      renderRoomFrame(roomIndex, FRAME_COUNT);
      syncUI();
    }

    function enterScrub(roomIndex: number, frame: number) {
      phase.kind = "scrub";
      phase.roomIndex = roomIndex;
      phase.frame = frame;
      setActiveRoom(roomIndex);
      setIsPaused(false);
      setActiveVideoIndex(null);
      renderRoomFrame(roomIndex, frame);
      syncUI();
    }

    function stopReverseLoop() {
      if (reverseRaf !== null) {
        cancelAnimationFrame(reverseRaf);
        reverseRaf = null;
      }
    }

    function startReverseLoop(transitionIndex: number) {
      stopReverseLoop();
      const video = videoRefs.current[transitionIndex];
      if (!video) return;
      let last = performance.now();
      const step = (now: number) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const next = video.currentTime - dt;
        if (next <= 0) {
          video.currentTime = 0;
          onVideoReversedToStart(transitionIndex);
          return;
        }
        video.currentTime = next;
        syncUI();
        reverseRaf = requestAnimationFrame(step);
      };
      reverseRaf = requestAnimationFrame(step);
    }

    function onVideoEnded(transitionIndex: number) {
      if (phase.kind !== "video" || phase.transitionIndex !== transitionIndex) return;
      const nextRoomIndex = transitionIndex + 1;
      enterScrub(nextRoomIndex, 1);
    }

    function onVideoReversedToStart(transitionIndex: number) {
      if (phase.kind !== "video" || phase.transitionIndex !== transitionIndex) return;
      const prevRoomIndex = transitionIndex;
      enterPause(prevRoomIndex);
    }

    function startVideo(transitionIndex: number, direction: 1 | -1) {
      const video = videoRefs.current[transitionIndex];
      if (!video) return;
      stopReverseLoop();
      phase.kind = "video";
      phase.transitionIndex = transitionIndex;
      phase.direction = direction;
      setIsPaused(false);
      setActiveVideoIndex(transitionIndex);
      if (direction === 1) {
        void video.play();
      } else {
        video.pause();
        startReverseLoop(transitionIndex);
      }
      syncUI();
    }

    function release() {
      released = true;
      removeTrap();
      window.scrollBy({ top: 48, left: 0, behavior: "auto" });
    }

    function reengage() {
      released = false;
      pauseForwardAccum = 0;
      enterPause(LAST_ROOM_INDEX);
      addTrap();
    }

    function applyDelta(rawDelta: number) {
      if (!revealed || released) return;
      const delta = rawDelta;
      let hops = 0;
      while (hops < 4) {
        hops++;
        if (phase.kind === "scrub") {
          const framesDelta = delta / PX_PER_FRAME;
          const target = phase.frame + framesDelta;
          if (target > FRAME_COUNT) {
            enterPause(phase.roomIndex);
            return;
          }
          if (target < 1) {
            if (phase.roomIndex === 0) {
              enterScrub(0, 1);
              return;
            }
            const transitionIndex = phase.roomIndex - 1;
            const video = videoRefs.current[transitionIndex];
            if (video && !video.duration) return;
            if (video) video.currentTime = video.duration;
            startVideo(transitionIndex, -1);
            return;
          }
          enterScrub(phase.roomIndex, target);
          return;
        }

        if (phase.kind === "pause") {
          if (delta > 0) {
            pauseForwardAccum += delta;
            if (pauseForwardAccum < PAUSE_THRESHOLD) return;
            pauseForwardAccum = 0;
            if (phase.roomIndex === LAST_ROOM_INDEX) {
              release();
              return;
            }
            startVideo(phase.roomIndex, 1);
            return;
          }
          if (delta < 0) {
            pauseForwardAccum = 0;
            // Re-enter this room's own scrub at its last frame and let the
            // loop reprocess the same delta so one up-scroll tick both
            // wakes from pause and moves a frame, rather than needing two.
            enterScrub(phase.roomIndex, FRAME_COUNT);
            continue;
          }
          return;
        }

        if (phase.kind === "video") {
          if (delta > 0 && phase.direction === -1) {
            stopReverseLoop();
            startVideo(phase.transitionIndex, 1);
            return;
          }
          if (delta < 0 && phase.direction === 1) {
            const video = videoRefs.current[phase.transitionIndex];
            if (video) video.pause();
            phase.direction = -1;
            startReverseLoop(phase.transitionIndex);
            return;
          }
          return;
        }
        return;
      }
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const d = Math.max(-MAX_DELTA, Math.min(MAX_DELTA, e.deltaY));
      applyDelta(d);
    }

    let touchStartY: number | null = null;
    function onTouchStart(e: TouchEvent) {
      touchStartY = e.touches[0]?.clientY ?? null;
    }
    function onTouchMove(e: TouchEvent) {
      if (touchStartY === null) return;
      const y = e.touches[0]?.clientY;
      if (y === undefined) return;
      e.preventDefault();
      const d = Math.max(-MAX_DELTA, Math.min(MAX_DELTA, touchStartY - y));
      touchStartY = y;
      applyDelta(d);
    }
    function onTouchEnd() {
      touchStartY = null;
    }

    function onKeyDown(e: KeyboardEvent) {
      if (["ArrowDown", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        applyDelta(80);
      } else if (["ArrowUp", "PageUp"].includes(e.key)) {
        e.preventDefault();
        applyDelta(-80);
      }
    }

    // Defensive only: the Navbar's full-screen mobile menu (md:hidden) locks
    // document.body.style.overflow while open. This component is desktop-only
    // (see Hero.tsx's breakpoint switch) so the two shouldn't ever overlap in
    // practice, but skip handling input if body scroll is locked by something
    // else rather than fighting it.
    function bodyScrollUnlocked() {
      return document.body.style.overflow !== "hidden";
    }

    function onWheelGuarded(e: WheelEvent) {
      if (!bodyScrollUnlocked()) return;
      onWheel(e);
    }
    function onTouchMoveGuarded(e: TouchEvent) {
      if (!bodyScrollUnlocked()) return;
      onTouchMove(e);
    }

    function addTrap() {
      window.addEventListener("wheel", onWheelGuarded, { passive: false });
      window.addEventListener("touchstart", onTouchStart, { passive: true });
      window.addEventListener("touchmove", onTouchMoveGuarded, { passive: false });
      window.addEventListener("touchend", onTouchEnd, { passive: true });
      window.addEventListener("keydown", onKeyDown);
    }

    function removeTrap() {
      window.removeEventListener("wheel", onWheelGuarded);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMoveGuarded);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKeyDown);
    }

    function onDocScroll() {
      if (released && window.scrollY <= 2) reengage();
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
      const currentFrame = phase.kind === "scrub" ? phase.frame : FRAME_COUNT;
      const roomForRedraw = phase.kind === "video" ? phase.transitionIndex : phase.roomIndex;
      renderRoomFrame(roomForRedraw, currentFrame);
    }

    let resizeTimer: number | null = null;
    function onWindowResize() {
      if (resizeTimer) cancelAnimationFrame(resizeTimer);
      resizeTimer = requestAnimationFrame(resizeCanvas);
    }

    resizeCanvas();
    addTrap();
    window.addEventListener("resize", onWindowResize);
    window.addEventListener("scroll", onDocScroll, { passive: true });

    const video0 = videoRefs.current[0];
    const video1 = videoRefs.current[1];
    const onEnded0 = () => onVideoEnded(0);
    const onEnded1 = () => onVideoEnded(1);
    video0?.addEventListener("ended", onEnded0);
    video1?.addEventListener("ended", onEnded1);

    void preloadRoom(0, () => {
      room0LoadedCount++;
      updateLoaderProgress();
    }).then(revealIfReady);

    return () => {
      disposed = true;
      removeTrap();
      window.removeEventListener("resize", onWindowResize);
      window.removeEventListener("scroll", onDocScroll);
      video0?.removeEventListener("ended", onEnded0);
      video1?.removeEventListener("ended", onEnded1);
      if (resizeTimer) cancelAnimationFrame(resizeTimer);
      stopReverseLoop();
    };
  }, []);

  const activeRoom = HERO_ROOMS[activeRoomIndex] ?? null;

  return (
    <section
      ref={sectionRef}
      className="relative h-screen w-full overflow-hidden bg-enzo-dark"
      style={{ overscrollBehavior: "none" }}
    >
      <div
        ref={progressBarRef}
        className="fixed left-0 top-0 z-[100] h-[3px] w-0 bg-gradient-to-r from-primary to-enzo-forest-light transition-[width] duration-100 ease-out"
      />

      <canvas
        ref={canvasRef}
        className="absolute inset-0 block h-full w-full transition-opacity duration-150 ease-linear"
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
          className="absolute inset-0 block h-full w-full object-cover transition-opacity duration-150 ease-linear"
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

      <HeroGlassBlocks room={activeRoom} visible={isPaused} />

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
