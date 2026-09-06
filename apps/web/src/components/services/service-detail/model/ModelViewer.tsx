"use client";

// §A3 — the model, explored.
//
// ── What this replaces ──
// The four A3 models were CSS 3D: transformed divs on a hand-rolled `Box3D`,
// turned by a drag. That was a deliberate trade — no WebGL context on a
// service page — and it bought exactly what it cost. Flat faces, no light, no
// material, nothing to look *into*: four boxes doing an impression of
// joinery, when the landing page a click away has a real one.
//
// So the service pages now get the same viewer the landing page has, and the
// same rules with it. Scroll drives nothing: the camera flies between named
// viewpoints on click, dragging orbits it by hand, and one labelled control
// does the thing a photograph cannot — opens the doors, slides the fronts,
// switches the lighting on, takes the panels off.
//
// ── What it costs, and what stops it costing that ──
// One WebGL context, on one service page, and only if you go looking for it:
// the canvas is held behind an IntersectionObserver until the section is
// within 300px, and is never created at all under reduced motion, where the
// section falls back to a still photograph of the same room. That is the same
// budget the landing page already spends.
//
// Mobile gets the model with the controls removed — a hands-off showcase loop
// that turns slowly and cycles the control — plus a line saying where to go
// to drive it. A drag surface on a phone fights the page scroll, and four
// camera chips plus a toggle is more chrome than a 375px column can carry.
//
// ── Second pass: the controls, and what "accurate" means here ──
// The viewer worked and did not behave like a viewer. Five things were wrong,
// and they were all the same thing — the controls were page furniture sitting
// underneath a picture, rather than parts of one instrument:
//
//   1. Azimuth was unbounded. A long drag walked the camera round behind the
//      wall and left you looking at the back of a plasterboard plane. Now
//      clamped in the render loop — see AZIMUTH_LIMIT in scene/sceneKit.
//   2. No zoom at all, on a section whose entire argument is millimetres.
//      Wheel and pinch now scale the viewpoint's own radius between fixed
//      bounds, so no viewpoint can be pushed through a wall or pulled out of
//      the room.
//   3. Drag was the only input, which means the whole section was unusable
//      without a pointer. The stage is now a focusable control with real
//      keyboard operation: arrows orbit, +/− zoom, 0 recentres, Enter works
//      the one action. That is also what makes the `role`/`aria` below honest
//      rather than decorative.
//   4. The chips and the action wrapped in a flex row *below* the stage, so
//      at some widths the action jumped under the viewpoints and the group
//      read as two unrelated rows. They are now docked inside the stage's own
//      bottom edge as one bar, which is where the controls of an instrument
//      live and which cannot reflow away from it.
//   5. The viewpoint's note was laid over the model, competing with the thing
//      it describes. It sits under the stage now, on its own line.
//
// The spec rail stretches to the stage rather than running its own height, so
// a figure and the part of the model it names are on screen together.
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { RotateCcw } from "lucide-react";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils";

/** Local clamp — the render loop has its own, this keeps the ref tidy too. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
import {
  AZIMUTH_LIMIT,
  neutralOrbit,
  ZOOM_MAX,
  ZOOM_MIN,
  type OrbitState,
  type Viewpoint,
} from "./scene/sceneKit";
import type { UnitKind } from "./scene/ServiceScene";

const ServiceScene = dynamic(() => import("./scene/ServiceScene"), {
  ssr: false,
  loading: () => null,
});

export interface ModelSpec {
  value: string;
  label: string;
  note: string;
}

export interface ModelViewerProps {
  id: string;
  kind: UnitKind;
  /** Section heading. */
  label: string;
  lines: string[];
  lede: string;
  /** Named camera positions — three or four reads best. */
  viewpoints: Viewpoint[];
  /** The one thing you can do to the model. */
  control: { off: string; on: string };
  /** Construction detail, not marketing claims. */
  specs: ModelSpec[];
  /** Shown instead of the canvas under reduced motion. */
  fallbackImage: string;
  fallbackAlt: string;
}

