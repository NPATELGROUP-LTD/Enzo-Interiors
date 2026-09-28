import type { Metadata } from "next";
import { QuickEstimate } from "@/components/quick/QuickEstimate";

export const metadata: Metadata = { title: "Quick estimate" };

export default function QuickEstimatePage() {
  return <QuickEstimate />;
}
