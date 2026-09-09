"use client";

// Investment — layout 2 of 4: THE BUDGET SLIDER (bedrooms).
//
// Replaces a row-per-tier ladder, which was a table with the lines taken
// out. This inverts the question: instead of showing three prices and
// asking which you can afford, it asks what you want to spend and tells you
// what that buys.
//
// One slider drives everything. Drag it and the tier resolves under the
// handle, the specification list below rewrites itself, and the figure
// tracks continuously — so the relationship between money and contents is
// something you feel by moving your hand rather than something you work out
// by reading three columns.
//
// The tier boundaries are derived from the published tiers' own estimates,
// so this works with two tiers or five and needs no authoring.
import { useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { fromOnScroll, useGSAP } from "@/hooks/useGSAP";
import { EASE, REVEAL_START } from "@/lib/motion";
import { estimateQuote, ROOM_SIZE_LABELS, type RoomSize } from "@/lib/quote-estimate";
import { cn } from "@/lib/utils";
import type { PricingTier } from "@/lib/content";
import { QuoteTriggerButton } from "../../shared/QuoteRequestModal";
import { RoomSizeControl } from "./RoomSizeControl";
import { GBP } from "@/lib/service-metrics";

export function InvestmentSlider({
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
  // 0–1 along the budget range. Starts a third in, so the section opens on
  // a real answer rather than at the cheapest possible one.
  const [t, setT] = useState(0.34);

  const bands = useMemo(
    () =>
      pricing
        .map((tier) => ({
          tier,
          estimate: estimateQuote({
            category,
            tier: tier.tier,
            basePriceLabel: tier.from,
            roomSize,
          }),
        }))
        .filter((band) => band.estimate)
        .sort((a, b) => a.estimate!.low - b.estimate!.low),
    [pricing, category, roomSize],
  );

  const floor = bands[0]?.estimate?.low ?? 0;
  const ceiling = bands[bands.length - 1]?.estimate?.high ?? floor + 1;
  const budget = Math.round((floor + (ceiling - floor) * t) / 50) * 50;

  // The dearest tier whose entry price the budget clears.
  const active =
    bands.reduce<number>(
      (found, band, index) => (budget >= band.estimate!.low ? index : found),
      0,
    ) ?? 0;
  const current = bands[active];

  useGSAP(sectionRef, (section, reduced) => {
    const panel = section.querySelector<HTMLElement>("[data-budget-panel]");
    if (!panel || reduced) return;
    fromOnScroll(
      panel,
      {
        opacity: 0,
        y: 30,
        duration: 0.85,
        ease: EASE.editorial,
      },
      { trigger: panel, start: REVEAL_START },
    );
  });

  useGSAP(
    sectionRef,
    (section, reduced) => {
      if (reduced) return;
      const items = section.querySelectorAll("[data-spec-item]");
      gsap.fromTo(
        items,
        { opacity: 0, x: -10 },
        { opacity: 1, x: 0, duration: 0.4, ease: EASE.enter, stagger: 0.03 },
      );
    },
    { deps: [active] },
  );

  if (!bands.length) return null;

  return (
    <section
      ref={sectionRef}
      id={id}
      aria-labelledby="investment-heading"
      className="relative bg-card scroll-mt-24"
    >
      <div className="shell py-20 md:py-28">
        <h2 id="investment-heading" className="sr-only">
          Investment
        </h2>

        <SectionIntro
          layout="split"
          index="A5"
          label="Budget"
          datum={`${bands.length} specifications`}
          lines={["Tell us the budget.", "We'll tell you", "what it buys."]}
          lede="Set your room size, then move the slider. Indicative ranges — the firm figure comes after we have measured."
        />

        <div className="mt-10">
          <RoomSizeControl value={roomSize} onChange={setRoomSize} />
        </div>

        <div
          data-budget-panel
          className="mt-10 overflow-hidden rounded-[20px] border border-border/70 bg-background"
        >
          {/* ── The slider ── */}
          <div className="border-b border-border/70 p-6 sm:p-8 md:p-10">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <span className="font-display block text-[10.5px] font-semibold uppercase tracking-[0.26em] text-enzo-forest-light">
                  Your budget
                </span>
                <span
                  className="mt-3 block font-title font-semibold leading-none tabular-nums tracking-[-0.045em] text-primary"
                  style={{ fontSize: "clamp(2.2rem, 5vw, 3.6rem)" }}
                >
                  {GBP.format(budget)}
                </span>
              </div>
              <div className="text-right">
                <span className="block text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  Buys you
                </span>
                <span className="mt-2 block font-title text-[1.4rem] font-semibold tracking-[-0.03em] text-enzo-forest-light">
                  {current.tier.tier}
                </span>
              </div>
            </div>

            <label className="mt-8 block">
              <span className="sr-only">
                Budget, from {GBP.format(floor)} to {GBP.format(ceiling)}
              </span>
              <input
                type="range"
                min={0}
                max={1000}
                value={Math.round(t * 1000)}
                onChange={(event) => setT(Number(event.target.value) / 1000)}
                className="enzo-range w-full"
                aria-valuetext={`${GBP.format(budget)}, ${current.tier.tier}`}
              />
            </label>

            {/* Tier names under the track. `justify-between` rather than
                positioning each label at its own price threshold: two
                thresholds that fall close together (a cheap "Essential" and
                a not-much-dearer "Premium") put their labels close enough
                to overlap into one unreadable run of letters. Evenly spaced
                and always in price order, they can never collide, and the
                active one still reads as the answer to "where am I". */}
            <div className="mt-3 flex items-baseline justify-between gap-2">
              {bands.map((band, index) => (
                <span
                  key={band.tier.tier}
                  className={cn(
                    "whitespace-nowrap text-[11px] transition-[color,font-weight] duration-300",
                    index === active ? "font-semibold" : "font-normal",
                    index === 0 && "text-left",
                    index === bands.length - 1 && index !== 0 && "text-right",
                  )}
                  style={{
                    color:
                      index === active
                        ? "var(--enzo-forest)"
                        : "var(--muted-foreground)",
                  }}
                >
                  {band.tier.tier}
                </span>
              ))}
            </div>
          </div>

          {/* ── What that buys ── */}
          <div className="grid gap-6 p-6 sm:gap-8 sm:p-8 md:grid-cols-[minmax(0,1fr)_minmax(0,16rem)] md:p-10">
            <div>
              <p className="text-[14.5px] leading-[1.65] text-foreground/85">
                {current.tier.desc}
              </p>
              <ul className="mt-5 grid gap-x-8 sm:grid-cols-2">
                {current.tier.features.map((feature) => (
                  <li
                    key={feature}
                    data-spec-item
                    className="flex items-baseline gap-3 border-t border-border/60 py-2.5 text-[13.5px] text-foreground/85"
                  >
                    <span aria-hidden="true" className="h-px w-3 shrink-0 bg-enzo-sand" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            <div className="md:pt-1">
              <p className="text-[12.5px] text-muted-foreground">
                {ROOM_SIZE_LABELS[roomSize]} room · {current.tier.tier} range{" "}
                {GBP.format(current.estimate!.low)} –{" "}
                {GBP.format(current.estimate!.high)}
              </p>
              <QuoteTriggerButton
                quoteInfo={{
                  tier: current.tier.tier,
                  estimateLabel: `${GBP.format(current.estimate!.low)} – ${GBP.format(current.estimate!.high)}`,
                }}
                className="mt-5 w-full rounded-full bg-primary py-3.5 text-[14px] font-medium text-primary-foreground transition-colors duration-300 hover:bg-enzo-forest-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Quote me at this budget
              </QuoteTriggerButton>
            </div>
          </div>
        </div>

        <p className="mt-6 max-w-[70ch] text-[12px] leading-[1.7] text-muted-foreground">
          Ranges scale each specification&rsquo;s starting price by room size. A
          guide for planning, not a quotation — we do not price a room we have
          not measured.
        </p>
      </div>
    </section>
  );
}
