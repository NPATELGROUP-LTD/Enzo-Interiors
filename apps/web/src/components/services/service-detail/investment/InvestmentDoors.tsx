"use client";

// Investment — layout 4 of 4: THE DOORS (wardrobes).
//
// Replaces a tabbed "one specification at a time" panel, which was a tab
// strip over a box — the plainest possible arrangement on the page that
// most needed a shape of its own.
//
// The tiers are full-height door fronts standing side by side. The one you
// point at opens: it widens, its front slides aside and the specification
// is revealed in the carcass behind it. It is the product's own mechanism
// used as the interface, and at wardrobe proportions — tall, narrow, edge
// to edge — it looks like nothing else on the site.
//
// Widths are driven by flex-grow so the row always fills exactly, at any
// number of published tiers. Below lg it becomes a plain stack, because
// three tall slivers on a phone are unreadable.
import { useRef, useState } from "react";
import gsap from "gsap";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { fromOnScroll, useGSAP } from "@/hooks/useGSAP";
import { EASE, REVEAL_START } from "@/lib/motion";
import { estimateQuote, ROOM_SIZE_LABELS, type RoomSize } from "@/lib/quote-estimate";
import { cn } from "@/lib/utils";
import type { PricingTier } from "@/lib/content";
import { QuoteTriggerButton } from "../../shared/QuoteRequestModal";
import { RoomSizeControl } from "./RoomSizeControl";
import { GBP } from "./RollingFigure";

