// 5-step consultation booking wizard (per docs/websitemap.md), ported from
// Boilerplate:src/app/components/pages/BookingPage.tsx. Deliberately outside
// the (marketing) route group: renders standalone, without the Navbar/Footer
// chrome, matching the boilerplate's own layout.
//
// This file stays a thin Server Component shell: it reads `?service=` /
// `?tier=` (the Quote-to-Booking Handoff described in
// docs/Enzo_Interiors_App_Flow_v4.md — see the quote modal's "Book a free
// consultation" CTA for the producing side) and validates them against the
// published records before handing them to the step logic in
// ./BookingWizard.tsx, which needs interactive state and so must be a Client
// Component.
//
// Both lists it validates against are the real ones. Step 1's cards used to be
// a local table of four services — ids, labels and an icon — which is the same
// four rows the services table already holds, and the tiers were a hardcoded
// Set of three names. Publishing a fifth service, or renaming a tier, would
// have silently broken the handoff.
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { BookingWizard } from "./BookingWizard";
import {
  getCompany,
  getPage,
  getServiceDetails,
  getTestimonial,
  media,
} from "@/lib/content";

// Every other route sets its own title; without this one the booking wizard
// inherited the root layout's bare "Enzo Interiors", so a tab parked
// mid-booking was indistinguishable from the homepage.
export async function generateMetadata(): Promise<Metadata> {
  const metadata = (await getPage("booking")).metadata;
  return pageMetadata({ ...metadata, path: "/booking", ogKey: "booking" });
}

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [params, content, services, company] = await Promise.all([
    searchParams,
    getPage("booking"),
    getServiceDetails(),
    getCompany(),
  ]);
  const quote = await getTestimonial(content.panel.testimonialId);

  // Step 1's cards, joined from the published services: the slug the
  // [category] route uses, the plural room name, and the icon the record
  // already names.
  const options = services.map((service) => ({
    id: service.slug,
    label: service.shortName,
    icon: service.icon,
  }));

  // The tiers a quote request can hand over are whatever the services
  // actually publish, rather than a second list of their names.
  const tiers = new Set(
    services.flatMap((service) => service.pricing.map((tier) => tier.tier)),
  );

  const serviceParam =
    typeof params.service === "string" ? params.service : undefined;
  const tierParam = typeof params.tier === "string" ? params.tier : undefined;

  const initialService =
    serviceParam && options.some((option) => option.id === serviceParam)
      ? serviceParam
      : undefined;
  const initialTier = tierParam && tiers.has(tierParam) ? tierParam : undefined;

  return (
    <BookingWizard
      initialService={initialService}
      initialTier={initialTier}
      content={content}
      services={options}
      backgroundImage={media(content.backgroundImageId)}
      quote={quote}
      logos={company.logos}
      hours={company.hours}
    />
  );
}
