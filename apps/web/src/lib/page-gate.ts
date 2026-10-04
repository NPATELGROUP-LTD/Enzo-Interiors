import type { Metadata } from "next";
import { draftMode } from "next/headers";

import { getSiteStatus, isPageOn, type PagesKey } from "@/lib/content";

/** Name and one-line promise for each switchable page, shown on its "updated soon" view. */
export const PAGE_COPY: Record<PagesKey, { name: string; line: string }> = {
  about: { name: "About", line: "The workshop, the team and how a project runs." },
  services: { name: "Services", line: "Kitchens, wardrobes, media walls and more, with the detail of each." },
  portfolio: { name: "Recent work", line: "Finished projects across Leicestershire, photographed on site." },
  booking: { name: "Book a consultation", line: "To book a free home survey today, call or email us and we will find a time." },
  contact: { name: "Contact", line: "" },
  privacy: { name: "Privacy", line: "" },
  terms: { name: "Terms", line: "" },
  cookies: { name: "Cookies", line: "" },
};

/**
 * True when a page is switched off in Settings and the visitor is not an
 * editor previewing (draft mode shows the real page, as it does past the
 * coming-soon gate). Call it before the page's own fetches.
 */
export async function pageOff(key: PagesKey): Promise<boolean> {
  const [site, draft] = await Promise.all([getSiteStatus(), draftMode()]);
  return !isPageOn(site, key) && !draft.isEnabled;
}

/** Metadata for the "updated soon" view: never indexed. */
export function offMetadata(key: PagesKey): Metadata {
  return { title: PAGE_COPY[key].name, robots: { index: false, follow: true } };
}
