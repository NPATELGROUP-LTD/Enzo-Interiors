// The content layer.
//
// Every string, list and image on this site comes from the CMS in apps/admin,
// served as one published bundle by `GET /content/site`. Each record is still
// stored exactly once: a service points at a media row, a portfolio project
// points at a service, a testimonial points at the project it was written
// about, the header's service menu points at the services table. The functions
// below do those joins and hand callers flat, rendered-ready records.
//
// This file used to import the JSON tables in src/data directly. Those files
// are still here and still matter, in two ways:
//
//   1. They are the FALLBACK. If the API cannot be reached, the site renders
//      the content it shipped with rather than an error page. A marketing site
//      that goes blank because a backend is restarting is worse than one
//      showing copy that is a few edits out of date.
//   2. They are the TYPES. The page shapes below are still derived from the
//      committed JSON with `typeof`, so a component reading `content.hero.title`
//      is still checked at compile time even though the value now arrives at
//      runtime. The CMS validates that what it stores keeps that shape.
//
// Freshness: the bundle is fetched with `revalidate`, so pages are statically
// cached and re-read on a timer. Publishing in the admin calls the revalidate
// route in app/api/revalidate, which drops the cache immediately — so an edit
// is live in seconds without making every visitor wait on this API.
import { cache } from "react";

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
 * authored as a template in the CMS rather than assembled from fragments in a
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

/* -------------------------------------------------------------------------- */
/* The bundle                                                                 */
/* -------------------------------------------------------------------------- */

/** The raw tables, exactly as they are stored. Shapes come from the JSON. */
/** Whether the site is open yet. Set in the admin's Settings. */
export interface SiteStatus {
  status: "live" | "coming_soon";
  /** ISO time. Once passed, the site is live whatever `status` says. */
  launchAt: string | null;
}

/** The one rule for "is the public site open", shared by layout, robots and sitemap. */
export function isLive(site: SiteStatus, now = Date.now()): boolean {
  return site.status === "live" || (!!site.launchAt && Date.parse(site.launchAt) <= now);
}

interface Bundle {
  site: SiteStatus;
  company: typeof companyRow;
  media: MediaItem[];
  services: typeof serviceRows;
  portfolio: typeof portfolioRows;
  testimonials: typeof testimonialRows;
  team: typeof teamRows;
  faqs: typeof faqRows;
  navigation: typeof navigationRows;
  pages: {
    site: typeof site;
    shared: typeof shared;
    home: typeof home;
    services: typeof servicesPage;
    "service-detail": typeof serviceDetailPage;
    portfolio: typeof portfolioPage;
    about: typeof aboutPage;
    contact: typeof contactPage;
    legal: typeof legalPage;
    booking: typeof bookingPage;
  };
}

/**
 * Public URL of the media bucket. Every image, the shipped ones included,
 * lives there; src/data/media.json only records each one's key.
 */
export const MEDIA_BASE = (process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? "").replace(/\/+$/, "");

const shippedMedia: MediaItem[] = mediaRows.map(({ key, ...row }) => ({
  ...row,
  src: `${MEDIA_BASE}/${key}`,
}));

