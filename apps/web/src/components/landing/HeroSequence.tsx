"use client";

// Hero v3 — three room frame sequences (Mediawall, Kitchen, Bedroom)
// connected by two transition videos, ending in a parallax CTA — all one
// continuous story on a single master ScrollTrigger pin+scrub. The CTA is
// deliberately NOT a separate section below the hero: it's the final
// segment of this same timeline, so it stays pinned/fixed with the rest of
// the sequence rather than scrolling in as its own thing.
//
// Segment order: room -> pause (glass blocks) -> video -> room -> pause ->
// video -> room -> pause -> cta. Frame segments are always fully
// scroll-scrubbed both directions. Pause segments hold the room's last
// frame and fade the glass blocks in/out. Video segments are asymmetric:
// scrolling *down* into one locks further forward scroll and auto-plays it
// in real time; scrolling *up* through one is a plain scroll-scrub in
// reverse, exactly like a frame segment. The cta segment cross-fades in
// and drives its 3 parallax layers directly off local scroll progress.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { Button } from "@/components/ui/Button";
import { HeroGlassBlocks } from "./HeroGlassBlocks";
import { HERO_ROOMS, HERO_TRANSITIONS, roomFrameUrl, transitionVideoUrl } from "./hero-rooms";

const FRAME_COUNT = HERO_ROOMS[0]!.frameCount;
const PX_PER_FRAME = 75;
const PX_PER_VIDEO = 550;
const PAUSE_PX = 400;
const CTA_PX = 2200;
const MAX_DPR = 1.5;
const SCRUB_SMOOTHING = 1.1;

const CTA_BG =
  "https://images.unsplash.com/photo-1765434669956-afcd50058d69?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBiZWRyb29tJTIwaW50ZXJpb3IlMjB3YXJtfGVufDF8fHx8MTc3MjM5ODIzZF8w&ixlib=rb-4.1.0&q=80&w=1080";

let scrollTriggerRegistered = false;

// One ordered list of segments makes up the master timeline.
type Segment =
  | { type: "room"; roomIndex: number; px: number }
  | { type: "pause"; roomIndex: number; px: number }
  | { type: "video"; transitionIndex: number; px: number }
  | { type: "cta"; px: number };

