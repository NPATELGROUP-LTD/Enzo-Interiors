# Enzo Interiors Platform

Web app with CRM and 2D/3D modeling system for **Enzo Interiors** — a Leicester, UK bespoke interior design and fitted furniture company specialising in Kitchens, Bedrooms, Media Walls, and Wardrobes.

Built by [NPATEL GROUP LTD](https://github.com/NPATELGROUP-LTD) as a single-tenant platform exclusively for Enzo Interiors.

## Overview

The platform is split into four independently deployable applications rather than one monolith, so public marketing traffic and authenticated portal traffic scale and deploy separately:

- **Marketing website** — attracts and converts new leads, with an instant Quote Calculator.
- **Client Portal** — clients track projects, approve designs, view invoices/documents, and message the Enzo team.
- **Admin Portal (CRM)** — internal staff tool for managing clients, bookings, projects, quotes, invoicing, pricing, and content.
- **Backend API** — sole owner of business logic, database access, auth, and file storage.

Payments and multi-tenancy are **permanently out of scope**: invoices are tracked and marked "Paid" manually by Admin, and the system will never serve any business other than Enzo Interiors.

## Repository Structure

```
enzo-interiors/
├── apps/
│   ├── web/            # Next.js (App Router) — public marketing site
│   ├── admin/          # Staff/Admin Portal (CRM), React/Vite SPA
│   ├── portal/         # Client Portal, React/Vite SPA
│   └── api/            # NestJS backend API (single source of business logic)
├── packages/
│   ├── shared/         # Shared TS types, Zod schemas, Prisma types, API client
│   └── ui/             # Shared design system components
└── docs/                # Architecture, PRD/TRD, implementation plan
```

## Tech Stack

| Layer | Technology |
|---|---|
| Public Frontend (`apps/web`) | Next.js (App Router) + TypeScript + Tailwind CSS — SSR/SEO |
| Admin Portal (`apps/admin`) | React + TypeScript (Vite) + Tailwind — PWA |
| Client Portal (`apps/portal`) | React + TypeScript (Vite) + Tailwind — PWA |
| Backend API (`apps/api`) | NestJS + TypeScript |
| Database | PostgreSQL 16 via Prisma ORM |
| Real-time | Socket.IO (WebSocket gateway in NestJS) |
| File Storage | S3-compatible (self-hosted MinIO or cloud AWS S3) |
| Auth | JWT + NestJS Guards, separate Admin/Client login flows |
| Deployment | Docker + Coolify (self-hosted PaaS) |
| Hosting | Self-hosted Proxmox, exposed via Cloudflare Tunnel |
| Monitoring | Uptime Kuma + Proxmox dashboard |
| Error Tracking | GlitchTip |

## Core Modules

**Marketing site (`apps/web`)**: Homepage, Services, Service Detail (per category with Quote Calculator), Portfolio (filterable gallery), About, Contact, 5-step Booking wizard, 404.

**Admin Portal (`apps/admin`)**: Dashboard, Clients (CRM), Bookings & Availability, Quotes & Pricing (builder + Component Pricing Library), Projects (5-stage Kanban: Consultation → Design → Approval → Installation → Completed), Invoices (manual mark-paid), Messages, Content Manager, Settings.

**Client Portal (`apps/portal`)**: Dashboard, My Projects (with design approval workflow), My Quotes, Messages (real-time chat), Documents, Invoices (view/status only), Settings.

**Backend API (`apps/api`)**: Auth, Public Content, Quote Calculator (`/quotes/estimate`, <200ms), Clients, Quotes, Components, Invoices, Bookings, Projects, Messages (WebSocket), Documents — all RBAC-enforced (Client / Designer-Installer / Admin).

## Data Model

Single-tenant PostgreSQL schema (no `tenant_id` anywhere) with core tables: `staff_users`, `clients`, `projects`, `components`, `quotes`, `quote_line_items`, `invoices`, `bookings`, `availability_settings`, `conversations`/`messages`, `saved_reply_templates`, `notification_preferences`, `documents`, `testimonials`, `portfolio_items`, `contact_submissions`, `business_settings`, `activity_logs`. All monetary fields use `decimal`; `quote_line_items.unit_price` is a point-in-time snapshot so price changes never retroactively alter historical quotes.

## Branching Strategy

- `main` — always deployable, mirrors **production**.
- `develop` — integration branch, mirrors **staging**.
- `feature/*` — short-lived branches for specific tasks, branched from `develop`.
- `hotfix/*` — urgent fixes branched from `main`, merged back into both `main` and `develop`.

Release flow: `feature/*` → PR → `develop` (staging deploy via Coolify) → QA → PR → `main` (production deploy via Coolify).

## Environments

| Environment | Branch | Notes |
|---|---|---|
| Local | — | pnpm/yarn or Docker Compose against local Postgres + MinIO |
| Staging | `develop` | Proxmox VM/LXC via Coolify, `staging-*.enzointeriors.co.uk` |
| Production | `main` | Separate Coolify apps, production DB and `enzo-interiors-prod` S3 bucket |

---

© NPATEL GROUP LTD — Enzo Interiors Platform
