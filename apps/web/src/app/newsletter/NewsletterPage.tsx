import Link from "next/link";
import { NewsletterLinkAction } from "@/components/newsletter/Newsletter";
import { getCompany, getPage } from "@/lib/content";

/** The page a newsletter email's link opens once the site is live. */
export async function NewsletterPage({ mode }: { mode: "confirm" | "unsubscribe" }) {
  const [page, company] = await Promise.all([getPage("site"), getCompany()]);
  return (
    <main className="flex min-h-dvh flex-col bg-enzo-forest px-6 py-10 text-enzo-cream sm:px-12 md:py-14">
      <Link href="/" aria-label={page.newsletter.homeLabel} className="self-start">
        {/* eslint-disable-next-line @next/next/no-img-element -- the one mark on the page, sized by CSS */}
        <img src={company.logos.onDark.src} alt={company.name} className="h-12 w-auto" />
      </Link>
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-8">
        <NewsletterLinkAction mode={mode} labels={page.newsletter} />
        <Link href="/" className="text-sm text-enzo-cream/70 underline-offset-4 hover:underline">
          {page.newsletter.homeLabel}
        </Link>
      </div>
    </main>
  );
}
