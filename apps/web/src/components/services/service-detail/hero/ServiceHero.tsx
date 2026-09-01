// Picks which of the four hero designs a service page uses.
//
// ── Why four ──
// Every service page having the same hero made the four pages read as one
// template with the nouns swapped, and it made each of them read as the
// /services fold again. Four genuinely different arrangements fix both:
//
//   1  HeroSplitPlate    hard 50/50 split, type left, photo right
//   2  HeroPhotoOverlay  full-bleed photograph, type over its bottom edge
//   3  HeroDrawingLed    no photograph — the plan drawing leads
//   4  HeroCentredStack  centred type over a 21:9 letterbox band
//
// ── Why it is still safe for a client-authored CMS ──
// Assignment is by published position, so the set stays evenly distributed
// however many services exist: a fifth service takes variant 1 again, a
// sixth variant 2, and so on. Nobody has to choose, and nothing breaks.
// `heroVariant` on the record overrides that when someone does want to
// choose — set it in the Admin Content Manager and this respects it.
//
// Adding a fifth design later means adding one file and one entry to
// VARIANTS; nothing else changes.
import type { ReactNode } from "react";
import type { ServiceDetail } from "@/lib/content";
import { HeroSplitPlate } from "./HeroSplitPlate";
import { HeroPhotoOverlay } from "./HeroPhotoOverlay";
import { HeroDrawingLed } from "./HeroDrawingLed";
import { HeroCentredStack } from "./HeroCentredStack";

const VARIANTS = [
  HeroSplitPlate,
  HeroPhotoOverlay,
  HeroDrawingLed,
  HeroCentredStack,
] as const;

export const HERO_VARIANT_COUNT = VARIANTS.length;

interface ServiceHeroProps {
  service: ServiceDetail;
  /** Zero-based position in the published set — the default variant key. */
  position: number;
  quoteCta: ReactNode;
  id: string;
}

export function ServiceHero({ service, position, quoteCta, id }: ServiceHeroProps) {
  // A negative position (slug not found in the published list) would make
  // the modulo negative and index off the end, so it is floored first.
  const requested = service.heroVariant ?? Math.max(0, position);
  const Hero = VARIANTS[requested % VARIANTS.length] ?? HeroSplitPlate;

  return <Hero service={service} quoteCta={quoteCta} id={id} />;
}
