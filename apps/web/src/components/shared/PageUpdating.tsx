import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { NewsletterSignup } from "@/components/newsletter/Newsletter";
import { getPage } from "@/lib/content";
import { PAGE_COPY } from "@/lib/page-gate";
import type { PagesKey } from "@/lib/content";

/**
 * What a switched-off page shows (Settings › Pages), inside the normal site
 * chrome. The words are here rather than in the CMS because the view is
 * temporary: it goes when the real pages do.
 */
export async function PageUpdating({ page }: { page: PagesKey }) {
  const { footer } = await getPage("site");
  const { name, line } = PAGE_COPY[page];
  const link =
    "inline-flex items-center gap-2 text-[14px] text-enzo-forest underline decoration-enzo-forest/30 underline-offset-[6px] transition-colors hover:decoration-enzo-forest focus-visible:outline-none focus-visible:decoration-enzo-forest";

  return (
    <section className="bg-enzo-cream text-enzo-charcoal">
      <div className="mx-auto grid min-h-[80dvh] max-w-6xl content-center gap-12 px-6 pb-24 pt-40 md:px-12 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
        <div>
          <p className="text-[12px] font-medium uppercase tracking-[0.22em] text-enzo-forest/70">{name}</p>
          <h1 className="mt-4 max-w-[16ch] font-title text-[clamp(2.25rem,6vw,4.5rem)] font-medium leading-[1.02] tracking-[-0.035em] text-balance text-enzo-forest">
            This page is being updated.
          </h1>
          <p className="mt-6 max-w-[44ch] text-base leading-relaxed text-enzo-charcoal/75">
            {line} We are adding the finishing touches, so it will be back soon.
          </p>
          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-2">
            <Link href="/" className={link}>
              Back to the home page <ArrowRight size={14} aria-hidden />
            </Link>
            <Link href="/contact" className={link}>
              Talk to us <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
        </div>
        <div className="border-t border-enzo-forest/15 pt-6 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0">
          <p className="mb-4 text-[14px] text-enzo-charcoal/75">Hear when it is ready.</p>
          <NewsletterSignup labels={footer.newsletter} source="footer" tone="light" />
        </div>
      </div>
    </section>
  );
}
