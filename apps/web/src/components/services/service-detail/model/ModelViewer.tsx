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
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils";
import type { OrbitState, Viewpoint } from "./scene/sceneKit";
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
  const orbitRef = useRef<OrbitState>({ azimuth: 0, polar: 0 });
  const dragRef = useRef<{ active: boolean; x: number; y: number } | null>(null);

  const [viewIndex, setViewIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [hasOrbited, setHasOrbited] = useState(false);

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
    orbitRef.current.azimuth = 0;
    orbitRef.current.polar = 0;
    setHasOrbited(false);
  }, []);

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
    orbitRef.current.azimuth -= dx * 0.006;
    orbitRef.current.polar -= dy * 0.004;
    if (!hasOrbited && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) setHasOrbited(true);
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
      <div className="mx-auto max-w-[1500px] px-5 py-20 sm:px-6 md:px-12 md:py-28">
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

        <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,19rem)] lg:gap-10">
          {/* ── The stage ── */}
          <div>
            <div
              ref={stageRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              className={cn(
                "relative aspect-[4/3] w-full overflow-hidden rounded-[20px] bg-enzo-forest/25 sm:aspect-[16/10]",
                !showcase && canRender3D && "cursor-grab active:cursor-grabbing",
              )}
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

              {/* Recentre, only once the visitor has actually moved it. */}
              {!showcase && canRender3D && hasOrbited && (
                <button
                  type="button"
                  onClick={resetOrbit}
                  className="absolute right-4 top-4 rounded-full border border-enzo-cream/25 bg-enzo-dark/70 px-4 py-2 text-[12px] text-enzo-cream backdrop-blur transition-colors duration-300 hover:border-enzo-sand hover:text-enzo-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand"
                >
                  Recentre
                </button>
              )}

              {/* What the current viewpoint is looking at. */}
              {!showcase && canRender3D && (
                <p className="pointer-events-none absolute bottom-4 left-5 right-5 text-[12px] text-enzo-cream/65">
                  {view.note}
                </p>
              )}
            </div>

            {/* ── Controls ── */}
            {showcase || !canRender3D ? (
              <p className="mt-5 text-[12.5px] text-enzo-cream/65">
                {canRender3D
                  ? "Turning on its own here — open it on a larger screen to take the controls."
                  : "Motion is off, so this is a photograph of the same room."}
              </p>
            ) : (
              <div className="mt-5 flex flex-wrap items-center gap-2">
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
                        "rounded-full border px-5 py-2.5 text-[13px] transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-2 focus-visible:ring-offset-enzo-dark",
                        on
                          ? "border-enzo-sand bg-enzo-sand text-enzo-forest"
                          : "border-enzo-cream/25 text-enzo-cream/70 hover:border-enzo-cream/60 hover:text-enzo-cream",
                      )}
                    >
                      {viewpoint.label}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setOpen((current) => !current)}
                  aria-pressed={open}
                  className="ml-auto rounded-full border border-enzo-cream/25 px-6 py-2.5 text-[13px] text-enzo-cream transition-colors duration-300 hover:border-enzo-sand hover:text-enzo-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-2 focus-visible:ring-offset-enzo-dark"
                >
                  {open ? control.on : control.off}
                </button>
              </div>
            )}
          </div>

          {/* ── Construction detail ──
              Millimetres and materials, not process claims: the page has
              five other sections for those, and a spec list beside a model
              is the one place a number is worth reading. */}
          <dl className="lg:pt-1">
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
