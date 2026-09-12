// Picks the A3 model for a service page.
//
// Four services, four units, one viewer. Everything that differs between the
// pages — which unit stands in the room, where the cameras sit, what the one
// control does, and the construction detail beside it — is authored in
// src/data/pages/service-detail.json under `model.variants`, so a fifth
// service is one entry there rather than a fifth component.
//
//   0  kitchen  a run, a tall bank and an island   · doors and drawers open
//   1  bedroom  a run of sliding-front wardrobes   · fronts slide apart
//   2  media    a panelled wall with a recess      · lighting comes on
//   3  walkin   two facing runs and an island      · the fronts come off
//
// The camera figures live with that copy rather than in a table of their own:
// a viewpoint is a label and a note as much as it is four numbers, and
// splitting them would mean editing two files to add one view.
//
// See ./ModelViewer for why these are real three.js now and what that costs,
// and ./scene/units.tsx for the geometry.
import {
  fill,
  type ModelVariantContent,
  type ServiceDetail,
  type ServiceDetailContent,
} from "@/lib/content";
import { variantIndex } from "../variant";
import { ModelViewer } from "./ModelViewer";
import type { UnitKind } from "./scene/ServiceScene";

export function ServiceModel({
  service,
  position,
  id,
  content,
}: {
  service: ServiceDetail;
  position: number;
  id: string;
  content: ServiceDetailContent["model"];
}) {
  const variants: ModelVariantContent[] = content.variants;
  const variant =
    variants[variantIndex(position, variants.length, service.heroVariant)]!;

  return (
    <ModelViewer
      id={id}
      // The one cast here: JSON cannot express the union of unit kinds the
      // scene switches on, and the authored values are written against it.
      kind={variant.kind as UnitKind}
      content={variant}
      common={content}
      fallbackImage={service.image}
      fallbackAlt={fill(content.fallbackAlt, { title: service.title })}
    />
  );
}
