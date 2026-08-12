// Ported from Boilerplate:src/app/components/pages/PortfolioPage.tsx.
// Server Component shell (hero + data fetch) — filter/grid/lightbox state
// lives in the Client Component PortfolioGallery.tsx. TRD §9 calls this
// page out (alongside /services/[category]) for ISR/SSG since it's
// image-heavy; `revalidate` re-generates it periodically instead of on
// every request.
import Link from "next/link";
import { getPortfolioItems } from "@/lib/content";
import { PortfolioGallery } from "./PortfolioGallery";

export const revalidate = 3600;

export default async function PortfolioPage() {
  const items = await getPortfolioItems();

  return (
    <div>
      {/* Hero */}
      <section className="pt-32 pb-16 bg-background">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <p className="text-enzo-sage text-[12px] uppercase tracking-[0.2em] mb-4">
            <Link href="/" className="hover:text-primary transition-colors">
              Home
            </Link>{" "}
            / Portfolio
          </p>
          <h1
            className="text-primary"
            style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)" }}
          >
            Our Portfolio
          </h1>
        </div>
      </section>

      {/* Filter + Grid + Lightbox */}
      <section className="py-12 bg-background">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <PortfolioGallery items={items} />
        </div>
      </section>
    </div>
  );
}
