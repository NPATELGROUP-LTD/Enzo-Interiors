# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Homeowners in Leicester & Leicestershire planning a fitted room (kitchen, bedroom, wardrobes, media wall), usually arriving from Instagram or word of mouth.
- Trade: builders, developers and landlords commissioning fitted furniture across several properties. Copy speaks to both (confirmed).

## Product Purpose

Enzo Interiors designs and handcrafts bespoke fitted furniture in Leicester. The public site turns interest into a conversation: a booked free home consultation, a call, an email, or an Instagram follow. Success is a booked consultation.

## Positioning

A local workshop that measures, draws and builds in-house: one studio from survey to fitting, not a showroom reselling units.

## Operating Context

- Consultations are free home visits, booked through the site's booking flow (service → day → time → details), with availability set in the admin.
- Studio hours live on the company record; calls outside hours are by appointment.
- Before launch every address shows the coming-soon page, with a countdown to the launch date set in the admin.

## Capabilities and Constraints

- Services: Kitchens, Bedrooms, Wardrobes, Media Walls (the published services records).
- Content comes from the CMS (admin) with JSON seeds in `apps/web/src/data`.
- Next.js web app, NestJS API, Postgres, MinIO; deployed on Coolify behind a Cloudflare Tunnel.

## Brand Commitments

- Name: Enzo Interiors. Logos `logo-forest` (on light) and `logo-white` (on dark).
- Contact: phone 07777 333052, hello@enzointeriors.co.uk, Instagram @enzo.interiors. No Facebook presence on the site.
- British English, plain and direct voice.

## Evidence on Hand

- Portfolio photography and testimonials in `apps/web/src/data` (portfolio.json, testimonials.json, media.json).
- No published prices, awards or client counts; none may be invented.

## Product Principles

- Every page leaves the visitor a way to reach the studio today.
- Show the work, not claims about it.
- One studio, one voice: the same facts stated once, from the company record.