/** What the site ships with, and what it falls back to. */
const FALLBACK: Bundle = {
  // Live when the API cannot be reached: the shipped copy is public-ready, and
  // a site that goes dark because a backend restarted is the worse failure.
  site: { status: "live", launchAt: null },
  company: companyRow,
  media: shippedMedia,
  services: serviceRows,
  portfolio: portfolioRows,
  testimonials: testimonialRows,
  team: teamRows,
  faqs: faqRows,
  navigation: navigationRows,
  pages: {
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
  },
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

/** Seconds between unprompted re-reads. Publishing does not wait for this. */
const REVALIDATE_SECONDS = Number(process.env.CONTENT_REVALIDATE_SECONDS ?? 3600);

/**
 * A published bundle, merged over the fallback.
 *
 * Merged rather than replaced so that a collection the CMS has no published
 * rows for — a fresh database, a half-finished import — shows the shipped
 * content instead of an empty page. The site is never blank because of us.
 */
function merge(raw: Partial<Bundle> | null): Bundle {
  if (!raw) return FALLBACK;
  const nonEmpty = <T,>(value: T[] | undefined, fallback: T[]): T[] =>
    Array.isArray(value) && value.length > 0 ? value : fallback;

  return {
    site: raw.site ?? FALLBACK.site,
    company: raw.company ?? FALLBACK.company,
    media: nonEmpty(raw.media, FALLBACK.media),
    services: nonEmpty(raw.services, FALLBACK.services),
    portfolio: nonEmpty(raw.portfolio, FALLBACK.portfolio),
    testimonials: nonEmpty(raw.testimonials, FALLBACK.testimonials),
    team: nonEmpty(raw.team, FALLBACK.team),
    faqs: nonEmpty(raw.faqs, FALLBACK.faqs),
    navigation: nonEmpty(raw.navigation, FALLBACK.navigation),
    // Section by section, so a section added to src/data renders from the
    // shipped copy until the CMS has one (the import adds it on its next run).
    pages: Object.fromEntries(
      Object.entries(FALLBACK.pages).map(([key, shipped]) => [
        key,
        { ...shipped, ...(raw.pages?.[key as keyof Bundle["pages"]] ?? {}) },
      ]),
    ) as Bundle["pages"],
  };
}

/**
 * Reads the bundle and resolves it into the shapes components consume.
 *
 * `cache` dedupes this for the lifetime of one render, so a page calling
 * getPage, getCompany and getServices does the joins once, not three times.
 */
const load = cache(async (): Promise<Resolved> => {
  let raw: Partial<Bundle> | null = null;
  try {
    const response = await fetch(`${API_BASE}/content/site`, {
      next: { revalidate: REVALIDATE_SECONDS, tags: ["content"] },
    });
    if (response.ok) {
      raw = (await response.json()) as Partial<Bundle>;
    } else {
      console.warn(`[content] ${API_BASE}/content/site returned ${response.status}; using shipped content.`);
    }
  } catch (error) {
    console.warn(
      `[content] Could not reach ${API_BASE}; using shipped content.`,
      error instanceof Error ? error.message : error,
    );
  }
  return resolve(merge(raw));
});

/* -------------------------------------------------------------------------- */
/* Media                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The media lookup, kept synchronous.
 *
 * Media ids are embedded throughout the page copy — `content.hero.cta.card
 * .imageId` and so on — and are resolved inline while a component builds its
 * props, where there is nothing to await. So the map is module-level, starts
 * as the shipped media table, and is replaced the first time a bundle
 * resolves. Every caller reaches `media()` from inside a component that has
 * already awaited one of the getters below, so by then it holds CMS values;
 * before then it holds the shipped ones, which are correct for every image the
 * site was built with. Either way it never returns nothing for a known id.
 */
let MEDIA = new Map<string, MediaItem>(shippedMedia.map((row) => [row.id, row]));

/** The row for an id. Unknown ids resolve to an empty image rather than throwing:
 *  a mistyped id in the content should cost one picture, not the whole page. */
export function media(id: string | undefined | null): MediaItem {
  if (!id) return { id: "", src: "", alt: "", source: "" };
  return MEDIA.get(id) ?? { id, src: "", alt: "", source: "" };
}

export function mediaSrc(id: string | undefined | null): string {
  return media(id).src;
}

/* -------------------------------------------------------------------------- */
/* Joins                                                                      */
/* -------------------------------------------------------------------------- */

interface Resolved {
  bundle: Bundle;
  services: ServiceDetail[];
  servicesById: Map<string, ServiceDetail>;
  portfolio: PortfolioItem[];
  testimonials: Testimonial[];
  team: TeamMember[];
  company: Company;
  navigation: NavLink[];
  generalFaqs: FAQEntry[];
}

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

/** Narrows a detail record to the list shape the summary surfaces consume. */
function toService(detail: ServiceDetail): Service {
  const { id, slug, title, shortName, singular, category, icon, navSummary, description, image, imageAlt, features } = detail;
  return { id, slug, title, shortName, singular, category, icon, navSummary, description, image, imageAlt, features };
}

function resolve(bundle: Bundle): Resolved {
  // The media map has to be in place before any join reads an image off it.
  MEDIA = new Map<string, MediaItem>(
    bundle.media.map((row) => [row.id, row]),
  );

  const faqsFor = (serviceId: string | null): FAQEntry[] =>
    bundle.faqs
      .filter((row) => row.serviceId === serviceId)
      .map(({ q, a }) => ({ q, a }));

  const services: ServiceDetail[] = bundle.services.map((row) => {
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
  });
  const servicesById = new Map(services.map((service) => [service.id, service]));

  const portfolio: PortfolioItem[] = bundle.portfolio
    .filter((row) => row.isPublished)
    .map((row) => {
      const service = servicesById.get(row.serviceId);
      const images = row.imageIds.map(mediaSrc);
      return {
        id: row.id,
        serviceId: row.serviceId,
        title: row.title,
        // The discipline name lives on the service, so a project cannot
        // disagree with the service it was built under.
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
  const projectsById = new Map(portfolio.map((item) => [item.id, item]));

  const testimonials: Testimonial[] = bundle.testimonials
    .filter((row) => row.isPublished)
    .map((row) => ({
      id: row.id,
      projectId: row.projectId,
      name: row.clientName,
      // Where they live is a fact about the project, not about the review.
      role: projectsById.get(row.projectId)?.location ?? "",
      text: row.text,
      pullQuote: (row as { pullQuote?: string }).pullQuote,
      image: mediaSrc(row.imageId),
      rating: row.rating,
    }));

  const team: TeamMember[] = bundle.team.map((row) => ({
    id: row.id,
    name: row.name,
    role: row.role,
    note: row.note,
    image: mediaSrc(row.imageId),
  }));

  const hours: StudioHours = {
    weekly: Object.fromEntries(
      DAY_ORDER.map((day, index) => [
        index,
        (bundle.company.hours.weekly[day] ?? []).map<HoursWindow>((window) => ({
          open: toMinutes(window.open),
          close: toMinutes(window.close),
        })),
      ]),
    ),
    rows: bundle.company.hours.rows,
    note: bundle.company.hours.note,
    status: bundle.company.hours.status,
  };

  const company: Company = {
    name: bundle.company.name,
    description: bundle.company.description,
    city: bundle.company.city,
    county: bundle.company.county,
    region: bundle.company.region,
    phone: bundle.company.phone,
    email: bundle.company.email,
    emailHref: `mailto:${bundle.company.email}`,
    logos: {
      onLight: media(bundle.company.logos.onLight),
      onDark: media(bundle.company.logos.onDark),
    },
    socials: bundle.company.socials,
    map: bundle.company.map,
    hours,
    madeBy: bundle.company.madeBy,
    // Older CMS rows predate the address; the import adds it on its next run.
    address: bundle.company.address ?? { street: "", postcode: "" },
  };

  // The header's Services panel lists the published services rather than a
  // second hand-written copy of their names: publish a fifth service and it
  // appears.
  const navigation: NavLink[] = bundle.navigation.map((row) => {
    const { childPages, ...rest } = row as typeof row & { childPages?: string };
    return {
      ...rest,
      pages:
        childPages === "services"
          ? services.map((service) => ({
              label: service.title,
              href: `/services/${service.slug}`,
              description: service.navSummary,
            }))
          : undefined,
    };
  });

  return {
    bundle,
    services,
    servicesById,
    portfolio,
    testimonials,
    team,
    company,
    navigation,
    generalFaqs: faqsFor(null),
  };
}

/* -------------------------------------------------------------------------- */
/* Getters                                                                    */
/* -------------------------------------------------------------------------- */

export async function getServices(): Promise<Service[]> {
  return (await load()).services.map(toService);
}

export async function getServiceDetails(): Promise<ServiceDetail[]> {
  return (await load()).services;
}

export async function getService(slug: string): Promise<ServiceDetail | null> {
  return (await load()).servicesById.get(slug) ?? null;
}

/** The slugs /services/[category] is built for. */
export async function getServiceSlugs(): Promise<string[]> {
  return (await load()).services.map((service) => service.slug);
}

/** The cross-service questions — the rows with no service of their own. */
export async function getGeneralFaqs(): Promise<FAQEntry[]> {
  return (await load()).generalFaqs;
}

export async function getPortfolioItems(): Promise<PortfolioItem[]> {
  return (await load()).portfolio;
}

export async function getTestimonials(): Promise<Testimonial[]> {
  return (await load()).testimonials;
}

export async function getTestimonial(id: string): Promise<Testimonial | null> {
  return (await load()).testimonials.find((row) => row.id === id) ?? null;
}

export async function getTeam(): Promise<TeamMember[]> {
  return (await load()).team;
}

export async function getCompany(): Promise<Company> {
  return (await load()).company;
}

export async function getSiteStatus(): Promise<SiteStatus> {
  return (await load()).bundle.site;
}

export async function getNavigation(): Promise<NavLink[]> {
  return (await load()).navigation;
}

export type PageKey = keyof Bundle["pages"];

export async function getPage<K extends PageKey>(key: K): Promise<Bundle["pages"][K]> {
  return (await load()).bundle.pages[key];
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
  const { bundle, servicesById } = await load();
  return bundle.pages.home.hero.rooms.map((room) => ({
    ...room,
    label: servicesById.get(room.serviceId)?.singular ?? "",
  }));
}
