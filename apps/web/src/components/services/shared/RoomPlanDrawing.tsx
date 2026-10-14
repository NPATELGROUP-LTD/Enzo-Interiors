"use client";

// The drawing, filled with the real room.
//
// Renders the procedural footprint from src/lib/room-plan.ts and clips the
// service's photograph *inside* it, so the plan reads as a window cut into
// the finished room rather than a diagram sitting next to a picture. The
// walls ink themselves in first and the photograph arrives behind them,
// which is the order the studio actually works in.
//
// Remounted (keyed on slug) whenever the hero's active service changes, so
// the entrance timeline below re-runs per selection without any imperative
// "animate out then in" bookkeeping.
import { useEffect, useId, useMemo, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@/hooks/useGSAP";
import { EASE } from "@/lib/motion";
import { buildRoomPlan } from "@/lib/room-plan";
import { cn } from "@/lib/utils";
import { fill, type SharedContent } from "@/lib/content";

/**
 * Where the drawn room actually lands inside the component's own box, in CSS
 * pixels relative to it.
 *
 * The SVG is letterboxed by `preserveAspectRatio`, and the footprint sits
 * inside its own draughting margin on top of that — so the photograph's left
 * edge is at neither 0 nor any fixed fraction of the container. Anything that
 * has to line up with the *drawing* rather than with its box (the services
 * hero's caption) has to be told where it is.
 */
export interface PlanFrame {
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** The component's own box, so callers can work out trailing gutters. */
  width: number;
  height: number;
}

interface RoomPlanDrawingProps {
  /** Seeds the geometry — same slug always draws the same room. */
  slug: string;
  /** Photograph clipped into the footprint. */
  image: string;
  /** Small caption in the drawing's top-left, e.g. "Kitchens". */
  caption: string;
  /** The drawing's own two strings — the printed caption and the alt text. */
  content: SharedContent["roomPlan"];
  /**
   * Which of the four room shapes to draw. Passed by position from the
   * services index so each published service gets a different footprint;
   * omitted, it falls out of the slug hash.
   */
  pattern?: number;
  /**
   * Called on mount and on resize with the footprint's rendered box. Keep the
   * reference stable (useCallback or a setState function) — it is an effect
   * dependency, so a fresh closure each render re-creates the observer.
   */
  onFrame?: (frame: PlanFrame) => void;
  className?: string;
}

export function RoomPlanDrawing({
  slug,
  image,
  caption,
  content,
  pattern,
  onFrame,
  className,
}: RoomPlanDrawingProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const outlineRef = useRef<SVGPathElement>(null);
  const rawId = useId();
  // useId emits colons, which are not valid in a CSS url(#…) reference.
  const uid = rawId.replace(/:/g, "");
  const plan = useMemo(() => buildRoomPlan(slug, pattern), [slug, pattern]);

  useGSAP(
    rootRef,
    (root, reduced) => {
      const strokes = gsap.utils.toArray<SVGGeometryElement>("[data-draw]", root);
      const fills = gsap.utils.toArray<SVGElement>("[data-fill]", root);
      const photo = root.querySelector<SVGElement>("[data-photo]");
      const meta = gsap.utils.toArray<SVGElement>("[data-meta]", root);

      if (reduced) {
        gsap.set(strokes, { strokeDashoffset: 0, opacity: 1 });
        gsap.set([...fills, ...meta, photo].filter(Boolean), { opacity: 1, scale: 1 });
        return;
      }

      // Path lengths are measured rather than hand-maintained, so the
      // generator in lib/room-plan.ts stays free to change the geometry.
      strokes.forEach((el) => {
        const length = el.getTotalLength();
        gsap.set(el, { strokeDasharray: length, strokeDashoffset: length, opacity: 1 });
      });

      const tl = gsap.timeline();

      tl.to(strokes, {
        strokeDashoffset: 0,
        duration: 0.85,
        ease: EASE.editorial,
        stagger: 0.035,
      })
        .fromTo(
          photo,
          { opacity: 0, scale: 1.06 },
          { opacity: 1, scale: 1, duration: 1.1, ease: EASE.editorial },
          0.22,
        )
        .fromTo(
          fills,
          { opacity: 0, scale: 0.86 },
          {
            opacity: 1,
            scale: 1,
            duration: 0.5,
            ease: EASE.enter,
            stagger: { each: 0.028, from: "start" },
          },
          0.4,
        )
        .fromTo(
          meta,
          { opacity: 0, y: 6 },
          { opacity: 1, y: 0, duration: 0.5, ease: EASE.enter, stagger: 0.06 },
          0.55,
        );

      return () => {
        tl.kill();
      };
    },
    { deps: [slug] },
  );

  // Measured rather than derived. The inset depends on the container's
  // aspect (which decides how the SVG letterboxes) *and* on the plan's own
  // margin, so there is no fraction to hard-code — and a wrong constant here
  // would show up as type that is nearly, but not quite, aligned.
  useEffect(() => {
    const root = rootRef.current;
    const outline = outlineRef.current;
    if (!root || !outline || !onFrame) return;

    let previous = "";

    const measure = () => {
      const ctm = outline.getScreenCTM();
      if (!ctm) return;
      const box = outline.getBBox();
      const rootBox = root.getBoundingClientRect();
      // No rotation or skew is ever applied here, so the CTM reduces to a
      // scale and a translate and the corners can be mapped directly.
      const frame: PlanFrame = {
        left: ctm.a * box.x + ctm.e - rootBox.left,
        right: ctm.a * (box.x + box.width) + ctm.e - rootBox.left,
        top: ctm.d * box.y + ctm.f - rootBox.top,
        bottom: ctm.d * (box.y + box.height) + ctm.f - rootBox.top,
        width: rootBox.width,
        height: rootBox.height,
      };

      // Guard the caller against a fresh object on every observer tick —
      // onFrame is usually a setState, and a new identity each frame would
      // re-render the hero continuously.
      const key = `${frame.left}|${frame.right}|${frame.width}`;
      if (key === previous) return;
      previous = key;
      onFrame(frame);
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [onFrame, slug, pattern]);

  const clipId = `plan-clip-${uid}`;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <svg
        viewBox={`0 0 ${plan.width} ${plan.height}`}
        className="h-full w-full overflow-visible"
        role="img"
        aria-label={fill(content.ariaLabel, { caption: caption.toLowerCase() })}
      >
        <defs>
          <clipPath id={clipId}>
            <path d={plan.outline} />
          </clipPath>
        </defs>

        {/* No graph-paper fill behind the drawing. It used to be here as
            "draughting paper", but a ruled grid across the whole sheet is
            the noisiest thing on a dark hero and it competed with the
            linework it was supposed to support. The walls, the run and the
            dimension lines carry the drawing on their own. */}

        {/* The photograph, living only inside the footprint. */}
        <g clipPath={`url(#${clipId})`}>
          <g data-photo style={{ transformOrigin: "50% 50%" }}>
            <image
              href={image}
              x="0"
              y="0"
              width={plan.width}
              height={plan.height}
              preserveAspectRatio="xMidYMid slice"
            />
            {/* Forest wash so the cream linework stays legible over any
                photograph the client uploads, however bright — kept light
                enough that the room itself is still the thing you look at. */}
            <rect
              width={plan.width}
              height={plan.height}
              fill="#0F2A21"
              opacity="0.34"
            />
          </g>

          {/* Fitted run, drawn inside the clip so it reads as furniture
              standing in the room rather than floating over the photo. */}
          {plan.units.map((unit, i) => (
            <rect
              key={`unit-${i}`}
              data-fill
              x={unit.x}
              y={unit.y}
              width={unit.w}
              height={unit.h}
              fill="rgba(212,201,181,0.24)"
              stroke="rgba(242,240,235,0.75)"
              strokeWidth="1.1"
              opacity="0"
              style={{ transformBox: "fill-box", transformOrigin: "50% 50%" }}
            />
          ))}
          {plan.joints.map((joint, i) => (
            <line
              key={`joint-${i}`}
              data-fill
              x1={joint.x1}
              y1={joint.y1}
              x2={joint.x2}
              y2={joint.y2}
              stroke="rgba(242,240,235,0.55)"
              strokeWidth="0.8"
              opacity="0"
            />
          ))}
        </g>

        {/* Walls — the heavy line, drawn first. */}
        <path
          ref={outlineRef}
          data-draw
          d={plan.outline}
          fill="none"
          stroke="#F2F0EB"
          strokeWidth="2.6"
          strokeLinejoin="round"
          opacity="0"
        />

        {/* Windows: the doubled line every plan uses for glazing. */}
        {plan.windows.map((win, i) => (
          <g key={`win-${i}`}>
            <line
              data-draw
              x1={win.x1}
              y1={win.y1}
              x2={win.x2}
              y2={win.y2}
              stroke="#0F2A21"
              strokeWidth="4.5"
              opacity="0"
            />
            <line
              data-draw
              x1={win.x1}
              y1={win.y1}
              x2={win.x2}
              y2={win.y2}
              stroke="#D4C9B5"
              strokeWidth="1.2"
              opacity="0"
            />
          </g>
        ))}

        {/* Door swing. */}
        <path
          data-draw
          d={plan.door.arc}
          fill="none"
          stroke="rgba(212,201,181,0.7)"
          strokeWidth="1"
          strokeDasharray="0"
          opacity="0"
        />
        <line
          data-draw
          x1={plan.door.leaf.x1}
          y1={plan.door.leaf.y1}
          x2={plan.door.leaf.x2}
          y2={plan.door.leaf.y2}
          stroke="rgba(212,201,181,0.9)"
          strokeWidth="1.6"
          opacity="0"
        />

        {/* Dimension lines — ticks, no figures. See lib/room-plan.ts. */}
        {plan.dimensions.map((dim, i) => (
          <g key={`dim-${i}`} className="text-enzo-sand">
            <line
              data-draw
              x1={dim.line.x1}
              y1={dim.line.y1}
              x2={dim.line.x2}
              y2={dim.line.y2}
              stroke="currentColor"
              strokeWidth="0.8"
              opacity="0"
            />
            {dim.ticks.map((tick, j) => (
              <line
                key={`tick-${j}`}
                data-draw
                x1={tick.x1}
                y1={tick.y1}
                x2={tick.x2}
                y2={tick.y2}
                stroke="currentColor"
                strokeWidth="0.8"
                opacity="0"
              />
            ))}
          </g>
        ))}

        <text
          data-meta
          x="8"
          y="16"
          opacity="0"
          className="fill-enzo-sand font-display"
          style={{ fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase" }}
        >
          {fill(content.caption, { caption })}
        </text>
      </svg>
    </div>
  );
}
