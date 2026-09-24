// The shapes the site renders — the *resolved* records, after the JSON tables in
// src/data have been joined together.
//
// src/data holds normalised rows the way the production database will: a service
// points at a media row by id, a portfolio project points at a service, a
// testimonial points at the project it was written about. Nothing is stored
// twice. The getters in ./index.ts do the joins and hand components these flat
// shapes, which is exactly what `GET /content/*` will return once apps/api
// exists — so swapping the getters' bodies for real fetch calls changes nothing
// above this line.

export interface MediaItem {
  id: string;
  src: string;
  alt: string;
  title?: string;
  source: string;
}

export interface ProcessStep {
  step: string;
  desc: string;
}

export interface PricingTier {
  tier: string;
  desc: string;
  /** Displayed starting price, e.g. "£4,500". Parsed by src/lib/service-metrics.ts. */
  from: string;
  features: string[];
}

export interface FAQEntry {
  q: string;
  a: string;
}

/** The list shape — what a future `GET /content/services` returns. */
export interface Service {
  /** Row id, and the route slug for /services/[category]. */
  id: string;
  /** Alias of `id`, kept because every surface routes on `service.slug`. */
  slug: string;
  title: string;
  /** Plural, adjective-free: "Kitchens". The answer to "which room?". */
  shortName: string;
  /** Singular: "Kitchen". Used by the hero's room labels. */
  singular: string;
  category: string;
  /** lucide icon name, mapped to a component where it is rendered. */
  icon: string;
  /** One line for the header's service menu. */
  navSummary: string;
  description: string;
  image: string;
  imageAlt: string;
  features: string[];
}

/** The detail shape — what `GET /content/services/:slug` returns. */
export interface ServiceDetail extends Service {
  heroDesc: string;
  overview: string;
  overviewShort?: string;
  process: ProcessStep[];
  pricing: PricingTier[];
  gallery: string[];
  faqs: FAQEntry[];
  timeline: string;
  materials: string[];
  heroVariant?: number;
}

export interface PortfolioItem {
  id: string;
  /** The service this project was built under — where `category` comes from. */
  serviceId: string;
  title: string;
  /** Read off the linked service, never authored twice. */
  category: string;
  image: string;
  images: string[];
  location: string;
  client: string;
  duration: string;
  year: string;
  desc: string;
  materials: string[];
}

export interface Testimonial {
  id: string;
  /** The project it was written about. */
  projectId: string;
  name: string;
  /** The linked project's location — not stored on the review. */
  role: string;
  text: string;
  /** A shorter pull-out, where one is authored. */
  pullQuote?: string;
  image: string;
  rating: number;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  note: string;
  image: string;
}

/** Minutes past midnight, Europe/London. */
export interface HoursWindow {
  open: number;
  close: number;
}

export interface HoursRow {
  day: string;
  time: string;
}

export interface StudioHours {
  /** Keyed by JS day index — 0 is Sunday. An empty array is a closed day. */
  weekly: Record<number, HoursWindow[]>;
  rows: HoursRow[];
  note: string;
  status: {
    openUntil: string;
    opensLaterToday: string;
    opensOn: string;
    tomorrow: string;
    byAppointment: string;
  };
}

export interface CompanySocial {
  id: string;
  label: string;
  href: string;
  handle?: string;
}

export interface Company {
  name: string;
  description: string;
  city: string;
  county: string;
  region: string;
  phone: { display: string; href: string };
  email: string;
  emailHref: string;
  logos: { onLight: MediaItem; onDark: MediaItem };
  socials: CompanySocial[];
  map: {
    embedUrl: string;
    linkUrl: string;
    title: string;
    linkLabel: string;
    linkAriaLabel: string;
  };
  hours: StudioHours;
  madeBy: string;
  /** For search and maps. Blank until the studio confirms it. */
  address: { street: string; postcode: string };
}

export interface NavSection {
  /** Sheet index as the page itself letters it — "01", "C3", "A2". */
  index: string;
  label: string;
  href: string;
  description: string;
}

/** A child *page*, not a section of this one. Only Services has any. */
export interface NavPage {
  label: string;
  href: string;
  description: string;
}

export interface NavLink {
  label: string;
  path: string;
  /** lucide icon name. */
  icon: string;
  tagline: string;
  sections: NavSection[];
  pages?: NavPage[];
}

// ── Page-copy shapes that inference cannot type cleanly ──
// Most page JSON is consumed through `typeof`, which is exact and needs no
// maintenance. These few are arrays whose members legitimately differ from one
// another (four investment layouts do not share a vocabulary), so they are
// declared rather than inferred.

/**
 * §C1's three ways in. The route pointing at the page's own form authors its
 * own value and href; the phone and email routes name a field of the company
 * record instead, so the number and the address are not written a second time
 * here.
 */
export interface ContactRouteContent {
  index: string;
  label: string;
  datum: string;
  value?: string;
  href?: string;
  /** A key of the company record — "phone" or "email". */
  valueSource?: string;
  hrefSource?: string;
  external?: boolean;
}

export interface ModelVariantContent {
  kind: string;
  label: string;
  lines: string[];
  lede: string;
  viewpoints: {
    id: string;
    label: string;
    note: string;
    azimuth: number;
    polar: number;
    radius: number;
    targetY: number;
  }[];
  control: { off: string; on: string };
  specs: { value: string; label: string; note: string }[];
}

export interface ProcessVariantContent {
  label: string;
  datum: string;
  lines: string[];
  lede: string;
  ledeShort?: string;
}

export interface InvestmentVariantContent {
  label: string;
  datum: string;
  lines: string[];
  lede: string;
  footnote: string;
  recommendedLabel?: string;
  tierIndexLabel?: string;
  budgetLabel?: string;
  buysLabel?: string;
  sliderSrLabel?: string;
  rangeLine?: string;
  ctaLabel?: string;
  specificationLabel?: string;
  frameHeader?: string;
  roomLabel?: string;
  movesLabel?: string;
  moves?: { label: string; body: string }[];
  srTierLabel?: string;
  srRangeLabel?: string;
}

export interface AboutFigureContent {
  /** "projectCount" derives the value from the published projects. */
  source?: string;
  value?: number | null;
  text?: string;
  suffix?: string;
  label: string;
  note: string;
}

export interface HeroRoomContent {
  id: string;
  serviceId: string;
  framesDir: string;
  frameCount: number;
  /** Read off the linked service — the room is not named twice. */
  label: string;
  hold: { heading: string; body: string };
}

