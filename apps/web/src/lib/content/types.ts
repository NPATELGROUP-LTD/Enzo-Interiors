// Shapes mirror the future `GET /content/*` responses documented in
// docs/architecture.md ("Public Content" row). Field names are kept
// identical to the Boilerplate mock data so swapping these functions'
// bodies for real `fetch()` calls against apps/api later is a body-only
// change — no caller needs to change shape.

/**
 * The list shape — what a future `GET /content/services` would return for
 * the index/landing rails. Everything here is required because every
 * surface that lists services (landing §01, /services hero ladder) needs
 * all of it to render a row.
 */
export interface Service {
  title: string;
  category: string;
  description: string;
  image: string;
  /** Route slug for /services/[category] — e.g. "kitchens". */
  slug: string;
  /** Checklist bullets shown wherever a service is summarised. */
  features: string[];
}

export interface ProcessStep {
  step: string;
  desc: string;
}

export interface PricingTier {
  tier: string;
  desc: string;
  /** Displayed starting price, e.g. "£4,500". Parsed by src/lib/quote-estimate.ts. */
  from: string;
  features: string[];
}

export interface FAQEntry {
  q: string;
  a: string;
}

/**
 * The detail shape — what `GET /content/services/:slug` would return.
 *
 * Every field here is authored per-service by the client in the Admin
 * Content Manager, which is why both `/services` and `/services/[category]`
 * are built to render whatever arrives: the number of services, process
 * steps, pricing tiers, materials, features and FAQs are all treated as
 * variable-length by the components that consume them. Nothing in the UI
 * assumes "four services with four steps and three tiers".
 */
export interface ServiceDetail extends Service {
  /** One-line hook under the page title. */
  heroDesc: string;
  /** The long-form paragraph on the detail page. */
  overview: string;
  process: ProcessStep[];
  pricing: PricingTier[];
  gallery: string[];
  faqs: FAQEntry[];
  /** Human-readable lead time, e.g. "4-6 weeks". */
  timeline: string;
  materials: string[];
  /**
   * Optional override for which of the detail page's hero designs this
   * service uses (see components/services/service-detail/hero/ServiceHero).
   * Left unset, the variant follows the service's published position, which
   * spreads the four designs evenly with no authoring required.
   */
  heroVariant?: number;
}

export interface Testimonial {
  name: string;
  role: string;
  text: string;
  image: string;
}

export interface PortfolioItem {
  id: number;
  title: string;
  category: string;
  image: string;
  location: string;
  client: string;
  duration: string;
  year: string;
  desc: string;
  materials: string[];
}
