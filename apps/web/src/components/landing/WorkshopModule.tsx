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
import { VIEWPOINTS, type OrbitState } from "./MediaWallScene";

const MediaWallScene = dynamic(() => import("./MediaWallScene"), {
  ssr: false,
  loading: () => null,
});

/** Construction facts, not process claims — deliberately not overlapping §02. */
const SPECS = [
  { value: "18 mm", label: "Carcass", note: "Moisture-resistant board, edge-banded on every visible face." },
  { value: "4 mm", label: "Shadow gap", note: "Consistent across the run and scribed to the wall at both ends." },
  { value: "75 in", label: "TV recess", note: "Cut to your screen, with cable routes dropped before we fit." },
  { value: "5 yr", label: "Guarantee", note: "On every joint, hinge and soft-close runner we fit." },
];

export function WorkshopModule() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const orbitRef = useRef<OrbitState>({ azimuth: 0, polar: 0 });
  const dragRef = useRef<{ active: boolean; x: number; y: number } | null>(null);

  const [viewIndex, setViewIndex] = useState(0);
  const [doorsOpen, setDoorsOpen] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [hasOrbited, setHasOrbited] = useState(false);

  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const prefersReducedMotion = usePrefersReducedMotion();
  const showcase = !isDesktop;
  const canRender3D = !prefersReducedMotion;
  const view = VIEWPOINTS[viewIndex]!;

  // Hold the WebGL context back until the section is genuinely nearby.
  useEffect(() => {
    if (!canRender3D) return;
    const stage = stageRef.current;
    if (!stage) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setSceneReady(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px 0px" },
    );
    observer.observe(stage);
    return () => observer.disconnect();
  }, [canRender3D]);

  const resetOrbit = useCallback(() => {
    orbitRef.current.azimuth = 0;
    orbitRef.current.polar = 0;
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
      className="relative overflow-hidden bg-enzo-forest scroll-mt-24"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 38%, rgba(138,158,140,0.2), transparent 66%), radial-gradient(45% 40% at 92% 96%, rgba(212,201,181,0.09), transparent 60%)",
        }}
      />

      <div className="relative mx-auto max-w-[1500px] px-5 py-20 sm:px-6 md:px-12 md:py-28">
        <h2 id="craft-heading" className="sr-only">
          How it is built
        </h2>

        <SectionIntro
          layout="split"
          tone="dark"
          index="03"
          label="Construction"
          datum="18 mm carcass"
          lines={["Built like furniture,", "not like flat-pack."]}
          lede={
            showcase
              ? "A media wall, drawn to the millimetre — turning through open and shut."
              : "Turn it, open the doors, look inside. A media wall, drawn to the millimetre."
          }
        />

        <div className="mt-10 grid gap-8 lg:mt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,290px)] lg:gap-14">
          {/* ── Viewer ── */}
          <div>
            <div
              ref={stageRef}
              data-viewer-stage
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              className="relative aspect-[3/4] w-full max-h-[220px] overflow-hidden rounded-[22px] border border-enzo-cream/10 bg-enzo-forest/40 sm:aspect-[16/10] sm:max-h-none"
              style={{
                cursor: !showcase && canRender3D ? "grab" : "default",
                touchAction: showcase ? "auto" : "none",
              }}
            >
              {canRender3D && sceneReady ? (
                <>
                  <MediaWallScene
                    view={showcase ? VIEWPOINTS[1]! : view}
                    orbitRef={orbitRef}
                    doorsOpen={doorsOpen}
                    showcase={showcase}
                  />

                  {showcase ? (
                    <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-gradient-to-t from-enzo-dark/85 to-transparent px-4 pb-4 pt-10 text-center text-[11.5px] leading-snug text-enzo-cream/85">
                      <Monitor className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      Open on a desktop to turn it and open the doors yourself
                    </span>
                  ) : (
                    <>
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center transition-opacity duration-500"
                        style={{ opacity: hasOrbited ? 0 : 1 }}
                      >
                        <span className="rounded-full bg-enzo-dark/70 px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-enzo-cream/85 backdrop-blur-sm">
                          Drag to turn
                        </span>
                      </div>
                      {hasOrbited && (
                        <button
                          type="button"
                          onClick={resetOrbit}
                          className="absolute right-4 top-4 inline-flex items-center gap-2 rounded-full bg-enzo-dark/70 px-3.5 py-2 text-[11px] uppercase tracking-[0.18em] text-enzo-cream backdrop-blur-sm transition-colors duration-300 hover:bg-enzo-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand"
                        >
                          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                          Recentre
                        </button>
                      )}
                    </>
                  )}
                </>
              ) : (
                <ImageWithFallback
                  src="/fireplaceMediawall.jpeg"
                  alt="Bespoke media wall built by Enzo Interiors"
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              )}
            </div>

            <p className="mt-3 text-[11.5px] leading-[1.5] text-enzo-cream/70">
              Illustrative 3D render only — not the actual finished piece. Your final design is
              built to the exact specification, materials and measurements agreed with you.
            </p>

            {/* ── Controls — desktop only ── */}
            {!showcase && canRender3D && (
              <>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Camera viewpoints">
                    {VIEWPOINTS.map((viewpoint, index) => {
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
                          className="rounded-full border px-4 py-2.5 text-[12.5px] font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-2 focus-visible:ring-offset-enzo-forest"
                          style={
                            isActive
                              ? {
                                  borderColor: "var(--enzo-sand)",
                                  background: "var(--enzo-sand)",
                                  color: "var(--enzo-forest)",
                                }
                              : {
                                  borderColor: "rgba(242,240,235,0.28)",
                                  color: "rgba(242,240,235,0.88)",
                                }
                          }
                        >
                          {viewpoint.label}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    data-viewer-control
                    onClick={() => setDoorsOpen((current) => !current)}
                    aria-pressed={doorsOpen}
                    className="ml-auto inline-flex items-center gap-2.5 rounded-full border border-enzo-sage/50 px-4 py-2.5 text-[12.5px] font-medium text-enzo-cream transition-colors duration-300 hover:border-enzo-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-2 focus-visible:ring-offset-enzo-forest"
                  >
                    <span
                      aria-hidden="true"
                      className="relative block h-4 w-7 rounded-full transition-colors duration-300"
                      style={{
                        background: doorsOpen ? "var(--enzo-sand)" : "rgba(242,240,235,0.25)",
                      }}
                    >
                      <span
                        className="absolute top-0.5 block h-3 w-3 rounded-full bg-enzo-forest transition-transform duration-300 ease-out"
                        style={{ transform: doorsOpen ? "translateX(14px)" : "translateX(2px)" }}
                      />
                    </span>
                    {doorsOpen ? "Doors open" : "Open the doors"}
                  </button>
                </div>

                <p
                  key={view.id}
                  className="mt-3 animate-in fade-in duration-500 text-[13px] leading-[1.6] text-enzo-cream/75 motion-reduce:animate-none"
                >
                  {view.note}
                </p>
              </>
            )}
          </div>

          {/* ── Spec column ── */}
          <div className="flex flex-col gap-5 lg:gap-6">
            {SPECS.map((spec) => (
              <div key={spec.label} data-spec className="border-t border-enzo-cream/15 pt-4">
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-[1.6rem] font-semibold tracking-[-0.02em] text-enzo-cream">
                    {spec.value}
                  </span>
                  <span className="font-display text-[10px] font-semibold uppercase tracking-[0.26em] text-enzo-sand">
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
