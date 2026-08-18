"use client";

// Hero v3 — three room frame sequences (Mediawall, Kitchen, Bedroom), each
// separated by a bespoke parallax "chapter" (no video, no floating
// glassmorphism cards — that copy now lives inside the parallax chapters
// themselves), ending in an asymmetric parallax CTA. Everything is one
// continuous story on a single master ScrollTrigger pin+scrub: since
// nothing here plays back in real time anymore, every segment is purely
// scroll-position-driven and therefore trivially, exactly reversible —
// no locking, no direction tricks, no boundary hand-off bugs.
//
// The intro (rooms + chapters) reads as an unbranded cinematic teaser: no
// Navbar, no site frame, just a "scroll to begin" cue — see the
// data-hero-chrome toggling below and .site-navbar/.site-frame in
// theme.css. Both fade in together only once the CTA segment arrives,
// marking the shift from "intro" to "the site starts here."
//
// Chapters are given generous scroll distance and a heavy scrub smoothing
// factor specifically so a fast flick-scroll still gets time to visibly
// play out the parallax rather than blowing through it in a frame or two —
// scrub adds lag between raw scroll position and the value ScrollTrigger
// reports, so even an instant huge scroll delta "catches up" over ~2.4s of
// real time instead of snapping straight there.
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { HeroCtaButton } from "./HeroCtaButton";
import { HeroRotatingImage } from "./HeroRotatingImage";
import { RotatingBadge } from "./RotatingBadge";
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
  const scrollHintRef = useRef<HTMLDivElement | null>(null);

  // Chapter 1 — double-door reveal (mediawall -> kitchen).
  const t0BgRef = useRef<HTMLDivElement | null>(null);
  const t0DoorLeftRef = useRef<HTMLDivElement | null>(null);
  const t0DoorRightRef = useRef<HTMLDivElement | null>(null);
  const t0SeamRef = useRef<HTMLDivElement | null>(null);
  const t0ContentRef = useRef<HTMLDivElement | null>(null);

  // Chapter 2 — horizontal marquee + drifting photo card (kitchen -> bedroom).
  const t1BgRef = useRef<HTMLDivElement | null>(null);
  const t1MarqueeRef = useRef<HTMLDivElement | null>(null);
  const t1CardRef = useRef<HTMLDivElement | null>(null);
  const t1ContentRef = useRef<HTMLDivElement | null>(null);

  // CTA — high-end editorial layout: luminous kinetic typography on the left +
  // interactive frosted consultation preview card on the right.
  const ctaBgRef = useRef<HTMLDivElement | null>(null);
  const ctaCardRef = useRef<HTMLDivElement | null>(null);
  const ctaEyebrowRef = useRef<HTMLDivElement | null>(null);
  const ctaLine1Ref = useRef<HTMLSpanElement | null>(null);
  const ctaLine2Ref = useRef<HTMLSpanElement | null>(null);
  const ctaSubRef = useRef<HTMLParagraphElement | null>(null);
  const ctaButtonsRef = useRef<HTMLDivElement | null>(null);
  const ctaChip1Ref = useRef<HTMLDivElement | null>(null);
  const ctaChip2Ref = useRef<HTMLDivElement | null>(null);

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

    // Intro (rooms/chapters) hides the Navbar + decorative frame entirely;
    // both fade back in only once the CTA segment is reached. See
    // .site-navbar/.site-frame + body[data-hero-chrome] in theme.css.
    document.body.dataset.heroChrome = "hidden";

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
      if (disposed || revealed) return;
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
      document.body.dataset.heroChrome = layer === "cta" ? "visible" : "hidden";
    }

    function updateProgressUI(px: number) {
      if (progressBarRef.current) {
        progressBarRef.current.style.width = Math.max(0, Math.min(100, (px / TOTAL_PX) * 100)) + "%";
      }
      if (scrollHintRef.current) {
        scrollHintRef.current.style.opacity = String(1 - clamp01(px / 500));
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

    // Chapter 2: kitchen's last frame is pinned to the wall as a framed,
    // labeled photo card that drifts up and away, while an oversized
    // horizontal marquee word and bedroom's first frame settle in behind
    // it — a different mechanic from Chapter 1's door reveal.
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
        const cardProgress = clamp01((localProgress - 0.05) / 0.55);
        t1CardRef.current.style.transform = `translateY(${-cardProgress * 55}px) scale(${1 - cardProgress * 0.08})`;
        t1CardRef.current.style.opacity = String(1 - clamp01((localProgress - 0.62) / 0.3));
      }
      const textOpacity = windowed(localProgress, 0.2, 0.4, 0.8, 0.97);
      if (t1ContentRef.current) {
        t1ContentRef.current.style.opacity = String(textOpacity);
        t1ContentRef.current.style.transform = `translateY(${(1 - textOpacity) * 24}px)`;
      }
    }

    // CTA: 2-column luxury editorial layout — eyebrow badge, masked line-by-line
    // headline reveal (with luminous warm gradient text), subtext, buttons,
    // trust chips, plus a floating frosted consultation preview card on the right.
    function renderCta(localProgress: number) {
      setActiveRoom(HERO_ROOMS.length - 1);
      setLayer("cta");
      if (ctaBgRef.current) {
        ctaBgRef.current.style.transform =
          `scale(${1.15 - localProgress * 0.06}) translateX(${(0.5 - localProgress) * -3}%)`;
      }
      if (ctaEyebrowRef.current) {
        const eyebrowReveal = clamp01(localProgress / 0.1);
        ctaEyebrowRef.current.style.opacity = String(eyebrowReveal);
        ctaEyebrowRef.current.style.transform = `translateY(${(1 - eyebrowReveal) * 12}px)`;
      }
      const line1 = clamp01((localProgress - 0.05) / 0.2);
      const line2 = clamp01((localProgress - 0.14) / 0.2);
      if (ctaLine1Ref.current) ctaLine1Ref.current.style.transform = `translateY(${(1 - line1) * 100}%)`;
      if (ctaLine2Ref.current) ctaLine2Ref.current.style.transform = `translateY(${(1 - line2) * 100}%)`;
      const subReveal = clamp01((localProgress - 0.24) / 0.16);
      if (ctaSubRef.current) {
        ctaSubRef.current.style.opacity = String(subReveal);
        ctaSubRef.current.style.transform = `translateY(${(1 - subReveal) * 14}px)`;
      }
      const btnReveal = clamp01((localProgress - 0.34) / 0.16);
      if (ctaButtonsRef.current) {
        ctaButtonsRef.current.style.opacity = String(btnReveal);
        ctaButtonsRef.current.style.transform = `translateY(${(1 - btnReveal) * 14}px)`;
      }
      const cardReveal = clamp01((localProgress - 0.2) / 0.25);
      if (ctaCardRef.current) {
        ctaCardRef.current.style.opacity = String(cardReveal);
        ctaCardRef.current.style.transform = `translateY(${(1 - cardReveal) * 20}px)`;
      }
      [ctaChip1Ref, ctaChip2Ref].forEach((ref, i) => {
        const chipReveal = clamp01((localProgress - (0.2 + i * 0.08)) / 0.12);
        if (ref.current) {
          ref.current.style.opacity = String(chipReveal);
          ref.current.style.transform = `translateY(${(1 - chipReveal) * 16}px)`;
        }
      });
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
        if (disposed) return;
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
      // Revert the pin before React removes the section. Without the explicit
      // revert flag, ScrollTrigger can leave its spacer/placeholder in the DOM
      // during a desktop-to-mobile media-query swap, which causes React's
      // removeChild error in development.
      trigger?.kill(true);
      ScrollTrigger.getAll().forEach((instance) => {
        if (instance.trigger === section) instance.kill(true);
      });
      gsap.killTweensOf(section);
      delete document.body.dataset.heroChrome;
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

      {/* Chapter 2 — horizontal marquee + drifting framed photo card:
          kitchen recedes, bedroom emerges. Different mechanic from
          Chapter 1's door reveal. */}
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
          <div className="absolute right-[10%] top-[14%] hidden md:block">
            <div
              ref={t1CardRef}
              className="w-[300px] overflow-hidden rounded-[18px] border-2 border-enzo-sand shadow-[0_28px_70px_rgba(0,0,0,0.55)]"
            >
              <img src={roomFrameUrl(kitchenRoom, FRAME_COUNT)} alt="" className="block w-full" />
              <div className="bg-enzo-sand px-4 py-2.5">
                <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.15em] text-enzo-forest">
                  Kitchen — Complete
                </span>
              </div>
            </div>
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

      {/* CTA — final segment. A product-showcase composition: copy and a
          compact project card on the left, with a rounded image feature on
          the right — all kept in Enzo's existing dark palette. */}
      <div
        className="absolute inset-0 overflow-hidden bg-enzo-dark transition-opacity duration-500 ease-out"
        style={{ opacity: activeLayer === "cta" ? 1 : 0, pointerEvents: activeLayer === "cta" ? "auto" : "none" }}
        aria-hidden={activeLayer !== "cta"}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 55% at 10% 15%, rgba(138,158,140,0.16), transparent 60%), radial-gradient(55% 45% at 92% 90%, rgba(212,201,181,0.08), transparent 60%)",
          }}
        />

        <div className="relative z-10 mx-auto flex h-full w-full max-w-[1200px] flex-col justify-center px-7 sm:px-10 lg:px-0">
          <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-[500px_480px] lg:justify-center lg:gap-24">

            {/* ── Left ── */}
            <div className="flex flex-col items-start">

              {/* The CTA title deliberately uses the site's Space Grotesk
                  display face: a distinctive sans-serif contrast to the
                  editorial serif used elsewhere on the site. */}
              <div ref={ctaEyebrowRef} className="hidden" aria-hidden="true" />
              <h2
                className="font-display font-semibold leading-[0.98] tracking-[-0.055em] text-enzo-cream"
                style={{ fontSize: "clamp(3.15rem, 4.8vw, 4.25rem)" }}
              >
                <span className="block overflow-hidden pb-[0.12em] -mb-[0.12em]">
                  <span ref={ctaLine1Ref} className="block whitespace-nowrap" style={{ transform: "translateY(100%)" }}>
                    Stop <em className="text-enzo-sage not-italic">Dreaming</em>.
                  </span>
                </span>
                <span className="block overflow-hidden pb-[0.12em] -mb-[0.12em]">
                  <span ref={ctaLine2Ref} className="block whitespace-nowrap" style={{ transform: "translateY(100%)" }}>
                    Start <em className="text-enzo-sage not-italic">Building</em>.
                  </span>
                </span>
              </h2>

              {/* Subtext */}
              <p
                ref={ctaSubRef}
                className="font-sans mt-5 line-clamp-2 max-w-[44ch] text-[15px] font-normal leading-[1.7] text-enzo-cream/60 opacity-0"
              >
                One free consultation. Zero pressure. Built for you.
              </p>

              {/* Pill CTA — label + embedded arrow circle */}
              <div ref={ctaButtonsRef} className="mt-9 opacity-0">
                <HeroCtaButton href="/booking" label="Book Free Consultation" />
              </div>

              {/* Thumbnail card + rotating badge, inline row */}
              <div className="mt-14 flex items-start gap-10">
                <div ref={ctaChip1Ref} className="w-[260px] shrink-0 opacity-0">
                  <div className="overflow-hidden rounded-2xl">
                    <img
                      src="/Wardrobes.jpeg"
                      alt="Bespoke fitted wardrobes by Enzo Interiors"
                      title="Bespoke Wardrobes"
                      className="block aspect-[3/2] w-full object-cover"
                    />
                  </div>
                  <p className="font-display mt-3 text-[13px] font-semibold text-enzo-cream">Wardrobe Suite</p>
                  <p className="font-sans text-[12px] text-enzo-cream/50">Bespoke. Handcrafted.</p>
                </div>

                <div ref={ctaChip2Ref} className="relative z-10 -mt-10 flex h-[150px] items-center opacity-0">
                  <RotatingBadge label="View Portfolio" href="/portfolio" size={150} />
                </div>
              </div>
            </div>

            {/* ── Right ── */}
            <div ref={ctaCardRef} className="w-full max-w-[480px] opacity-0">
              <HeroRotatingImage
                imageRef={ctaBgRef}
                className="max-w-[480px]"
                images={[
                  {
                    src: "/Bedroom.jpeg",
                    alt: "Bespoke bedroom interior by Enzo Interiors",
                    title: "Bespoke Bedroom",
                  },
                  {
                    src: "/centeredKitchen.jpeg",
                    alt: "Bespoke kitchen interior by Enzo Interiors",
                    title: "Bespoke Kitchen",
                  },
                  {
                    src: "/fireplaceMediawall.jpeg",
                    alt: "Bespoke media wall interior by Enzo Interiors",
                    title: "Bespoke Media Wall",
                  },
                ]}
                notchRadius={0}
                notchFeather={0}
              />
            </div>

          </div>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-black/45 via-black/10 to-black/40"
        style={{ opacity: activeLayer === "room" ? 1 : 0 }}
      />

      {/* Scroll cue — the only UI visible at the very start, since Navbar
          and the site frame are both hidden until the CTA arrives. */}
      <div
        ref={scrollHintRef}
        className="pointer-events-none absolute inset-x-0 bottom-20 z-[4] flex flex-col items-center gap-2 text-enzo-cream/70"
      >
        <span className="text-[11px] uppercase tracking-[0.3em]">Scroll to Begin</span>
        <ChevronDown className="h-4 w-4 animate-bounce" />
      </div>

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
