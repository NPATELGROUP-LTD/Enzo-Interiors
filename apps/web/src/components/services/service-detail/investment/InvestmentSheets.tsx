"use client";

// Investment — layout 1 of 4: THE SHEETS.
//
// Tiers as quotation sheets that fan slightly on arrival and straighten as
// they settle, so a row of price boxes reads as paperwork off a workshop
// desk rather than a SaaS pricing table.
//
// The room-size control, the estimate helper and the rolling figure are
// shared with the other three investment layouts (see ./RoomSizeControl and
// ./RollingFigure) — the pricing behaviour is identical everywhere on the
// site and only the presentation differs.
//
// Tier count is whatever the client authored: the recommended sheet is the
// middle one by position, and the grid reflows rather than assuming three.
//
// Ground: off-white.
import { useRef, useState } from "react";
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

export function InvestmentSheets({
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

  // Middle sheet by position — a rule rather than a hardcoded index, so it
  // still points at something sensible with two tiers or five.
  const recommended = Math.floor((pricing.length - 1) / 2);

  useGSAP(sectionRef, (section, reduced) => {
    const sheets = gsap.utils.toArray<HTMLElement>("[data-sheet]", section);
    if (!sheets.length) return;

    if (reduced) {
      gsap.set(sheets, { opacity: 1, y: 0, rotate: 0 });
      return;
    }

    gsap.from(sheets, {
      opacity: 0,
      y: 44,
      rotate: (index: number) => (index % 2 === 0 ? -2.2 : 2.4),
      duration: 0.95,
      ease: EASE.editorial,
      stagger: 0.09,
      scrollTrigger: { trigger: sheets[0], start: REVEAL_START, once: true },
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
          lines={["An honest range,", "before the survey."]}
          lede="Pick the size of your room and every specification re-prices instantly. Indicative ranges — the firm figure comes after we have measured."
        />

        <div className="mt-10">
          <RoomSizeControl value={roomSize} onChange={setRoomSize} />
        </div>

        <div
          className={cn(
            "mt-10 grid gap-5",
            pricing.length === 1 && "max-w-xl",
            pricing.length === 2 && "md:grid-cols-2",
            pricing.length >= 3 && "md:grid-cols-2 xl:grid-cols-3",
          )}
        >
          {pricing.map((tier, index) => {
            const estimate = estimateQuote({
              category,
              tier: tier.tier,
              basePriceLabel: tier.from,
              roomSize,
            });
            const isRecommended = index === recommended;
            const estimateLabel = estimate
              ? `${GBP.format(estimate.low)} – ${GBP.format(estimate.high)}`
              : undefined;

            return (
              <article
                key={tier.tier}
                data-sheet
                className={cn(
                  "group relative flex flex-col rounded-[20px] p-8 transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1.5",
                  isRecommended
                    ? "bg-enzo-forest text-enzo-cream shadow-[0_18px_50px_-24px_rgba(28,74,58,0.75)] hover:shadow-[0_28px_60px_-24px_rgba(28,74,58,0.85)]"
                    : "border border-border/70 bg-background hover:shadow-[0_18px_44px_-28px_rgba(44,44,44,0.5)]",
                )}
              >
                {isRecommended && (
                  <span className="absolute right-7 top-7 rounded-full bg-enzo-sand px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-enzo-forest">
                    Most chosen
                  </span>
                )}

                <span
                  className={cn(
                    "font-display text-[10.5px] font-semibold uppercase tracking-[0.26em]",
                    isRecommended ? "text-enzo-sand" : "text-enzo-forest-light",
                  )}
                >
                  {String(index + 1).padStart(2, "0")} / {tier.tier}
                </span>

                <p
                  className={cn(
                    "mt-5 font-title font-semibold leading-[1.05] tabular-nums tracking-[-0.04em]",
                    isRecommended ? "text-enzo-cream" : "text-primary",
                  )}
                  style={{ fontSize: "clamp(1.6rem, 2.5vw, 2.1rem)" }}
                >
                  {estimate ? (
                    <>
                      <RollingFigure value={estimate.low} />
                      <span
                        className={cn(
                          "px-1.5 font-normal",
                          isRecommended ? "text-enzo-cream/45" : "text-foreground/35",
                        )}
                      >
                        –
                      </span>
                      <RollingFigure value={estimate.high} />
                    </>
                  ) : (
                    "On application"
                  )}
                </p>
                <p
                  className={cn(
                    "mt-2 text-[12.5px]",
                    isRecommended ? "text-enzo-cream/55" : "text-muted-foreground",
                  )}
                >
                  {ROOM_SIZE_LABELS[roomSize].toLowerCase()} room · from {tier.from}
                </p>

                <p
                  className={cn(
                    "mt-5 text-[14px] leading-[1.65]",
                    isRecommended ? "text-enzo-cream/70" : "text-muted-foreground",
                  )}
                >
                  {tier.desc}
                </p>

                <ul className="mt-6 flex-1">
                  {tier.features.map((feature) => (
                    <li
                      key={feature}
                      className={cn(
                        "flex items-baseline gap-3 border-t py-2.5 text-[13.5px]",
                        isRecommended
                          ? "border-enzo-cream/12 text-enzo-cream/85"
                          : "border-border/60 text-foreground/85",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "h-px w-3 shrink-0",
                          isRecommended ? "bg-enzo-sand" : "bg-primary",
                        )}
                      />
                      {feature}
                    </li>
                  ))}
                </ul>

                <QuoteTriggerButton
                  quoteInfo={{ tier: tier.tier, estimateLabel }}
                  className={cn(
                    "mt-8 w-full rounded-full py-3.5 text-[14px] font-medium transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                    isRecommended
                      ? "bg-enzo-cream text-primary hover:bg-enzo-sand focus-visible:ring-enzo-sand focus-visible:ring-offset-enzo-forest"
                      : "bg-primary text-primary-foreground hover:bg-enzo-forest-light focus-visible:ring-ring focus-visible:ring-offset-background",
                  )}
                >
                  Get this quoted
                </QuoteTriggerButton>
              </article>
            );
          })}
        </div>

        <p className="mt-6 max-w-[70ch] text-[12px] leading-[1.7] text-muted-foreground">
          Ranges scale the specification&rsquo;s starting price by room size.
          They are a guide for planning, not a quotation — we do not price a
          room we have not measured.
        </p>
      </div>
    </section>
  );
}
