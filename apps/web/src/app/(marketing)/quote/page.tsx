// /quote: the public quote maker, behind Settings › Pages `quote` (off by default). The page is a thin
// Server Component shell; the editor (components/quote/QuoteMaker.tsx) is a Client Component that
// talks to the API's public quote maker routes, which are shut too while the switch is off.
import type { Metadata } from "next";

import { QuoteMaker } from "@/components/quote/QuoteMaker";
import { PageUpdating } from "@/components/shared/PageUpdating";
import { getCompany } from "@/lib/content";
import { offMetadata, pageOff } from "@/lib/page-gate";

export async function generateMetadata(): Promise<Metadata> {
  if (await pageOff("quote")) return offMetadata("quote");
  return {
    title: "Design & price your room",
    description: "Lay out your kitchen, wardrobes or media wall to scale, pick finishes and see a price range straight away.",
    alternates: { canonical: "/quote" },
  };
}

export default async function QuotePage() {
  if (await pageOff("quote")) return <PageUpdating page="quote" />;
  const company = await getCompany();
  return <QuoteMaker phone={company.phone ?? null} />;
}
