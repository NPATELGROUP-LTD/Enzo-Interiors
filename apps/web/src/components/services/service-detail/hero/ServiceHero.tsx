// Picks which of the four hero designs a service page uses.
//
// ── One family, four mechanisms ──
// These four are built around one shared grammar — an
// oversized masked masthead, a sheet rule, the same four facts, the same two
// actions (all of it in heroParts.tsx) — and then one *mechanism* per page,
// chosen for what that service actually is:
//
//   file           service    ground      composition          how it arrives
//   HeroMasthead   Kitchens   cream       straight down        curtain: mask down, picture up
//   HeroColumns    Bedrooms   near-black  title right, bays    three side wipes in sequence
//   HeroAperture   Media Walls forest     centred, symmetric   strike of light → slit → frame
//   HeroDoors      Wardrobes  warm grey   picture first        two doors slide apart
//
// So the pages feel like siblings and still cannot be mistaken for each
// other — and the mechanism is never decoration: a media wall switches on
// like a screen, a wardrobe opens like a wardrobe.
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
import { HeroColumns } from "./HeroColumns";
import { HeroAperture } from "./HeroAperture";
import { HeroDoors } from "./HeroDoors";

const VARIANTS = [
  HeroMasthead,
  HeroColumns,
  HeroAperture,
  HeroDoors,
] as const;


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
