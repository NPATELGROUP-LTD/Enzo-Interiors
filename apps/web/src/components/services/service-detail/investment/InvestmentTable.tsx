"use client";

// Investment — layout 3 of 4: THE TABLE.
//
// A real comparison table: tiers as columns, what you get as rows, a tick
// where a tier includes something. It is the plainest of the four, and that
// is the point — one page in four should let someone who already knows what
// they want compare specifications directly instead of reading three
// paragraphs of prose.
//
// Rows are the union of every tier's feature list, so the table builds
// itself from whatever the client authored: add a bullet to one tier and a
// new row appears with that tier ticked and the others blank.
//
// Ground: warm grey.
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

export function InvestmentTable({
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
  const [column, setColumn] = useState<number | null>(null);

  // Union of every tier's features, in first-seen order.
  const rows = useMemo(() => {
    const seen: string[] = [];
    pricing.forEach((tier) =>
      tier.features.forEach((feature) => {
        if (!seen.includes(feature)) seen.push(feature);
      }),
    );
    return seen;
  }, [pricing]);

  const estimates = useMemo(
    () =>
      pricing.map((tier) =>
        estimateQuote({
          category,
          tier: tier.tier,
          basePriceLabel: tier.from,
          roomSize,
        }),
      ),
    [pricing, category, roomSize],
  );

  useGSAP(sectionRef, (section, reduced) => {
    const cells = gsap.utils.toArray<HTMLElement>("[data-cell]", section);
    if (!cells.length) return;

    if (reduced) {
      gsap.set(cells, { opacity: 1, y: 0 });
      return;
    }

    gsap.from(cells, {
      opacity: 0,
      y: 12,
      duration: 0.45,
      ease: EASE.enter,
      stagger: { grid: [rows.length + 1, pricing.length], from: "start", each: 0.02 },
      scrollTrigger: { trigger: cells[0], start: REVEAL_START, once: true },
    });
  });

  if (!pricing.length) return null;

  const state = (index: number) =>
    column === null ? "idle" : column === index ? "on" : "off";

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
          label="Investment"
          datum={`${pricing.length} specifications`}
          lines={["Compare the", "specifications."]}
          lede="Pick your room size and every column re-prices instantly. Indicative ranges — the firm figure comes after we have measured."
        />

        <div className="mt-10">
          <RoomSizeControl value={roomSize} onChange={setRoomSize} />
        </div>

        <div className="mt-10 -mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6 md:mx-0 md:px-0">
          <table className="w-full min-w-[42rem] border-collapse text-left">
            <caption className="sr-only">
              What each specification includes, and its estimated range
            </caption>
            <thead>
              <tr>
                <th scope="col" className="w-[16rem] pb-6 pr-6 align-bottom">
                  <span className="font-display block text-[10.5px] font-semibold uppercase tracking-[0.26em] text-enzo-forest-light">
                    Included
                  </span>
                </th>
                {pricing.map((tier, index) => (
                  <th
                    key={tier.tier}
                    scope="col"
                    onPointerEnter={() => setColumn(index)}
                    onPointerLeave={() => setColumn(null)}
                    className={cn(
                      "min-w-[11rem] px-5 pb-6 align-bottom transition-colors duration-300",
                      state(index) === "on" && "bg-background",
                    )}
                  >
                    <span data-cell className="block">
                      <span
                        className={cn(
                          "font-display block text-[10px] font-semibold uppercase tracking-[0.24em] transition-colors duration-300",
                          state(index) === "off"
                            ? "text-enzo-forest-light/50"
                            : "text-enzo-forest-light",
                        )}
                      >
                        {tier.tier}
                      </span>
                      <span
                        className={cn(
                          "mt-2 block font-title text-[1.15rem] font-semibold tabular-nums leading-[1.15] tracking-[-0.03em] transition-colors duration-300",
                          state(index) === "off" ? "text-primary/45" : "text-primary",
                        )}
                      >
                        {estimates[index] ? (
                          <>
                            <RollingFigure value={estimates[index]!.low} />
                            <span className="px-1 font-normal text-foreground/30">–</span>
                            <RollingFigure value={estimates[index]!.high} />
                          </>
                        ) : (
                          "On application"
                        )}
                      </span>
                      <span className="mt-1.5 block text-[11.5px] text-muted-foreground">
                        {ROOM_SIZE_LABELS[roomSize].toLowerCase()} room
                      </span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((feature) => (
                <tr key={feature} className="group/row border-t border-border/60">
                  <th
                    scope="row"
                    className="py-3.5 pr-6 align-top text-[13.5px] font-normal leading-[1.5] text-foreground/85 transition-colors duration-300 group-hover/row:text-primary"
                  >
                    {feature}
                  </th>
                  {pricing.map((tier, index) => {
                    const has = tier.features.includes(feature);
                    return (
                      <td
                        key={`${tier.tier}-${feature}`}
                        onPointerEnter={() => setColumn(index)}
                        onPointerLeave={() => setColumn(null)}
                        className={cn(
                          "px-5 py-3.5 align-top transition-colors duration-300",
                          state(index) === "on" && "bg-background",
                        )}
                      >
                        {/* A short rule for "included", nothing for not —
                            no tick glyph, and never colour alone. */}
                        <span className="sr-only">
                          {has ? "Included" : "Not included"}
                        </span>
                        <span
                          aria-hidden="true"
                          className={cn(
                            "mt-2 block h-px transition-all duration-300",
                            has
                              ? state(index) === "off"
                                ? "w-7 bg-primary/40"
                                : "w-7 bg-primary"
                              : "w-2 bg-border",
                          )}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}

              <tr className="border-t border-border/60">
                <td />
                {pricing.map((tier, index) => (
                  <td key={tier.tier} className="px-5 pt-6 align-top">
                    <QuoteTriggerButton
                      quoteInfo={{
                        tier: tier.tier,
                        estimateLabel: estimates[index]
                          ? `${GBP.format(estimates[index]!.low)} – ${GBP.format(estimates[index]!.high)}`
                          : undefined,
                      }}
                      className="w-full rounded-full bg-primary py-3 text-[13.5px] font-medium text-primary-foreground transition-colors duration-300 hover:bg-enzo-forest-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      Get quoted
                    </QuoteTriggerButton>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mt-6 max-w-[70ch] text-[12px] leading-[1.7] text-muted-foreground">
          Ranges scale the specification&rsquo;s starting price by room size. A
          guide for planning, not a quotation.
        </p>
      </div>
    </section>
  );
}
