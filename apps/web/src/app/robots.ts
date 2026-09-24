import type { MetadataRoute } from "next";

import { getSiteStatus, isLive } from "@/lib/content";
import { SITE_URL } from "@/lib/seo";

/**
 * Open to every crawler once the site is live, AI assistants included: being
 * quoted by ChatGPT, Claude or Perplexity when someone asks for a kitchen
 * fitter in Leicester is the same win as ranking on Google. The named rules
 * only make that explicit. Before launch, nothing is crawled.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  if (!isLive(await getSiteStatus())) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/"] },
      {
        userAgent: ["GPTBot", "OAI-SearchBot", "ClaudeBot", "PerplexityBot", "Google-Extended"],
        allow: "/",
        disallow: ["/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
