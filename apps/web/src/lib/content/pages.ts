// Settings › Pages: which public pages are switched on. Pure, so npm test can
// run it; the API sends `site.pages`, and anything it leaves out (an older API,
// or the offline fallback) takes the default below.
export const PAGE_KEYS = ["about", "services", "portfolio", "booking", "quote", "contact", "privacy", "terms", "cookies"] as const;
export type PagesKey = (typeof PAGE_KEYS)[number];
export type PagesSetting = Partial<Record<PagesKey, boolean>>;

/** Until the real content is ready only the home page, contact and the legal pages are live. */
export const PAGE_DEFAULTS: Record<PagesKey, boolean> = {
  about: false,
  services: false,
  portfolio: false,
  booking: false,
  quote: false,
  contact: true,
  privacy: true,
  terms: true,
  cookies: true,
};

export function isPageOn(site: { pages?: PagesSetting | null }, key: PagesKey): boolean {
  return site.pages?.[key] ?? PAGE_DEFAULTS[key];
}
