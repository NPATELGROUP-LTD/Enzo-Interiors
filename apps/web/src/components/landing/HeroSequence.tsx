"use client";

// Full-bleed scroll-scrubbed hero: pins the section and draws the frame at
// `public/frames/hero/frame_0001.webp`...`frame_0097.webp` matching current
// scroll progress onto a canvas. Ported from the standalone "Video Scroll
// Effect" project's ScrollSequence component — simplified to this app's
// fixed frame-naming convention (no generic filePrefix/pad/ext props) and
// with Lenis dropped in favor of native smooth scroll + GSAP's own `scrub`
// interpolation (see plan: apps/web already proves this pattern works via
// ScrollReveal/FullScreenScrollFX without a smooth-scroll library).
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { HeroCaption } from "./HeroCaption";
import { HeroIntro } from "./HeroIntro";
import { HERO_SCENES, findSceneIndex } from "./hero-scenes";

const FRAME_COUNT = 97;
const FRAME_PATH = "/frames/hero";
const PX_PER_FRAME = 64;
const SCRUB = 0.8;
const MAX_DPR = 1.5;

let scrollTriggerRegistered = false;

function frameUrl(n: number) {
  return `${FRAME_PATH}/frame_${String(n).padStart(4, "0")}.webp`;
}

export function HeroSequence() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const loaderFillRef = useRef<HTMLDivElement | null>(null);
  const loaderPctRef = useRef<HTMLSpanElement | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);

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

    const images = new Array<HTMLImageElement>(FRAME_COUNT);
    const loaded = new Array<boolean>(FRAME_COUNT).fill(false);
    let loadedCount = 0;
    let revealed = false;
    let lastSceneIndex = -1;

    let dpr = 1;
    let targetIndex = 0;
    let lastDrawnIndex = -1;
    let rafPending = false;
    let disposed = false;

    function revealIfReady() {
      if (revealed || !loaded[0]) return;
      revealed = true;
      setIsRevealed(true);
      ScrollTrigger.refresh();
    }

    function updateLoaderProgress() {
      const pct = Math.round((loadedCount / FRAME_COUNT) * 100);
      if (loaderFillRef.current) loaderFillRef.current.style.width = pct + "%";
      if (loaderPctRef.current) loaderPctRef.current.textContent = String(pct);
    }

    function preloadFrames() {
      for (let i = 0; i < FRAME_COUNT; i++) {
        const index = i;
        const img = new Image();
        img.decoding = "async";
        img.onload = () => {
          if (disposed) return;
          loaded[index] = true;
          loadedCount++;
          updateLoaderProgress();
          revealIfReady();
          requestRender(targetIndex);
        };
        img.onerror = () => {
          if (disposed) return;
          loadedCount++;
          updateLoaderProgress();
          revealIfReady();
        };
        img.src = frameUrl(index + 1);
        images[index] = img;
      }
    }

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

    function updateActiveScene(idx: number) {
      const sceneIndex = findSceneIndex(HERO_SCENES, idx + 1);
      if (sceneIndex !== lastSceneIndex) {
        lastSceneIndex = sceneIndex;
        setActiveSceneIndex(sceneIndex);
      }
    }

    function renderFrame() {
      rafPending = false;
      const idx = targetIndex;
      let drawIdx = idx;

      if (!loaded[drawIdx]) {
        let found = -1;
        for (let i = idx; i >= 0; i--) {
          if (loaded[i]) {
            found = i;
            break;
          }
        }
        if (found === -1) {
          for (let j = idx; j < FRAME_COUNT; j++) {
            if (loaded[j]) {
              found = j;
              break;
            }
          }
        }
        if (found === -1) return;
        drawIdx = found;
      }

      const img = images[drawIdx];
      if (drawIdx !== lastDrawnIndex && img) {
        lastDrawnIndex = drawIdx;
        drawImageCover(img);
      }
      updateActiveScene(idx);
    }

    function requestRender(idx: number) {
      targetIndex = idx;
      if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(renderFrame);
      }
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
      lastDrawnIndex = -1;
      renderFrame();
    }

    let resizeTimer: number | null = null;
    function onWindowResize() {
      if (resizeTimer) cancelAnimationFrame(resizeTimer);
      resizeTimer = requestAnimationFrame(() => {
        resizeCanvas();
        ScrollTrigger.refresh();
      });
    }

    resizeCanvas();
    preloadFrames();

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: "+=" + FRAME_COUNT * PX_PER_FRAME,
      pin: true,
      pinSpacing: true,
      scrub: SCRUB,
      anticipatePin: 1,
      onUpdate: (self) => {
        const idx = Math.round(self.progress * (FRAME_COUNT - 1));
        requestRender(idx);
        if (progressBarRef.current) {
          progressBarRef.current.style.width = self.progress * 100 + "%";
        }
      },
    });

    window.addEventListener("resize", onWindowResize);
    window.addEventListener("orientationchange", onWindowResize);

    return () => {
      disposed = true;
      window.removeEventListener("resize", onWindowResize);
      window.removeEventListener("orientationchange", onWindowResize);
      if (resizeTimer) cancelAnimationFrame(resizeTimer);
      trigger.kill();
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

      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-black/45 via-black/10 to-black/40"
      />

      <div className="absolute inset-x-0 top-0 z-[2] flex justify-center px-6 pt-28 md:pt-32">
        <HeroIntro />
      </div>

      <HeroCaption scenes={HERO_SCENES} activeIndex={activeSceneIndex} revealed={isRevealed} />

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
