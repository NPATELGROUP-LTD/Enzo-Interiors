"use client";

// Section 01 — a pinned horizontal rail.
//
// Layout: an editorial masthead holds the left third of the viewport while
// the four disciplines travel past it on the right, so the section reads
// like a sample board being drawn across a workbench rather than a grid of
// equal cards. It is the only pinned section on the page — pinning more
// than one fights native scroll feel, especially on touch.
//
// Below `lg` the pin is dropped entirely and the same markup becomes a
// native snap-scrolling rail, which is the better touch interaction anyway
// (a scrubbed pin hijacks the gesture the user already knows).
import { useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { useGSAP } from "@/hooks/useGSAP";
import { DUR, EASE, REVEAL_START, STAGGER } from "@/lib/motion";
import type { Service } from "@/lib/content";

interface ServicesRailProps {
  services: Service[];
}

export function ServicesRail({ services }: ServicesRailProps) {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    sectionRef,
    (section, reduced, { desktop }) => {
      const viewport = section.querySelector<HTMLElement>("[data-rail-viewport]");
      const track = section.querySelector<HTMLElement>("[data-rail-track]");
      if (!viewport || !track) return;

      const panels = gsap.utils.toArray<HTMLElement>("[data-rail-panel]", track);
      if (panels.length === 0) return;

      // Touch / narrow viewports: the rail scrolls natively, so the only
      // motion is a plain entrance for the panels already on screen.
      if (!desktop) {
        if (reduced) return;
        gsap.from(panels, {
          opacity: 0,
          y: 28,
          duration: DUR.enter,
          ease: EASE.enter,
          stagger: STAGGER,
          scrollTrigger: { trigger: viewport, start: REVEAL_START, once: true },
        });
        return;
      }

      // Reduced motion on desktop: no pin, no scrub. The rail keeps its
      // horizontal overflow so every service is still reachable by
      // keyboard and by dragging the scrollbar.
      if (reduced) {
        viewport.style.overflowX = "auto";
        // Undone on revert so turning the preference back off hands the
        // viewport back to the pinned rail instead of leaving it with both
        // a scrollbar and a scrub.
        return () => {
          viewport.style.removeProperty("overflow-x");
        };
      }

      const counter = section.querySelector<HTMLElement>("[data-rail-counter]");
      const progress = section.querySelector<HTMLElement>("[data-rail-progress]");
      // Pin the inner stage, never the <section> itself. ScrollTrigger wraps
      // whatever it pins in a `.pin-spacer` div, which re-parents that node —
      // and React still believes the <section> is a direct child of the page
      // container. The moment a sibling is inserted next to it (the Hero
      // swapping its placeholder for the scroll sequence right after mount),
      // React calls insertBefore against a reference node that no longer
      // lives there and the whole tree throws. Keeping the pin one level in
      // means React's children never move.
      const stage = section.querySelector<HTMLElement>("[data-rail-stage]");
      if (!stage) return;

      // Recomputed on every refresh (`invalidateOnRefresh`) rather than
      // captured once, so a resize or a late-loading font cannot leave the
      // rail stopping short of the final panel.
      const distance = () => Math.max(0, track.scrollWidth - viewport.clientWidth);

      const drift = gsap.to(track, {
        x: () => -distance(),
        ease: EASE.linear,
        scrollTrigger: {
          trigger: stage,
          pin: stage,
          start: "top top",
          // The extra tail keeps the last panel on screen for a beat
          // instead of unpinning the instant it arrives.
          end: () => `+=${distance() + window.innerHeight * 0.35}`,
          anticipatePin: 1,
          scrub: 0.8,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            if (progress) gsap.set(progress, { scaleX: self.progress });
            if (counter) {
              const index = Math.round(self.progress * (panels.length - 1)) + 1;
              counter.textContent = String(index).padStart(2, "0");
            }
          },
        },
      });

      // Counter-drift inside each plate. `containerAnimation` re-bases these
      // triggers onto the horizontal tween above, so "enters the viewport"
      // means horizontally, not vertically — the depth cue tracks the rail's
      // own motion instead of the page's.
      panels.forEach((panel) => {
        const image = panel.querySelector<HTMLElement>("[data-rail-image]");
        if (!image) return;
        gsap.fromTo(
          image,
          { xPercent: -6 },
          {
            xPercent: 6,
            ease: EASE.linear,
            scrollTrigger: {
              trigger: panel,
              containerAnimation: drift,
              start: "left right",
              end: "right left",
              scrub: true,
            },
          },
        );
      });
    },
    { queries: { desktop: "(min-width: 1024px)" } },
  );

  return (
    <section
      ref={sectionRef}
      aria-labelledby="services-heading"
      className="relative overflow-hidden bg-background"
    >
      {/* Seam out of the hero's near-black frame — without it the cut from
          the cinematic intro to cream is a hard edge. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-enzo-dark/15 to-transparent"
      />

      <div
        data-rail-stage
        className="relative mx-auto grid w-full max-w-[1600px] gap-12 py-24 lg:h-screen lg:grid-cols-[minmax(300px,30vw)_minmax(0,1fr)] lg:items-center lg:gap-0 lg:py-0"
      >
        {/* Masthead */}
        <div className="px-6 md:px-12 lg:pl-[clamp(2rem,5vw,5rem)] lg:pr-12">
          <h2 id="services-heading" className="sr-only">
            Services
          </h2>
          <SectionIntro
            index="01"
            label="Services"
            datum="four disciplines"
            lines={["Everything fitted.", "Nothing off the shelf."]}
            lede="Four things, made properly. We draw them, build them in our workshop and fit them ourselves, so there is nobody else to hand the blame to."
            titleClassName="[font-size:clamp(1.9rem,3.1vw,2.9rem)]"
          />

          <Link
            href="/services"
            className="group/all mt-8 inline-flex items-center gap-2 border-b border-primary/25 pb-1 text-[13px] font-medium text-primary transition-colors duration-300 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
          >
            All services
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 ease-out group-hover/all:translate-x-1" />
          </Link>

          {/* Rail position readout — doubles as the "there is more to the
              right" affordance a pinned rail otherwise lacks. */}
          <div className="mt-12 hidden items-center gap-4 lg:flex">
            <span
              data-rail-counter
              className="font-display text-[11px] font-semibold tabular-nums text-primary"
            >
              01
            </span>
            <span className="relative h-px flex-1 bg-border">
              <span
                data-rail-progress
                aria-hidden="true"
                className="absolute inset-0 block origin-left bg-primary"
                style={{ transform: "scaleX(0)" }}
              />
            </span>
            <span className="font-display text-[11px] tabular-nums text-muted-foreground">
              {String(services.length).padStart(2, "0")}
            </span>
          </div>
        </div>

        {/* Rail */}
        <div
          data-rail-viewport
          className="min-w-0 snap-x snap-mandatory overflow-x-auto overscroll-x-contain pb-4 lg:snap-none lg:overflow-hidden lg:pb-0 lg:[mask-image:linear-gradient(to_right,black_0,black_calc(100%-96px),transparent_100%)]"
        >
          <div
            data-rail-track
            className="flex w-max gap-5 px-6 md:px-12 lg:gap-8 lg:pl-0 lg:pr-[12vw]"
          >
            {services.map((service, index) => (
              <article
                key={service.slug}
                data-rail-panel
                className="group w-[74vw] max-w-[340px] shrink-0 snap-center sm:w-[44vw] lg:w-[clamp(250px,20vw,320px)]"
              >
                <Link
                  href={`/services/${service.slug}`}
                  data-cursor="view"
                  className="block rounded-[22px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
                >
                  <div className="relative h-[clamp(300px,42vh,440px)] overflow-hidden rounded-[22px] bg-muted">
                    {/* Scale sits on this wrapper, drift on the image
                        itself — two elements so a CSS hover transform and
                        GSAP's inline transform never overwrite each other. */}
                    <div className="relative h-full w-full transition-transform duration-[900ms] ease-out group-hover:scale-[1.04]">
                      <ImageWithFallback
                        data-rail-image
                        src={service.image}
                        alt={service.title}
                        loading="lazy"
                        className="absolute inset-y-0 left-[-7%] h-full w-[114%] max-w-none object-cover"
                      />
                    </div>
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-enzo-forest/45 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                    <span className="font-display absolute left-4 top-4 rounded-full bg-enzo-cream/85 px-2.5 py-1 text-[10px] font-semibold tabular-nums tracking-[0.14em] text-enzo-forest backdrop-blur-sm">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>

                  <div className="mt-5 flex items-baseline justify-between gap-4 border-t border-border/60 pt-4">
                    <h3 className="font-serif text-[1.35rem] font-normal leading-tight text-primary">
                      {service.title}
                    </h3>
                    <ArrowUpRight className="h-4 w-4 shrink-0 -translate-x-1 translate-y-1 text-enzo-forest-light opacity-0 transition-all duration-300 ease-out group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100" />
                  </div>
                  <p className="mt-2 text-[13.5px] leading-[1.65] text-muted-foreground">
                    {service.description}
                  </p>
                </Link>

                <ul className="mt-4 space-y-1.5">
                  {service.features.slice(0, 3).map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-2.5 text-[12px] text-foreground/75"
                    >
                      <span aria-hidden="true" className="h-px w-3 shrink-0 bg-enzo-sand" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
