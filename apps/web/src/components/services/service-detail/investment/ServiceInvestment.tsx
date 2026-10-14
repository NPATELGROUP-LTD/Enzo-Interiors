// Picks the investment layout for a service page.
//
//   0  InvestmentSheets   fanned tier cards (off-white)
//   1  InvestmentSlider   set a budget, see what it buys (off-white)
//   2  InvestmentDisplay  specifications as inputs, priced in a frame (warm grey)
//   3  InvestmentDoors    tiers as door fronts that open (near-black)
//
// All four share the room-size control and the `estimateQuote` helper, so
// the pricing behaviour is identical across the site and only the
// presentation differs. See ../variant.ts for how the index is chosen.
import type {
  InvestmentVariantContent,
  PricingTier,
  ServiceDetail,
  ServiceDetailContent,
  SharedContent,
} from "@/lib/content";
import { variantIndex } from "../variant";
import { InvestmentSheets } from "./InvestmentSheets";
import { InvestmentSlider } from "./InvestmentSlider";
import { InvestmentDisplay } from "./InvestmentDisplay";
import { InvestmentDoors } from "./InvestmentDoors";

const VARIANTS = [
  InvestmentSheets,
  InvestmentSlider,
  InvestmentDisplay,
  InvestmentDoors,
] as const;

export function ServiceInvestment({
  service,
  category,
  pricing,
  position,
  id,
  content,
  roomSizeContent,
}: {
  service: ServiceDetail;
  category: string;
  pricing: PricingTier[];
  position: number;
  id: string;
  content: ServiceDetailContent["investment"];
  roomSizeContent: SharedContent["roomSize"];
}) {
  if (!pricing.length) return null;

  // One index picks both the layout and the copy written for it, so a page
  // can never render the doors with the slider's words.
  const index = variantIndex(position, VARIANTS.length, service.heroVariant);
  const Investment = VARIANTS[index];
  const variants: InvestmentVariantContent[] = content.variants;

  return (
    <Investment
      category={category}
      pricing={pricing}
      id={id}
      content={variants[index]!}
      common={content}
      roomSizeContent={roomSizeContent}
    />
  );
}