const SEGMENTS: Segment[] = [];
HERO_ROOMS.forEach((_, roomIndex) => {
  SEGMENTS.push({ type: "room", roomIndex, px: FRAME_COUNT * PX_PER_FRAME });
  SEGMENTS.push({ type: "pause", roomIndex, px: PAUSE_PX });
  if (roomIndex < HERO_TRANSITIONS.length) {
    SEGMENTS.push({ type: "video", transitionIndex: roomIndex, px: PX_PER_VIDEO });
  }
});
SEGMENTS.push({ type: "cta", px: CTA_PX });

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
  const ctaBgRef = useRef<HTMLDivElement | null>(null);
  const ctaWatermarkRef = useRef<HTMLDivElement | null>(null);
  const ctaContentRef = useRef<HTMLDivElement | null>(null);

  const [isRevealed, setIsRevealed] = useState(false);
  const [activeRoomIndex, setActiveRoomIndex] = useState(0);
  const [activeVideoIndex, setActiveVideoIndex] = useState<number | null>(null);
  const [pausedRoomIndex, setPausedRoomIndex] = useState<number | null>(null);
  const [ctaActive, setCtaActive] = useState(false);

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
    let lastPausedRoomIndex: number | null = null;
    let lastCtaActive = false;
    let ctaEntered = false;

    const images: HTMLImageElement[][] = HERO_ROOMS.map(() => new Array(FRAME_COUNT));
    const loaded: boolean[][] = HERO_ROOMS.map(() => new Array(FRAME_COUNT).fill(false));
    let room0LoadedCount = 0;
    let revealed = false;
    let trigger: ScrollTrigger | null = null;

    // Per-transition runtime state for the forward-lock/backward-scrub split.
    const videoStates = HERO_TRANSITIONS.map(() => ({ forwardDone: false }));
    let lockedTransitionIndex: number | null = null;
    let lastRawPx = 0;

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
      // reaches them without blocking first paint.
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

    function setPaused(roomIndex: number | null) {
      if (roomIndex === lastPausedRoomIndex) return;
      lastPausedRoomIndex = roomIndex;
      setPausedRoomIndex(roomIndex);
    }

    function setCta(active: boolean) {
      if (active === lastCtaActive) return;
      lastCtaActive = active;
      setCtaActive(active);
    }

    function updateProgressUI(px: number) {
      if (progressBarRef.current) {
        progressBarRef.current.style.width = Math.max(0, Math.min(100, (px / TOTAL_PX) * 100)) + "%";
      }
    }

    // Uses `<` (not `<=`) so an exact segment boundary resolves into the
    // NEXT segment rather than the tail end of the current one — matters
    // most right when a video's onEnded snaps scroll to its end px: without
    // this, that exact position re-resolved into the video segment itself
    // (at localProgress 1), leaving its last frame stuck on screen for one
    // extra scroll tick instead of handing off to the next room immediately.
    function findSegmentAt(px: number) {
      let acc = 0;
      for (let i = 0; i < SEGMENTS.length; i++) {
        const seg = SEGMENTS[i]!;
        const isLast = i === SEGMENTS.length - 1;
        if (px < acc + seg.px || isLast) {
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
    // position past the segment and releases the lock so ordinary
    // scrubbing continues into the next room.
    function lockAndPlayForward(transitionIndex: number, seg: Segment) {
      const video = videoRefs.current[transitionIndex];
      if (!video || !trigger) return;
      const start = segmentStartPx(seg);
      lockedTransitionIndex = transitionIndex;
      setActiveRoom(transitionIndex);
      setActiveVideo(transitionIndex);
      setPaused(null);
      video.currentTime = 0;
      // A legitimate quick reversal can still abort this play() call via
      // the pause() in the release branch below — that's expected, not an
      // error worth surfacing as an unhandled rejection.
      video.play().catch(() => {});
      trigger.scroll(trigger.start + start);
      updateProgressUI(start);
      lastRawPx = start;

      const onEnded = () => {
        video.removeEventListener("ended", onEnded);
        videoStates[transitionIndex]!.forwardDone = true;
        lockedTransitionIndex = null;
        if (trigger) trigger.scroll(trigger.start + start + seg.px);
        lastRawPx = start + seg.px;
      };
      video.addEventListener("ended", onEnded);
    }

    function renderCta(localProgress: number) {
      setActiveRoom(HERO_ROOMS.length - 1);
      setActiveVideo(null);
      setPaused(null);
      setCta(true);

      const bg = ctaBgRef.current;
      const watermark = ctaWatermarkRef.current;
      const content = ctaContentRef.current;
      const bgYPercent = -10 + localProgress * 20;
      const wmYPercent = 22 - localProgress * 44;
      const wmScale = 0.94 + localProgress * 0.08;
      const contentYPercent = 14 - localProgress * 28;
      if (bg) bg.style.transform = `translateY(${bgYPercent}%)`;
      if (watermark) {
        watermark.style.transform = `translateY(calc(-50% + ${wmYPercent}%)) scale(${wmScale})`;
      }
      if (content) content.style.transform = `translateY(${contentYPercent}%)`;

      if (!ctaEntered && content) {
        ctaEntered = true;
        gsap.fromTo(
          content,
          { opacity: 0, y: 40, scale: 0.97 },
          { opacity: 1, y: 0, scale: 1, duration: 0.9, ease: "power3.out", overwrite: true },
        );
      }
    }

    // Master render: resolves the current segment from raw scroll pixels
    // and either draws a frame, holds on a pause, scrubs/locks a video, or
    // drives the CTA's parallax layers.
    //
    // Direction is tracked by comparing against our own last-seen position
    // rather than ScrollTrigger's self.direction — the forward-lock clamp
    // below calls trigger.scroll() to hold position, which is itself a
    // backward scroll motion and would otherwise make self.direction
    // falsely report "user scrolled up" on the very next tick, releasing
    // the lock (and pausing the video) almost immediately after engaging it.
    function handleUpdate(self: ScrollTrigger) {
      const rawPx = self.progress * TOTAL_PX;

      if (lockedTransitionIndex !== null) {
        const lockedSeg = SEGMENTS.find(
          (s) => s.type === "video" && s.transitionIndex === lockedTransitionIndex,
        )!;
        const start = segmentStartPx(lockedSeg);
        if (rawPx < start - 0.5) {
          // Genuinely scrolled back above the lock point — release, pause,
          // and let the normal scrub logic below take over from here.
          videoRefs.current[lockedTransitionIndex]?.pause();
          lockedTransitionIndex = null;
        } else {
          // Still locked: hold the scroll position, the video plays itself.
          if (trigger && rawPx > start) trigger.scroll(trigger.start + start);
          updateProgressUI(start);
          lastRawPx = start;
          return;
        }
      }

      const movingForward = rawPx >= lastRawPx;

      // Re-arm any video the user has scrolled back above, so approaching
      // it forward again re-triggers the locked auto-play from the start.
      for (let i = 0; i < HERO_TRANSITIONS.length; i++) {
        const videoSeg = SEGMENTS.find((s) => s.type === "video" && s.transitionIndex === i)!;
        if (rawPx < segmentStartPx(videoSeg)) videoStates[i]!.forwardDone = false;
      }
      if (rawPx < segmentStartPx(SEGMENTS[SEGMENTS.length - 1]!)) ctaEntered = false;

      const { seg, localProgress } = findSegmentAt(rawPx);

      if (seg.type === "room") {
        setActiveRoom(seg.roomIndex);
        setActiveVideo(null);
        setPaused(null);
        setCta(false);
        renderRoomFrame(seg.roomIndex, 1 + localProgress * (FRAME_COUNT - 1));
      } else if (seg.type === "pause") {
        setActiveRoom(seg.roomIndex);
        setActiveVideo(null);
        setPaused(seg.roomIndex);
        setCta(false);
        renderRoomFrame(seg.roomIndex, FRAME_COUNT);
      } else if (seg.type === "video") {
        const ti = seg.transitionIndex;
        const video = videoRefs.current[ti];
        const state = videoStates[ti]!;
        setPaused(null);
        setCta(false);
        if (!video || !video.duration) {
          setActiveRoom(ti);
          setActiveVideo(null);
          renderRoomFrame(ti, FRAME_COUNT);
        } else if (movingForward && !state.forwardDone) {
          lockAndPlayForward(ti, seg);
          return;
        } else {
          setActiveRoom(ti);
          setActiveVideo(ti);
          video.currentTime = localProgress * video.duration;
        }
      } else {
        renderCta(localProgress);
      }

      lastRawPx = rawPx;
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

  const pausedRoom = pausedRoomIndex !== null ? HERO_ROOMS[pausedRoomIndex]! : null;

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
        className="absolute inset-0 block h-full w-full transition-opacity duration-150 ease-linear"
        style={{ opacity: activeVideoIndex === null && !ctaActive ? 1 : 0 }}
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
        style={{ opacity: ctaActive ? 0 : 1 }}
      />

      <HeroGlassBlocks room={pausedRoom} visible={pausedRoomIndex !== null} />

      {/* CTA — the final segment of this same timeline, not a separate
          section; cross-fades in over the canvas/video and drives its own
          3-layer parallax directly off local scroll progress within its
          allotted range. */}
      <div
        className="absolute inset-0 z-[6] flex min-h-full items-center justify-center overflow-hidden transition-opacity duration-500 ease-out"
        style={{ opacity: ctaActive ? 1 : 0, pointerEvents: ctaActive ? "auto" : "none" }}
      >
        <div className="absolute inset-0">
          <div ref={ctaBgRef} className="absolute inset-[-10%]">
            <ImageWithFallback src={CTA_BG} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="absolute inset-0 bg-enzo-dark/80" />
        </div>

        <div
          ref={ctaWatermarkRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-1/2 select-none text-center font-serif leading-none text-enzo-cream/[0.06]"
          style={{ fontSize: "clamp(6rem, 22vw, 20rem)" }}
        >
          Enzo
        </div>

        <div ref={ctaContentRef} className="relative z-10 px-6 text-center opacity-0">
          <span className="mb-5 block text-[12px] uppercase tracking-[0.3em] text-enzo-sage">
            Start Your Project
          </span>
          <h2
            className="mx-auto max-w-3xl text-enzo-cream"
            style={{ fontSize: "clamp(2.25rem, 5.5vw, 4rem)" }}
          >
            Let&apos;s Build Something Beautiful, Together
          </h2>
          <p className="mx-auto mt-5 max-w-md text-[16px] text-enzo-cream/70 md:text-[18px]">
            A free, no-obligation design consultation — in your home, on your terms.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/booking">Book a Free Consultation</Link>
            </Button>
            <Button asChild variant="secondary" size="lg" className="border-2">
              <Link href="/portfolio">View Our Work</Link>
            </Button>
          </div>
        </div>
      </div>

      <div
        className="absolute inset-x-0 bottom-8 z-[3] flex justify-center gap-2 transition-opacity duration-300"
        style={{ opacity: ctaActive ? 0 : 1 }}
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
