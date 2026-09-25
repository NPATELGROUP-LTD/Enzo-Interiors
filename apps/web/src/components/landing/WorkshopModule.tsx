"use client";

// Section 03 — the media wall, explored.
//
// This used to be a diagram: an object in the middle with four marketing
// claims on leader lines around it, turning as you scrolled. Two problems. The
// claims ("free consultation", "one team start to finish") were saying what
// section 02 already says at length, so the two sections read as one idea told
// twice. And a scroll-driven camera means the visitor can never actually look
// at the thing — it moves whenever they move.
//
// So this is a viewer, not a diagram. Scroll drives nothing here. The camera
// flies between named viewpoints on click, dragging orbits it by hand, a
// switch opens the doors, and the copy is construction detail — millimetres
// and materials — rather than process claims.
//
// Mobile gets the same model with the controls removed: a hands-off showcase
// loop that turns slowly and cycles the doors open and shut, plus a line
// saying where to go to drive it. A drag surface on a phone would fight the
// page scroll, and four camera chips plus a toggle is more chrome than a
// 375px column can carry.
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { Monitor, RotateCcw } from "lucide-react";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { fromOnScroll, useGSAP } from "@/hooks/useGSAP";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { DUR, EASE, REVEAL_START } from "@/lib/motion";
import { cn } from "@/lib/utils";
import {
  AZIMUTH_LIMIT,
  neutralOrbit,
  ZOOM_MAX,
  ZOOM_MIN,
  type OrbitState,
  type Viewpoint,
} from "@/lib/scene-common";
import type { HomeContent, MediaItem } from "@/lib/content";

const MediaWallScene = dynamic(() => import("./MediaWallScene"), {
  ssr: false,
  loading: () => null,
});

/**
 * The section's column template, used by BOTH the heading row and the content
 * row. Declared once because the whole point is that the two agree — see the
 * note on SectionIntro's `splitTemplate`. Two hand-matched strings drift the
 * first time either is touched.
 */
const PANEL_COLUMNS = "minmax(0,1fr) minmax(0,20rem)";

