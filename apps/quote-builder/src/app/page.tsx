import type { Metadata } from "next";
import { Landing } from "@/components/Landing";

export const metadata: Metadata = { title: "Price your room" };

export default function QuoteBuilderPage() {
  return <Landing />;
}
