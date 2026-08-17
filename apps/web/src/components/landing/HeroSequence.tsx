"use client";

// Hero v3 — three room frame sequences (Mediawall, Kitchen, Bedroom), each
// separated by a bespoke parallax "chapter" (no video, no floating
// glassmorphism cards — that copy now lives inside the parallax chapters
// themselves), ending in a split-panel parallax CTA. Everything is one
// continuous story on a single master ScrollTrigger pin+scrub: since
// nothing here plays back in real time anymore, every segment is purely
// scroll-position-driven and therefore trivially, exactly reversible —
// no locking, no direction tricks, no boundary hand-off bugs.
//
// Chapters are given generous scroll distance and a heavy scrub smoothing
// factor specifically so a fast flick-scroll still gets time to visibly
// play out the parallax rather than blowing through it in a frame or two —
// scrub adds lag between raw scroll position and the value ScrollTrigger
// reports, so even an instant huge scroll delta "catches up" over ~2.4s of
// real time instead of snapping straight there.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Button } from "@/components/ui/Button";
import { HERO_ROOMS, HERO_TRANSITIONS, roomFrameUrl } from "./hero-rooms";

const FRAME_COUNT = HERO_ROOMS[0]!.frameCount;
const PX_PER_FRAME = 75;
const TRANSITION_PX = 2000;
const CTA_PX = 2600;
const MAX_DPR = 1.5;
const SCRUB_SMOOTHING = 2.4;

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

  // Chapter 1 — double-door reveal (mediawall -> kitchen).
  const t0BgRef = useRef<HTMLDivElement | null>(null);
  const t0DoorLeftRef = useRef<HTMLDivElement | null>(null);
  const t0DoorRightRef = useRef<HTMLDivElement | null>(null);
  const t0SeamRef = useRef<HTMLDivElement | null>(null);
  const t0ContentRef = useRef<HTMLDivElement | null>(null);

  // Chapter 2 — zoom-through cross-dissolve (kitchen -> bedroom).
  const t1OutgoingRef = useRef<HTMLDivElement | null>(null);
  const t1IncomingRef = useRef<HTMLDivElement | null>(null);
  const t1VignetteRef = useRef<HTMLDivElement | null>(null);
  const t1ContentRef = useRef<HTMLDivElement | null>(null);

  // CTA — kinetic typography manifesto: masked line reveals + a slowly
  // rotating seal badge, no image panel or floating card.
  const ctaBgRef = useRef<HTMLDivElement | null>(null);
  const ctaBadgeRef = useRef<HTMLDivElement | null>(null);
  const ctaEyebrowRef = useRef<HTMLSpanElement | null>(null);
  const ctaLine1Ref = useRef<HTMLSpanElement | null>(null);
  const ctaLine2Ref = useRef<HTMLSpanElement | null>(null);
  const ctaSubRef = useRef<HTMLParagraphElement | null>(null);
  const ctaButtonsRef = useRef<HTMLDivElement | null>(null);

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

    // Chapter 1: mediawall's last frame splits down the middle and opens
    // like double doors, revealing kitchen's first frame behind — the
    // seam line collapses as the doors finish opening, and the copy
    // arrives centered only once the reveal has fully settled.
    function renderTransition0(localProgress: number) {
      setActiveRoom(0);
      setLayer("transition0");
      const doorOpen = clamp01(localProgress / 0.62);
      if (t0BgRef.current) {
        t0BgRef.current.style.transform = `scale(${1.1 - doorOpen * 0.1})`;
      }
      if (t0DoorLeftRef.current) t0DoorLeftRef.current.style.transform = `translateX(${-doorOpen * 100}%)`;
      if (t0DoorRightRef.current) t0DoorRightRef.current.style.transform = `translateX(${doorOpen * 100}%)`;
      if (t0SeamRef.current) {
        t0SeamRef.current.style.opacity = String(1 - doorOpen);
        t0SeamRef.current.style.transform = `scaleY(${1 - doorOpen * 0.5})`;
      }
      const textOpacity = windowed(localProgress, 0.42, 0.6, 0.84, 0.98);
      if (t0ContentRef.current) {
        t0ContentRef.current.style.opacity = String(textOpacity);
        t0ContentRef.current.style.transform = `translateY(${(1 - textOpacity) * 20}px) scale(${0.98 + textOpacity * 0.02})`;
      }
    }

    // Chapter 2: a different mechanic entirely — kitchen's last frame
    // zooms in and dissolves away while bedroom's first frame zooms in
    // from an oversized start and settles to normal scale, crossing paths
    // around the local midpoint with a soft vignette pulse for a "passing
    // through a doorway" feel. Content stays centered and scales in with
    // the crossover instead of sliding from an edge.
    function renderTransition1(localProgress: number) {
      setActiveRoom(1);
      setLayer("transition1");
      const outProgress = clamp01(localProgress / 0.55);
      if (t1OutgoingRef.current) {
        t1OutgoingRef.current.style.transform = `scale(${1 + outProgress * 0.55})`;
        t1OutgoingRef.current.style.opacity = String(1 - clamp01((localProgress - 0.32) / 0.32));
      }
      const inProgress = clamp01((localProgress - 0.3) / 0.62);
      if (t1IncomingRef.current) {
        t1IncomingRef.current.style.transform = `scale(${1.4 - inProgress * 0.4})`;
        t1IncomingRef.current.style.opacity = String(inProgress);
      }
      if (t1VignetteRef.current) {
        const crossover = clamp01(1 - Math.abs(localProgress - 0.5) / 0.32);
        t1VignetteRef.current.style.opacity = String(crossover * 0.55);
      }
      const textOpacity = windowed(localProgress, 0.08, 0.28, 0.72, 0.94);
      if (t1ContentRef.current) {
        t1ContentRef.current.style.opacity = String(textOpacity);
        t1ContentRef.current.style.transform = `scale(${0.94 + textOpacity * 0.06})`;
      }
    }

    // CTA: kinetic typography manifesto — no image panel, no floating
    // card. The headline reveals line by line through a masked wipe as
    // the user scrolls, a slowly rotating seal badge adds a boutique
    // touch, and the offer/buttons arrive last.
    function renderCta(localProgress: number) {
      setActiveRoom(HERO_ROOMS.length - 1);
      setLayer("cta");
      if (ctaBgRef.current) {
        ctaBgRef.current.style.transform = `scale(${1.15 - localProgress * 0.06})`;
      }
      if (ctaEyebrowRef.current) {
        ctaEyebrowRef.current.style.opacity = String(clamp01(localProgress / 0.12));
      }
      const line1 = clamp01((localProgress - 0.06) / 0.22);
      const line2 = clamp01((localProgress - 0.2) / 0.22);
      if (ctaLine1Ref.current) ctaLine1Ref.current.style.transform = `translateY(${(1 - line1) * 100}%)`;
      if (ctaLine2Ref.current) ctaLine2Ref.current.style.transform = `translateY(${(1 - line2) * 100}%)`;
      const subReveal = clamp01((localProgress - 0.42) / 0.18);
      if (ctaSubRef.current) {
        ctaSubRef.current.style.opacity = String(subReveal);
        ctaSubRef.current.style.transform = `translateY(${(1 - subReveal) * 14}px)`;
      }
      const btnReveal = clamp01((localProgress - 0.58) / 0.2);
      if (ctaButtonsRef.current) {
        ctaButtonsRef.current.style.opacity = String(btnReveal);
        ctaButtonsRef.current.style.transform = `translateY(${(1 - btnReveal) * 14}px)`;
      }
      if (ctaBadgeRef.current) {
        ctaBadgeRef.current.style.opacity = String(clamp01((localProgress - 0.1) / 0.25) * 0.9);
      }
    }

    function handleUpdate(self: ScrollTrigger) {
      const rawPx = self.progress * TOTAL_PX;
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

      {/* Chapter 1 — double doors: mediawall's last frame splits and opens,
          revealing kitchen behind. */}
      <div
        className="absolute inset-0 overflow-hidden transition-opacity duration-300 ease-linear"
        style={{ opacity: activeLayer === "transition0" ? 1 : 0 }}
        aria-hidden={activeLayer !== "transition0"}
      >
        <div ref={t0BgRef} className="absolute inset-0">
          <img
            src={roomFrameUrl(kitchenRoom, 1)}
            alt=""
            className="h-full w-full scale-110 object-cover"
          />
          <div className="absolute inset-0 bg-enzo-dark/45" />
        </div>

        <div ref={t0DoorLeftRef} className="absolute inset-y-0 left-0 w-1/2 overflow-hidden">
          <img
            src={roomFrameUrl(mediawallRoom, FRAME_COUNT)}
            alt=""
            className="absolute inset-y-0 left-0 h-full w-[200%] max-w-none object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/10 via-transparent to-black/35" />
        </div>
        <div ref={t0DoorRightRef} className="absolute inset-y-0 right-0 w-1/2 overflow-hidden">
          <img
            src={roomFrameUrl(mediawallRoom, FRAME_COUNT)}
            alt=""
            className="absolute inset-y-0 right-0 h-full w-[200%] max-w-none object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-l from-black/10 via-transparent to-black/35" />
        </div>

        <div
          ref={t0SeamRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-enzo-sage/60"
        />

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-8 text-center">
          <div ref={t0ContentRef} className="max-w-lg opacity-0">
            <span className="mb-4 block font-sans text-[12px] font-semibold uppercase tracking-[0.3em] text-enzo-sage">
              {transition0.copy.eyebrow}
            </span>
            <h2 className="mb-4 font-serif text-[clamp(1.75rem,4vw,3rem)] font-medium leading-[1.15] text-enzo-cream">
              {transition0.copy.heading}
            </h2>
            <p className="mx-auto max-w-[38ch] text-[15px] leading-[1.6] text-enzo-cream/75 md:text-[16px]">
              {transition0.copy.body}
            </p>
          </div>
        </div>
      </div>

      {/* Chapter 2 — zoom-through cross-dissolve: kitchen zooms in and
          dissolves away, bedroom zooms in from oversized and settles.
          Deliberately a different mechanic from Chapter 1's door reveal. */}
      <div
        className="absolute inset-0 overflow-hidden transition-opacity duration-300 ease-linear"
        style={{ opacity: activeLayer === "transition1" ? 1 : 0 }}
        aria-hidden={activeLayer !== "transition1"}
      >
        <div ref={t1OutgoingRef} className="absolute inset-0">
          <img src={roomFrameUrl(kitchenRoom, FRAME_COUNT)} alt="" className="h-full w-full object-cover" />
        </div>
        <div ref={t1IncomingRef} className="absolute inset-0 opacity-0">
          <img src={roomFrameUrl(bedroomRoom, 1)} alt="" className="h-full w-full object-cover" />
        </div>
        <div
          ref={t1VignetteRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-0"
          style={{ background: "radial-gradient(circle at center, transparent 35%, rgba(0,0,0,0.65) 100%)" }}
        />
        <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center px-8 text-center">
          <div ref={t1ContentRef} className="max-w-lg opacity-0">
            <span className="mb-4 block font-sans text-[12px] font-semibold uppercase tracking-[0.3em] text-enzo-sage">
              {transition1.copy.eyebrow}
            </span>
            <h2 className="mb-4 font-serif text-[clamp(1.75rem,4vw,3rem)] font-medium leading-[1.15] text-enzo-cream">
              {transition1.copy.heading}
            </h2>
            <p className="mx-auto max-w-[38ch] text-[15px] leading-[1.6] text-enzo-cream/75 md:text-[16px]">
              {transition1.copy.body}
            </p>
          </div>
        </div>
      </div>

      {/* CTA — final segment, kinetic typography manifesto: no image
          panel, no floating card. Headline reveals line by line through a
          masked wipe as the user scrolls; a slowly rotating seal badge
          adds a boutique touch. */}
      <div
        className="absolute inset-0 flex items-center justify-center overflow-hidden bg-enzo-forest transition-opacity duration-500 ease-out"
        style={{ opacity: activeLayer === "cta" ? 1 : 0, pointerEvents: activeLayer === "cta" ? "auto" : "none" }}
        aria-hidden={activeLayer !== "cta"}
      >
        <div ref={ctaBgRef} className="absolute inset-0 opacity-[0.16]">
          <img
            src={roomFrameUrl(bedroomRoom, FRAME_COUNT)}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-enzo-forest/40 via-enzo-forest/75 to-enzo-forest" />

        <div
          ref={ctaBadgeRef}
          aria-hidden="true"
          className="absolute right-[10%] top-[16%] hidden h-28 w-28 opacity-0 md:block"
        >
          <div className="absolute inset-0 rounded-full border border-enzo-sage/40" />
          <div className="absolute inset-2 animate-[spin_16s_linear_infinite] rounded-full border border-dashed border-enzo-sage/30" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
            <span className="font-serif text-[10px] uppercase tracking-[0.2em] text-enzo-sage">Est.</span>
            <span className="font-serif text-[10px] uppercase tracking-[0.2em] text-enzo-sage">Leicester</span>
          </div>
        </div>

        <div className="relative z-10 max-w-4xl px-8 text-center">
          <span
            ref={ctaEyebrowRef}
            className="mb-6 block font-sans text-[12px] font-semibold uppercase tracking-[0.3em] text-enzo-sage opacity-0"
          >
            04 — Start Your Project
          </span>
          <h2
            className="font-serif font-medium leading-[1.05] text-enzo-cream"
            style={{ fontSize: "clamp(2.5rem, 7vw, 5.5rem)" }}
          >
            <span className="block overflow-hidden">
              <span ref={ctaLine1Ref} className="block" style={{ transform: "translateY(100%)" }}>
                Let&apos;s Build Something
              </span>
            </span>
            <span className="block overflow-hidden">
              <span ref={ctaLine2Ref} className="block" style={{ transform: "translateY(100%)" }}>
                Beautiful, Together
              </span>
            </span>
          </h2>
          <p
            ref={ctaSubRef}
            className="mx-auto mt-6 max-w-[42ch] text-[16px] leading-[1.6] text-enzo-cream/70 opacity-0"
          >
            A free, no-obligation design consultation — in your home, on your terms.
          </p>
          <div ref={ctaButtonsRef} className="mt-10 flex flex-col items-center justify-center gap-4 opacity-0 sm:flex-row">
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
