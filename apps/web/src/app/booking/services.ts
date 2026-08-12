// Plain (non "use client") data module shared between page.tsx (Server
// Component — validates `?service=` against these ids) and BookingWizard.tsx
// (Client Component — renders Step 1's service cards). Kept separate from
// BookingWizard.tsx deliberately: a Server Component can't import plain data
// from a "use client" module (Next's react-server loader turns every export
// of a client module into an opaque client reference, so `BOOKING_SERVICES`
// would no longer be a usable array — confirmed by a 500 during manual
// verification). See ./page.tsx and ./BookingWizard.tsx.
//
// Slugs match src/lib/content/services.ts / the [category] route's
// SERVICE_SLUGS, not the boilerplate's short "kitchen"/"bedroom" ids — this
// is what makes the `?service=kitchens` prefill from a real Service Detail
// page's URL line up. Kept local to the booking feature (not imported from
// the [category] route) for the same colocation reasoning that route's
// data.ts documents: no `GET /content/*` endpoint backs this list yet.
import { ChefHat, Bed, Tv, DoorOpen } from "lucide-react";

export const BOOKING_SERVICES = [
  { id: "kitchens", label: "Kitchens", Icon: ChefHat },
  { id: "bedrooms", label: "Bedrooms", Icon: Bed },
  { id: "media-walls", label: "Media Walls", Icon: Tv },
  { id: "wardrobes", label: "Wardrobes", Icon: DoorOpen },
] as const;

export type BookingServiceId = (typeof BOOKING_SERVICES)[number]["id"];