// The specs beside the model are construction facts, not process claims —
// deliberately not overlapping §02 — and they are authored with the rest of
// this section's copy.
export function WorkshopModule({
  content,
  fallbackImage,
}: {
  content: HomeContent["workshop"];
  /** Shown instead of the canvas under reduced motion. */
  fallbackImage: MediaItem;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const orbitRef = useRef<OrbitState>(neutralOrbit());
  const dragRef = useRef<{ active: boolean; x: number; y: number } | null>(null);

  const [viewIndex, setViewIndex] = useState(0);
  const [doorsOpen, setDoorsOpen] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [hasOrbited, setHasOrbited] = useState(false);

  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const prefersReducedMotion = usePrefersReducedMotion();
  const showcase = !isDesktop;
  const canRender3D = !prefersReducedMotion;
  const viewpoints: Viewpoint[] = content.viewpoints;
  const view = viewpoints[viewIndex]!;

  // Hold the WebGL context back until the section is genuinely nearby.
  //
  // Observed *and* measured, matching §A3's viewer (see model/ModelViewer).
  // An IntersectionObserver is the right tool for "tell me when this scrolls
  // into range" and the wrong one for "is it already in range": it does not
  // reliably deliver an initial record for an element that is on screen at
  // mount, and where it does not, the section sits as an empty box until you
  // scroll past it and back. A one-shot timer re-checks the box directly and
  // reveals the scene if it is already in view.
  //
  // The check runs in a timer callback rather than in the effect body on
  // purpose: setting state synchronously while an effect runs cascades a
  // second render pass, which is what `react-hooks/set-state-in-effect` exists
  // to stop.
  useEffect(() => {
    if (!canRender3D) return;
    const stage = stageRef.current;
    if (!stage) return;

    const MARGIN = 300;
    let cancelled = false;
    const reveal = () => {
      if (!cancelled) setSceneReady(true);
    };

    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            ([entry]) => {
              if (entry?.isIntersecting) {
                reveal();
                observer?.disconnect();
              }
            },
            { rootMargin: `${MARGIN}px 0px` },
          );
    observer?.observe(stage);

    const timer = window.setTimeout(() => {
      const rect = stage.getBoundingClientRect();
      if (rect.top < window.innerHeight + MARGIN && rect.bottom > -MARGIN) {
        reveal();
        observer?.disconnect();
      }
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      observer?.disconnect();
    };
  }, [canRender3D]);

  const resetOrbit = useCallback(() => {
    const neutral = neutralOrbit();
    orbitRef.current.azimuth = neutral.azimuth;
    orbitRef.current.polar = neutral.polar;
    orbitRef.current.zoom = neutral.zoom;
    setHasOrbited(false);
  }, []);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (showcase || !canRender3D) return;
    // Interactive chrome (the Recentre button) sits inside this same stage
    // box. Capturing the pointer here unconditionally redirects the
    // subsequent pointerup — and the click it would otherwise produce — to
    // the stage itself, so the button's onClick silently never fires.
    if ((event.target as HTMLElement).closest("button")) return;
    dragRef.current = { active: true, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  /** The one place the orbit ref is written, so every input is clamped alike. */
  const nudge = useCallback((dAzimuth: number, dPolar: number, dZoom = 0) => {
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    const orbit = orbitRef.current;
    orbit.azimuth = clamp(orbit.azimuth + dAzimuth, -AZIMUTH_LIMIT, AZIMUTH_LIMIT);
    orbit.polar = clamp(orbit.polar + dPolar, -0.42, 0.42);
    orbit.zoom = clamp(orbit.zoom + dZoom, ZOOM_MIN, ZOOM_MAX);
    setHasOrbited(true);
  }, []);

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag?.active) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;
    // Written straight into the ref the render loop reads, so orbiting never
    // costs a React render.
    nudge(-dx * 0.006, -dy * 0.004);
  };

  // Wheel zoom, attached natively so it can preventDefault — without that
  // the page scrolls out from under the model while you are zooming it.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || showcase || !canRender3D) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      nudge(0, 0, event.deltaY * 0.0009);
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [showcase, canRender3D, nudge]);

  // Keyboard operation — the stage is a control, not a picture with a drag
  // listener, and arrow keys are what make that true without a pointer.
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (showcase || !canRender3D) return;
    const STEP = 0.09;
    switch (event.key) {
      case "ArrowLeft": nudge(STEP, 0); break;
      case "ArrowRight": nudge(-STEP, 0); break;
      case "ArrowUp": nudge(0, STEP * 0.6); break;
      case "ArrowDown": nudge(0, -STEP * 0.6); break;
      case "+": case "=": nudge(0, 0, -0.08); break;
      case "-": case "_": nudge(0, 0, 0.08); break;
      case "0": resetOrbit(); break;
      case "Enter": case " ": setDoorsOpen((current) => !current); break;
      default: return;
    }
    event.preventDefault();
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current) dragRef.current.active = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  useGSAP(sectionRef, (section, reduced) => {
    const stage = section.querySelector<HTMLElement>("[data-viewer-stage]");
    const specs = gsap.utils.toArray<HTMLElement>("[data-spec]", section);

    if (reduced) {
      gsap.set([stage, ...specs].filter(Boolean), { opacity: 1, y: 0, scale: 1 });
      return;
    }

    if (stage) {
      fromOnScroll(
        stage,
        {
          opacity: 0,
          y: 40,
          scale: 0.95,
          duration: 1.05,
          ease: EASE.editorial,
        },
        { trigger: stage, start: "top 88%" },
      );
    }
    // The viewpoint/doors controls used to get their own `once: true`
    // ScrollTrigger keyed off their own position. That trigger's boundary is
    // computed once, on mount — before the 3D canvas has necessarily
    // resized/settled — and never refreshes, so on some loads the page had
    // already scrolled past the (stale) trigger point by the time it fired,
    // leaving the controls stuck at opacity 0. They're required chrome (the
    // only way to change viewpoint), not decoration, so they no longer wait
    // on scroll at all — they simply render at full opacity with the stage.
    if (specs.length) {
      fromOnScroll(
        specs,
        {
          opacity: 0,
          y: 24,
          duration: DUR.enter,
          ease: EASE.enter,
          stagger: 0.07,
        },
        { trigger: specs[0], start: REVEAL_START },
      );
    }
  });

  return (
    <section
      ref={sectionRef}
      id="home-workshop"
      aria-labelledby="craft-heading"
      className="relative overflow-hidden bg-enzo-forest scroll-mt-24 lg:flex lg:h-[100svh] lg:min-h-[46rem] lg:flex-col"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 38%, rgba(138,158,140,0.2), transparent 66%), radial-gradient(45% 40% at 92% 96%, rgba(212,201,181,0.09), transparent 60%)",
        }}
      />

      <div className="relative shell flex flex-col py-20 md:py-28 lg:min-h-0 lg:flex-1 lg:py-[clamp(2.5rem,5vh,4.5rem)]">
        <h2 id="craft-heading" className="sr-only">
          {content.srHeading}
        </h2>

        <SectionIntro
          layout="split"
          splitTemplate={PANEL_COLUMNS}
          tone="dark"
          index={content.index}
          label={content.label}
          datum={content.datum}
          lines={content.lines}
          lede={showcase ? content.ledeShowcase : content.lede}
        />

        {/* ── One screen, one sequence ──
            This used to be a normal stacked section: heading, then a 16:10
            viewer, then the controls, then four specifications under them. On
            a laptop that ran to about a screen and a half, so the model and
            the numbers describing the model were never on screen together —
            you read "18 mm carcass" with the carcass already scrolled off the
            top, and the controls that turn it sat in the fold between the two.
            Split across two screens, an interactive viewer stops being
            interactive: people scroll past it rather than drive it.

            From `lg` the section is exactly one viewport and the parts are
            laid out inside it in the order you use them — read the heading,
            look at the model, reach for the controls under it, check the
            numbers beside it. The stage takes whatever height is left
            (`flex-1 min-h-0`) instead of asking for a fixed ratio, so the
            composition holds from a 700px laptop to a 1600px display without
            ever pushing a control off the bottom. */}
        {/* Same template and the same gutter as the heading row above, so the
            model lines up under the title and the specification rail lines up
            under the lede — one spine, not two rows that happen to share a
            width. `gap-x-12` because that is what SectionIntro's split row
            uses, and two grids can only share a spine if they share a gutter. */}
        <div
          className="mt-10 grid gap-8 lg:mt-[clamp(1.5rem,3vh,2.75rem)] lg:min-h-0 lg:flex-1 lg:gap-x-12 lg:[grid-template-columns:var(--panel-cols)]"
          style={{ "--panel-cols": PANEL_COLUMNS } as React.CSSProperties}
        >
          {/* ── Viewer ── */}
          <div className="flex min-h-0 flex-col">
            <div
              ref={stageRef}
              data-viewer-stage
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onKeyDown={onKeyDown}
              {...(!showcase && canRender3D
                ? {
                    tabIndex: 0,
                    role: "application" as const,
                    "aria-label": content.controls.stageAriaLabel,
                  }
                : {})}
              className="relative aspect-[3/4] w-full max-h-[220px] overflow-hidden rounded-[22px] border border-enzo-cream/10 bg-enzo-forest/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-2 focus-visible:ring-offset-enzo-forest sm:aspect-[16/10] sm:max-h-none lg:aspect-auto lg:min-h-0 lg:flex-1"
              style={{
                cursor: !showcase && canRender3D ? "grab" : "default",
                touchAction: showcase ? "auto" : "none",
              }}
            >
              {canRender3D && sceneReady ? (
                <>
                  <MediaWallScene
                    view={showcase ? viewpoints[1]! : view}
                    orbitRef={orbitRef}
                    doorsOpen={doorsOpen}
                    showcase={showcase}
                  />

                  {showcase ? (
                    <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-gradient-to-t from-enzo-dark/85 to-transparent px-4 pb-4 pt-10 text-center text-[11.5px] leading-snug text-enzo-cream/85">
                      <Monitor className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {content.controls.showcaseNote}
                    </span>
                  ) : (
                    <>
                      {/* The hint, until the model has actually been moved. */}
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-0 top-5 flex justify-center transition-opacity duration-500"
                        style={{ opacity: hasOrbited ? 0 : 1 }}
                      >
                        <span className="rounded-full bg-enzo-dark/70 px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-enzo-cream/85 backdrop-blur-sm">
                          {content.controls.hint}
                        </span>
                      </div>

                      {/* ── The control dock ──
                          Docked inside the stage's own bottom edge, exactly as
                          §A3 on a service page does it (see ModelViewer). It
                          used to be a wrapping flex row *below* the stage,
                          which had the two faults that arrangement always has:
                          at some widths the toggle dropped under the viewpoint
                          chips and the group read as two unrelated rows, and
                          nothing about it said the controls belonged to the
                          picture rather than to the page. Controls of an
                          instrument sit on the instrument.

                          One row, one horizontal scroll axis for the chips on
                          a narrow stage, recentre as an icon so it never
                          crowds the action, and the action pinned right. */}
                      <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-enzo-dark/90 via-enzo-dark/70 to-transparent px-3 pb-3 pt-10 sm:px-4 sm:pb-4">
                        <div
                          role="group"
                          aria-label={content.controls.viewpointGroupLabel}
                          className="flex min-w-0 flex-1 gap-1 overflow-x-auto rounded-full bg-enzo-dark/70 p-1 backdrop-blur-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                        >
                          {viewpoints.map((viewpoint, index) => {
                            const isActive = index === viewIndex;
                            return (
                              <button
                                key={viewpoint.id}
                                type="button"
                                data-viewer-control
                                onClick={() => {
                                  setViewIndex(index);
                                  resetOrbit();
                                }}
                                aria-pressed={isActive}
                                className={cn(
                                  "shrink-0 rounded-full px-4 py-2 text-[12.5px] whitespace-nowrap transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand",
                                  isActive
                                    ? "bg-enzo-sand text-enzo-forest"
                                    : "text-enzo-cream/75 hover:bg-enzo-cream/10 hover:text-enzo-cream",
                                )}
                              >
                                {viewpoint.label}
                              </button>
                            );
                          })}
                        </div>

                        <button
                          type="button"
                          data-viewer-control
                          onClick={resetOrbit}
                          disabled={!hasOrbited}
                          aria-label={content.controls.recentreLabel}
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-enzo-dark/70 text-enzo-cream backdrop-blur-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand",
                            hasOrbited
                              ? "opacity-100 hover:bg-enzo-cream/15"
                              : "pointer-events-none opacity-0",
                          )}
                        >
                          <RotateCcw className="h-4 w-4" aria-hidden="true" />
                        </button>

                        <button
                          type="button"
                          data-viewer-control
                          onClick={() => setDoorsOpen((current) => !current)}
                          aria-pressed={doorsOpen}
                          className={cn(
                            "flex shrink-0 items-center gap-2.5 rounded-full px-5 py-2.5 text-[12.5px] font-medium whitespace-nowrap transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand",
                            doorsOpen
                              ? "bg-enzo-cream text-enzo-forest"
                              : "bg-enzo-forest text-enzo-cream hover:bg-enzo-forest-light",
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className="relative block h-4 w-7 rounded-full transition-colors duration-300"
                            style={{
                              background: doorsOpen
                                ? "var(--enzo-forest)"
                                : "rgba(242,240,235,0.25)",
                            }}
                          >
                            <span
                              className="absolute top-0.5 block h-3 w-3 rounded-full transition-transform duration-300 ease-out"
                              style={{
                                background: doorsOpen
                                  ? "var(--enzo-cream)"
                                  : "var(--enzo-forest)",
                                transform: doorsOpen
                                  ? "translateX(14px)"
                                  : "translateX(2px)",
                              }}
                            />
                          </span>
                          {doorsOpen
                            ? content.controls.doorsOpenLabel
                            : content.controls.doorsClosedLabel}
                        </button>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <ImageWithFallback
                  src={fallbackImage.src}
                  alt={content.fallback.alt}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              )}
            </div>

            <p className="mt-3 text-[11.5px] leading-[1.5] text-enzo-cream/60 lg:order-last lg:mt-2 lg:max-w-[70ch] lg:text-[11px]">
              {content.disclaimer}
            </p>

            {/* The viewpoint's note, under the stage rather than over the
                model it describes. The controls it used to sit beside are now
                docked inside the stage — see the dock above. */}
            {!showcase && canRender3D && (
              <p
                key={view.id}
                className="mt-4 animate-in fade-in duration-500 text-[13px] leading-[1.6] text-enzo-cream/75 motion-reduce:animate-none"
              >
                {view.note}
              </p>
            )}
          </div>

          {/* ── Spec column ──
              A compact rail at the top of its column, not four figures spread
              over the full height of it. `justify-between` was the first
              instinct — span the model, so the eye can travel between a detail
              on the render and the figure naming it — and in practice it
              stretched to a column that is taller than the model (the model's
              side also carries the controls and the disclaimer), so the last
              figure sat well below the render it describes with ~90px of dead
              ground between every pair. A tight rail aligned to the top of the
              stage reads as a specification; an evenly-spread one reads as a
              column that could not decide how tall it was. */}
          <div className="flex flex-col gap-5 lg:min-h-0 lg:gap-6 lg:overflow-y-auto">
            {content.specs.map((spec) => (
              <div key={spec.label} data-spec className="border-t border-enzo-cream/15 pt-4">
                {/* `justify-between` + a bumped-up label size only below
                    `lg`: at phone width the value and its unit-word are the
                    only two things on the line, so the word can afford to
                    be a real right-hand column instead of a small tag
                    crowding the number's baseline. `lg:` restores both to
                    the original tight, left-running pair. */}
                <div className="flex items-baseline justify-between gap-3 lg:justify-start">
                  <span className="font-display text-[1.6rem] font-semibold tracking-[-0.02em] text-enzo-cream">
                    {spec.value}
                  </span>
                  <span className="font-display text-right text-[11.5px] font-semibold uppercase tracking-[0.18em] text-enzo-sand lg:text-left lg:text-[10px] lg:tracking-[0.26em]">
                    {spec.label}
                  </span>
                </div>
                <p className="mt-1.5 text-[12.5px] leading-[1.6] text-enzo-cream/70">
                  {spec.note}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
