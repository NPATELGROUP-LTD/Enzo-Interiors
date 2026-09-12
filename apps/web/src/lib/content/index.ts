// The content layer.
//
// Every string, list and image on this site comes from the JSON tables in
// src/data, and every one of them is stored exactly once: a service points at a
// media row, a portfolio project points at a service, a testimonial points at
// the project it was written about, the header's service menu points at the
// services table. The functions below do those joins and hand callers flat,
// rendered-ready records.
//
// They are async on purpose. They stand in for `GET /content/*` (see
// docs/architecture.md, "Public Content"), so when apps/api exists the bodies
// become `fetch()` calls and nothing above this line changes. `getServiceSlugs`
// is the one exception — Next walks the build graph for generateStaticParams
// before any request context exists.
import companyRow from "@/data/company.json";
import mediaRows from "@/data/media.json";
import serviceRows from "@/data/services.json";
import portfolioRows from "@/data/portfolio.json";
import testimonialRows from "@/data/testimonials.json";
import teamRows from "@/data/team.json";
import faqRows from "@/data/faqs.json";
import navigationRows from "@/data/navigation.json";

import site from "@/data/pages/site.json";
import shared from "@/data/pages/shared.json";
import home from "@/data/pages/home.json";
import servicesPage from "@/data/pages/services.json";
import serviceDetailPage from "@/data/pages/service-detail.json";
import portfolioPage from "@/data/pages/portfolio.json";
import aboutPage from "@/data/pages/about.json";
import contactPage from "@/data/pages/contact.json";
import legalPage from "@/data/pages/legal.json";
import bookingPage from "@/data/pages/booking.json";

import type {
  Company,
  FAQEntry,
  HeroRoomContent,
  HoursWindow,
  MediaItem,
  NavLink,
  PortfolioItem,
  Service,
  ServiceDetail,
  StudioHours,
  TeamMember,
  Testimonial,
} from "./types";

export type * from "./types";

/**
 * Fills `{token}` placeholders. Copy that has to carry a number or a name is
 * authored as a template in the JSON rather than assembled from fragments in a
 * component, so the whole sentence stays readable — and translatable — where it
 * is edited.
 */
