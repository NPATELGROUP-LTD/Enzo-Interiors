import type { Metadata } from "next";
import { StudioApp } from "@/components/quote-builder/studio/StudioApp";

export const metadata: Metadata = { title: "Studio catalogue" };

export default function StudioPage() {
  return <StudioApp />;
}
