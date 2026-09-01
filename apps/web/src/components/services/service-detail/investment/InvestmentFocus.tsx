"use client";

// Investment — layout 4 of 4: ONE AT A TIME.
//
// A tier selector and a single large panel. Instead of asking someone to
// read three columns in parallel, this shows one specification at full size
// and lets them step between them — the price stays in the same place on
// screen while the contents change underneath it, which makes the
// difference between tiers far easier to feel than a side-by-side grid.
//
// The panel cross-fades and the figure rolls, so stepping between tiers
// reads as one object changing rather than three objects swapping.
//
// Ground: near-black — the only dark investment section of the four, which
// is what stops this page's lower half from looking like the others.
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

export function InvestmentFocus({
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
  const [selected, setSelected] = useState(Math.floor((pricing.length - 1) / 2));

  const tier = pricing[selected] ?? pricing[0];
  const estimate = useMemo(
    () =>
      tier
        ? estimateQuote({
            category,
            tier: tier.tier,
            basePriceLabel: tier.from,
            roomSize,
          })
        : null,
    [tier, category, roomSize],
  );

  useGSAP(
    sectionRef,
    (section, reduced) => {
      const panel = section.querySelector<HTMLElement>("[data-panel]");
      if (!panel || reduced) return;

      // Fires on every tier change (deps below), so the panel always reads
      // as the same object being re-filled.
      gsap.fromTo(
        panel.querySelectorAll("[data-panel-item]"),
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.45, ease: EASE.enter, stagger: 0.035 },
      );
    },
    { deps: [selected] },
  );

  useGSAP(sectionRef, (section, reduced) => {
    const shell = section.querySelector<HTMLElement>("[data-shell]");
    if (!shell || reduced) return;
    gsap.from(shell, {
      opacity: 0,
      y: 34,
      duration: 0.85,
      ease: EASE.editorial,
      scrollTrigger: { trigger: shell, start: REVEAL_START, once: true },
    });
  });

  if (!pricing.length) return null;

  return (
    <section
      ref={sectionRef}
      id={id}
      aria-labelledby="investment-heading"
      className="relative bg-enzo-dark scroll-mt-24"
    >
      <div className="mx-auto max-w-[1500px] px-5 py-20 sm:px-6 md:px-12 md:py-28">
        <h2 id="investment-heading" className="sr-only">
          Investment
        </h2>

        <SectionIntro
          layout="split"
          tone="dark"
          index="A5"
          label="Investment"
          datum={`${pricing.length} specifications`}
          lines={["One specification", "at a time."]}
          lede="Set the room size, then step through the specifications. The price stays put while the contents change, so the difference between them is easy to see."
        />

        <div className="mt-10">
          <RoomSizeControl value={roomSize} onChange={setRoomSize} tone="dark" />
        </div>

        {/* Tier selector. */}
        <div
          role="tablist"
          aria-label="Specification"
          className="mt-8 flex flex-wrap gap-2"
        >
          {pricing.map((option, index) => (
            <button
              key={option.tier}
              type="button"
              role="tab"
              aria-selected={index === selected}
              onClick={() => setSelected(index)}
              className={cn(
                "rounded-full border px-6 py-2.5 text-[13.5px] transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-2 focus-visible:ring-offset-enzo-dark",
                index === selected
                  ? "border-enzo-sand bg-enzo-sand text-enzo-forest"
                  : "border-enzo-cream/20 text-enzo-cream/65 hover:border-enzo-cream/45 hover:text-enzo-cream",
              )}
            >
              {option.tier}
            </button>
          ))}
        </div>

        <div
          data-shell
          className="mt-8 overflow-hidden rounded-[20px] border border-enzo-cream/12"
        >
          <div data-panel className="grid lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
            <div className="border-b border-enzo-cream/12 p-8 lg:border-b-0 lg:border-r lg:p-10">
              <span
                data-panel-item
                className="font-display block text-[10.5px] font-semibold uppercase tracking-[0.26em] text-enzo-sand"
              >
                {tier.tier}
              </span>
              <p
                data-panel-item
                className="mt-5 font-title font-semibold leading-[1.02] tabular-nums tracking-[-0.045em] text-enzo-cream"
                style={{ fontSize: "clamp(1.8rem, 3.4vw, 2.8rem)" }}
              >
                {estimate ? (
                  <>
                    <RollingFigure value={estimate.low} />
                    <span className="px-1.5 font-normal text-enzo-cream/35">–</span>
                    <RollingFigure value={estimate.high} />
                  </>
                ) : (
                  "On application"
                )}
              </p>
              <p data-panel-item className="mt-2 text-[12.5px] text-enzo-cream/50">
                {ROOM_SIZE_LABELS[roomSize].toLowerCase()} room · from {tier.from}
              </p>
              <p
                data-panel-item
                className="mt-6 text-[14.5px] leading-[1.65] text-enzo-cream/70"
              >
                {tier.desc}
              </p>

              <QuoteTriggerButton
                quoteInfo={{
                  tier: tier.tier,
                  estimateLabel: estimate
                    ? `${GBP.format(estimate.low)} – ${GBP.format(estimate.high)}`
                    : undefined,
                }}
                className="mt-8 w-full rounded-full bg-enzo-cream py-3.5 text-[14px] font-medium text-enzo-forest transition-colors duration-300 hover:bg-enzo-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-2 focus-visible:ring-offset-enzo-dark"
              >
                Get this quoted
              </QuoteTriggerButton>
            </div>

            <ul className="p-8 lg:p-10">
              {tier.features.map((feature) => (
                <li
                  key={feature}
                  data-panel-item
                  className="flex items-baseline gap-4 border-b border-enzo-cream/10 py-3.5 last:border-b-0"
                >
                  <span aria-hidden="true" className="h-px w-4 shrink-0 bg-enzo-sand" />
                  <span className="text-[14.5px] leading-[1.5] text-enzo-cream/85">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-6 max-w-[70ch] text-[12px] leading-[1.7] text-enzo-cream/40">
          Ranges scale the specification&rsquo;s starting price by room size. A
          guide for planning, not a quotation — we do not price a room we have
          not measured.
        </p>
      </div>
    </section>
  );
}
