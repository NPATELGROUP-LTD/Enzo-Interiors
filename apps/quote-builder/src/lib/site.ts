/**
 * The public website this prototype hands customers back to (booking, "back
 * to site"). A separate app, so it is a full URL rather than a route.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const siteHref = (path: string) => `${SITE_URL}${path}`;