export function fill(
  template: string,
  values: Record<string, string | number | null | undefined>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = values[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

// ── Media ───────────────────────────────────────────────────────────────────
const MEDIA = new Map<string, MediaItem>(
  (mediaRows as MediaItem[]).map((row) => [row.id, row]),
);

/** The row for an id. Unknown ids resolve to an empty image rather than throwing:
 *  a mistyped id in the data should cost one picture, not the whole page. */
export function media(id: string | undefined | null): MediaItem {
  if (!id) return { id: "", src: "", alt: "", source: "" };
  return MEDIA.get(id) ?? { id, src: "", alt: "", source: "" };
}

export function mediaSrc(id: string | undefined | null): string {
  return media(id).src;
}

// ── Services ────────────────────────────────────────────────────────────────
function faqsFor(serviceId: string | null): FAQEntry[] {
  return faqRows
    .filter((row) => row.serviceId === serviceId)
    .map(({ q, a }) => ({ q, a }));
}

function toDetail(row: (typeof serviceRows)[number]): ServiceDetail {
  const image = media(row.imageId);
  return {
    id: row.id,
    slug: row.id,
    title: row.title,
    shortName: row.shortName,
    singular: row.singular,
    category: row.category,
    icon: row.icon,
    navSummary: row.navSummary,
    description: row.description,
    image: image.src,
    imageAlt: image.alt,
    features: row.features,
    heroDesc: row.heroDesc,
    overview: row.overview,
    overviewShort: row.overviewShort,
    process: row.process,
    pricing: row.pricing,
    gallery: row.galleryIds.map(mediaSrc),
    faqs: faqsFor(row.id),
    timeline: row.timeline,
    materials: row.materials,
  };
}

/** Narrows a detail record to the list shape the summary surfaces consume. */
function toService(detail: ServiceDetail): Service {
  const { id, slug, title, shortName, singular, category, icon, navSummary, description, image, imageAlt, features } = detail;
  return { id, slug, title, shortName, singular, category, icon, navSummary, description, image, imageAlt, features };
}

const SERVICE_DETAILS: ServiceDetail[] = serviceRows.map(toDetail);
const SERVICES_BY_ID = new Map(SERVICE_DETAILS.map((s) => [s.id, s]));

export async function getServices(): Promise<Service[]> {
  return SERVICE_DETAILS.map(toService);
}

export async function getServiceDetails(): Promise<ServiceDetail[]> {
  return SERVICE_DETAILS;
}

export async function getService(slug: string): Promise<ServiceDetail | null> {
  return SERVICES_BY_ID.get(slug) ?? null;
}

/** Synchronous: generateStaticParams runs before any request context exists. */
export function getServiceSlugs(): string[] {
  return serviceRows.map((row) => row.id);
}

/** The cross-service questions — the rows with no service of their own. */
export async function getGeneralFaqs(): Promise<FAQEntry[]> {
  return faqsFor(null);
}

// ── Portfolio ───────────────────────────────────────────────────────────────
const PORTFOLIO: PortfolioItem[] = portfolioRows
  .filter((row) => row.isPublished)
  .map((row) => {
    const service = SERVICES_BY_ID.get(row.serviceId);
    const images = row.imageIds.map(mediaSrc);
    return {
      id: row.id,
      serviceId: row.serviceId,
      title: row.title,
      // The discipline name lives on the service, so a project cannot disagree
      // with the service it was built under.
      category: service?.shortName ?? "",
      image: images[0] ?? "",
      images,
      location: row.location,
      client: row.client,
      duration: row.duration,
      year: row.year,
      desc: row.description,
      materials: row.materials,
    };
  });

const PROJECTS_BY_ID = new Map(PORTFOLIO.map((item) => [item.id, item]));

export async function getPortfolioItems(): Promise<PortfolioItem[]> {
  return PORTFOLIO;
}

// ── Testimonials ────────────────────────────────────────────────────────────
const TESTIMONIALS: Testimonial[] = testimonialRows
  .filter((row) => row.isPublished)
  .map((row) => ({
    id: row.id,
    projectId: row.projectId,
    name: row.clientName,
    // Where they live is a fact about the project, not about the review.
    role: PROJECTS_BY_ID.get(row.projectId)?.location ?? "",
    text: row.text,
    pullQuote: (row as { pullQuote?: string }).pullQuote,
    image: mediaSrc(row.imageId),
    rating: row.rating,
  }));

export async function getTestimonials(): Promise<Testimonial[]> {
  return TESTIMONIALS;
}

export async function getTestimonial(id: string): Promise<Testimonial | null> {
  return TESTIMONIALS.find((row) => row.id === id) ?? null;
}

// ── Team ────────────────────────────────────────────────────────────────────
const TEAM: TeamMember[] = teamRows.map((row) => ({
  id: row.id,
  name: row.name,
  role: row.role,
  note: row.note,
  image: mediaSrc(row.imageId),
}));

export async function getTeam(): Promise<TeamMember[]> {
  return TEAM;
}

// ── Company ─────────────────────────────────────────────────────────────────
const DAY_ORDER = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

/** "10:00" -> minutes past midnight. */
function toMinutes(clock: string): number {
  const [hour, minute] = clock.split(":").map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

const HOURS: StudioHours = {
  weekly: Object.fromEntries(
    DAY_ORDER.map((day, index) => [
      index,
      (companyRow.hours.weekly[day] ?? []).map<HoursWindow>((window) => ({
        open: toMinutes(window.open),
        close: toMinutes(window.close),
      })),
    ]),
  ),
  rows: companyRow.hours.rows,
  note: companyRow.hours.note,
  status: companyRow.hours.status,
};

const COMPANY: Company = {
  name: companyRow.name,
  description: companyRow.description,
  city: companyRow.city,
  county: companyRow.county,
  region: companyRow.region,
  phone: companyRow.phone,
  email: companyRow.email,
  emailHref: `mailto:${companyRow.email}`,
  logos: {
    onLight: media(companyRow.logos.onLight),
    onDark: media(companyRow.logos.onDark),
  },
  socials: companyRow.socials,
  map: companyRow.map,
  hours: HOURS,
  madeBy: companyRow.madeBy,
};

export async function getCompany(): Promise<Company> {
  return COMPANY;
}

// ── Navigation ──────────────────────────────────────────────────────────────
// The header's Services panel lists the published services rather than a second
// hand-written copy of their names: publish a fifth service and it appears.
const NAVIGATION: NavLink[] = navigationRows.map((row) => {
  const { childPages, ...rest } = row as typeof row & { childPages?: string };
  return {
    ...rest,
    pages:
      childPages === "services"
        ? SERVICE_DETAILS.map((service) => ({
            label: service.title,
            href: `/services/${service.slug}`,
            description: service.navSummary,
          }))
        : undefined,
  };
});

export async function getNavigation(): Promise<NavLink[]> {
  return NAVIGATION;
}

// ── Page copy ───────────────────────────────────────────────────────────────
const PAGES = {
  site,
  shared,
  home,
  services: servicesPage,
  "service-detail": serviceDetailPage,
  portfolio: portfolioPage,
  about: aboutPage,
  contact: contactPage,
  legal: legalPage,
  booking: bookingPage,
} as const;

export type PageKey = keyof typeof PAGES;

export async function getPage<K extends PageKey>(key: K): Promise<(typeof PAGES)[K]> {
  return PAGES[key];
}

export type SiteContent = typeof site;
export type SharedContent = typeof shared;
export type HomeContent = typeof home;
export type ServicesPageContent = typeof servicesPage;
export type ServiceDetailContent = typeof serviceDetailPage;
export type PortfolioPageContent = typeof portfolioPage;
export type AboutPageContent = typeof aboutPage;
export type ContactPageContent = typeof contactPage;
export type LegalPageContent = typeof legalPage;
export type BookingPageContent = typeof bookingPage;

/**
 * The hero's three rooms, with each room's label read off the service it shows
 * rather than authored a second time beside it.
 */
export async function getHeroRooms(): Promise<HeroRoomContent[]> {
  return home.hero.rooms.map((room) => ({
    ...room,
    label: SERVICES_BY_ID.get(room.serviceId)?.singular ?? "",
  }));
}
