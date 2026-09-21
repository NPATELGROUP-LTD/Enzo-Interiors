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
└── docs/               # Architecture, PRD/TRD, implementation plan
```

Each app is **fully self-contained**: its own `package.json`, its own install,
its own types and its own design system. There is deliberately no `packages/`
layer — `apps/admin` and `apps/portal` stay visually consistent by following the
same UI/UX brief, not by importing from one another.


## Running the platform locally

There are two ways to run this, and they are designed to coexist — the ports
do not collide, so you can leave the docker stack up while you work in watch
mode against it.

### Dev — apps on the host, against your own PostgreSQL

Each app is standalone: install and run it from its own directory. Copy each
`.env.example` to the filename in brackets and fill it in first.

| # | App | Directory | Port | Env file | Start |
|---|---|---|---|---|---|
| 1 | Backend API | `apps/api` | 4000 | `.env` | `npm install && npm run db:setup && npm run dev` |
| 2 | Admin CRM | `apps/admin` | 5174 | `.env.local` | `npm install && npm run dev` |
| 3 | Client Portal | `apps/portal` | 5175 | `.env.local` | `npm install && npm run dev` |
| – | Marketing site | `apps/web` | 3000 | `.env.local` | `npm install && npm run dev` |

**Start the API first** — every other app is a thin client and shows a
connection error without it. The marketing site is the exception: it falls back
to the content committed in `apps/web/src/data` and still renders.

You need a PostgreSQL 16+ reachable at the `DATABASE_URL` in `apps/api/.env`,
with the database already created:

```bash
createdb -h 127.0.0.1 -U postgres enzo_dev
```

`npm run db:setup` then does the rest — applies the migrations, seeds the demo
CRM records, and imports the site's copy into the CMS. It is also how you reset
to a known-good state later; it is safe to re-run, and unlike the old JSON
store you do **not** need to stop the API first.

**Image uploads in dev** need object storage, and dev borrows the compose
stack's MinIO rather than running a second one:

```bash
docker compose up -d minio minio-init
```

That is the whole dependency — the rest of the stack can stay down. Dev and
pre-prod keep separate databases, so sharing the bucket costs nothing but a
few stray objects. Without it the CMS still works against every image the site
ships with in `apps/web/public`; only new uploads refuse, with a message
saying so.

### Pre-prod — the whole stack in Docker

```bash
cp .env.example .env            # fill in the secrets it asks for
docker compose up -d --build
docker compose run --rm seed    # demo CRM data + the site's copy
```

That brings up PostgreSQL, MinIO, the API, the admin portal and the public
site together, built the way they are deployed. Set the `*_PORT` values in
`.env` away from the dev ports above if you want both running at once.

`up` is finished when `docker compose ps` shows every service healthy. The
order is enforced with conditions rather than plain `depends_on`: the API
waits for a database that answers *and* for the buckets to exist, and the two
front ends wait for an API that has proved it can reach Postgres. Without
that, a fresh stack can serve a 502 or refuse the first upload with
`NoSuchBucket`, and neither looks like a race when you hit it.

`seed` is a one-shot service in the `setup` profile, so `up` never re-runs it;
re-run it yourself to reset to known-good data. It exists as a service rather
than a host command because the runtime image drops `tsx` with the dev
dependencies and the CMS import reads `apps/web/src/data`, which is not in the
API's build context — it runs the API's `build` stage with that directory
mounted read-only.

Note that `VITE_*` and `NEXT_PUBLIC_*` are inlined at build time, so the admin
and web images are specific to the URLs they were built against. Changing
`API_PUBLIC_URL`, `WEB_PUBLIC_URL` or `MEDIA_BASE_URL` needs
`docker compose build`, not just a restart.

### Demo accounts

Both login screens list these and fill the form on click.

| App | Email | Password |
|---|---|---|
| Admin CRM | `admin@enzointeriors.co.uk` | `admin123` |
| Admin CRM | `designer@enzointeriors.co.uk` | `designer123` |
| Admin CRM | `installer@enzointeriors.co.uk` | `installer123` |
| Client Portal | `sarah.jones@example.com` and 4 others | `client123` |

The two login flows are separate and non-interchangeable. See each app's README for the full list and a tour of what each account shows.

> These are demo credentials installed by `npm run seed`, which wipes every
> table before it writes. It refuses to run with `NODE_ENV=production`.
> Passwords are stored as bcrypt hashes, including these.

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

**Admin Portal (`apps/admin`)**: Dashboard, Clients (CRM), Bookings & Availability, Quotes & Pricing (builder + Component Pricing Library), Projects (5-stage Kanban: Consultation → Design → Approval → Installation → Completed), Invoices (manual mark-paid), Messages, Enquiries (contact-form submissions),
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
| Local | — | pnpm/yarn or Docker Compose against local Postgres + MinIO |
| Staging | `develop` | Proxmox VM/LXC via Coolify, `staging-*.enzointeriors.co.uk` |
| Production | `main` | Separate Coolify apps, production DB and `enzo-interiors-prod` S3 bucket |

---

© NPATEL GROUP LTD — Enzo Interiors Platform
