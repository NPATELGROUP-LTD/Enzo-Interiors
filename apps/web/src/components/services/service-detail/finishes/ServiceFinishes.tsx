// Picks the finishes layout for a service page.
//
//   0  FinishBlock3D     draggable CSS-3D sample block (forest)
//   1  FinishSwatchWall   every finish at once, showroom board (near-black)
//   2  FinishColumns      full-height bands that open in place (forest)
//   3  FinishPairing      front against surface, side by side (near-black)
//
// See ../variant.ts for how the index is chosen and why.
import type { ServiceDetail } from "@/lib/content";
import { variantIndex } from "../variant";
import { FinishBlock3D } from "./FinishBlock3D";
import { FinishSwatchWall } from "./FinishSwatchWall";
import { FinishColumns } from "./FinishColumns";
import { FinishPairing } from "./FinishPairing";

const VARIANTS = [
  FinishBlock3D,
  FinishSwatchWall,
  FinishColumns,
  FinishPairing,
] as const;

export function ServiceFinishes({
  service,
  position,
  id,
}: {
  service: ServiceDetail;
  position: number;
  id: string;
}) {
  if (!service.materials.length) return null;

  const Finishes = VARIANTS[variantIndex(position, VARIANTS.length, service.heroVariant)];
  return <Finishes service={service} id={id} />;
}
