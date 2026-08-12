"use client";

// Client leaf for the Service Detail page's Pricing section (see
// ./page.tsx, "/* Pricing */"). Adds the room-size selector +
// instant-estimate range described in docs/Enzo_Interiors_App_Flow_v4.md:
// "selecting a room size/tier triggers a real-time (<200ms) price range"
// that then feeds the "Get a Free Quote" modal (./QuoteModal.tsx).
//
// This owns the selected-room-size state and re-derives each tier's
// estimate via the pure `estimateQuote` helper (src/lib/quote-estimate.ts)
// on every change — purely client-side arithmetic, so it's instant (no
// network round-trip, unlike the eventual `POST /quotes/estimate` this is
// standing in for). The surrounding page (hero, description, process,
// FAQs, CTA) stays a Server Component; only this grid — which needs to
// react to shared selector state across all three tier cards — needs to be
// a Client Component.
import { useState } from "react";
import { Check } from "lucide-react";
import { ScrollReveal } from "@/components/shared/ScrollReveal";
import {
  estimateQuote,
  formatPriceRange,
  ROOM_SIZE_LABELS,
  ROOM_SIZES,
  type RoomSize,
} from "@/lib/quote-estimate";
import { QuoteTriggerButton } from "./QuoteModal";
import type { ServiceDetail } from "./data";

export function QuoteEstimator({
  category,
  pricing,
}: {
  category: string;
  pricing: ServiceDetail["pricing"];
}) {
  // Defaults to "medium" so a live estimate is visible immediately, not
  // only after the visitor makes a selection.
  const [roomSize, setRoomSize] = useState<RoomSize>("medium");

  return (
    <div>
      {/* Room-size selector — drives the live estimate for all 3 tier cards below. */}
      <div className="flex flex-col items-center gap-3 mb-10">
        <span className="text-[11px] uppercase tracking-[0.2em] text-enzo-sage">
          Room Size
        </span>
        <div className="inline-flex rounded-full border border-border/40 p-1 gap-1">
          {ROOM_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => setRoomSize(size)}
              aria-pressed={roomSize === size}
              className={`px-6 py-2 rounded-full text-[13px] transition-all duration-200 ${
                roomSize === size
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-primary"
              }`}
            >
              {ROOM_SIZE_LABELS[size]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {pricing.map((p, i) => {
          const estimate = estimateQuote({
            category,
            tier: p.tier,
            basePriceLabel: p.from,
            roomSize,
          });
          const estimateLabel = estimate
            ? formatPriceRange(estimate.low, estimate.high)
            : null;

          return (
            <ScrollReveal key={p.tier} delay={i * 0.1}>
              <div
                className={`rounded-2xl p-8 h-full flex flex-col ${
                  i === 1
                    ? "bg-primary text-primary-foreground ring-2 ring-primary scale-[1.02]"
                    : "bg-background border border-border/30"
                }`}
              >
                <span className="text-[11px] uppercase tracking-[0.2em] text-enzo-sage">
                  {p.tier}
                </span>
                <h3
                  className={`mt-2 ${i === 1 ? "text-primary-foreground" : "text-primary"}`}
                  style={{ fontSize: "1.3rem" }}
                >
                  From {p.from}
                </h3>
                <div
                  className={`mt-3 rounded-xl px-4 py-3 ${
                    i === 1 ? "bg-primary-foreground/10" : "bg-card"
                  }`}
                >
                  <span
                    className={`text-[11px] uppercase tracking-[0.15em] ${
                      i === 1 ? "text-primary-foreground/60" : "text-muted-foreground"
                    }`}
                  >
                    Your {ROOM_SIZE_LABELS[roomSize].toLowerCase()} room estimate
                  </span>
                  <p
                    className={`mt-1 text-[16px] ${i === 1 ? "text-primary-foreground" : "text-primary"}`}
                    style={{ fontWeight: 600 }}
                  >
                    {estimateLabel ?? `From ${p.from}`}
                  </p>
                </div>
                <p
                  className={`mt-4 text-[14px] ${i === 1 ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                >
                  {p.desc}
                </p>
                <ul className="mt-6 space-y-2.5 flex-1">
                  {p.features.map((f) => (
                    <li
                      key={f}
                      className={`flex items-center gap-2 text-[13px] ${i === 1 ? "text-primary-foreground/80" : "text-foreground"}`}
                    >
                      <Check
                        size={14}
                        className={i === 1 ? "text-enzo-sage" : "text-primary"}
                      />
                      {f}
                    </li>
                  ))}
                </ul>
                <QuoteTriggerButton
                  quoteInfo={{
                    tier: p.tier,
                    estimateLabel: estimateLabel ?? undefined,
                  }}
                  className={`mt-8 w-full py-3 rounded-full text-[14px] transition-all duration-300 ${
                    i === 1
                      ? "bg-enzo-cream text-primary hover:bg-white"
                      : "bg-primary text-primary-foreground hover:bg-enzo-forest-light"
                  }`}
                >
                  Get Quote
                </QuoteTriggerButton>
              </div>
            </ScrollReveal>
          );
        })}
      </div>
    </div>
  );
}
