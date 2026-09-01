// Picks the investment layout for a service page.
//
//   0  InvestmentSheets   fanned tier cards (off-white)
//   1  InvestmentSlider   set a budget, see what it buys (off-white)
//   2  InvestmentBuildUp  one wall, stacked in priced steps (warm grey)
//   3  InvestmentDoors    tiers as door fronts that open (near-black)
//
// All four share the room-size control and the `estimateQuote` helper, so
// the pricing behaviour is identical across the site and only the
// presentation differs. See ../variant.ts for how the index is chosen.
import type { PricingTier, ServiceDetail } from "@/lib/content";
import { variantIndex } from "../variant";
import { InvestmentSheets } from "./InvestmentSheets";
import { InvestmentSlider } from "./InvestmentSlider";
import { InvestmentBuildUp } from "./InvestmentBuildUp";
import { InvestmentDoors } from "./InvestmentDoors";

const VARIANTS = [
  InvestmentSheets,
  InvestmentSlider,
  InvestmentBuildUp,
  InvestmentDoors,
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
