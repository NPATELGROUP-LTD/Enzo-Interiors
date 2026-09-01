"use client";

// The turntable every service-page model sits on.
//
// Owns the camera and nothing else: drag to orbit, arrow keys to orbit,
// a slow sway while nobody has touched it, and a clamp that stops the model
// being flipped onto its back — you are turning an object on a bench, not
// orbiting a planet.
//
// The rotation is written straight to the scene's transform from a
// gsap.ticker callback with an eased follow, so a fast drag has weight and
// the idle sway never steps. No React state is involved in the camera at
// all, which is what keeps it smooth while the page around it re-renders.
import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@/hooks/useGSAP";
import { cn } from "@/lib/utils";

interface ModelStageProps {
  /** Resting camera angles in degrees. */
  rest?: { rx: number; ry: number };
  /** Scene scale per breakpoint — models are authored at scale 1. */
  scaleClassName?: string;
  label: string;
  children: ReactNode;
  className?: string;
}

export function ModelStage({
  rest = { rx: -14, ry: -32 },
  scaleClassName = "scale-[0.62] sm:scale-90 lg:scale-100",
  label,
  children,
  className,
}: ModelStageProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(rootRef, (root, reduced) => {
    const scene = root.querySelector<HTMLElement>("[data-scene]");
    const stage = root.querySelector<HTMLElement>("[data-stage]");
    if (!scene || !stage) return;

    const apply = (rx: number, ry: number) => {
      scene.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
    };

    if (reduced) {
      apply(rest.rx, rest.ry);
      return;
    }

    const current = { ...rest };
    const target = { ...rest };
    let dragging = false;
    let claimed = false;
    let lastX = 0;
    let lastY = 0;

    const tick = () => {
      if (!dragging && !claimed) {
        const t = gsap.ticker.time;
        target.ry = rest.ry + Math.sin(t * 0.5) * 12;
        target.rx = rest.rx + Math.cos(t * 0.37) * 3;
      }
      current.rx += (target.rx - current.rx) * 0.09;
      current.ry += (target.ry - current.ry) * 0.09;
      apply(current.rx, current.ry);
    };

    gsap.ticker.add(tick);

    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      claimed = true;
      lastX = event.clientX;
      lastY = event.clientY;
      stage.setPointerCapture(event.pointerId);
      stage.style.cursor = "grabbing";
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      target.ry += (event.clientX - lastX) * 0.4;
      target.rx = gsap.utils.clamp(-52, 12, target.rx - (event.clientY - lastY) * 0.26);
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
      const step =
        event.key === "ArrowRight" ? 18 : event.key === "ArrowLeft" ? -18 : 0;
      if (!step) return;
      event.preventDefault();
      claimed = true;
      target.ry += step;
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

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div
        data-stage
        tabIndex={0}
        role="img"
        aria-label={`${label} Drag, or use the left and right arrow keys, to turn it.`}
        className="relative flex min-h-[22rem] cursor-grab touch-pan-y select-none items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand md:min-h-[30rem]"
        style={{ perspective: "1500px" }}
      >
        {/* Shadow on the bench. Outside the preserve-3d scene, so it does
            not rotate with the model. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-[68%] h-12 w-[22rem] -translate-x-1/2 blur-2xl"
          style={{
            background: "radial-gradient(ellipse at center, rgba(0,0,0,0.55), transparent 70%)",
          }}
        />

        <div className={scaleClassName}>
          <div
            data-scene
            className="relative h-0 w-0"
            style={{
              transformStyle: "preserve-3d",
              transform: `rotateX(${rest.rx}deg) rotateY(${rest.ry}deg)`,
            }}
          >
            {children}
          </div>
        </div>

        <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] uppercase tracking-[0.2em] text-enzo-cream/35">
          Drag to turn
        </p>
      </div>
    </div>
  );
}
