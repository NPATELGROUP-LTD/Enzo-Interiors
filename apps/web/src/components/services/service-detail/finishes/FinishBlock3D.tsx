"use client";

// /services/[category] §A3 — the sample block.
//
// Every fitted-furniture site lists its finishes as a row of pills. A pill
// tells you a word; what a showroom gives you is a corner of the actual
// carcass, with a door front, a return and a worktop, that you pick up and
// turn towards the light. This is that object: a real 3D block you drag,
// with the selected finish applied to the faces.
//
// It is CSS 3D rather than three.js on purpose. The landing page already
// spends a WebGL context on the media-wall viewer; a second one on a
// deeper page would cost every visitor a renderer to look at a cuboid.
// Transformed div faces give the same object for no runtime, work without
// a canvas, and — the part that matters here — take their colour and
// surface character straight from the finish names the client typed into
// the Content Manager (see src/lib/finish-swatch.ts), so a finish nobody
// anticipated still renders as a plausible material.
import { useRef, useState } from "react";
import gsap from "gsap";
import { RotateCw } from "lucide-react";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { useGSAP } from "@/hooks/useGSAP";
import { EASE, REVEAL_START } from "@/lib/motion";
import { getFinishSwatch, grainLayers } from "@/lib/finish-swatch";
import { cn } from "@/lib/utils";
import type { ServiceDetail } from "@/lib/content";

/** Carcass dimensions in px at scale 1. Scaled up by breakpoint, not by JS. */
const W = 190;
const H = 240;
const D = 108;

const REST = { rx: -13, ry: -30 };

/** Finishes that read as a worktop rather than a door front. */
const WORKTOP_WORDS = [
  "quartz",
  "granite",
  "dekton",
  "marble",
  "stone",
  "concrete",
  "slate",
];

interface FinishBlock3DProps {
  service: ServiceDetail;
  id: string;
}

