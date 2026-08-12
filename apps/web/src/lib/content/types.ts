// Shapes mirror the future `GET /content/*` responses documented in
// docs/architecture.md ("Public Content" row). Field names are kept
// identical to the Boilerplate mock data so swapping these functions'
// bodies for real `fetch()` calls against apps/api later is a body-only
// change — no caller needs to change shape.

export interface Service {
  title: string;
  category: string;
  description: string;
  image: string;
  /** Route slug for /services/[category] — e.g. "kitchens". */
  slug: string;
  /** Checklist bullets shown on the /services list page. */
  features: string[];
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
