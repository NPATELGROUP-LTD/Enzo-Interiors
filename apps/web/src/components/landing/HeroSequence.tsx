"use client";

// Hero v3 — three room frame sequences (Mediawall, Kitchen, Bedroom), each
// separated by a bespoke parallax "chapter" (no video, no floating
// glassmorphism cards — that copy now lives inside the parallax chapters
// themselves), ending in a redesigned parallax CTA. Everything is one
// continuous story on a single master ScrollTrigger pin+scrub: since
// nothing here plays back in real time anymore, every segment is purely
// scroll-position-driven and therefore trivially, exactly reversible —
// no locking, no direction tricks, no boundary hand-off bugs.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Button } from "@/components/ui/Button";
import { HERO_ROOMS, HERO_TRANSITIONS, roomFrameUrl } from "./hero-rooms";

const FRAME_COUNT = HERO_ROOMS[0]!.frameCount;
const PX_PER_FRAME = 75;
const TRANSITION_PX = 1500;
const CTA_PX = 2200;
const MAX_DPR = 1.5;
const SCRUB_SMOOTHING = 1.1;

let scrollTriggerRegistered = false;

type Layer = "room" | "transition0" | "transition1" | "cta";

type Segment =
  | { type: "room"; roomIndex: number; px: number }
  | { type: "transition"; transitionIndex: number; px: number }
  | { type: "cta"; px: number };

