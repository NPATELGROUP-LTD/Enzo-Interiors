// /portfolio — the archive.
//
// Four sections, no two sharing a layout or a mechanic. See
// src/components/portfolio/ for the file map.
//
//   01  PortfolioMasthead   the fold: one full-bleed plate cutting through
//                           the archive, over four counted figures (near-black)
//   02  PortfolioWall       every project as a mosaic, filtered with a
//                           Flip re-layout (near-black)
//   03  PortfolioAnatomy    one project given the room the grid cannot:
//                           the plate large, the record set out (cream)
//   04  PortfolioClose      the ask, in the landing hero's own grammar,
//                           with the archive counted (near-black)
//
// ── One list, not three ──
// An earlier cut had a ruled register on the fold and a materials schedule
// at §03, both of which listed all nine projects — so the page said the same
// thing three times in three fonts. A later one replaced §03 with a catchment
// plot, which enumerated them a third time in a different notation. The
// archive is enumerated exactly once, in §02, where showing it is the point.
// The fold sells; §03 goes deep on one record instead of shallow on all of
// them; the close asks, and counts what the records add up to.
//
// Stays a Server Component: it fetches the records and hands them down.
// Every section is written against `PortfolioItem[]` of any length, because
// in production the client publishes projects themselves from the Admin
// Content Manager — nothing assumes there are nine, and §01's figures and
// §03's plot are both counted off whatever those records happen to say.
//
// TRD §9 calls this page out (alongside /services/[category]) for ISR/SSG
// since it is image-heavy; `revalidate` re-generates it periodically
// instead of on every request.
import type { Metadata } from "next";
import { PortfolioRoot } from "@/components/portfolio/PortfolioRoot";
import { getPortfolioItems } from "@/lib/content";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Portfolio — Enzo Interiors",
  description:
    "Every kitchen, bedroom, media wall and wardrobe we have finished across Leicestershire — with the client, the location, the time on site and the materials specified.",
};

export default async function PortfolioPage() {
  const items = await getPortfolioItems();
  return <PortfolioRoot items={items} />;
}
