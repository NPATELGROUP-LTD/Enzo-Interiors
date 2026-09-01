"use client";

// Finishes — layout 4 of 4: THE PAIRING.
//
// Two large panels side by side and a control under each: pick a front and
// pick a worktop, and see the pair together at full size. Nobody chooses a
// finish in isolation — they choose a *combination*, and none of the other
// three layouts lets you actually test one.
//
// The seam between the panels is the point of the design, so it sits dead
// centre with a hairline on it, and the panels cross-fade rather than
// swapping, which keeps the comparison continuous while you cycle options.
//
// Ground: near-black, so both panels are judged against neutral.
import { useRef, useState } from "react";
import gsap from "gsap";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { useGSAP } from "@/hooks/useGSAP";
import { EASE, REVEAL_START } from "@/lib/motion";
import { getFinishSwatch, grainLayers } from "@/lib/finish-swatch";
import { cn } from "@/lib/utils";
import type { ServiceDetail } from "@/lib/content";

/** Finishes that read as a worktop rather than a door front. */
const SURFACE_WORDS = [
  "quartz",
  "granite",
  "dekton",
  "marble",
  "stone",
  "concrete",
  "slate",
  "glass",
  "mirror",
];

export function FinishPairing({
  service,
  id,
}: {
  service: ServiceDetail;
  id: string;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const finishes = service.materials;

  // Split the published list into fronts and surfaces so the two controls
  // offer sensible options. If the client has authored no surface-like
  // finish, both columns fall back to the full list rather than rendering
  // an empty picker.
  const surfaces = finishes.filter((name) =>
    SURFACE_WORDS.some((word) => name.toLowerCase().includes(word)),
  );
  const fronts = finishes.filter((name) => !surfaces.includes(name));
  const frontOptions = fronts.length ? fronts : finishes;
  const surfaceOptions = surfaces.length ? surfaces : finishes;

  const [front, setFront] = useState(0);
  const [surface, setSurface] = useState(0);

  const frontSwatch = getFinishSwatch(frontOptions[front] ?? finishes[0]);
  const surfaceSwatch = getFinishSwatch(surfaceOptions[surface] ?? finishes[0]);

  useGSAP(sectionRef, (section, reduced) => {
    const panels = gsap.utils.toArray<HTMLElement>("[data-panel]", section);
    if (!panels.length) return;

    if (reduced) {
      gsap.set(panels, { clipPath: "inset(0 0 0 0)" });
      return;
    }

    // Panels open away from the seam — the two halves parting.
    gsap.from(panels, {
      clipPath: (i: number) => (i === 0 ? "inset(0 0 0 100%)" : "inset(0 100% 0 0)"),
      duration: 1.05,
      ease: EASE.editorial,
      scrollTrigger: { trigger: panels[0], start: REVEAL_START, once: true },
    });
  });

  if (!finishes.length) return null;

  return (
    <section
      ref={sectionRef}
      id={id}
      aria-labelledby="finishes-heading"
      className="relative bg-enzo-dark scroll-mt-24"
    >
      <div className="mx-auto max-w-[1500px] px-5 py-20 sm:px-6 md:px-12 md:py-28">
        <h2 id="finishes-heading" className="sr-only">
          Finishes
        </h2>

        <SectionIntro
          layout="split"
          tone="dark"
          index="A3"
          label="Pairing"
          datum={`${finishes.length} to combine`}
          lines={["Try them", "against each other."]}
          lede="A finish is never chosen on its own. Put a front against a surface and see the combination at full size — the decision you are actually making."
        />

        {/* The pair. The seam is centred and carries a hairline, because the
            join is the thing being judged. */}
        <div className="mt-14 grid overflow-hidden rounded-[16px] sm:grid-cols-2">
          <div
            data-panel
            className="relative aspect-[4/3] sm:aspect-[3/4]"
            style={{
              backgroundColor: frontSwatch.base,
              backgroundImage: grainLayers(frontSwatch.grain),
              transition: "background-color 500ms cubic-bezier(0.22,1,0.36,1)",
            }}
          >
            <span
              className="absolute left-4 top-4 rounded-md px-2.5 py-1.5 text-[11px] uppercase tracking-[0.18em] backdrop-blur-sm"
              style={{
                backgroundColor: frontSwatch.light
                  ? "rgba(20,20,19,0.5)"
                  : "rgba(242,240,235,0.82)",
                color: frontSwatch.light ? "#F2F0EB" : "#1C4A3A",
              }}
            >
              Front
            </span>
          </div>
          <div
            data-panel
            className="relative aspect-[4/3] sm:aspect-[3/4]"
            style={{
              backgroundColor: surfaceSwatch.base,
              backgroundImage: grainLayers(surfaceSwatch.grain),
              transition: "background-color 500ms cubic-bezier(0.22,1,0.36,1)",
            }}
          >
            <span
              className="absolute right-4 top-4 rounded-md px-2.5 py-1.5 text-[11px] uppercase tracking-[0.18em] backdrop-blur-sm"
              style={{
                backgroundColor: surfaceSwatch.light
                  ? "rgba(20,20,19,0.5)"
                  : "rgba(242,240,235,0.82)",
                color: surfaceSwatch.light ? "#F2F0EB" : "#1C4A3A",
              }}
            >
              Surface
            </span>
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 hidden w-px bg-black/25 sm:block"
            />
          </div>
        </div>

        {/* Controls, one under each panel. */}
        <div className="mt-8 grid gap-8 sm:grid-cols-2 sm:gap-6">
          <FinishPicker
            legend="Front"
            options={frontOptions}
            selected={front}
            onSelect={setFront}
          />
          <FinishPicker
            legend="Surface"
            options={surfaceOptions}
            selected={surface}
            onSelect={setSurface}
          />
        </div>

        <p className="mt-10 text-[13px] text-enzo-cream/55">
          Showing{" "}
          <span className="text-enzo-cream">{frontSwatch.name}</span> against{" "}
          <span className="text-enzo-cream">{surfaceSwatch.name}</span>. Indicative
          colours — the real samples come to your room first.
        </p>
      </div>
    </section>
  );
}

function FinishPicker({
  legend,
  options,
  selected,
  onSelect,
}: {
  legend: string;
  options: string[];
  selected: number;
  onSelect: (index: number) => void;
}) {
  return (
    <fieldset>
      <legend className="font-display mb-3 text-[10.5px] font-semibold uppercase tracking-[0.26em] text-enzo-sand">
        {legend}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((finish, index) => {
          const swatch = getFinishSwatch(finish);
          const isOn = index === selected;
          return (
            <button
              key={finish}
              type="button"
              onClick={() => onSelect(index)}
              aria-pressed={isOn}
              className={cn(
                "flex items-center gap-2.5 rounded-full border py-1.5 pl-1.5 pr-4 text-[12.5px] transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-2 focus-visible:ring-offset-enzo-dark",
                isOn
                  ? "border-enzo-sand bg-enzo-sand/12 text-enzo-cream"
                  : "border-enzo-cream/18 text-enzo-cream/65 hover:border-enzo-cream/45 hover:text-enzo-cream",
              )}
            >
              <span
                aria-hidden="true"
                className="h-5 w-5 shrink-0 rounded-full ring-1 ring-inset ring-black/25"
                style={{
                  backgroundColor: swatch.base,
                  backgroundImage: grainLayers(swatch.grain),
                }}
              />
              {finish}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
