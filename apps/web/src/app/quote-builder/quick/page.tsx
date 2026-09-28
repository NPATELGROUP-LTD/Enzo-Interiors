import type { Metadata } from "next";
import { QuickEstimate } from "@/components/quote-builder/quick/QuickEstimate";

export const metadata: Metadata = { title: "Quick estimate" };

export default function QuickEstimatePage() {
  return <QuickEstimate />;
}
