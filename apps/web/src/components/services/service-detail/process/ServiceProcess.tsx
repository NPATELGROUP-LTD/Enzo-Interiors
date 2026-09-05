// Picks the process layout for a service page.
//
//   0  ProcessRail      scroll-driven horizontal travel (warm grey)
//   1  ProcessTimeline  vertical, sticky stage counter (cream)
//   2  ProcessStair     each stage indented one step further (warm grey)
//   3  ProcessAssembly  the unit drawing itself down the page (warm grey)
//
// See ../variant.ts for how the index is chosen and why.
import type { ProcessStep, ServiceDetail } from "@/lib/content";
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
}: {
  service: ServiceDetail;
  steps: ProcessStep[];
  position: number;
  id: string;
}) {
  if (!steps.length) return null;

  const Process = VARIANTS[variantIndex(position, VARIANTS.length, service.heroVariant)];
  return <Process steps={steps} id={id} />;
}