export function ModelViewer({
  id,
  kind,
  label,
  lines,
  lede,
  viewpoints,
  control,
  specs,
  fallbackImage,
  fallbackAlt,
}: ModelViewerProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const orbitRef = useRef<OrbitState>(neutralOrbit());
  const dragRef = useRef<{ active: boolean; x: number; y: number } | null>(null);

  const [viewIndex, setViewIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);

  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const prefersReducedMotion = usePrefersReducedMotion();
  const showcase = !isDesktop;
  const canRender3D = !prefersReducedMotion;
  const view = viewpoints[viewIndex] ?? viewpoints[0]!;

  // Hold the WebGL context back until the section is genuinely nearby.
  //
  // Observed *and* measured. An IntersectionObserver is the right tool for
  // "tell me when this scrolls into range" and the wrong one for "is it
  // already in range": it does not reliably deliver an initial record for an
  // element that is on screen at mount, and where it does not, the section
  // sits there as an empty box until you scroll past it and back. So a
  // one-shot timer re-checks the box directly after mount and reveals the
  // scene if it is already in view.
  //
  // The check is in a timer callback rather than in the effect body on
  // purpose: setting state synchronously while an effect runs cascades a
  // second render pass, which is what `react-hooks/set-state-in-effect` is
  // there to stop.
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
            (entries) => {
              if (entries.some((entry) => entry.isIntersecting)) {
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
    setHasMoved(false);
  }, []);

  /**
   * The one place the orbit ref is written, so clamping, the "has been
   * moved" flag and the keyboard/pointer/wheel paths cannot drift apart.
   */
  const nudge = useCallback(
    (dAzimuth: number, dPolar: number, dZoom = 0) => {
      const orbit = orbitRef.current;
      orbit.azimuth = clamp(orbit.azimuth + dAzimuth, -AZIMUTH_LIMIT, AZIMUTH_LIMIT);
      orbit.polar = clamp(orbit.polar + dPolar, -0.42, 0.42);
      orbit.zoom = clamp(orbit.zoom + dZoom, ZOOM_MIN, ZOOM_MAX);
      setHasMoved(true);
    },
    [],
  );

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (showcase || !canRender3D) return;
    // Interactive chrome (Recentre) sits inside this same stage box.
    // Capturing the pointer unconditionally would redirect the subsequent
    // pointerup — and the click it would produce — to the stage, so the
    // button's onClick would silently never fire.
    if ((event.target as HTMLElement).closest("button")) return;
    dragRef.current = { active: true, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag?.active) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;
    // Written straight into the ref the render loop reads, so orbiting never
    // costs a React render.
    if (Math.abs(dx) > 0 || Math.abs(dy) > 0) nudge(-dx * 0.006, -dy * 0.004);
  };

  // Wheel zoom. `passive: false` is not available on a React synthetic
  // handler, so this is attached natively — without preventDefault the page
  // scrolls away underneath the model while you are trying to zoom it, which
  // is the single most irritating thing a 3D viewer can do.
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

  // Keyboard operation, which is what makes the stage a control rather than a
  // picture with a drag listener. Step sizes are a comfortable fraction of
  // the clamp, so a held arrow reaches the limit in about a second.
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (showcase || !canRender3D) return;
    const STEP = 0.09;
    switch (event.key) {
      case "ArrowLeft":
        nudge(STEP, 0);
        break;
      case "ArrowRight":
        nudge(-STEP, 0);
        break;
      case "ArrowUp":
        nudge(0, STEP * 0.6);
        break;
      case "ArrowDown":
        nudge(0, -STEP * 0.6);
        break;
      case "+":
      case "=":
        nudge(0, 0, -0.08);
        break;
      case "-":
      case "_":
        nudge(0, 0, 0.08);
        break;
      case "0":
        resetOrbit();
        break;
      case "Enter":
      case " ":
        setOpen((current) => !current);
        break;
      default:
        return;
    }
    // Only reached when a key above matched, so the stage never swallows Tab
    // or a browser shortcut.
    event.preventDefault();
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current) dragRef.current.active = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <section
      id={id}
      aria-labelledby="model-heading"
      className="relative bg-enzo-dark scroll-mt-24"
    >
      <div className="shell py-20 md:py-28">
        <h2 id="model-heading" className="sr-only">
          The model
        </h2>

        <SectionIntro
          layout="split"
          tone="dark"
          index="A3"
          label={label}
          datum={isDesktop ? "drag to turn" : "turning itself"}
          lines={lines}
          lede={lede}
        />

        {/* `items-stretch`: the rail and the stage are two cells of one row,
            so a figure and the part of the model it names cannot end up on
            different screens. */}
        <div className="mt-12 grid items-stretch gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,19rem)] lg:gap-10">
          {/* ── The stage ── */}
          <div className="flex flex-col">
            <div
              ref={stageRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onKeyDown={onKeyDown}
              // A focusable, labelled control rather than a decorated box.
              // `application` is the correct role for a custom widget that
              // handles its own arrow keys — it tells a screen reader to pass
              // them through instead of using them to navigate.
              {...(!showcase && canRender3D
                ? {
                    tabIndex: 0,
                    role: "application" as const,
                    "aria-label": `${fallbackAlt}. Interactive model — arrow keys turn it, plus and minus zoom, zero recentres, Enter ${control.off.toLowerCase()}.`,
                  }
                : {})}
              className={cn(
                "relative aspect-[4/3] w-full overflow-hidden rounded-[20px] bg-enzo-forest/25 sm:aspect-[16/10]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-2 focus-visible:ring-offset-enzo-dark",
                !showcase && canRender3D && "cursor-grab active:cursor-grabbing",
              )}
              // Vertical panning would otherwise scroll the page mid-drag.
              style={!showcase && canRender3D ? { touchAction: "pan-y" } : undefined}
            >
              {canRender3D ? (
                sceneReady && (
                  <ServiceScene
                    kind={kind}
                    view={view}
                    orbitRef={orbitRef}
                    open={open}
                    showcase={showcase}
                  />
                )
              ) : (
                // Reduced motion: the room, still. No canvas is created.
                <ImageWithFallback
                  src={fallbackImage}
                  alt={fallbackAlt}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}

              {/* The hint, until the model has actually been moved. */}
              {!showcase && canRender3D && !hasMoved && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-1/2 top-5 -translate-x-1/2 rounded-full bg-enzo-dark/70 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-enzo-cream/85 backdrop-blur-sm"
                >
                  Drag to turn · scroll to zoom
                </span>
              )}

              {/* ── The control bar ──
                  Docked inside the stage's own bottom edge, so it is part of
                  the instrument and cannot reflow away from it. One row, one
                  scroll axis on narrow screens, and the action pinned right
                  where a primary action belongs. */}
              {!showcase && canRender3D && (
                <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-enzo-dark/90 via-enzo-dark/70 to-transparent px-3 pb-3 pt-10 sm:px-4 sm:pb-4">
                  <div
                    role="group"
                    aria-label="Viewpoint"
                    className="flex min-w-0 flex-1 gap-1 overflow-x-auto rounded-full bg-enzo-dark/70 p-1 backdrop-blur-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  >
                    {viewpoints.map((viewpoint, index) => {
                      const on = index === viewIndex;
                      return (
                        <button
                          key={viewpoint.id}
                          type="button"
                          onClick={() => {
                            setViewIndex(index);
                            resetOrbit();
                          }}
                          aria-pressed={on}
                          className={cn(
                            "shrink-0 rounded-full px-4 py-2 text-[12.5px] whitespace-nowrap transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand",
                            on
                              ? "bg-enzo-sand text-enzo-forest"
                              : "text-enzo-cream/75 hover:bg-enzo-cream/10 hover:text-enzo-cream",
                          )}
                        >
                          {viewpoint.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Recentre — always present once it can do something, and
                      an icon rather than a word so it never crowds the
                      action beside it. */}
                  <button
                    type="button"
                    onClick={resetOrbit}
                    disabled={!hasMoved}
                    aria-label="Recentre the model"
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-enzo-dark/70 text-enzo-cream backdrop-blur-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand",
                      hasMoved
                        ? "opacity-100 hover:bg-enzo-cream/15"
                        : "pointer-events-none opacity-0",
                    )}
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setOpen((current) => !current)}
                    aria-pressed={open}
                    className={cn(
                      "shrink-0 rounded-full px-5 py-2.5 text-[12.5px] font-medium whitespace-nowrap transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand",
                      open
                        ? "bg-enzo-cream text-enzo-forest"
                        : "bg-enzo-forest text-enzo-cream hover:bg-enzo-forest-light",
                    )}
                  >
                    {open ? control.on : control.off}
                  </button>
                </div>
              )}
            </div>

            {/* The viewpoint's note, under the stage rather than over the
                model it is describing. `key` replays the fade per viewpoint,
                which is what makes it read as a caption changing rather than
                a paragraph that happens to differ. */}
            <p
              key={showcase ? "showcase" : view.id}
              className="mt-4 animate-in fade-in duration-500 text-[13px] leading-[1.65] text-enzo-cream/70 motion-reduce:animate-none"
            >
              {showcase || !canRender3D
                ? canRender3D
                  ? "Turning on its own here — open it on a larger screen to take the controls."
                  : "Motion is off, so this is a photograph of the same room."
                : view.note}
            </p>

            {!showcase && canRender3D && (
              <p className="mt-2 text-[11.5px] leading-[1.6] text-enzo-cream/45">
                Illustrative render. Keyboard: arrows turn, +/− zoom, 0 recentres.
              </p>
            )}
          </div>

          {/* ── Construction detail ──
              Millimetres and materials, not process claims: the page has
              five other sections for those, and a spec list beside a model
              is the one place a number is worth reading. */}
          <dl className="flex flex-col lg:justify-between lg:pt-1">
            {specs.map((spec) => (
              <div
                key={spec.label}
                className="border-t border-enzo-cream/12 py-4 last:border-b sm:py-5"
              >
                {/* Below `sm` the label sits beside the figure rather than
                    ranged right. Pinned right on a phone column it ends up
                    a line of tracked-out caps hard against the sheet edge,
                    which reads as an overflow whether or not it is one. */}
                <dt className="flex flex-wrap items-baseline gap-x-3 gap-y-1 sm:justify-between sm:gap-4">
                  <span className="font-title text-[1.35rem] font-semibold tabular-nums tracking-[-0.03em] text-enzo-cream">
                    {spec.value}
                  </span>
                  <span className="font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-enzo-sand sm:tracking-[0.24em]">
                    {spec.label}
                  </span>
                </dt>
                <dd className="mt-1.5 text-[13px] leading-[1.6] text-enzo-cream/70 sm:mt-2">
                  {spec.note}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