export function FinishBlock3D({ service, id }: FinishBlock3DProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [selected, setSelected] = useState(0);
  // Impulse applied by a finish change, decayed on the ticker — the block
  // turning slightly as you swap the sample in your hand.
  const impulse = useRef(0);
  const claimed = useRef(false);

  const finishes = service.materials;
  const swatch = getFinishSwatch(finishes[selected] ?? "Oak");

  // The worktop keeps its own material: a kitchen is not one finish, and a
  // block where every face changes together stops reading as furniture.
  const worktopName =
    finishes.find((name) =>
      WORKTOP_WORDS.some((word) => name.toLowerCase().includes(word)),
    ) ?? "Quartz";
  const worktop = getFinishSwatch(worktopName);

  useGSAP(sectionRef, (section, reduced) => {
    const scene = section.querySelector<HTMLElement>("[data-block-scene]");
    const stage = section.querySelector<HTMLElement>("[data-block-stage]");
    const chips = gsap.utils.toArray<HTMLElement>("[data-block-chip]", section);
    if (!scene || !stage) return;

    const setTransform = (rx: number, ry: number) => {
      scene.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
    };

    if (reduced) {
      setTransform(REST.rx, REST.ry);
      gsap.set(chips, { opacity: 1, y: 0 });
      return;
    }

    gsap.from(chips, {
      opacity: 0,
      y: 14,
      duration: 0.5,
      ease: EASE.enter,
      stagger: 0.035,
      scrollTrigger: { trigger: stage, start: REVEAL_START, once: true },
    });
    gsap.from(stage, {
      opacity: 0,
      y: 40,
      duration: 1,
      ease: EASE.editorial,
      scrollTrigger: { trigger: stage, start: "top 88%", once: true },
    });

    const current = { ...REST };
    const target = { ...REST };
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const tick = () => {
      const time = gsap.ticker.time;

      if (!dragging && !claimed.current) {
        // Untouched: a slow sway, so the object is visibly a physical thing
        // before anyone tries to grab it.
        target.ry = REST.ry + Math.sin(time * 0.55) * 11;
        target.rx = REST.rx + Math.cos(time * 0.4) * 3.5;
      }

      impulse.current *= 0.9;
      // Ease toward the target rather than snapping, so a fast drag has
      // weight and the sway never steps.
      current.rx += (target.rx - current.rx) * 0.09;
      current.ry += (target.ry + impulse.current - current.ry) * 0.09;
      setTransform(current.rx, current.ry);
    };

    gsap.ticker.add(tick);

    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      claimed.current = true;
      lastX = event.clientX;
      lastY = event.clientY;
      stage.setPointerCapture(event.pointerId);
      stage.style.cursor = "grabbing";
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      target.ry += (event.clientX - lastX) * 0.42;
      // Clamped so the block can never be flipped onto its back — you are
      // turning a sample on a bench, not orbiting a planet.
      target.rx = gsap.utils.clamp(
        -34,
        12,
        target.rx - (event.clientY - lastY) * 0.28,
      );
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const onPointerUp = (event: PointerEvent) => {
      dragging = false;
      if (stage.hasPointerCapture(event.pointerId)) {
        stage.releasePointerCapture(event.pointerId);
      }
      stage.style.cursor = "grab";
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      claimed.current = true;
      target.ry += event.key === "ArrowRight" ? 18 : -18;
    };

    stage.addEventListener("pointerdown", onPointerDown);
    stage.addEventListener("pointermove", onPointerMove);
    stage.addEventListener("pointerup", onPointerUp);
    stage.addEventListener("pointercancel", onPointerUp);
    stage.addEventListener("keydown", onKeyDown);

    return () => {
      gsap.ticker.remove(tick);
      stage.removeEventListener("pointerdown", onPointerDown);
      stage.removeEventListener("pointermove", onPointerMove);
      stage.removeEventListener("pointerup", onPointerUp);
      stage.removeEventListener("pointercancel", onPointerUp);
      stage.removeEventListener("keydown", onKeyDown);
    };
  });

  const pickFinish = (index: number) => {
    setSelected(index);
    claimed.current = true;
    impulse.current = -22;
  };

  const faceStyle = (color: string, grain: Parameters<typeof grainLayers>[0]) => ({
    backgroundColor: color,
    backgroundImage: grainLayers(grain),
    transition: "background-color 520ms cubic-bezier(0.22,1,0.36,1)",
  });

  if (!finishes.length) return null;

  return (
    <section
      ref={sectionRef}
      id={id}
      aria-labelledby="service-finishes-heading"
      className="relative overflow-hidden bg-enzo-forest scroll-mt-24"
    >
      <div className="mx-auto max-w-[1500px] px-5 py-20 sm:px-6 md:px-12 md:py-28">
        <h2 id="service-finishes-heading" className="sr-only">
          Finishes
        </h2>

        <SectionIntro
          layout="split"
          tone="dark"
          index="A3"
          label="Finishes"
          datum={`${finishes.length} to choose from`}
          lines={["Turn the sample", "over first."]}
          lede="Drag the block to see the door front, the return and the worktop together — the three surfaces that decide how a room reads. Samples come to your home before you commit to any of them."
        />

        <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-16">
          {/* ── The block ── */}
          <div
            data-block-stage
            tabIndex={0}
            role="img"
            aria-label={`Three-dimensional sample block finished in ${swatch.name}, with a ${worktop.name} worktop. Drag or use the left and right arrow keys to turn it.`}
            className="relative flex min-h-[22rem] cursor-grab touch-pan-y select-none items-center justify-center rounded-[20px] bg-enzo-dark/35 py-12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand md:min-h-[30rem]"
            style={{ perspective: "1300px" }}
          >
            <div className="scale-[0.92] sm:scale-110 lg:scale-[1.28]">
              {/* Contact shadow sits outside the preserve-3d scene: it is
                  the shadow on the bench, so it must not rotate with the
                  block. */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-[62%] h-10 w-[16rem] -translate-x-1/2 blur-xl"
                style={{
                  background:
                    "radial-gradient(ellipse at center, rgba(0,0,0,0.5), transparent 70%)",
                }}
              />
              <div
                data-block-scene
                className="relative"
                style={{
                  width: W,
                  height: H,
                  transformStyle: "preserve-3d",
                  transform: `rotateX(${REST.rx}deg) rotateY(${REST.ry}deg)`,
                }}
              >
                {/* Every face uses the same recipe — centre it on the box,
                    rotate it, then push it out by half the box's extent
                    along its own Z. Positioning faces from the top-left
                    instead makes each one a different offset puzzle. */}
                {/* Door front */}
                <div
                  className="absolute left-1/2 top-1/2 overflow-hidden rounded-[3px]"
                  style={{
                    ...faceStyle(swatch.base, swatch.grain),
                    width: W,
                    height: H,
                    transform: `translate(-50%, -50%) translateZ(${D / 2}px)`,
                    boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.18)",
                  }}
                >
                  {/* Shadow gaps: a drawer bank over a door, which is what
                      makes the cuboid read as a cabinet. */}
                  <span
                    className="absolute inset-x-0 top-[26%] h-[2px] bg-black/30"
                    aria-hidden="true"
                  />
                  <span
                    className="absolute inset-x-0 top-[calc(26%+2px)] h-[3px] bg-white/10"
                    aria-hidden="true"
                  />
                  {/* Rail handle. */}
                  <span
                    aria-hidden="true"
                    className="absolute left-1/2 top-[19%] h-[5px] w-[46%] -translate-x-1/2 rounded-full"
                    style={{
                      backgroundColor: swatch.light
                        ? "rgba(40,40,40,0.55)"
                        : "rgba(240,238,233,0.6)",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.35)",
                    }}
                  />
                  <span
                    aria-hidden="true"
                    className="absolute left-1/2 top-[63%] h-[5px] w-[46%] -translate-x-1/2 rounded-full"
                    style={{
                      backgroundColor: swatch.light
                        ? "rgba(40,40,40,0.55)"
                        : "rgba(240,238,233,0.6)",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.35)",
                    }}
                  />
                </div>

                {/* Return / end panel — the darker shade of the same
                    finish, which is what a real return does under side
                    light and what gives the block its edge. */}
                <div
                  className="absolute left-1/2 top-1/2 overflow-hidden rounded-[3px]"
                  style={{
                    ...faceStyle(swatch.shade, swatch.grain),
                    width: D,
                    height: H,
                    transform: `translate(-50%, -50%) rotateY(90deg) translateZ(${W / 2}px)`,
                    boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.22)",
                  }}
                />

                {/* Worktop — its own material, overhanging the carcass. */}
                <div
                  className="absolute left-1/2 top-1/2 rounded-[2px]"
                  style={{
                    ...faceStyle(worktop.base, worktop.grain),
                    width: W + 12,
                    height: D + 12,
                    transform: `translate(-50%, -50%) rotateX(90deg) translateZ(${H / 2}px)`,
                    boxShadow: "0 0 0 1px rgba(0,0,0,0.16)",
                  }}
                />
              </div>
            </div>

            <p className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-enzo-cream/40">
              <RotateCw className="h-3 w-3" />
              Drag to turn
            </p>
          </div>

          {/* ── Finish picker ── */}
          <div className="lg:pt-2">
            <div className="flex items-baseline justify-between gap-4 border-b border-enzo-cream/12 pb-3">
              <span className="font-display text-[10.5px] font-semibold uppercase tracking-[0.26em] text-enzo-sand">
                Selected
              </span>
              <span className="text-[11px] tabular-nums text-enzo-cream/45">
                {String(selected + 1).padStart(2, "0")}/
                {String(finishes.length).padStart(2, "0")}
              </span>
            </div>
            <p
              className="mt-4 font-title font-semibold leading-[1.1] tracking-[-0.03em] text-enzo-cream"
              style={{ fontSize: "clamp(1.5rem, 2.6vw, 2.1rem)" }}
            >
              {swatch.name}
            </p>
            <p className="mt-2 text-[13px] text-enzo-cream/55">
              Shown with a {worktop.name.toLowerCase()} worktop.
            </p>

            <ul className="mt-7 flex flex-wrap gap-2">
              {finishes.map((finish, index) => {
                const chip = getFinishSwatch(finish);
                const isOn = index === selected;
                return (
                  <li key={finish}>
                    <button
                      data-block-chip
                      type="button"
                      onClick={() => pickFinish(index)}
                      aria-pressed={isOn}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-full border py-1.5 pl-1.5 pr-4 text-[12.5px] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-2 focus-visible:ring-offset-enzo-forest",
                        isOn
                          ? "border-enzo-sand bg-enzo-sand/12 text-enzo-cream"
                          : "border-enzo-cream/18 text-enzo-cream/65 hover:border-enzo-cream/45 hover:text-enzo-cream",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className="h-6 w-6 shrink-0 rounded-full ring-1 ring-inset ring-black/20 transition-transform duration-300 group-hover:scale-110"
                        style={{
                          backgroundColor: chip.base,
                          backgroundImage: grainLayers(chip.grain),
                        }}
                      />
                      {finish}
                    </button>
                  </li>
                );
              })}
            </ul>

            <p className="mt-8 text-[12.5px] leading-[1.7] text-enzo-cream/45">
              Colours here are indicative — timber and stone vary batch to
              batch, which is exactly why we bring the real samples to your
              room before anything is ordered.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
