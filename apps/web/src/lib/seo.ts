import type { Metadata } from "next";

import { getMedia } from "@/lib/content";

/** The canonical origin. Every canonical, OG and sitemap URL is built from it. */
export const SITE_URL = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
export const SITE_NAME = "Enzo Interiors";

/**
 * A page's full metadata: canonical, Open Graph and Twitter card.
 *
 * Next replaces a parent's `openGraph` rather than merging into it, so every
 * page spells out the whole block. The share image is the one chosen in the
 * CMS (`metadata.ogImageId`) when there is one, otherwise the generated card.
 */
export async function pageMetadata({
  title,
  description,
  path,
  ogKey,
  ogImageId,
}: {
  title: string;
  description?: string;
  path: string;
  ogKey: string;
  ogImageId?: string | null;
}): Promise<Metadata> {
  const custom = ogImageId ? (await getMedia())(ogImageId).src : "";
  const image = custom
    ? { url: custom, alt: title }
    : { url: `/og/${ogKey}`, width: 1200, height: 630, alt: title };
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "en_GB",
      siteName: SITE_NAME,
      url: path,
      title,
      description,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      // X crops to 2:1, so the generated card has its own 1200×600 cut.
      images: [custom ? image : { url: `/og/${ogKey}/twitter`, width: 1200, height: 600, alt: title }],
    },
  };
}
