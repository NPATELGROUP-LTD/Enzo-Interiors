"use client";

// Investment — layout 2 of 4: THE LADDER.
//
// Tiers as full-width rows rather than side-by-side cards, each with a bar
// showing where it sits against the dearest option. Rows give the tier
// names and their contents far more room than a three-column grid, which
// matters when a specification has six bullet points and a card has to
// squeeze them into 300px.
//
// Shares the room-size control and the `estimateQuote` helper with every
// other investment layout — the pricing behaviour is identical across all
// four, only the presentation differs.
//
// Ground: off-white.
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
import { RollingFigure, GBP } from "./RollingFigure";

export function InvestmentLadder({
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

  const rows = useMemo(
    () =>
      pricing.map((tier) => ({
        tier,
        estimate: estimateQuote({
          category,
          tier: tier.tier,
          basePriceLabel: tier.from,
          roomSize,
        }),
      })),
    [pricing, category, roomSize],
  );

  const ceiling = Math.max(1, ...rows.map((row) => row.estimate?.high ?? 0));

  useGSAP(sectionRef, (section, reduced) => {
    const items = gsap.utils.toArray<HTMLElement>("[data-rung]", section);
    if (!items.length) return;

    if (reduced) {
      gsap.set(items, { opacity: 1, y: 0 });
      return;
    }

    gsap.from(items, {
      opacity: 0,
      y: 28,
      duration: 0.7,
      ease: EASE.enter,
      stagger: 0.09,
      scrollTrigger: { trigger: items[0], start: REVEAL_START, once: true },
    });
  });

  if (!pricing.length) return null;

  return (
    <section
      ref={sectionRef}
      id={id}
      aria-labelledby="investment-heading"
      className="relative bg-card scroll-mt-24"
    >
      <div className="mx-auto max-w-[1500px] px-5 py-20 sm:px-6 md:px-12 md:py-28">
        <h2 id="investment-heading" className="sr-only">
          Investment
        </h2>

        <SectionIntro
          layout="split"
          index="A5"
          label="Investment"
          datum={`${pricing.length} specifications`}
          lines={["What it costs,", "step by step."]}
          lede="Pick your room size and every specification re-prices instantly. Indicative ranges — the firm figure comes after we have measured."
        />

        <div className="mt-10">
          <RoomSizeControl value={roomSize} onChange={setRoomSize} />
        </div>

        <ol className="mt-10">
          {rows.map(({ tier, estimate }, index) => (
            <li
              key={tier.tier}
              data-rung
              className="group border-t border-border/70 py-8 last:border-b md:py-10"
            >
              <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)_minmax(0,14rem)] lg:items-start lg:gap-12">
                <div>
                  <span className="font-display text-[10.5px] font-semibold uppercase tracking-[0.26em] text-enzo-forest-light">
                    {String(index + 1).padStart(2, "0")} / {tier.tier}
                  </span>
                  <p
                    className="mt-3 font-title font-semibold leading-[1.05] tabular-nums tracking-[-0.04em] text-primary"
                    style={{ fontSize: "clamp(1.5rem, 2.6vw, 2.1rem)" }}
                  >
                    {estimate ? (
                      <>
                        <RollingFigure value={estimate.low} />
                        <span className="px-1.5 font-normal text-foreground/35">–</span>
                        <RollingFigure value={estimate.high} />
                      </>
                    ) : (
                      "On application"
                    )}
                  </p>
                  <p className="mt-2 text-[12.5px] text-muted-foreground">
                    {ROOM_SIZE_LABELS[roomSize].toLowerCase()} room · from {tier.from}
                  </p>

                  {/* Where this tier sits against the dearest one. */}
                  {estimate && (
                    <span aria-hidden="true" className="mt-4 block h-px w-full bg-border">
                      <span
                        className="block h-px bg-primary transition-[width] duration-500 ease-out"
                        style={{
                          width: `${Math.max(8, (estimate.high / ceiling) * 100)}%`,
                        }}
                      />
                    </span>
                  )}
                </div>

                <div>
                  <p className="text-[14.5px] leading-[1.6] text-foreground/85">
                    {tier.desc}
                  </p>
                  <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
                    {tier.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-center gap-2.5 text-[13px] text-muted-foreground"
                      >
                        <span aria-hidden="true" className="h-px w-3 shrink-0 bg-enzo-sand" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="lg:pt-1">
                  <QuoteTriggerButton
                    quoteInfo={{
                      tier: tier.tier,
                      estimateLabel: estimate
                        ? `${GBP.format(estimate.low)} – ${GBP.format(estimate.high)}`
                        : undefined,
                    }}
                    className={cn(
                      "w-full rounded-full py-3.5 text-[14px] font-medium transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      "bg-primary text-primary-foreground hover:bg-enzo-forest-light",
                    )}
                  >
                    Get this quoted
                  </QuoteTriggerButton>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-6 max-w-[70ch] text-[12px] leading-[1.7] text-muted-foreground">
          Ranges scale the specification&rsquo;s starting price by room size. A
          guide for planning, not a quotation — we do not price a room we have
          not measured.
        </p>
      </div>
    </section>
  );
}
