"use client";

// Finishes — layout 2 of 4: THE SWATCH WALL.
//
// Every finish shown at once as a wall of large samples, the way a showroom
// board actually presents them. Where the 3D block (layout 1) shows one
// finish on an object, this shows all of them side by side, which is the
// comparison a visitor is really making when they are choosing a colour.
//
// Hovering a swatch grows it and pushes its neighbours down slightly — the
// board reacting to a hand reaching for one sample rather than a card
// lifting on a shadow.
//
// Ground: near-black, so the samples are the only colour on the section.
import { useRef, useState } from "react";
import gsap from "gsap";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { useGSAP } from "@/hooks/useGSAP";
import { EASE, REVEAL_START } from "@/lib/motion";
import { getFinishSwatch, grainLayers } from "@/lib/finish-swatch";
import type { ServiceDetail } from "@/lib/content";

export function FinishSwatchWall({
  service,
  id,
}: {
  service: ServiceDetail;
  id: string;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const finishes = service.materials;

  useGSAP(sectionRef, (section, reduced) => {
    const tiles = gsap.utils.toArray<HTMLElement>("[data-swatch]", section);
    if (!tiles.length) return;

    if (reduced) {
      gsap.set(tiles, { opacity: 1, y: 0, scale: 1 });
      return;
    }

    gsap.from(tiles, {
      opacity: 0,
      y: 22,
      scale: 0.94,
      duration: 0.65,
      ease: EASE.editorial,
      // Grid stagger so the wall fills diagonally rather than row by row.
      stagger: { grid: "auto", from: "start", each: 0.035 },
      scrollTrigger: { trigger: tiles[0], start: REVEAL_START, once: true },
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
          label="Finishes"
          datum={`${finishes.length} on the board`}
          lines={["The whole board,", "at once."]}
          lede="Colour is the decision people agonise over, so here they all are together. We bring the physical samples to your room before anything is ordered — screens lie about timber."
        />

        <ul className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {finishes.map((finish, index) => {
            const swatch = getFinishSwatch(finish);
            const dim = active !== null && active !== index;
            return (
              <li key={finish}>
                <button
                  type="button"
                  data-swatch
                  onPointerEnter={() => setActive(index)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                  aria-pressed={active === index}
                  className="group block w-full text-left focus-visible:outline-none"
                >
                  <span
                    className="block aspect-[4/5] w-full rounded-[10px] ring-1 ring-inset ring-black/25 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-focus-visible:ring-2 group-focus-visible:ring-enzo-sand"
                    style={{
                      backgroundColor: swatch.base,
                      backgroundImage: grainLayers(swatch.grain),
                      opacity: dim ? 0.42 : 1,
                      transform: active === index ? "scale(1.05)" : "scale(1)",
                    }}
                  />
                  <span
                    className="mt-3 block text-[13px] transition-colors duration-300"
                    style={{
                      color: dim ? "rgba(242,240,235,0.35)" : "#F2F0EB",
                    }}
                  >
                    {finish}
                  </span>
                  <span
                    className="mt-0.5 block text-[11px] capitalize transition-colors duration-300"
                    style={{
                      color: dim ? "rgba(242,240,235,0.2)" : "rgba(212,201,181,0.75)",
                    }}
                  >
                    {swatch.grain}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <p className="mt-10 max-w-[62ch] text-[12.5px] leading-[1.7] text-enzo-cream/45">
          Colours here are indicative — timber and stone vary batch to batch,
          which is exactly why the real samples come to you.
        </p>
      </div>
    </section>
  );
}
