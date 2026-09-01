// Picks which of the four hero designs a service page uses.
//
// ── Why four, and why they finally look different ──
// The first attempt gave the four pages four different *geometries* on the
// same near-black ground, running the same sequence (eyebrow, title, lede,
// two buttons, facts), and three of the four were type-left /
// picture-right. Rearranging identical ingredients on identical paper does
// not produce four designs — it produces one design with the parts moved,
// which is exactly how it read.
//
// So each hero now differs on three axes at once:
//
//   file            ground       axis                image
//   HeroMasthead    cream        top-to-bottom       one wide 21:8 band
//   HeroOverlap     near-black   layered, off-centre tall plate, type across it
//   HeroPlanCentre  forest       symmetrical         none — the plan drawing
//   HeroSpecCard    warm grey    card + side strip   narrow full-height strip
//
// They also differ in where the facts live (footer column / inline rule /
// centred rule / ruled table rows) and in how they arrive (band unrolls /
// plate lands then type is laid over / rises, no direction / card fades and
// rows rule in).
//
// ── Why it is still safe for a client-authored CMS ──
// Assignment is by published position, so the set stays evenly distributed
// however many services exist: a fifth service takes the masthead again, a
// sixth the overlap, and so on. Nobody has to choose. `heroVariant` on the
// record overrides that when someone does want to.
//
// Each hero renders its own quote button, because the button has to be
// styled for its own ground — a cream pill is invisible on the cream
// masthead. That is also why there is no `quoteCta` prop any more.
import type { ServiceDetail } from "@/lib/content";
import { variantIndex } from "../variant";
import { HeroMasthead } from "./HeroMasthead";
import { HeroOverlap } from "./HeroOverlap";
import { HeroPlanCentre } from "./HeroPlanCentre";
import { HeroSpecCard } from "./HeroSpecCard";

const VARIANTS = [
  HeroMasthead,
  HeroOverlap,
  HeroPlanCentre,
  HeroSpecCard,
] as const;

export const HERO_VARIANT_COUNT = VARIANTS.length;

export function ServiceHero({
  service,
  position,
  id,
}: {
  service: ServiceDetail;
  /** Zero-based position in the published set — the default variant key. */
  position: number;
  id: string;
}) {
  const Hero = VARIANTS[variantIndex(position, VARIANTS.length, service.heroVariant)];
  return <Hero service={service} id={id} />;
}
