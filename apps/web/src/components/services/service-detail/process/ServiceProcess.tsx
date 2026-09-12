// Picks the process layout for a service page.
//
//   0  ProcessRail      scroll-driven horizontal travel (warm grey)
//   1  ProcessTimeline  vertical, sticky stage counter (cream)
//   2  ProcessStair     each stage indented one step further (warm grey)
//   3  ProcessAssembly  the unit drawing itself down the page (warm grey)
//
// See ../variant.ts for how the index is chosen and why.
import type {
  ProcessStep,
  ProcessVariantContent,
  ServiceDetail,
  ServiceDetailContent,
} from "@/lib/content";
import { variantIndex } from "../variant";
import { ProcessRail } from "./ProcessRail";
import { ProcessTimeline } from "./ProcessTimeline";
import { ProcessStair } from "./ProcessStair";
import { ProcessAssembly } from "./ProcessAssembly";

const VARIANTS = [
  ProcessRail,
  ProcessTimeline,
  ProcessStair,
  ProcessAssembly,
] as const;

export function ServiceProcess({
  service,
  steps,
  position,
  id,
  content,
}: {
  service: ServiceDetail;
  steps: ProcessStep[];
  position: number;
  id: string;
  content: ServiceDetailContent["process"];
}) {
  if (!steps.length) return null;

  // One index picks both the layout and the copy written for it.
  const index = variantIndex(position, VARIANTS.length, service.heroVariant);
  const Process = VARIANTS[index];
  const variants: ProcessVariantContent[] = content.variants;

  return (
    <Process steps={steps} id={id} content={variants[index]!} common={content} />
  );
}
