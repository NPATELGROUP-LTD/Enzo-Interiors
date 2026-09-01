"use client";

// /services/[category] §A5 — the investment sheets.
//
// Keeps the behaviour the app-flow doc specifies (pick a room size, get a
// real-time range under 200ms, carry that selection into the quote form)
// and rebuilds the surface around it. Three changes matter:
//
//  1. The room-size control is a segmented switch with a pill that actually
//     travels between options — measured from the DOM, so it stays correct
//     at any label length or language.
//  2. The price is the headline, and it *rolls* between values when the
//     room size changes. A number that silently swaps looks like a render
//     bug; a number that counts tells you your input did something.
//  3. Tiers are laid out as quotation sheets that fan slightly on arrival
//     and straighten as they settle, so a row of three price boxes reads as
//     paperwork from a workshop rather than a SaaS pricing table.
//
// Tier count is whatever the client authored: the recommended sheet is the
// middle one by position, and the grid reflows rather than assuming three.
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Check } from "lucide-react";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { useGSAP } from "@/hooks/useGSAP";
import { EASE, REVEAL_START } from "@/lib/motion";
import {
  estimateQuote,
  ROOM_SIZE_LABELS,
  ROOM_SIZES,
  type RoomSize,
} from "@/lib/quote-estimate";
import { cn } from "@/lib/utils";
import type { PricingTier } from "@/lib/content";
import { QuoteTriggerButton } from "../shared/QuoteRequestModal";

const GBP = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

/**
 * A currency figure that counts to its new value instead of swapping.
 * Writes textContent from a GSAP tween rather than re-rendering per frame,
 * so a change costs one tween and no React work.
 */
function RollingFigure({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      shown.current = value;
      node.textContent = GBP.format(value);
      return;
    }

    const proxy = { value: shown.current };
    const tween = gsap.to(proxy, {
      value,
      duration: 0.55,
      ease: "power2.out",
      onUpdate: () => {
        node.textContent = GBP.format(Math.round(proxy.value));
      },
      onComplete: () => {
        shown.current = value;
      },
    });

    return () => {
      tween.kill();
      shown.current = proxy.value;
    };
  }, [value]);

  // Server-rendered with the initial figure, so there is a real price in the
  // HTML before any JS runs.
  return <span ref={ref}>{GBP.format(value)}</span>;
}

interface DetailInvestmentProps {
  category: string;
  pricing: PricingTier[];
  id: string;
}

export function DetailInvestment({ category, pricing, id }: DetailInvestmentProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [roomSize, setRoomSize] = useState<RoomSize>("medium");

  // Middle sheet by position — a rule rather than a hardcoded index, so it
  // still points at something sensible with two tiers or five.
  const recommended = Math.floor((pricing.length - 1) / 2);

  useGSAP(
    sectionRef,
    (section, reduced) => {
      const sheets = gsap.utils.toArray<HTMLElement>("[data-sheet]", section);
      const control = section.querySelector<HTMLElement>("[data-size-control]");

      if (sheets.length) {
        if (reduced) {
          gsap.set(sheets, { opacity: 1, y: 0, rotate: 0 });
        } else {
          gsap.from(sheets, {
            opacity: 0,
            y: 44,
            // Alternating tilt, straightened on arrival: sheets dropped on
            // a desk, not cards sliding into a grid.
            rotate: (index: number) => (index % 2 === 0 ? -2.2 : 2.4),
            duration: 0.95,
            ease: EASE.editorial,
            stagger: 0.09,
            scrollTrigger: { trigger: sheets[0], start: REVEAL_START, once: true },
          });
        }
      }

      if (!control) return;

      // The travelling pill is positioned from the real button boxes, so it
      // stays aligned whatever the labels say or how they wrap.
      const pill = control.querySelector<HTMLElement>("[data-size-pill]");
      const buttons = gsap.utils.toArray<HTMLElement>("button", control);
      if (!pill || !buttons.length) return;

      const place = (immediate: boolean) => {
        const index = ROOM_SIZES.indexOf(roomSize);
        const button = buttons[index];
        if (!button) return;
        gsap.to(pill, {
          x: button.offsetLeft,
          width: button.offsetWidth,
          duration: immediate || reduced ? 0 : 0.45,
          ease: "power3.out",
        });
      };

      place(true);
      const onResize = () => place(true);
      window.addEventListener("resize", onResize);

      return () => {
        window.removeEventListener("resize", onResize);
      };
    },
    { deps: [pricing, roomSize] },
  );

  if (!pricing.length) return null;

  return (
    <section
      ref={sectionRef}
      id={id}
      aria-labelledby="service-investment-heading"
      className="relative bg-card scroll-mt-24"
    >
      <div className="mx-auto max-w-[1500px] px-5 py-20 sm:px-6 md:px-12 md:py-28">
        <h2 id="service-investment-heading" className="sr-only">
          Investment
        </h2>

        <SectionIntro
          layout="split"
          index="A5"
          label="Investment"
          datum={`${pricing.length} specifications`}
          lines={["An honest range,", "before the survey."]}
          lede="Pick the size of your room and every specification re-prices instantly. These are indicative ranges — the firm figure comes after we have measured."
        />

        {/* ── Room size ── */}
        <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-6">
          <span
            id="room-size-label"
            className="font-display text-[10.5px] font-semibold uppercase tracking-[0.26em] text-enzo-forest-light"
          >
            Room size
          </span>
          <div
            data-size-control
            role="group"
            aria-labelledby="room-size-label"
            className="relative inline-flex rounded-full border border-border/70 bg-background p-1"
          >
            <span
              aria-hidden="true"
              data-size-pill
              className="absolute inset-y-1 left-0 rounded-full bg-primary"
            />
            {ROOM_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setRoomSize(size)}
                aria-pressed={roomSize === size}
                className={cn(
                  "relative z-10 rounded-full px-6 py-2 text-[13px] transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  roomSize === size
                    ? "text-primary-foreground"
                    : "text-muted-foreground hover:text-primary",
                )}
              >
                {ROOM_SIZE_LABELS[size]}
              </button>
            ))}
          </div>
        </div>

        {/* ── Sheets ── */}
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

                {/* The estimate is the headline — it is the thing that
                    responds to the control above it. */}
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

                <ul className="mt-6 flex-1 space-y-0">
                  {tier.features.map((feature) => (
                    <li
                      key={feature}
                      className={cn(
                        "flex items-center gap-3 border-t py-2.5 text-[13.5px]",
                        isRecommended
                          ? "border-enzo-cream/12 text-enzo-cream/85"
                          : "border-border/60 text-foreground/85",
                      )}
                    >
                      <Check
                        size={14}
                        className={cn(
                          "shrink-0",
                          isRecommended ? "text-enzo-sand" : "text-primary",
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
