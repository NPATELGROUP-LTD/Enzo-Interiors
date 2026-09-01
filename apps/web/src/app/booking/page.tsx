// 5-step consultation booking wizard (per docs/websitemap.md), ported from
// Boilerplate:src/app/components/pages/BookingPage.tsx. Deliberately outside
// the (marketing) route group: renders standalone, without the Navbar/Footer
// chrome, matching the boilerplate's own layout.
//
// This file stays a thin Server Component shell: it reads `?service=` /
// `?tier=` (the Quote-to-Booking Handoff described in
// docs/Enzo_Interiors_App_Flow_v4.md — see
// src/components/services/QuoteModal.tsx's "Book a free consultation" CTA
// for the producing side) and
// validates them against known values before handing them to the actual
// step logic in ./BookingWizard.tsx, which needs interactive state and so
// must be a Client Component.
import { BookingWizard } from "./BookingWizard";
import { BOOKING_SERVICES, type BookingServiceId } from "./services";

// Mirrors the tier labels used by src/lib/content/services.ts's
// `pricing[].tier` values (Essential / Premium / Luxury) — kept local since
// nothing beyond display formatting needs the full pricing data here.
const VALID_TIERS = new Set(["Essential", "Premium", "Luxury"]);

function isBookingServiceId(value: string): value is BookingServiceId {
  return BOOKING_SERVICES.some((s) => s.id === value);
}

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;

  const serviceParam =
    typeof params.service === "string" ? params.service : undefined;
  const tierParam = typeof params.tier === "string" ? params.tier : undefined;

  const initialService =
    serviceParam && isBookingServiceId(serviceParam)
      ? serviceParam
      : undefined;
  const initialTier =
    tierParam && VALID_TIERS.has(tierParam) ? tierParam : undefined;

  return (
    <BookingWizard initialService={initialService} initialTier={initialTier} />
  );
}
