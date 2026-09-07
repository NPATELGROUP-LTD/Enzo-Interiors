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
// Chapters are given generous scroll distance and a direct (unsmoothed) scrub
// factor specifically so a fast flick-scroll still gets time to visibly
// play out the parallax rather than blowing through it in a frame or two.
// See SCRUB_SMOOTHING and TRANSITION_PX below for how the two are tuned and
// why the scrub is direct rather than eased.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { HeroCtaButton } from "./HeroCtaButton";
import { HeroRotatingImage } from "./HeroRotatingImage";
import { RotatingBadge } from "./RotatingBadge";
import { HERO_ROOMS, HERO_TRANSITIONS, roomFrameUrl } from "./hero-rooms";

const FRAME_COUNT = HERO_ROOMS[0]!.frameCount;
// Scroll distance mapped to each frame — lower is faster (less scrolling
// needed to get through a room's 144 frames).
//
// Was 42/1400/1800, which made the intro ~22,700px — around 190 wheel
// notches before the site proper started, which reads as "scrolling
// forever". At 14/850/1100 the three rooms take ~6,000px and the whole
// intro lands near 8,600px: roughly a third of the travel, while each room
// still gets several screen-heights of scrub rather than flicking past.
const PX_PER_FRAME = 14;
// The transitions are the only two places in the sequence with something to
// *read* — a room's 144 frames are a moving photograph, but a transition
// holds a line of copy on a still. At 850px those two chapters travelled at
// exactly the same rate as the photography either side of them, which meant
// the text arrived and left inside about half a screen of wheel: fast enough
// that most people never learned it was there, and anyone who did notice had
// to scroll back up to finish the sentence.
//
// Scroll distance *is* the speed control here — the animation is scrubbed, so
// giving a chapter more pixels makes the same motion take more wheel. 1700
// roughly doubles the time the copy is legible without slowing the rooms, so
// the sequence now has a rhythm (move, pause to read, move) rather than one
// constant rate throughout.
const TRANSITION_PX = 1700;
const CTA_PX = 1100;
const MAX_DPR = 1.5;
// ── Why this is `true` and not a number ──
// A numeric scrub adds a *second* easing on top of the one Lenis already
// applies to the document scroll. The page smooths the wheel, and then
// ScrollTrigger smooths the smoothed value again before it reaches the frame
// index — so the frames arrive visibly behind the pointer, and stopping the
// wheel does not stop the sequence: it keeps drifting for another second and
// a bit while the scrub catches up. On a 144-frame photographic sequence that
// reads as the page being laggy rather than as the motion being smooth, which
// is the opposite of the intent.
//
// `scrub: true` binds the frame to the scroll position with no extra lag of
// its own. The motion is still smooth — Lenis is still easing the scroll it
// is fed — but the sequence now stops when the wheel stops, and the frame
// under your finger is the frame you asked for.
const SCRUB_SMOOTHING = true;

