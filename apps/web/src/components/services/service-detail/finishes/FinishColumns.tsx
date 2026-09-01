"use client";

// Finishes — layout 3 of 4: THE COLUMNS.
//
// Full-height vertical bands of material, one per finish, that expand in
// place when you point at them. The section reads as a run of door fronts
// standing side by side — which is how these materials are actually
// encountered, edge to edge rather than as isolated squares.
//
// Only one band can be open at a time and the widths are driven by
// flex-grow, so the row always fills exactly and never reflows onto a
// second line however many finishes are published.
//
// Below lg it becomes a horizontal swipe rail: fourteen vertical slivers on
// a phone are unreadable and untappable.
//
// Ground: forest.
import { useRef, useState } from "react";
import gsap from "gsap";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { useGSAP } from "@/hooks/useGSAP";
import { EASE, REVEAL_START } from "@/lib/motion";
import { getFinishSwatch, grainLayers } from "@/lib/finish-swatch";
import type { ServiceDetail } from "@/lib/content";

export function FinishColumns({
  service,
  id,
}: {
  service: ServiceDetail;
  id: string;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(0);
  const finishes = service.materials;

  useGSAP(sectionRef, (section, reduced) => {
    const bands = gsap.utils.toArray<HTMLElement>("[data-band]", section);
    if (!bands.length) return;

    if (reduced) {
      gsap.set(bands, { opacity: 1, scaleY: 1 });
      return;
    }

    gsap.from(bands, {
      opacity: 0,
      scaleY: 0.82,
      transformOrigin: "50% 100%",
      duration: 0.8,
      ease: EASE.editorial,
      stagger: 0.05,
      scrollTrigger: { trigger: bands[0], start: REVEAL_START, once: true },
    });
  });

  if (!finishes.length) return null;

  const current = getFinishSwatch(finishes[open] ?? finishes[0]);

  return (
    <section
      ref={sectionRef}
      id={id}
      aria-labelledby="finishes-heading"
      className="relative bg-enzo-forest scroll-mt-24"
    >
      <div className="mx-auto max-w-[1500px] px-5 py-20 sm:px-6 md:px-12 md:py-28">
        <h2 id="finishes-heading" className="sr-only">
          Finishes
        </h2>

        <SectionIntro
          layout="split"
          tone="dark"
          index="A3"
          label="Finishes"
          datum={`${finishes.length} available`}
          lines={["Stand them", "side by side."]}
          lede="A finish behaves differently at full height than it does as a small square. Point at one to open it out."
        />

        {/* ── lg and up: expanding bands ── */}
        <div
          className="mt-14 hidden gap-2 lg:flex lg:h-[26rem]"
          role="group"
          aria-label="Finishes"
        >
          {finishes.map((finish, index) => {
            const swatch = getFinishSwatch(finish);
            const isOpen = index === open;
            return (
              <button
                key={finish}
                type="button"
                data-band
                onPointerEnter={() => setOpen(index)}
                onFocus={() => setOpen(index)}
                aria-pressed={isOpen}
                className="group relative min-w-0 overflow-hidden rounded-[12px] ring-1 ring-inset ring-black/20 transition-[flex-grow] duration-[650ms] ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand"
                style={{
                  flexGrow: isOpen ? 4 : 1,
                  flexBasis: 0,
                  backgroundColor: swatch.base,
                  backgroundImage: grainLayers(swatch.grain),
                }}
              >
                {/* Name runs vertically while the band is narrow and turns
                    horizontal once there is room for it. */}
                <span
                  className="absolute inset-x-0 bottom-0 p-4 text-left transition-opacity duration-300"
                  style={{ opacity: isOpen ? 1 : 0 }}
                >
                  <span
                    className="block rounded-md px-2.5 py-1.5 text-[13.5px] font-medium backdrop-blur-sm"
                    style={{
                      backgroundColor: swatch.light
                        ? "rgba(20,20,19,0.55)"
                        : "rgba(242,240,235,0.86)",
                      color: swatch.light ? "#F2F0EB" : "#1C4A3A",
                    }}
                  >
                    {finish}
                  </span>
                </span>
                <span
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[12px] font-medium transition-opacity duration-300"
                  style={{
                    writingMode: "vertical-rl",
                    transform: "translateX(-50%) rotate(180deg)",
                    opacity: isOpen ? 0 : 1,
                    color: swatch.light ? "rgba(20,20,19,0.75)" : "rgba(242,240,235,0.9)",
                  }}
                >
                  {finish}
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-5 hidden text-[13px] text-enzo-cream/60 lg:block">
          <span className="text-enzo-cream">{current.name}</span>
          <span className="px-2 text-enzo-cream/25">·</span>
          <span className="capitalize">{current.grain}</span>
        </p>

        {/* ── Below lg: swipe rail ── */}
        <ul className="-mx-5 mt-12 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-3 sm:-mx-6 sm:px-6 lg:hidden">
          {finishes.map((finish) => {
            const swatch = getFinishSwatch(finish);
            return (
              <li key={finish} className="w-[44%] shrink-0 snap-start sm:w-[30%]">
                <span
                  className="block aspect-[3/4] w-full rounded-[12px] ring-1 ring-inset ring-black/20"
                  style={{
                    backgroundColor: swatch.base,
                    backgroundImage: grainLayers(swatch.grain),
                  }}
                />
                <span className="mt-2.5 block text-[13px] text-enzo-cream">
                  {finish}
                </span>
              </li>
            );
          })}
        </ul>

        <p className="mt-8 max-w-[62ch] text-[12.5px] leading-[1.7] text-enzo-cream/45">
          Indicative colours. The real samples come to your room before
          anything is ordered.
        </p>
      </div>
    </section>
  );
}
