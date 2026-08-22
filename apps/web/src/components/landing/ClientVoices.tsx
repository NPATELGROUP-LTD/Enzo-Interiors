"use client";

// Section 05 — one quote at a time, with the client list as the control.
//
// Three columns of looping testimonial cards read as wallpaper: nobody
// finishes a moving card. Here a single review gets the full width of a
// serif setting, and the nine clients sit beside it as a roster you can
// actually pick from — which also makes the sample size visible instead of
// implied.
//
// The rotation is genuinely pausable (hover, focus, and an explicit
// control), because auto-advancing content that a keyboard user cannot
// stop is a WCAG failure, not a stylistic choice.
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Pause, Play } from "lucide-react";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { useGSAP } from "@/hooks/useGSAP";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { EASE } from "@/lib/motion";
import type { Testimonial } from "@/lib/content";

const DWELL_SECONDS = 7;

interface ClientVoicesProps {
  testimonials: Testimonial[];
}

export function ClientVoices({ testimonials }: ClientVoicesProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const [index, setIndex] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [playing, setPlaying] = useState(true);

  const prefersReducedMotion = usePrefersReducedMotion();
  const running = playing && !hovering && !prefersReducedMotion;
  const active = testimonials[index];

  // The dwell timer and the progress bar are the same tween, so what the
  // visitor sees filling up is literally the countdown that advances the
  // quote — they can never drift apart.
  useEffect(() => {
    const bar = progressRef.current;
    if (!bar) return;
    if (!running) {
      gsap.set(bar, { scaleX: 0 });
      return;
    }
    const tween = gsap.fromTo(
      bar,
      { scaleX: 0 },
      {
        scaleX: 1,
        duration: DWELL_SECONDS,
        ease: "none",
        onComplete: () => setIndex((current) => (current + 1) % testimonials.length),
      },
    );
    return () => {
      tween.kill();
    };
  }, [index, running, testimonials.length]);

  useGSAP(sectionRef, (section, reduced) => {
    if (reduced) return;
    const mark = section.querySelector<HTMLElement>("[data-quote-mark]");
    if (!mark) return;
    gsap.fromTo(
      mark,
      { yPercent: -14 },
      {
        yPercent: 14,
        ease: EASE.linear,
        scrollTrigger: { trigger: section, start: "top bottom", end: "bottom top", scrub: 0.6 },
      },
    );
  });

  if (!active) return null;

  return (
    <section
      ref={sectionRef}
      aria-labelledby="voices-heading"
      className="relative overflow-hidden bg-enzo-sand"
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={() => setHovering(false)}
    >
      <div className="mx-auto max-w-[1400px] px-4 py-14 sm:px-6 md:px-12 md:py-20">
        {/* Sand is the mount, cream is the reading surface. Solid forest on
            sand only reaches 6.1:1, which leaves no headroom for the tinted
            secondary text this section needs — so the warm band stays as a
            frame and the copy sits on cream, where every tint clears 4.5:1. */}
        <div className="rounded-[28px] bg-enzo-cream px-6 py-14 sm:px-10 md:px-14 md:py-20">
          <h2 id="voices-heading" className="sr-only">
            Client reviews
          </h2>
        <SectionIntro
          index="05"
          label="Clients"
          datum={`${testimonials.length} reviews`}
          lines={["What people say", "once we have gone."]}
          lede="The real test of fitted furniture is the year after the fitters leave. These are clients in and around Leicester, in their own words."
        />

        <div className="mt-14 grid gap-12 lg:mt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)] lg:gap-20">
          {/* Quote plate */}
          <div className="relative">
            <span
              data-quote-mark
              aria-hidden="true"
              className="pointer-events-none absolute -left-2 -top-10 select-none font-serif leading-none text-enzo-forest/10"
              style={{ fontSize: "clamp(9rem, 18vw, 15rem)" }}
            >
              &ldquo;
            </span>

            <figure
              key={index}
              className="relative animate-in fade-in slide-in-from-bottom-3 duration-700 motion-reduce:animate-none"
            >
              <blockquote
                className="font-serif font-light italic leading-[1.28] text-enzo-forest"
                style={{ fontSize: "clamp(1.45rem, 2.9vw, 2.4rem)" }}
              >
                {active.text}
              </blockquote>
              <figcaption className="mt-8 flex items-center gap-4 border-t border-enzo-forest/15 pt-5">
                <ImageWithFallback
                  src={active.image}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  className="h-11 w-11 rounded-full object-cover"
                />
                <span>
                  <cite className="block not-italic font-medium text-[15px] text-enzo-forest">
                    {active.name}
                  </cite>
                  <span className="block text-[12px] uppercase tracking-[0.18em] text-enzo-forest/80">
                    {active.role}
                  </span>
                </span>
              </figcaption>
            </figure>
          </div>

          {/* Roster — doubles as the picker and as visible proof of how
              many reviews there actually are. */}
          <div>
            <div className="flex items-center justify-between gap-4 border-b border-enzo-forest/15 pb-3">
              <span className="font-display text-[10px] font-semibold uppercase tracking-[0.26em] text-enzo-forest/80">
                All reviews
              </span>
              <button
                type="button"
                onClick={() => setPlaying((current) => !current)}
                className="inline-flex items-center gap-1.5 rounded-full border border-enzo-forest/20 px-3 py-1.5 text-[11px] text-enzo-forest transition-colors duration-300 hover:bg-enzo-forest hover:text-enzo-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-forest focus-visible:ring-offset-2 focus-visible:ring-offset-enzo-cream"
              >
                {playing ? (
                  <Pause className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <Play className="h-3 w-3" aria-hidden="true" />
                )}
                {playing ? "Pause" : "Play"}
              </button>
            </div>

            <ul className="mt-1">
              {testimonials.map((testimonial, itemIndex) => {
                const isActive = itemIndex === index;
                return (
                  <li key={testimonial.name} data-active={isActive} className="group relative">
                    <button
                      type="button"
                      aria-current={isActive ? "true" : undefined}
                      onClick={() => setIndex(itemIndex)}
                      onFocus={() => setHovering(true)}
                      onBlur={() => setHovering(false)}
                      className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors duration-300 hover:bg-enzo-sand/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-forest focus-visible:ring-offset-2 focus-visible:ring-offset-enzo-cream group-data-[active=true]:bg-enzo-sand/45"
                    >
                      <ImageWithFallback
                        src={testimonial.image}
                        alt=""
                        aria-hidden="true"
                        loading="lazy"
                        className="h-8 w-8 shrink-0 rounded-full object-cover grayscale transition duration-500 group-hover:grayscale-0 group-data-[active=true]:grayscale-0"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] text-enzo-forest/80 transition-colors duration-300 group-data-[active=true]:text-enzo-forest">
                          {testimonial.name}
                        </span>
                        <span className="block truncate text-[11px] text-enzo-forest/75">
                          {testimonial.role}
                        </span>
                      </span>
                      <span className="font-display text-[10px] tabular-nums text-enzo-forest/75">
                        {String(itemIndex + 1).padStart(2, "0")}
                      </span>
                    </button>

                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-2 bottom-0 block h-px overflow-hidden bg-enzo-forest/10"
                      >
                        <span
                          ref={progressRef}
                          className="block h-full origin-left bg-enzo-forest"
                          style={{ transform: "scaleX(0)" }}
                        />
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
          </div>
        </div>
      </div>
    </section>
  );
}
