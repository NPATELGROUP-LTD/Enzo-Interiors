"use client";

// Investment — layout 3 of 4: THE BUILD-UP (media walls).
//
// Replaces a features-by-tier comparison table. A table made the tiers look
// like three unrelated products you pick between, when in practice they are
// one wall with more added to it — which is also literally how the thing
// gets built, in layers off the plasterboard outwards.
//
// So the tiers stack. Each band shows only what that step *adds* and what
// the step costs on top of the one below, and the running total accumulates
// down the stack. Selecting a band lights every band up to and including
// it, so you can see the whole spec you would be buying rather than one
// column of it.
//
// Deltas are computed between consecutive published tiers, so this works
// with any number of them and needs no authoring.
import { useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { useGSAP } from "@/hooks/useGSAP";
import { EASE, REVEAL_START } from "@/lib/motion";
import { estimateQuote, ROOM_SIZE_LABELS, type RoomSize } from "@/lib/quote-estimate";
import { cn } from "@/lib/utils";
import type { PricingTier } from "@/lib/content";
import { QuoteTriggerButton } from "../../shared/QuoteRequestModal";
import { RoomSizeControl } from "./RoomSizeControl";
import { GBP } from "./RollingFigure";

export function InvestmentBuildUp({
  category,
  pricing,
  id,
}: {
  category: string;
  pricing: PricingTier[];
  id: string;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const [roomSize, setRoomSize] = useState<RoomSize>("medium");
  const [selected, setSelected] = useState(pricing.length - 1);

  const layers = useMemo(() => {
    const priced = pricing
      .map((tier) => ({
        tier,
        estimate: estimateQuote({
          category,
          tier: tier.tier,
          basePriceLabel: tier.from,
          roomSize,
        }),
      }))
      .filter((entry) => entry.estimate)
      .sort((a, b) => a.estimate!.low - b.estimate!.low);

    return priced.map((entry, index) => {
      const previous = priced[index - 1];
      // Only what this step adds over the one below it.
      const adds = previous
        ? entry.tier.features.filter((f) => !previous.tier.features.includes(f))
        : entry.tier.features;
      const delta = previous ? entry.estimate!.low - previous.estimate!.low : null;
      return { ...entry, adds, delta };
    });
  }, [pricing, category, roomSize]);

  useGSAP(sectionRef, (section, reduced) => {
    const bands = gsap.utils.toArray<HTMLElement>("[data-layer]", section);
    if (!bands.length) return;

    if (reduced) {
      gsap.set(bands, { opacity: 1, y: 0 });
      return;
    }

    // Bands arrive bottom-up — the wall being built off the floor.
    gsap.from([...bands].reverse(), {
      opacity: 0,
      y: 26,
      duration: 0.7,
      ease: EASE.editorial,
      stagger: 0.11,
      scrollTrigger: { trigger: bands[0], start: REVEAL_START, once: true },
    });
  });

  if (!layers.length) return null;

  const chosen = layers[Math.min(selected, layers.length - 1)];

  return (
    <section
      ref={sectionRef}
      id={id}
      aria-labelledby="investment-heading"
      className="relative bg-muted scroll-mt-24"
    >
      <div className="mx-auto max-w-[1500px] px-5 py-20 sm:px-6 md:px-12 md:py-28">
        <h2 id="investment-heading" className="sr-only">
          Investment
        </h2>

        <SectionIntro
          layout="split"
          index="A5"
          label="Build-up"
          datum={`${layers.length} steps`}
          lines={["One wall,", "built up in steps."]}
          lede="These are not three different products — they are the same wall with more added to it. Each band shows only what that step adds, and what the step costs."
        />

        <div className="mt-10">
          <RoomSizeControl value={roomSize} onChange={setRoomSize} />
        </div>

        {/* Stack, dearest at the top — the way it is drawn in section. */}
        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:gap-14">
          <div>
            {[...layers].reverse().map((layer) => {
              const index = layers.indexOf(layer);
              const included = index <= selected;
              return (
                <button
                  key={layer.tier.tier}
                  type="button"
                  data-layer
                  onClick={() => setSelected(index)}
                  aria-pressed={index === selected}
                  className={cn(
                    "group block w-full border-t border-border/70 px-1 py-7 text-left transition-colors duration-400 first:border-t-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    included ? "opacity-100" : "opacity-45",
                  )}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                    <span className="flex items-baseline gap-4">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "block h-px transition-all duration-500",
                          index === selected ? "w-12 bg-primary" : "w-5 bg-border",
                        )}
                      />
                      <span
                        className={cn(
                          "font-title font-semibold leading-[1.1] tracking-[-0.03em] transition-colors duration-300",
                          included ? "text-primary" : "text-foreground/60",
                        )}
                        style={{ fontSize: "clamp(1.25rem, 2.4vw, 1.9rem)" }}
                      >
                        {layer.tier.tier}
                      </span>
                    </span>

                    <span className="text-[14px] tabular-nums text-enzo-forest-light">
                      {layer.delta === null
                        ? `from ${GBP.format(layer.estimate!.low)}`
                        : `+ ${GBP.format(layer.delta)}`}
                    </span>
                  </div>

                  <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 pl-16">
                    {layer.adds.map((feature) => (
                      <li
                        key={feature}
                        className="text-[13px] text-muted-foreground"
                      >
                        {feature}
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>

          {/* Running total for everything up to the selected band. */}
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-[18px] border border-border/70 bg-background p-7">
              <span className="font-display block text-[10.5px] font-semibold uppercase tracking-[0.26em] text-enzo-forest-light">
                Up to {chosen.tier.tier}
              </span>
              <p
                className="mt-4 font-title font-semibold leading-[1.05] tabular-nums tracking-[-0.045em] text-primary"
                style={{ fontSize: "clamp(1.6rem, 2.6vw, 2.2rem)" }}
              >
                {GBP.format(chosen.estimate!.low)}
                <span className="px-1.5 font-normal text-foreground/35">–</span>
                {GBP.format(chosen.estimate!.high)}
              </p>
              <p className="mt-2 text-[12.5px] text-muted-foreground">
                {ROOM_SIZE_LABELS[roomSize]} room · everything in the{" "}
                {layers
                  .slice(0, selected + 1)
                  .map((l) => l.tier.tier.toLowerCase())
                  .join(", ")}{" "}
                {selected === 0 ? "step" : "steps"}
              </p>

              <QuoteTriggerButton
                quoteInfo={{
                  tier: chosen.tier.tier,
                  estimateLabel: `${GBP.format(chosen.estimate!.low)} – ${GBP.format(chosen.estimate!.high)}`,
                }}
                className="mt-7 w-full rounded-full bg-primary py-3.5 text-[14px] font-medium text-primary-foreground transition-colors duration-300 hover:bg-enzo-forest-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Quote this build-up
              </QuoteTriggerButton>
            </div>
          </aside>
        </div>

        <p className="mt-6 max-w-[70ch] text-[12px] leading-[1.7] text-muted-foreground">
          Step costs are the difference between each specification&rsquo;s
          starting price at your room size. A guide for planning, not a
          quotation.
        </p>
      </div>
    </section>
  );
}