const SEGMENTS: Segment[] = [];
HERO_ROOMS.forEach((_, roomIndex) => {
  SEGMENTS.push({ type: "room", roomIndex, px: FRAME_COUNT * PX_PER_FRAME });
  if (roomIndex < HERO_TRANSITIONS.length) {
    SEGMENTS.push({ type: "transition", transitionIndex: roomIndex, px: TRANSITION_PX });
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

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

// Linear ease-in/out window: 0 before `start`, 1 after `end`, ramping
// between — used to fade transition-chapter copy in and back out as the
// user scrubs through its local progress range.
function windowed(p: number, inStart: number, inEnd: number, outStart: number, outEnd: number) {
  const fadeIn = clamp01((p - inStart) / (inEnd - inStart));
  const fadeOut = 1 - clamp01((p - outStart) / (outEnd - outStart));
  return Math.min(fadeIn, fadeOut);
}

export function HeroSequence() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const loaderFillRef = useRef<HTMLDivElement | null>(null);
  const loaderPctRef = useRef<HTMLSpanElement | null>(null);

  // Chapter 1 — diagonal wipe (mediawall -> kitchen).
  const t0BgRef = useRef<HTMLDivElement | null>(null);
  const t0WipeRef = useRef<HTMLDivElement | null>(null);
  const t0AccentRef = useRef<HTMLDivElement | null>(null);
  const t0ContentRef = useRef<HTMLDivElement | null>(null);

  // Chapter 2 — horizontal marquee + drifting card (kitchen -> bedroom).
  const t1BgRef = useRef<HTMLDivElement | null>(null);
  const t1MarqueeRef = useRef<HTMLDivElement | null>(null);
  const t1CardRef = useRef<HTMLDivElement | null>(null);
  const t1ContentRef = useRef<HTMLDivElement | null>(null);

  // CTA — layered depth stack with a glass panel.
  const ctaBgRef = useRef<HTMLDivElement | null>(null);
  const ctaWatermarkRef = useRef<HTMLDivElement | null>(null);
  const ctaPanelRef = useRef<HTMLDivElement | null>(null);

  const [isRevealed, setIsRevealed] = useState(false);
  const [activeRoomIndex, setActiveRoomIndex] = useState(0);
  const [activeLayer, setActiveLayer] = useState<Layer>("room");

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
    let lastLayer: Layer = "room";
    let t0Entered = false;
    let t1Entered = false;
    let ctaEntered = false;

    const images: HTMLImageElement[][] = HERO_ROOMS.map(() => new Array(FRAME_COUNT));
    const loaded: boolean[][] = HERO_ROOMS.map(() => new Array(FRAME_COUNT).fill(false));
    let room0LoadedCount = 0;
    let revealed = false;
    let trigger: ScrollTrigger | null = null;

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
      void preloadRoom(1).then(() => void preloadRoom(2));
    }

    function setActiveRoom(roomIndex: number) {
      if (roomIndex === lastRoomIndex) return;
      lastRoomIndex = roomIndex;
      setActiveRoomIndex(roomIndex);
    }

    function setLayer(layer: Layer) {
      if (layer === lastLayer) return;
      lastLayer = layer;
      setActiveLayer(layer);
    }

    function updateProgressUI(px: number) {
      if (progressBarRef.current) {
        progressBarRef.current.style.width = Math.max(0, Math.min(100, (px / TOTAL_PX) * 100)) + "%";
      }
    }

    // Uses `<` (not `<=`) so an exact segment boundary resolves into the
    // NEXT segment rather than the tail end of the current one.
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

    // Chapter 1: mediawall's last frame wipes diagonally off-screen,
    // revealing kitchen's first frame underneath, with an accent line
    // moving at a different rate for depth and the transition copy fading
    // in over the middle of the range.
    function renderTransition0(localProgress: number) {
      setActiveRoom(0);
      setLayer("transition0");
      const xOffset = localProgress * 160;
      if (t0WipeRef.current) {
        t0WipeRef.current.style.clipPath =
          `polygon(${-xOffset}% 0%, ${120 - xOffset}% 0%, ${100 - xOffset}% 100%, ${-xOffset}% 100%)`;
      }
      if (t0BgRef.current) {
        t0BgRef.current.style.transform = `scale(${1.08 - localProgress * 0.08}) translateY(${(1 - localProgress) * 3}%)`;
      }
      if (t0AccentRef.current) {
        t0AccentRef.current.style.transform = `translateX(${(localProgress - 0.5) * 40}%) rotate(-8deg)`;
      }
      const textOpacity = windowed(localProgress, 0.12, 0.32, 0.72, 0.92);
      if (t0ContentRef.current) {
        t0ContentRef.current.style.opacity = String(textOpacity);
        t0ContentRef.current.style.transform = `translateY(${(1 - textOpacity) * 24}px)`;
      }
      if (!t0Entered && textOpacity > 0.05) t0Entered = true;
    }

    // Chapter 2: a different mechanic entirely — bedroom's frame drifts in
    // behind an oversized horizontal marquee word, while kitchen's last
    // frame recedes as a bordered photo card.
    function renderTransition1(localProgress: number) {
      setActiveRoom(1);
      setLayer("transition1");
      if (t1BgRef.current) {
        t1BgRef.current.style.transform = `scale(${1.1 - localProgress * 0.1}) translateY(${(localProgress - 0.5) * -4}%)`;
      }
      if (t1MarqueeRef.current) {
        t1MarqueeRef.current.style.transform = `translateX(${(0.5 - localProgress) * 30}%)`;
      }
      if (t1CardRef.current) {
        const cardProgress = clamp01(localProgress / 0.6);
        t1CardRef.current.style.transform =
          `translateY(${-cardProgress * 60}px) scale(${1 - cardProgress * 0.15}) rotate(${-cardProgress * 4}deg)`;
        t1CardRef.current.style.opacity = String(1 - clamp01((localProgress - 0.35) / 0.35));
      }
      const textOpacity = windowed(localProgress, 0.18, 0.4, 0.75, 0.95);
      if (t1ContentRef.current) {
        t1ContentRef.current.style.opacity = String(textOpacity);
        t1ContentRef.current.style.transform = `translateY(${(1 - textOpacity) * 24}px)`;
      }
      if (!t1Entered && textOpacity > 0.05) t1Entered = true;
    }

    // CTA: layered depth stack — blurred backdrop (slowest), oversized
    // rotated watermark (mid), glass panel with the actual offer (fastest
    // + one-time spring entrance).
    function renderCta(localProgress: number) {
      setActiveRoom(HERO_ROOMS.length - 1);
      setLayer("cta");
      if (ctaBgRef.current) {
        ctaBgRef.current.style.transform = `scale(${1.12 - localProgress * 0.06}) translateY(${-10 + localProgress * 20}%)`;
      }
      if (ctaWatermarkRef.current) {
        const wm = -22 + localProgress * 44;
        ctaWatermarkRef.current.style.transform = `translateY(calc(-50% + ${wm}%)) rotate(-6deg) scale(${0.94 + localProgress * 0.1})`;
      }
      if (ctaPanelRef.current) {
        const py = 16 - localProgress * 32;
        ctaPanelRef.current.style.transform = `translateY(${py}px)`;
      }
      if (!ctaEntered && ctaPanelRef.current) {
        ctaEntered = true;
        gsap.fromTo(
          ctaPanelRef.current,
          { opacity: 0, y: 48, scale: 0.96 },
          { opacity: 1, y: 0, scale: 1, duration: 0.9, ease: "power3.out", overwrite: true },
        );
      }
    }

    function handleUpdate(self: ScrollTrigger) {
      const rawPx = self.progress * TOTAL_PX;

      if (rawPx < segmentStartPx(SEGMENTS.find((s) => s.type === "transition" && s.transitionIndex === 0)!)) {
        t0Entered = false;
      }
      if (rawPx < segmentStartPx(SEGMENTS.find((s) => s.type === "transition" && s.transitionIndex === 1)!)) {
        t1Entered = false;
      }
      if (rawPx < segmentStartPx(SEGMENTS[SEGMENTS.length - 1]!)) ctaEntered = false;

      const { seg, localProgress } = findSegmentAt(rawPx);

      if (seg.type === "room") {
        setActiveRoom(seg.roomIndex);
        setLayer("room");
        renderRoomFrame(seg.roomIndex, 1 + localProgress * (FRAME_COUNT - 1));
      } else if (seg.type === "transition") {
        if (seg.transitionIndex === 0) renderTransition0(localProgress);
        else renderTransition1(localProgress);
      } else {
        renderCta(localProgress);
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

  const mediawallRoom = HERO_ROOMS[0]!;
  const kitchenRoom = HERO_ROOMS[1]!;
  const bedroomRoom = HERO_ROOMS[2]!;
  const transition0 = HERO_TRANSITIONS[0]!;
  const transition1 = HERO_TRANSITIONS[1]!;

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
        className="absolute inset-0 block h-full w-full transition-opacity duration-300 ease-linear"
        style={{ opacity: activeLayer === "room" ? 1 : 0 }}
      />

      {/* Chapter 1 — diagonal wipe: mediawall recedes, kitchen emerges. */}
      <div
        className="absolute inset-0 overflow-hidden transition-opacity duration-300 ease-linear"
        style={{ opacity: activeLayer === "transition0" ? 1 : 0 }}
        aria-hidden={activeLayer !== "transition0"}
      >
        <div ref={t0BgRef} className="absolute inset-0">
          <img
            src={roomFrameUrl(kitchenRoom, 1)}
            alt=""
            className="h-full w-full scale-110 object-cover blur-[2px]"
          />
          <div className="absolute inset-0 bg-enzo-dark/55" />
        </div>
        <div ref={t0WipeRef} className="absolute inset-0">
          <img src={roomFrameUrl(mediawallRoom, FRAME_COUNT)} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/5 to-black/45" />
        </div>
        <div
          ref={t0AccentRef}
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-[2px] w-[160%] -translate-x-1/2 -translate-y-1/2 bg-enzo-sage/40"
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-start px-8 md:px-16">
          <div ref={t0ContentRef} className="max-w-md opacity-0">
            <span className="mb-4 block font-sans text-[12px] font-semibold uppercase tracking-[0.3em] text-enzo-sage">
              {transition0.copy.eyebrow}
            </span>
            <h2 className="mb-4 font-serif text-[clamp(1.75rem,4vw,3rem)] font-medium leading-[1.15] text-enzo-cream">
              {transition0.copy.heading}
            </h2>
            <p className="max-w-[38ch] text-[15px] leading-[1.6] text-enzo-cream/75 md:text-[16px]">
              {transition0.copy.body}
            </p>
          </div>
        </div>
      </div>

      {/* Chapter 2 — horizontal marquee + drifting card: kitchen recedes,
          bedroom emerges. Deliberately a different mechanic from Chapter 1. */}
      <div
        className="absolute inset-0 overflow-hidden transition-opacity duration-300 ease-linear"
        style={{ opacity: activeLayer === "transition1" ? 1 : 0 }}
        aria-hidden={activeLayer !== "transition1"}
      >
        <div ref={t1BgRef} className="absolute inset-0">
          <img
            src={roomFrameUrl(bedroomRoom, 1)}
            alt=""
            className="h-full w-full scale-110 object-cover blur-[3px]"
          />
          <div className="absolute inset-0 bg-enzo-dark/60" />
        </div>
        <div
          ref={t1MarqueeRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-[-20%] top-1/2 -translate-y-1/2 select-none whitespace-nowrap text-center font-serif leading-none text-enzo-cream/[0.07]"
          style={{ fontSize: "clamp(4rem, 14vw, 11rem)" }}
        >
          Kitchen&nbsp;&nbsp;·&nbsp;&nbsp;Bedroom&nbsp;&nbsp;·&nbsp;&nbsp;Kitchen&nbsp;&nbsp;·&nbsp;&nbsp;Bedroom
        </div>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-end px-8 md:px-16">
          <div
            ref={t1CardRef}
            aria-hidden="true"
            className="absolute right-[8%] top-[18%] hidden w-[240px] overflow-hidden rounded-[14px] border-2 border-enzo-sand shadow-[0_20px_50px_rgba(0,0,0,0.5)] md:block"
          >
            <img src={roomFrameUrl(kitchenRoom, FRAME_COUNT)} alt="" className="block w-full" />
          </div>
          <div ref={t1ContentRef} className="max-w-md text-right opacity-0">
            <span className="mb-4 block font-sans text-[12px] font-semibold uppercase tracking-[0.3em] text-enzo-sage">
              {transition1.copy.eyebrow}
            </span>
            <h2 className="mb-4 font-serif text-[clamp(1.75rem,4vw,3rem)] font-medium leading-[1.15] text-enzo-cream">
              {transition1.copy.heading}
            </h2>
            <p className="ml-auto max-w-[38ch] text-[15px] leading-[1.6] text-enzo-cream/75 md:text-[16px]">
              {transition1.copy.body}
            </p>
          </div>
        </div>
      </div>

      {/* CTA — final segment, layered depth stack with a signature glass
          panel (this is where the glassmorphism language ends up living). */}
      <div
        className="absolute inset-0 flex items-center justify-center overflow-hidden transition-opacity duration-500 ease-out"
        style={{ opacity: activeLayer === "cta" ? 1 : 0, pointerEvents: activeLayer === "cta" ? "auto" : "none" }}
        aria-hidden={activeLayer !== "cta"}
      >
        <div ref={ctaBgRef} className="absolute inset-0">
          <img
            src={roomFrameUrl(bedroomRoom, FRAME_COUNT)}
            alt=""
            className="h-full w-full scale-110 object-cover blur-[6px]"
          />
          <div className="absolute inset-0 bg-enzo-dark/78" />
        </div>

        <div
          ref={ctaWatermarkRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-1/2 select-none text-center font-serif leading-none text-enzo-cream/[0.055]"
          style={{ fontSize: "clamp(5rem, 18vw, 16rem)" }}
        >
          Enzo
        </div>

        <div
          ref={ctaPanelRef}
          className="relative z-10 mx-6 w-[min(560px,90vw)] rounded-[24px] border border-enzo-cream/15 bg-enzo-forest/60 p-[clamp(28px,5vw,56px)] text-center opacity-0 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
        >
          <span className="mb-5 block font-sans text-[12px] font-semibold uppercase tracking-[0.3em] text-enzo-sage">
            Start Your Project
          </span>
          <h2
            className="mx-auto font-serif font-medium text-enzo-cream"
            style={{ fontSize: "clamp(1.9rem, 4.5vw, 3rem)" }}
          >
            Let&apos;s Build Something Beautiful, Together
          </h2>
          <p className="mx-auto mt-5 max-w-[38ch] text-[15px] leading-[1.6] text-enzo-cream/72 md:text-[16px]">
            A free, no-obligation design consultation — in your home, on your terms.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
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
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-black/45 via-black/10 to-black/40"
        style={{ opacity: activeLayer === "room" ? 1 : 0 }}
      />

      <div
        className="absolute inset-x-0 bottom-8 z-[3] flex justify-center gap-2 transition-opacity duration-300"
        style={{ opacity: activeLayer === "room" ? 1 : 0 }}
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
