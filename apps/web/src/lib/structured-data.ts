import type { Company, FAQEntry, ServiceDetail } from "@/lib/content/types";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

/**
 * schema.org descriptions of the business and its pages, for rich results in
 * Google and for AI assistants that read structured data before prose.
 */

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const clock = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** The local business, with opening hours, service area and profiles. */
export function businessLd(company: Company, logo: string): Record<string, unknown> {
  const hours = Object.entries(company.hours.weekly).flatMap(([day, windows]) =>
    windows.map((window) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: DAYS[Number(day)],
      opens: clock(window.open),
      closes: clock(window.close),
    })),
  );
  const profiles = company.socials.map((row) => row.href).filter((href) => href.startsWith("https://"));

  return {
    "@context": "https://schema.org",
    "@type": "HomeAndConstructionBusiness",
    "@id": `${SITE_URL}/#business`,
    name: company.name,
    description: company.description,
    url: SITE_URL,
    telephone: company.phone.href.replace(/^tel:/, ""),
    email: company.email,
    ...(logo ? { logo, image: logo } : {}),
    address: {
      "@type": "PostalAddress",
      ...(company.address.street ? { streetAddress: company.address.street } : {}),
      ...(company.address.postcode ? { postalCode: company.address.postcode } : {}),
      addressLocality: company.city,
      addressRegion: company.county,
      addressCountry: "GB",
    },
    areaServed: [
      { "@type": "City", name: company.city },
      { "@type": "AdministrativeArea", name: company.county },
    ],
    hasMap: company.map.linkUrl,
    openingHoursSpecification: hours,
    ...(profiles.length ? { sameAs: profiles } : {}),
  };
}

export function websiteLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: "en-GB",
    publisher: { "@id": `${SITE_URL}/#business` },
  };
}

export function serviceLd(service: ServiceDetail): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.title,
    description: service.heroDesc,
    serviceType: service.shortName,
    url: `${SITE_URL}/services/${service.slug}`,
    provider: { "@id": `${SITE_URL}/#business` },
    areaServed: { "@type": "AdministrativeArea", name: "Leicestershire" },
  };
}

export function breadcrumbLd(trail: Array<[name: string, path: string]>): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map(([name, path], index) => ({
      "@type": "ListItem",
      position: index + 1,
      name,
      item: `${SITE_URL}${path}`,
    })),
  };
}

export function faqLd(faqs: FAQEntry[]): Record<string, unknown> | null {
  if (!faqs.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}
