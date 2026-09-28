"use client";

// The price, set on forest like the recommended quotation sheet on the
// service pages. The range always has a caveat directly beneath it — never
// the figure on its own.
import { Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { plural, pounds } from "@/lib/format";
import type { Estimate } from "@/lib/pricing";
import type { PricingSettings } from "@/lib/types";
import { Swatch } from "./ui";

export const DISCLAIMER =
  "This is an estimate, not a quote. It is worked out from rough measurements and our standard unit sizes, with every board priced as a whole sheet. Your design is drawn up properly after a free survey, and the final price is confirmed then.";

export function Disclaimer({ tone = "light", className }: { tone?: "light" | "dark"; className?: string }) {
  return (
    <p
      className={cn(
        "flex gap-2.5 text-[12.5px] leading-[1.6]",
        tone === "dark" ? "text-enzo-cream/75" : "text-muted-foreground",
        className,
      )}
    >
      <Info size={15} aria-hidden="true" className={cn("mt-0.5 shrink-0", tone === "dark" ? "text-enzo-sand" : "text-primary")} />
      <span>{DISCLAIMER}</span>
    </p>
  );
}

export function PriceRange({ estimate, className }: { estimate: Estimate; className?: string }) {
  return (
    <p className={cn("font-title font-semibold leading-[1.02] tracking-[-0.04em] tabular-nums", className)}>
      {pounds(estimate.lowPence)}
      <span className="px-2 font-normal opacity-60">–</span>
      {pounds(estimate.highPence)}
    </p>
  );
}

/**
 * The slip pinned under the planner's side panel: the range, the counts and
 * a one-line caveat, so the price is never scrolled out of view while the
 * customer works. The full caveat sits in the panel above and on the
 * estimate page.
 */
export function CompactSlip({
  estimate,
  settings,
  studio = false,
  unitCount,
  children,
}: {
  estimate: Estimate;
  settings: PricingSettings;
  studio?: boolean;
  unitCount: number;
  children?: ReactNode;
}) {
  const empty = unitCount === 0;
  return (
    <section aria-labelledby="estimate-heading" aria-live="polite" className="flex flex-col gap-3 rounded-[18px] bg-enzo-forest p-5 text-enzo-cream">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="estimate-heading" className="font-sans text-[13px] font-medium tracking-normal text-enzo-sand">
          Estimated price
        </h2>
        {!empty && (
          <span className="font-display text-[12px] tabular-nums text-enzo-cream/70">
            {plural(unitCount, "unit")}, {plural(estimate.sheetCount, "sheet")}
          </span>
        )}
      </div>
      {empty ? (
        <p className="text-[14px] leading-relaxed text-enzo-cream/80">Add a unit to your plan to see a price.</p>
      ) : (
        <PriceRange estimate={estimate} className="text-[clamp(1.6rem,2.2vw,2.1rem)] text-enzo-cream" />
      )}
      {studio && !empty && (
        <p className="font-display text-[12px] tabular-nums text-enzo-sand">
          Cost {pounds(estimate.costPence)}, margin {pounds(estimate.marginPence)} at {settings.marginPct}%
        </p>
      )}
      <p className="flex gap-2 text-[12px] leading-snug text-enzo-cream/70">
        <Info size={13} aria-hidden="true" className="mt-0.5 shrink-0 text-enzo-sand" />
        Estimate only, from rough sizes. Confirmed after a free survey.
      </p>
      {children}
    </section>
  );
}

/** Phones: the planner stacks vertically, so the price rides along at the bottom of the screen. */
export function MobilePriceBar({
  estimate,
  unitCount,
  onOpen,
}: {
  estimate: Estimate;
  unitCount: number;
  onOpen: () => void;
}) {
  if (unitCount === 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 bg-enzo-forest px-5 py-3 text-enzo-cream shadow-[0_-8px_24px_-12px_rgba(16,46,45,0.6)] lg:hidden">
      <div className="min-w-0">
        <PriceRange estimate={estimate} className="text-[1.3rem]" />
        <p className="text-[11.5px] text-enzo-cream/70">Estimate only, confirmed after a survey</p>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="h-10 shrink-0 rounded-full bg-enzo-cream px-4 text-[13px] font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand"
      >
        See estimate
      </button>
    </div>
  );
}

/** Sheets per board, the warnings and the full caveat — the detail behind the slip. */
export function EstimateDetail({ estimate }: { estimate: Estimate }) {
  return (
    <div className="flex flex-col gap-4">
      {estimate.boards.length > 0 && (
        <div>
          <h3 className="font-sans text-[13px] font-medium tracking-normal">Boards this plan uses</h3>
          <ul className="mt-2 flex flex-col">
            {estimate.boards.map((usage) => (
              <li key={usage.board.id} className="flex items-center gap-3 border-t border-border/70 py-2 text-[13px]">
                <Swatch board={usage.board} className="h-5 w-5 rounded" />
                <span className="min-w-0 flex-1 truncate">{usage.board.name}</span>
                <span className="font-display tabular-nums text-muted-foreground">{plural(usage.sheetCount, "sheet")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {estimate.warnings.length > 0 && (
        <ul className="flex flex-col gap-2">
          {estimate.warnings.map((warning) => (
            <li key={warning} className="flex gap-2 text-[12.5px] leading-snug text-destructive">
              <TriangleAlert size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
              {warning}
            </li>
          ))}
        </ul>
      )}
      <Disclaimer />
    </div>
  );
}
