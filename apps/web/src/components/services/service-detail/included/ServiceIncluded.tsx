// Picks the "what's included" layout for a service page.
//
//   0  IncludedLedger    two ruled columns with leader lines (cream)
//   1  IncludedSpine     items alternating around a drawn centre rule (off-white)
//   2  IncludedShelving  asymmetric grid built like a fitted unit (warm grey)
//   3  IncludedRail      items hung from a rail on varied drops (cream)
//
// See ../variant.ts for how the index is chosen and why.
import type { ServiceDetail } from "@/lib/content";
import { variantIndex } from "../variant";
import { IncludedLedger } from "./IncludedLedger";
import { IncludedSpine } from "./IncludedSpine";
import { IncludedShelving } from "./IncludedShelving";
import { IncludedRail } from "./IncludedRail";

const VARIANTS = [
  IncludedLedger,
  IncludedSpine,
  IncludedShelving,
  IncludedRail,
] as const;

export function ServiceIncluded({
  service,
  position,
  id,
}: {
  service: ServiceDetail;
  position: number;
  id: string;
}) {
  if (!service.features.length) return null;

  const Included = VARIANTS[variantIndex(position, VARIANTS.length, service.heroVariant)];
  return <Included service={service} id={id} />;
}
