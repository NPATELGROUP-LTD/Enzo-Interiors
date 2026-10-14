# apps/web — Public Marketing Site

Next.js (App Router) application serving the public-facing Enzo Interiors marketing website.

## Purpose

Attracts and converts prospective clients through SEO-optimized, server-rendered pages. It also hosts the public Quote Calculator and Booking wizard.

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- SSR/SSG/ISR for SEO and fast page loads

## Routes

| Route | Description |
|---|---|
| `/` | Homepage, services, portfolio preview, testimonials and booking CTA |
| `/services` | Services overview |
| `/services/:category` | Kitchen, Bedroom, Media Wall or Wardrobe detail page with Quote Calculator |
| `/portfolio` | Filterable masonry gallery and project lightbox |
| `/about` | Founder, team, timeline and company values |
| `/contact` | Contact form, map and WhatsApp CTA |
| `/booking` | Five-step consultation booking wizard |
| `*` | Branded 404 page |

## API Integration

Consumes public content and booking endpoints from `apps/api`, including `GET /content/services`, `GET /content/portfolio`, `GET /content/testimonials`, `POST /quotes/estimate`, and booking endpoints.

The app must not access PostgreSQL or object storage directly.

## Notes

- This app is not a PWA; SEO and public discovery are the priority.
- Quote estimates should return in under 200ms.
