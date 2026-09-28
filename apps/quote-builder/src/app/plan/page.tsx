import type { Metadata } from "next";
import { PlannerApp, type Step } from "@/components/planner/PlannerApp";

export const metadata: Metadata = { title: "Room planner" };

const STEPS: Step[] = ["room", "layout", "estimate"];

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const step = typeof params.step === "string" && STEPS.includes(params.step as Step) ? (params.step as Step) : undefined;
  return <PlannerApp studio={params.studio === "1"} initialStep={step} />;
}
