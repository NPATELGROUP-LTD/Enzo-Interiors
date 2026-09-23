# Enzo Interiors Platform

Web app with CRM and 2D/3D modeling system for **Enzo Interiors** — a Leicester, UK bespoke interior design and fitted furniture company specialising in Kitchens, Bedrooms, Media Walls, and Wardrobes.

Built by [NPATEL GROUP LTD](https://github.com/NPATELGROUP-LTD) as a single-tenant platform exclusively for Enzo Interiors.

## Overview

The platform is split into four independently deployable applications rather than one monolith, so public marketing traffic and authenticated portal traffic scale and deploy separately:

- **Marketing website** — attracts and converts new leads, with an instant Quote Calculator.
- **Client Portal** — clients track projects, approve designs, view invoices/documents, and message the Enzo team.
- **Admin Portal (CRM)** — internal staff tool for managing clients, bookings, projects, quotes, invoicing, pricing, and content.
- **Backend API** — sole owner of business logic, database access, auth, and file storage.

> **v1 ships three of the four:** the public site, the API, and the admin
> (CMS, site settings and account screens). The CRM screens and modules and the client
> portal are still in the repository with their database tables intact, but
> are not routed or mounted — see `apps/api/src/app.module.ts` and
> `apps/admin/src/App.tsx` to bring them back.

Payments and multi-tenancy are **permanently out of scope**: invoices are tracked and marked "Paid" manually by Admin, and the system will never serve any business other than Enzo Interiors.

## Repository Structure

```
enzo-interiors/
├── apps/
│   ├── web/            # Next.js (App Router) — public marketing site
│   ├── admin/          # Staff/Admin Portal (CRM), React/Vite SPA
│   ├── portal/         # Client Portal, React/Vite SPA
│   └── api/            # NestJS backend API (single source of business logic)
└── docs/               # Architecture, PRD/TRD, implementation plan
```

Each app is **fully self-contained**: its own `package.json`, its own install,
its own types and its own design system. There is deliberately no `packages/`
layer — `apps/admin` and `apps/portal` stay visually consistent by following the
same UI/UX brief, not by importing from one another.


## Running the platform locally

PostgreSQL and MinIO **only ever run in Docker**, from `docker-compose.yml`.
There is no host database to install. Everything else can run either way.

### 1. The whole stack in Docker

```bash
cp .env.example .env            # fill in the secrets it asks for
docker compose up -d --build --wait
docker compose run --rm seed    # the site's copy, imported into the CMS
```

That brings up PostgreSQL, MinIO, the API, the admin (CMS) and the public site,
built exactly the way they are deployed. `--wait` returns once every service
is healthy. The API applies database migrations itself on every start.

The first admin account is created by the API on its first boot into an empty
database, from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env`. It never overwrites
an existing account. Sign in, then use the account menu's **Change password**.

`seed` is a one-shot service in the `setup` profile, so `up` never re-runs it.
It is safe to re-run on a live site: the import only adds entries that are
missing and never overwrites an edit.

`VITE_*` and `NEXT_PUBLIC_*` are inlined at build time, so the admin and web
images are specific to the URLs they were built against. Changing
`API_PUBLIC_URL`, `WEB_PUBLIC_URL` or `MEDIA_BASE_URL` needs
`docker compose build`, not just a restart.

**Starting again from nothing** (deletes the database and every upload):

```bash
docker compose down --volumes
```

### 2. Dev: apps on the host, database and storage in Docker

```bash
docker compose up -d --wait postgres minio minio-init
```

Then each app from its own directory. Copy its `.env.example` to the file in
brackets first, pointing `DATABASE_URL` and the `S3_*` values at the
containers above.

| App | Directory | Port | Env file | Start |
|---|---|---|---|---|
| Backend API | `apps/api` | 4000 | `.env` | `npm ci && npm run db:setup && npm run dev` |
| Admin (CMS) | `apps/admin` | 5174 | `.env.local` | `npm ci && npm run dev` |
| Public site | `apps/web` | 3000 | `.env.local` | `npm ci && npm run dev` |

Start the API first. The admin is a thin client and shows a connection error
without it. The public site falls back to the content committed in
`apps/web/src/data` and still renders.

`npm run db:setup` applies the migrations and imports the site's copy into the
CMS. It is safe to re-run.

The docker stack's app containers can run at the same time as these dev
servers if their `*_PORT` values in `.env` are moved off 3000, 4000 and 5174.
Both then share the one database and bucket.

`npm run seed` in `apps/api` installs demo CRM records for the CRM screens that
return after v1. It **wipes every table first**, including the CMS, and
refuses to run with `NODE_ENV=production`.

### Deploying

The same compose file is the production recipe (Coolify on the Proxmox host).
Point the Cloudflare Tunnel's hostnames at `web:3000`, `admin:80`, `api:4000`
and `minio:9000`. Set `MEDIA_BASE_URL` to the public media hostname plus the
bucket name, e.g. `https://media.enzointeriors.co.uk/enzo-public`. Upload URLs
are signed for that host, because the editor's browser sends the file straight
to it.

The startup order is enforced with health conditions, not bare `depends_on`.
The API waits for a database that answers *and* for the buckets to exist. The
two front ends wait for an API that has proved it can reach Postgres.

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

**Admin Portal (`apps/admin`)** — the Enzo Interiors admin, laid out as a
Mac-style app window. In v1 it runs the website: the CMS, Settings (site
live / coming soon with a launch time, where enquiries are emailed, preview),
search (Ctrl/⌘ K) and password reset by email. **CMS** in the menu bar drops down every page and
every kind of shared content; clicking it opens an overview of all of them.
Pages are edited section by section in the order a visitor sees them; the
content several pages share (**Services, Recent work, Testimonials, Team,
FAQs, Menu, Company**) each has its own place. Edits save as a draft; Publish puts them live and
refreshes the site within seconds. The full CRM, when it returns: Dashboard, Clients (CRM), Bookings & Availability, Quotes & Pricing (builder + Component Pricing Library), Projects (5-stage Kanban: Consultation → Design → Approval → Installation → Completed), Invoices (manual mark-paid), Messages, Enquiries (contact-form submissions),
Website (the CMS: every page, service, project, testimonial and image on the
public site, edited as a draft and published explicitly), Settings.

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
| Local | — | Docker Compose; PostgreSQL and MinIO always in containers |
| Staging | `develop` | Proxmox VM/LXC via Coolify, `staging-*.enzointeriors.co.uk` |
| Production | `main` | Separate Coolify apps, production DB and `enzo-interiors-prod` S3 bucket |

---

© NPATEL GROUP LTD — Enzo Interiors Platform
