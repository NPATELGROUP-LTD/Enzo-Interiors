"use client";

// Section 03 — a labelled diagram, not a feature grid.
//
// The old "why choose us" bento said four things in four boxes. This says
// the same four things as callouts around a single object, the way a spec
// sheet annotates the thing it is describing: leader lines run inward from
// the copy to a real, turnable wardrobe module. The claims and the craft
// are in the same field of view, which is the whole argument.
//
// The WebGL module is desktop-only and mounts only once the section is
// close to the viewport. Touch devices and reduced-motion visitors get a
// photograph in the same frame, with the same callouts around it.
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { useGSAP } from "@/hooks/useGSAP";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { DUR, EASE, REVEAL_START } from "@/lib/motion";
import { cn } from "@/lib/utils";

const JoineryScene = dynamic(() => import("./JoineryScene"), {
  ssr: false,
  loading: () => null,
});

interface Callout {
  tag: string;
  title: string;
  body: string;
}

const LEFT_CALLOUTS: Callout[] = [
  {
    tag: "Visit",
    title: "Free consultation",
    body: "We come to you, anywhere in Leicestershire, and measure the room ourselves.",
  },
  {
    tag: "Workshop",
    title: "Made in Leicester",
    body: "Cut, edged and assembled a few miles from your front door.",
  },
];

const RIGHT_CALLOUTS: Callout[] = [
  {
    tag: "Fit",
    title: "One team, start to finish",
    body: "The people who drew it and built it are the people who fit it.",
  },
  {
    tag: "After",
    title: "Five-year guarantee",
    body: "On every joint, hinge and runner we install. In writing, on handover day.",
  },
];

