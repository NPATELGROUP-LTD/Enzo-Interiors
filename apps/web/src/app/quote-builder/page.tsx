import type { Metadata } from "next";
import { Landing } from "@/components/quote-builder/Landing";

export const metadata: Metadata = { title: "Price your room" };

export default function QuoteBuilderPage() {
  return <Landing />;
}
