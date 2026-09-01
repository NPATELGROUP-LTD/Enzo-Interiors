// Picks the A3 model for a service page.
//
// This section replaced the finish/material displays. Four different ways
// of listing the same finish names was four ways of showing a colour chart,
// and a colour chart is not what anyone is trying to picture — the object
// is. So every service page now gets a 3D model of the thing it sells,
// turnable by hand, with one control that does the thing a photograph
// cannot.
//
//   0  ModelKitchenRun   base run, worktop and island — doors open
//   1  ModelWardrobeBay  full-height bay — doors slide apart
//   2  ModelMediaWall    panelled wall — lighting on
//   3  ModelWalkIn       two runs and an island — doors strip away
//
// All four are CSS 3D built on ./Box3D and turned by ./ModelStage, so
// adding a fifth is one file. See ../variant.ts for how the index is
// chosen.
import type { ServiceDetail } from "@/lib/content";
import { variantIndex } from "../variant";
import { ModelKitchenRun } from "./ModelKitchenRun";
import { ModelWardrobeBay } from "./ModelWardrobeBay";
import { ModelMediaWall } from "./ModelMediaWall";
import { ModelWalkIn } from "./ModelWalkIn";

const VARIANTS = [
  ModelKitchenRun,
  ModelWardrobeBay,
  ModelMediaWall,
  ModelWalkIn,
] as const;

export function ServiceModel({
  service,
  position,
  id,
}: {
  service: ServiceDetail;
  position: number;
  id: string;
}) {
  const Model = VARIANTS[variantIndex(position, VARIANTS.length, service.heroVariant)];
  return <Model id={id} />;
}
