// Picks the investment layout for a service page.
//
//   0  InvestmentSheets  fanned tier cards (off-white)
//   1  InvestmentLadder  full-width rows with comparison bars (off-white)
//   2  InvestmentTable   tiers as columns, features as rows (warm grey)
//   3  InvestmentFocus   one specification at a time (near-black)
//
// All four share the room-size control, the `estimateQuote` helper and the
// rolling figure, so the pricing behaviour is identical across the site and
// only the presentation differs. See ../variant.ts for how the index is
// chosen.
import type { PricingTier, ServiceDetail } from "@/lib/content";
import { variantIndex } from "../variant";
import { InvestmentSheets } from "./InvestmentSheets";
import { InvestmentLadder } from "./InvestmentLadder";
import { InvestmentTable } from "./InvestmentTable";
import { InvestmentFocus } from "./InvestmentFocus";

const VARIANTS = [
  InvestmentSheets,
  InvestmentLadder,
  InvestmentTable,
  InvestmentFocus,
] as const;

export function ServiceInvestment({
  service,
  category,
  pricing,
  position,
  id,
}: {
  service: ServiceDetail;
  category: string;
  pricing: PricingTier[];
  position: number;
  id: string;
}) {
  if (!pricing.length) return null;

  const Investment =
    VARIANTS[variantIndex(position, VARIANTS.length, service.heroVariant)];
  return <Investment category={category} pricing={pricing} id={id} />;
}
