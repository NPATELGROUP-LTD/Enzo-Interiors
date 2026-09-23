import type { MetadataRoute } from "next";

import { getServiceSlugs, getSiteStatus, isLive } from "@/lib/content";
import { SITE_URL } from "@/lib/seo";

/** Every public page. Empty before launch, so nothing is submitted early. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!isLive(await getSiteStatus())) return [];

  const main: Array<[string, number]> = [
    ["/", 1],
    ["/services", 0.9],
    ["/portfolio", 0.8],
    ["/about", 0.7],
    ["/contact", 0.8],
    ["/booking", 0.8],
  ];
  const services = (await getServiceSlugs()).map((slug): [string, number] => [`/services/${slug}`, 0.9]);
  const legal: Array<[string, number]> = [
    ["/privacy", 0.2],
    ["/terms", 0.2],
    ["/cookies", 0.2],
  ];

  return [...main, ...services, ...legal].map(([path, priority]) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: priority >= 0.8 ? "weekly" : "monthly",
    priority,
  }));
}