export function WorkshopModule() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  // Mutated by ScrollTrigger and read inside the render loop, so turning
  // the module never costs a React render.
  const progressRef = useRef(0);
  const [sceneReady, setSceneReady] = useState(false);

  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const prefersReducedMotion = usePrefersReducedMotion();
  const useScene = isDesktop && !prefersReducedMotion;

  // Hold the WebGL context back until the section is genuinely nearby.
  // Mounting it at page load would spend a GPU context and a render loop on
  // something most visitors have not scrolled to yet.
  useEffect(() => {
    if (!useScene) return;
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
  }, [useScene]);

  useGSAP(
    sectionRef,
    (section, reduced) => {
      const callouts = gsap.utils.toArray<HTMLElement>("[data-callout]", section);

      if (!reduced) {
        callouts.forEach((callout, index) => {
          const line = callout.querySelector<HTMLElement>("[data-callout-line]");
          const copy = callout.querySelector<HTMLElement>("[data-callout-copy]");
          // Built paused and handed to ScrollTrigger afterwards — passing
          // `scrollTrigger` into gsap.timeline() evaluates the trigger while
          // the timeline is still empty, which silently strands any callout
          // that happens to already be in view at page load.
          const tl = gsap.timeline({ paused: true, delay: (index % 2) * 0.08 });
          // The leader line reaches the copy before the copy exists — the
          // diagram points first, then labels.
          tl.to(line, { scaleX: 1, duration: 0.5, ease: EASE.enter }).to(
            copy,
            { opacity: 1, y: 0, duration: DUR.enter, ease: EASE.enter },
            0.15,
          );

          ScrollTrigger.create({
            trigger: callout,
            start: REVEAL_START,
            once: true,
            animation: tl,
          });
        });
      } else {
        callouts.forEach((callout) => {
          gsap.set(callout.querySelector("[data-callout-line]"), { scaleX: 1 });
          gsap.set(callout.querySelector("[data-callout-copy]"), { opacity: 1, y: 0 });
        });
      }

      const stage = stageRef.current;
      if (!stage || reduced) return;

      ScrollTrigger.create({
        trigger: stage,
        start: "top bottom",
        end: "bottom top",
        onUpdate: (self) => {
          progressRef.current = self.progress;
        },
      });
    },
    { deps: [] },
  );

  return (
    <section
      ref={sectionRef}
      aria-labelledby="craft-heading"
      className="relative overflow-hidden bg-enzo-forest"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(55% 45% at 50% 40%, rgba(138,158,140,0.18), transparent 65%), radial-gradient(45% 40% at 90% 95%, rgba(212,201,181,0.09), transparent 60%)",
        }}
      />

      <div className="relative mx-auto max-w-[1400px] px-6 py-24 md:px-12 md:py-32">
        <h2 id="craft-heading" className="sr-only">
          How we build
        </h2>
        <SectionIntro
          tone="dark"
          index="03"
          label="Craft"
          datum="one workshop"
          lines={["Built like furniture,", "not like flat-pack."]}
          lede="Eighteen-millimetre carcasses, chamfered door fronts, soft-close hardware and a shadow gap you can run a finger along."
        />

        <div className="mt-16 grid items-center gap-12 lg:mt-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,500px)_minmax(0,1fr)] lg:gap-10">
          <div className="order-2 flex flex-col gap-10 lg:order-1 lg:items-end lg:gap-20">
            {LEFT_CALLOUTS.map((callout) => (
              <CalloutBlock key={callout.tag} align="end" {...callout} />
            ))}
          </div>

          <div className="order-1 lg:order-2">
            <div
              ref={stageRef}
              className="relative mx-auto aspect-square w-full max-w-[500px]"
            >
              {/* Contact shadow — grounds the module without paying for a
                  shadow-casting light and a render target. */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-[12%] bottom-[8%] h-[12%] rounded-[50%]"
                style={{
                  background:
                    "radial-gradient(50% 50% at 50% 50%, rgba(0,0,0,0.45), transparent 70%)",
                }}
              />
              {useScene && sceneReady ? (
                <JoineryScene progressRef={progressRef} />
              ) : (
                <div className="relative flex h-full w-full items-center justify-center p-4">
                  <ImageWithFallback
                    src="/Wardrobes.jpeg"
                    alt="Fitted wardrobe module built by Enzo Interiors"
                    loading="lazy"
                    className="h-full w-full rounded-[22px] object-cover"
                  />
                </div>
              )}
            </div>
            <p className="mx-auto mt-5 max-w-[42ch] text-center text-[12.5px] leading-[1.6] text-enzo-cream/70">
              Wardrobe module &mdash; 18&nbsp;mm carcass, chamfered fronts, hinged on the outer edge.
            </p>
          </div>

          <div className="order-3 flex flex-col gap-10 lg:gap-20">
            {RIGHT_CALLOUTS.map((callout) => (
              <CalloutBlock key={callout.tag} align="start" {...callout} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CalloutBlock({
  tag,
  title,
  body,
  align,
}: Callout & { align: "start" | "end" }) {
  const flipped = align === "end";
  return (
    <div
      data-callout
      className={cn("flex max-w-[34ch] items-start gap-4", flipped && "lg:flex-row-reverse")}
    >
      <span
        aria-hidden="true"
        className={cn("mt-2 flex shrink-0 items-center gap-2", flipped && "lg:flex-row-reverse")}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-enzo-sand" />
        <span
          data-callout-line
          className="block h-px w-8 origin-left bg-enzo-sand/45 lg:w-14"
          style={{ transform: "scaleX(0)" }}
        />
      </span>

      <div
        data-callout-copy
        className={cn("opacity-0", flipped && "lg:text-right")}
        style={{ transform: "translateY(12px)" }}
      >
        <p className="font-display text-[10px] font-semibold uppercase tracking-[0.26em] text-enzo-sand">
          {tag}
        </p>
        <p className="mt-2 font-serif text-[1.15rem] leading-snug text-enzo-cream">{title}</p>
        <p className="mt-1.5 text-[13px] leading-[1.65] text-enzo-cream/70">{body}</p>
      </div>
    </div>
  );
}