// Set once the visitor has scrolled all the way to the CTA segment.
// sessionStorage (not localStorage) so it's per-tab: a fresh tab always
// starts at the top, but navigating to another page and back within the
// same tab resumes at the CTA instead of replaying the whole intro.
const HAS_SEEN_CTA_KEY = "enzo:hero-seen-cta";
// Where "resume at the CTA" actually lands, as a fraction of the way
// through the CTA segment — NOT 0 (that's the segment's start, where
// renderCta()'s reveal thresholds haven't fired yet, i.e. still hidden)
// and not exactly 1 either (right at the pin's boundary). renderCta()'s
// own reveal thresholds all complete well before this, so anywhere in
// this range renders identically fully-revealed — this same fraction is
// used for the initial manual paint, the suppression cutoff, and the
// actual scroll target below, so all three agree on the exact same
// visual state and the handoff between them is invisible.
const CTA_RESUME_FRACTION = 0.85;

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
// The absolute (whole-timeline) px position CTA_RESUME_FRACTION resolves
// to — i.e. how far into the pinned scroll range "resume at the CTA"
// actually targets.
const CTA_RESUME_RAW_PX = TOTAL_PX - CTA_PX * (1 - CTA_RESUME_FRACTION);

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
  // ScrollTrigger pins this inner element, never the <section>. Pinning wraps
  // whatever it pins in a `.pin-spacer` div, which re-parents that node — and
  // React still believes the <section> is a direct child of the page
  // container. Crossing the md breakpoint swaps HeroSequence for HeroStatic,
  // React tries to remove a <section> that now lives inside a spacer, and the
  // whole tree throws `removeChild`. Keeping the pin one level in means the
  // node React owns never moves, so the swap is always safe.
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
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

  const [activeRoomIndex, setActiveRoomIndex] = useState(0);
  const [activeLayer, setActiveLayer] = useState<Layer>("room");
  // Local loading state for the first room's frames — no cross-component
  // event needed since the loader now lives inside this component instead
  // of a separate global overlay.
  const [framesReady, setFramesReady] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);

  // Split out from the main effect below and run as a layout effect (not a
  // plain effect) specifically so it commits before the browser's first
  // paint of a client-side navigation TO this page — otherwise the Navbar
  // and decorative site-frame border would flash visible for a frame
  // before being hidden. (The very first document load has its own fix:
  // a blocking inline script in layout.tsx, since even a layout effect
  // can't run before hydration.)
  useLayoutEffect(() => {
    // Intro (rooms/chapters) hides the Navbar + decorative frame entirely;
    // both fade back in only once the CTA segment is reached. See
    // .site-navbar/.site-frame + body[data-hero-chrome] in theme.css.
    document.body.dataset.heroChrome = "hidden";
    return () => {
      delete document.body.dataset.heroChrome;
    };
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!section || !stage || !canvas) return;
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

    // Resume returning visitors at the CTA instead of replaying the whole
    // intro — see setLayer() below for where this flag gets set, and the
    // resumingAtCta handling in handleUpdate() for why. sessionStorage
    // (not localStorage) so it's per-tab: a fresh tab always starts at the
    // top, but navigating to another page and back within the same tab
    // resumes at the CTA instead.
    let hasSeenCta = false;
    try {
      hasSeenCta = window.sessionStorage.getItem(HAS_SEEN_CTA_KEY) === "true";
    } catch {
      // Ignore — falls back to playing the intro from the top.
    }
    // `scrub` deliberately lags self.progress behind the raw scroll
    // position (see the file-header comment) — so once we jump scroll to
    // the CTA's position below, ScrollTrigger's own progress takes ~2.4
    // real seconds to visibly "catch up" to it, which would replay the
    // whole intro fast-forwarded instead of landing instantly. This flag
    // makes handleUpdate() ignore those catch-up ticks (leaving the
    // CTA state we paint manually, further down, on screen) until real
    // progress has actually reached the CTA on its own — at which point
    // it hands off to normal scroll-driven rendering with no visible
    // discontinuity, since both already agree on the same state.
    let resumingAtCta = hasSeenCta;

    const images: HTMLImageElement[][] = HERO_ROOMS.map(() => new Array(FRAME_COUNT));
    const loaded: boolean[][] = HERO_ROOMS.map(() => new Array(FRAME_COUNT).fill(false));
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

    function revealIfReady() {
      if (disposed || revealed) return;
      revealed = true;
      setFramesReady(true);
      ScrollTrigger.refresh();
      // Recalculating trigger geometry above can itself reset the scroll
      // position (GSAP briefly clears pins to remeasure natural layout) —
      // so the resume-at-CTA jump has to happen AFTER this refresh, not
      // before it, or refresh() just undoes it.
      if (resumingAtCta && trigger) {
        window.scrollTo({ top: trigger.start + CTA_RESUME_RAW_PX, behavior: "auto" });
      }
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
      if (layer === "cta") {
        try {
          window.sessionStorage.setItem(HAS_SEEN_CTA_KEY, "true");
        } catch {
          // Privacy modes can disable storage — resuming at the CTA on a
          // later visit just won't work in that case, which is a safe
          // fallback (it degrades to always replaying the intro).
        }
      }
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

      // See resumingAtCta's declaration above: while the eased scrub
      // progress is still catching up to the scroll jump below, ignore
      // its intermediate ticks entirely (they'd otherwise repaint the
      // room/transition frames the visitor already skipped past) and keep
      // showing the CTA state painted manually further down. Once real
      // progress genuinely reaches the CTA on its own, hand off to normal
      // rendering — both already agree on the same state at that point,
      // so there's no visible jump.
      if (resumingAtCta) {
        if (rawPx < CTA_RESUME_RAW_PX) return;
        resumingAtCta = false;
      }

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

    // Paint the finished CTA state immediately (handleUpdate will ignore
    // the scrub's catch-up ticks until they genuinely reach it — see
    // resumingAtCta above), so a returning visitor never sees the intro
    // replay even for a moment. Uses CTA_RESUME_FRACTION (not 1) so this
    // matches exactly what handleUpdate will render once real progress
    // catches up to CTA_RESUME_RAW_PX — same input, same output, so the
    // handoff between them can't produce even a subpixel jump.
    if (resumingAtCta) renderCta(CTA_RESUME_FRACTION);

    // No animation of its own (pure onUpdate watcher) — attached to an empty
    // paused timeline so it measures on GSAP's deferred path instead of
    // synchronously. See useGSAP.ts's revealOnScroll comment for why a bare
    // ScrollTrigger.create here can crash with "reading 'end'".
    trigger = ScrollTrigger.create({
      trigger: stage,
      pin: stage,
      start: "top top",
      end: "+=" + TOTAL_PX,
      pinSpacing: true,
      scrub: SCRUB_SMOOTHING,
      anticipatePin: 1,
      onUpdate: handleUpdate,
      animation: gsap.timeline({ paused: true }),
    });

    // Every trigger below this one had its start/end measured before this pin
    // existed, so they all still believe the page is ~9,000px shorter than it
    // is — section 02 in particular would read as already scrolled past and
    // sit on its final stage. The hero mounts a frame after the rest of the
    // page (Hero swaps its placeholder for this component only once mounted),
    // so this refresh cannot be folded into the one above.
    requestAnimationFrame(() => {
      if (!disposed) ScrollTrigger.refresh();
    });

    resizeCanvas();

    window.addEventListener("resize", onWindowResize);
    window.addEventListener("orientationchange", onWindowResize);

    // Drives the loader below directly with real decode progress instead
    // of a fixed animation timeline.
    let firstRoomLoaded = 0;
    void preloadRoom(0, () => {
      firstRoomLoaded += 1;
      setLoadProgress(Math.round((firstRoomLoaded / FRAME_COUNT) * 100));
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
        if (instance.trigger === stage || instance.trigger === section) instance.kill(true);
      });
      gsap.killTweensOf(section);
    };
  }, []);

  const mediawallRoom = HERO_ROOMS[0]!;
  const kitchenRoom = HERO_ROOMS[1]!;
  const bedroomRoom = HERO_ROOMS[2]!;
  const transition0 = HERO_TRANSITIONS[0]!;
  const transition1 = HERO_TRANSITIONS[1]!;

  return (
    <section ref={sectionRef} className="relative w-full">
      <div
        ref={stageRef}
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

      {/* Frame loader — covers the canvas until the first room's 144
          frames are actually decoded, so there's never a blank/empty
          canvas before playback can start. Scoped to this section only
          (not a site-wide splash) and driven by the real decode progress
          tracked above, not a fixed timer. Also gated on activeLayer:
          a returning visitor who's resumed at the CTA (see the
          hasSeenCta scroll-jump above) is looking at the CTA content, not
          the room canvas, so this must never cover that just because the
          room frames are still finishing their preload in the background. */}
      <div
        aria-live="polite"
        aria-label="Loading the showcase"
        aria-hidden={framesReady || activeLayer !== "room"}
        className="absolute inset-0 z-[20] grid place-items-center bg-enzo-dark transition-opacity duration-500 ease-out"
        style={{
          opacity: framesReady || activeLayer !== "room" ? 0 : 1,
          pointerEvents: framesReady || activeLayer !== "room" ? "none" : "auto",
        }}
      >
        <div className="flex w-full max-w-xs flex-col items-center px-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- tiny fixed loader mark, not worth next/image's overhead */}
          <img src="/logo/enzo-white.png" alt="Enzo Interiors" className="h-10 w-auto sm:h-12" />
          <div className="mt-8 w-full">
            <div className="h-[3px] w-full overflow-hidden rounded-full bg-enzo-cream/15">
              <div
                className="h-full rounded-full bg-enzo-cream transition-[width] duration-150 ease-out"
                style={{ width: `${loadProgress}%` }}
              />
            </div>
            <div className="mt-4 flex items-center justify-between gap-4 text-enzo-cream/70">
              <span className="font-sans text-[11px] uppercase tracking-[0.22em]">Loading the showcase</span>
              <span className="shrink-0 font-sans text-[11px] tabular-nums tracking-[0.08em] text-enzo-cream/75">
                {loadProgress}%
              </span>
            </div>
          </div>
        </div>
      </div>

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
            <h2 className="mb-4 font-title text-[clamp(1.75rem,4vw,3rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-enzo-cream">
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
          className="pointer-events-none absolute inset-x-[-20%] top-1/2 -translate-y-1/2 select-none whitespace-nowrap text-center font-title leading-none text-enzo-cream/[0.07]"
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
            <h2 className="mb-4 font-title text-[clamp(1.75rem,4vw,3rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-enzo-cream">
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
                className="font-sans mt-5 line-clamp-2 max-w-[44ch] text-[15px] font-normal leading-[1.7] text-enzo-cream/70 opacity-0"
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
                  <p className="font-sans text-[12px] text-enzo-cream/70">Bespoke. Handcrafted.</p>
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

      {/* Room label — fills the otherwise-empty top of the frame with the
          same editorial eyebrow style used in the transition chapters
          below, and doubles as a "which room am I in" cue while scrubbing
          through the frame sequence, not just at idle. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-6 top-8 z-[4] flex items-center gap-3 text-enzo-cream/70 transition-opacity duration-300 sm:left-10 sm:top-10"
        style={{ opacity: activeLayer === "room" ? 1 : 0 }}
      >
        <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.32em] text-enzo-sage">
          {String(activeRoomIndex + 1).padStart(2, "0")}
        </span>
        <span className="h-px w-8 bg-enzo-cream/30" />
        <span className="font-sans text-[11px] uppercase tracking-[0.32em]">{HERO_ROOMS[activeRoomIndex]!.label}</span>
      </div>

      {/* Scroll cue — the only other UI visible at the very start, since
          Navbar and the site frame are both hidden until the CTA arrives.
          The lead-in line gives it a bit more visual weight than type
          alone. */}
      <div
        ref={scrollHintRef}
        className="pointer-events-none absolute inset-x-0 bottom-20 z-[4] flex flex-col items-center gap-3 text-enzo-cream/70"
      >
        <span className="h-8 w-px bg-enzo-cream/30" />
        <span className="text-[11px] uppercase tracking-[0.35em]">Scroll to Begin</span>
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
      </div>
    </section>
  );
}
