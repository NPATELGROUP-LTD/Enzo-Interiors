"use client";

// /services/[category] §A2 — what is included, as a rail you pull.
//
// This was a two-column numbered list beside a sticky plan drawing. Two
// problems: the drawing now leads one of the hero variants, so repeating it
// here made that page show the same image twice; and a fourteen-item list
// in two columns is a wall that gets skimmed, which is a waste of the one
// section that says exactly what you are buying.
//
// Now each included item is a plate on a rail you drag. Because the plates
// are large and there is only ever one fully in front of you, each line
// gets read instead of scanned.
//
// ── The end-of-rail problem ──
// A snap rail whose last card can only ever reach the right-hand edge feels
// broken: you drag, it stops, and the thing you were pulling toward is
// stuck in the corner. The trailing spacer below is sized to
// `50% - half a plate`, so the final plate can travel all the way to the
// centre of the viewport exactly like every plate before it. The first
// plate deliberately stays at the content's left margin — the rail should
// begin lined up with the heading above it, and only the *end* needs the
// extra room.
//
// Native scrolling does the work (momentum on touch, wheel, keyboard, and
// scroll-snap all for free); the pointer handler only adds click-and-drag
// for mice, which native overflow does not provide.
import { useCallback, useRef, useState } from "react";
import gsap from "gsap";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { useGSAP } from "@/hooks/useGSAP";
import { EASE, REVEAL_START } from "@/lib/motion";
import type { ServiceDetail } from "@/lib/content";

interface DetailIncludedRailProps {
  service: ServiceDetail;
  id: string;
}

export function DetailIncludedRail({ service, id }: DetailIncludedRailProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const railRef = useRef<HTMLUListElement>(null);
  const [progress, setProgress] = useState(0);

  const onScroll = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const max = rail.scrollWidth - rail.clientWidth;
    setProgress(max > 0 ? rail.scrollLeft / max : 0);
  }, []);

  useGSAP(sectionRef, (section, reduced) => {
    const plates = gsap.utils.toArray<HTMLElement>("[data-plate]", section);
    const rail = railRef.current;

    if (plates.length && !reduced) {
      gsap.from(plates.slice(0, 4), {
        opacity: 0,
        y: 30,
        duration: 0.75,
        ease: EASE.enter,
        stagger: 0.07,
        scrollTrigger: { trigger: plates[0], start: REVEAL_START, once: true },
      });
    }

    if (!rail || reduced) return;

    // Click-and-drag for pointing devices. Touch is left entirely to the
    // browser: hijacking it costs the momentum and rubber-band that the OS
    // already does better.
    let dragging = false;
    let startX = 0;
    let startScroll = 0;
    let moved = 0;

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      dragging = true;
      moved = 0;
      startX = event.clientX;
      startScroll = rail.scrollLeft;
      rail.style.cursor = "grabbing";
      rail.style.scrollSnapType = "none";
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      const delta = event.clientX - startX;
      moved = Math.abs(delta);
      rail.scrollLeft = startScroll - delta;
    };
    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      rail.style.cursor = "grab";
      // Snapping is restored only after the drag ends, so the rail glides
      // to the nearest plate instead of fighting the pointer mid-drag.
      rail.style.scrollSnapType = "";
    };
    // A drag that moved more than a few pixels must not also fire the
    // click on whatever was under the pointer.
    const onClickCapture = (event: MouseEvent) => {
      if (moved > 6) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    rail.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    rail.addEventListener("click", onClickCapture, true);

    return () => {
      rail.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      rail.removeEventListener("click", onClickCapture, true);
    };
  });

  if (!service.features.length) return null;

  return (
    <section
      ref={sectionRef}
      id={id}
      aria-labelledby="service-included-heading"
      className="relative overflow-hidden bg-background scroll-mt-24"
    >
      <div className="mx-auto max-w-[1500px] px-5 pt-20 sm:px-6 md:px-12 md:pt-28">
        <h2 id="service-included-heading" className="sr-only">
          What is included
        </h2>

        <SectionIntro
          layout="split"
          index="A2"
          label="Included"
          datum={`${service.features.length} as standard`}
          lines={["Everything that", "comes as standard."]}
          lede={service.overview}
        />
      </div>

      <ul
        ref={railRef}
        onScroll={onScroll}
        tabIndex={0}
        aria-label={`What is included with ${service.title}`}
        className="mt-12 flex cursor-grab snap-x snap-mandatory gap-4 overflow-x-auto pb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mt-16"
        style={{
          // Starts flush with the heading's own column…
          paddingLeft: "max(1.25rem, calc((100vw - 1500px) / 2 + 3rem))",
          // …and ends with enough room for the last plate to reach centre.
          paddingRight: "max(1.25rem, calc(50% - 11rem))",
        }}
      >
        {service.features.map((feature, index) => (
          <li
            key={feature}
            data-plate
            className="group relative flex w-[16rem] shrink-0 snap-center flex-col justify-between rounded-[18px] border border-border/70 bg-card p-7 transition-colors duration-400 hover:border-primary/40 sm:w-[20rem] md:w-[22rem]"
            style={{ minHeight: "15rem" }}
          >
            {/* The number is the plate's ground, not a label on it. */}
            <span
              aria-hidden="true"
              className="font-title font-semibold leading-none tracking-[-0.06em] text-primary/10 transition-colors duration-400 group-hover:text-primary/[0.16]"
              style={{ fontSize: "4.5rem" }}
            >
              {String(index + 1).padStart(2, "0")}
            </span>

            <div>
              <p className="text-[16.5px] font-medium leading-[1.4] tracking-[-0.02em] text-primary">
                {feature}
              </p>
              <span
                aria-hidden="true"
                className="mt-5 block h-px w-10 origin-left bg-enzo-sand transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-[2.4]"
              />
            </div>
          </li>
        ))}
      </ul>

      {/* Position along the rail, and the only instruction it needs. */}
      <div className="mx-auto max-w-[1500px] px-5 pb-20 pt-6 sm:px-6 md:px-12 md:pb-28">
        <div className="flex items-center gap-5">
          <span className="shrink-0 text-[11.5px] uppercase tracking-[0.2em] text-muted-foreground">
            Drag to read on
          </span>
          <span className="h-px flex-1 bg-border">
            <span
              className="block h-px origin-left bg-primary transition-transform duration-200 ease-out"
              style={{ transform: `scaleX(${Math.max(0.04, progress)})` }}
            />
          </span>
          <span className="font-display shrink-0 text-[11px] font-semibold tabular-nums text-primary">
            {String(service.features.length).padStart(2, "0")}
          </span>
        </div>
      </div>
    </section>
  );
}
