import type { MetadataRoute } from "next";

import {
  getPortfolioItems,
  getPublishedAt,
  getServiceDetails,
  getSiteStatus,
  isLive,
} from "@/lib/content";
import { SITE_URL } from "@/lib/seo";

/**
 * Every public page. Empty before launch, so nothing is submitted early.
 *
 * Built from the same content bundle as the pages, so it re-reads when an
 * admin publishes (the "content" tag) — a new service appears here the moment
 * it goes live. `lastmod` is the latest publish of the CMS entries that page
 * renders ("collection/slug", or "collection/*" for a whole collection), so
 * crawlers come back when something actually changed, not on every deploy.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!isLive(await getSiteStatus())) return [];

  const [publishedAt, services, portfolio] = await Promise.all([
    getPublishedAt(),
    getServiceDetails(),
    getPortfolioItems(),
  ]);

  const lastModified = (sources: string[]): Date | undefined => {
    const times = Object.entries(publishedAt)
      .filter(([key, at]) =>
        at && sources.some((source) => (source.endsWith("/*") ? key.startsWith(source.slice(0, -1)) : key === source)),
      )
      .map(([, at]) => Date.parse(at!));
    return times.length ? new Date(Math.max(...times)) : undefined;
  };

  const entry = (
    path: string,
    priority: number,
    sources: string[],
    images: string[] = [],
  ): MetadataRoute.Sitemap[number] => ({
    url: `${SITE_URL}${path}`,
    lastModified: lastModified(sources),
    changeFrequency: priority >= 0.8 ? "weekly" : "monthly",
    priority,
    ...(images.length ? { images: images.filter(Boolean) } : {}),
  });

  return [
    entry("/", 1, ["pages/home", "services/*", "portfolio/*", "testimonials/*"]),
    entry("/services", 0.9, ["pages/services", "services/*"]),
    ...services.map((service) =>
      entry(`/services/${service.slug}`, 0.9, [`services/${service.slug}`, "pages/service-detail", "faqs/*"], [service.image]),
    ),
    entry("/portfolio", 0.8, ["pages/portfolio", "portfolio/*"], portfolio.map((item) => item.image)),
    entry("/about", 0.7, ["pages/about", "team/*"]),
    entry("/contact", 0.8, ["pages/contact", "company/*"]),
    entry("/booking", 0.8, ["pages/booking"]),
    entry("/privacy", 0.2, ["pages/legal"]),
    entry("/terms", 0.2, ["pages/legal"]),
    entry("/cookies", 0.2, ["pages/legal"]),
  ];
}
