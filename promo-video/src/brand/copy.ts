// Every word in the videos, in one place.
//
// Wherever the site already says it, the site's own wording is used — the
// sources are noted so the two can be kept in step:
//
//   company facts   apps/web/src/data/company.json
//   process stages  apps/web/src/data/pages/home.json  → process.stages
//   room captions   apps/web/src/data/pages/home.json  → hero.rooms[].hold
//   the run plate   apps/web/src/data/pages/site.json  → pageTransition.imprint

export const company = {
  name: "Enzo Interiors",
  city: "Leicester",
  /** company.json → socials[instagram].handle */
  handle: "@enzo.interiors",
  /** The domain of hello@enzointeriors.co.uk and the staging hosts. */
  domain: "enzointeriors.co.uk",
  imprint: "Enzo Interiors — Leicester",
  disciplines: ["Kitchens", "Bedrooms", "Media walls", "Wardrobes"],
} as const;

/**
 * The four beats of the opening — the site's own process stages, told as
 * what happens to a room. Index, label and datum are the stage's (home.json);
 * the verb is the headline; the lede is drawn from the stage body and the
 * About page's promises.
 */
export const processBeats = [
  { index: "01", label: "Consultation", datum: "60–90 min", verb: "Measured.", lede: "Every wall, measured in the room itself." },
  { index: "02", label: "Design", datum: "5–7 days", verb: "Drawn.", lede: "A drawing you sign before we cut a sheet." },
  { index: "03", label: "Making", datum: "2–4 weeks", verb: "Built.", lede: "Made in our own Leicester workshop." },
  { index: "04", label: "Fitting", datum: "2–5 days", verb: "Fitted.", lede: "Scribed to your walls by the same team." },
] as const;

/** hero.rooms[].hold.heading — lettered into the footage as each room completes. */
export const roomCaptions = {
  kitchen: { label: "The finished kitchen", heading: "Made for the way you cook." },
  mediawall: { label: "The finished media wall", heading: "Every cable, out of sight." },
  bedroom: { label: "The finished bedroom", heading: "Wall to wall, floor to ceiling." },
} as const;

/** The reveal: the site's own hero line, "Fitted furniture, made to measure." */
export const reveal = {
  index: "05",
  label: "Handover",
  datum: "coming soon",
  lines: ["A new website,", "made to measure."],
} as const;

/**
 * What the phone shows, one page of the real site at a time. `scroll` is the
 * stretch of the page (CSS px from the top) the phone travels across.
 */
export const siteTour = [
  { screen: "home", lines: ["A new website,", "made to measure."], scroll: [0, 40] },
  { screen: "services", lines: ["Every price,", "up front."], scroll: [690, 1130] },
  { screen: "portfolio", lines: ["Every room", "we have finished."], scroll: [180, 290] },
  { screen: "booking", lines: ["Book a free survey", "in four questions."], scroll: [0, 0] },
] as const;

export type SiteScreen = (typeof siteTour)[number]["screen"];

/**
 * Height of each capture in public/site, in CSS px (the files are 390 CSS px
 * wide at 2x). Keep in step with PAGES in scripts/capture-site.mjs.
 */
export const siteCaptureHeight: Record<SiteScreen, number> = {
  home: 1400,
  services: 2000,
  portfolio: 1400,
  booking: 844,
};

export const endCard = {
  index: "07",
  label: "New website",
  lead: "New website,",
  follow: "Follow {handle} to see it first.",
} as const;