export function InvestmentDoors({
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
  const [open, setOpen] = useState(Math.floor((pricing.length - 1) / 2));

  const priced = pricing.map((tier) => ({
    tier,
    estimate: estimateQuote({
      category,
      tier: tier.tier,
      basePriceLabel: tier.from,
      roomSize,
    }),
  }));

  useGSAP(sectionRef, (section, reduced) => {
    const doors = gsap.utils.toArray<HTMLElement>("[data-door]", section);
    if (!doors.length) return;

    if (reduced) {
      gsap.set(doors, { opacity: 1, scaleY: 1 });
      return;
    }

    fromOnScroll(
      doors,
      {
        opacity: 0,
        scaleY: 0.86,
        transformOrigin: "50% 100%",
        duration: 0.85,
        ease: EASE.editorial,
        stagger: 0.08,
      },
      { trigger: doors[0], start: REVEAL_START },
    );
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
          label="Specifications"
          datum={`${pricing.length} to open`}
          lines={["Open the one", "you want priced."]}
          lede="Each specification is a door. Point at one and it opens onto what is behind it. Indicative ranges — the firm figure comes after we have measured."
        />

        <div className="mt-10">
          <RoomSizeControl value={roomSize} onChange={setRoomSize} tone="dark" />
        </div>

        {/* ── lg and up: the doors ── */}
        <div className="mt-12 hidden gap-3 lg:flex lg:h-[32rem]">
          {priced.map(({ tier, estimate }, index) => {
            const isOpen = index === open;
            return (
              <article
                key={tier.tier}
                data-door
                className="group relative min-w-0 overflow-hidden rounded-[16px] bg-enzo-forest/30 transition-[flex-grow] duration-[700ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ flexGrow: isOpen ? 4.2 : 1, flexBasis: 0 }}
              >
                <button
                  type="button"
                  onPointerEnter={() => setOpen(index)}
                  onFocus={() => setOpen(index)}
                  onClick={() => setOpen(index)}
                  aria-expanded={isOpen}
                  className="absolute inset-0 z-10 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-enzo-sand"
                >
                  <span className="sr-only">
                    {tier.tier} specification
                    {estimate
                      ? `, ${GBP.format(estimate.low)} to ${GBP.format(estimate.high)}`
                      : ""}
                  </span>
                </button>

                {/* The door front — slides aside as the bay opens. */}
                <div
                  aria-hidden={isOpen}
                  className="absolute inset-0 flex flex-col items-center justify-between py-8 transition-transform duration-[700ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
                  style={{
                    background: "linear-gradient(160deg, #D4C9B5, #B9AE99)",
                    transform: isOpen ? "translateX(-102%)" : "translateX(0)",
                  }}
                >
                  <span className="font-display text-[11px] font-semibold tabular-nums text-enzo-forest/70">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span
                    className="whitespace-nowrap text-[15px] font-medium tracking-[0.02em] text-enzo-forest"
                    style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                  >
                    {tier.tier}
                  </span>
                  {/* Rail handle. */}
                  <span
                    aria-hidden="true"
                    className="h-10 w-[5px] rounded-full bg-enzo-forest/45"
                  />
                </div>

                {/* The carcass behind it. */}
                <div
                  className="pointer-events-none absolute inset-0 flex flex-col justify-end p-8 transition-opacity duration-500"
                  style={{ opacity: isOpen ? 1 : 0, transitionDelay: isOpen ? "220ms" : "0ms" }}
                >
                  <span className="font-display text-[10.5px] font-semibold uppercase tracking-[0.26em] text-enzo-sand">
                    {tier.tier}
                  </span>
                  <p
                    className="mt-3 font-title font-semibold leading-[1.05] tabular-nums tracking-[-0.04em] text-enzo-cream"
                    style={{ fontSize: "clamp(1.5rem, 2.4vw, 2.1rem)" }}
                  >
                    {estimate ? (
                      <>
                        {GBP.format(estimate.low)}
                        <span className="px-1.5 font-normal text-enzo-cream/65">–</span>
                        {GBP.format(estimate.high)}
                      </>
                    ) : (
                      "On application"
                    )}
                  </p>
                  <p className="mt-1.5 text-[12px] text-enzo-cream/70">
                    {ROOM_SIZE_LABELS[roomSize].toLowerCase()} room · from {tier.from}
                  </p>
                  <p className="mt-4 max-w-[44ch] text-[14px] leading-[1.6] text-enzo-cream/70">
                    {tier.desc}
                  </p>
                  <ul className="mt-4 flex max-w-[46ch] flex-wrap gap-x-6 gap-y-1.5">
                    {tier.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-center gap-2 text-[12.5px] text-enzo-cream/70"
                      >
                        <span aria-hidden="true" className="h-px w-3 shrink-0 bg-enzo-sand" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <QuoteTriggerButton
                    quoteInfo={{
                      tier: tier.tier,
                      estimateLabel: estimate
                        ? `${GBP.format(estimate.low)} – ${GBP.format(estimate.high)}`
                        : undefined,
                    }}
                    className="pointer-events-auto mt-6 w-fit rounded-full bg-enzo-cream px-7 py-3 text-[13.5px] font-medium text-enzo-forest transition-colors duration-300 hover:bg-enzo-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-2 focus-visible:ring-offset-enzo-dark"
                  >
                    Get this quoted
                  </QuoteTriggerButton>
                </div>
              </article>
            );
          })}
        </div>

        {/* ── Below lg: a plain stack ── */}
        <div className="mt-10 lg:hidden">
          {priced.map(({ tier, estimate }, index) => (
            <div
              key={tier.tier}
              className={cn(
                "border-t border-enzo-cream/12 py-7",
                index === priced.length - 1 && "border-b",
              )}
            >
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-title text-[1.2rem] font-semibold tracking-[-0.03em] text-enzo-cream">
                  {tier.tier}
                </span>
                <span className="text-[13.5px] tabular-nums text-enzo-sand">
                  {estimate
                    ? `${GBP.format(estimate.low)} – ${GBP.format(estimate.high)}`
                    : "On application"}
                </span>
              </div>
              <p className="mt-2 text-[13.5px] leading-[1.6] text-enzo-cream/70">
                {tier.desc}
              </p>
              <QuoteTriggerButton
                quoteInfo={{
                  tier: tier.tier,
                  estimateLabel: estimate
                    ? `${GBP.format(estimate.low)} – ${GBP.format(estimate.high)}`
                    : undefined,
                }}
                className="mt-4 w-full rounded-full border border-enzo-cream/25 py-3 text-[13.5px] text-enzo-cream transition-colors duration-300 hover:border-enzo-sand hover:text-enzo-sand"
              >
                Get this quoted
              </QuoteTriggerButton>
            </div>
          ))}
        </div>

        <p className="mt-8 max-w-[70ch] text-[12px] leading-[1.7] text-enzo-cream/65">
          Ranges scale each specification&rsquo;s starting price by room size. A
          guide for planning, not a quotation.
        </p>
      </div>
    </section>
  );
}
