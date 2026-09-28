"use client";

import { usePathname } from "next/navigation";
import { NewsletterLinkAction, NewsletterSignup, newsletterLink } from "@/components/newsletter/Newsletter";
import type { SiteContent } from "@/lib/content";

/**
 * Before launch every address is the coming-soon page, the newsletter's
 * confirm and unsubscribe links included. So this answers those links in
 * place, and offers the sign-up everywhere else.
 */
export function ComingSoonNewsletter({ content }: { content: SiteContent }) {
  const link = newsletterLink(usePathname());
  return link ? (
    <NewsletterLinkAction mode={link} labels={content.newsletter} tone="light" />
  ) : (
    <NewsletterSignup labels={content.footer.newsletter} source="coming_soon" tone="light" />
  );
}
