# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Current Development Phase ⭐

**Primary Focus:** Public-facing Next.js frontend website (`apps/web`)
- Quote Calculator with sub-200ms response time
- Booking Wizard (5-step flow)
- Marketing pages (Home, Services, Portfolio, About, Contact)

**Architectural Note:** The repository was originally designed as a full-stack monorepo. Currently, development is focused on the public website. Other apps and packages are kept in the repo for architectural reference:
- `apps/admin/`, `apps/portal/`, `apps/api/` — Kept untouched, not actively developed
- `apps/quote-builder/` — Local-only prototype of the 3D/2D component quote builder (localStorage, no API). Never built or deployed by the root scripts; see its README
- `packages/` folder — Removed (was only used by admin/portal)

For future multi-app development, refer to the full architecture docs below.

---

## Quick Start

**Repository:** Enzo Interiors Platform — multi-app, single-tenant SPA with CRM for a bespoke interior design & fitted furniture company (Leicester, UK).

**Status:** Monorepo structure created; apps at boilerplate stage. No package managers set up yet. Documentation complete.

**Key docs:** Read `docs/architecture.md` and `docs/Implementation_Plan_Enzo_Interiors.md` before making architectural changes or adding features.

---

## Architecture Overview

The Enzo Interiors Platform is split into four independently deployable applications rather than one monolith, allowing public marketing traffic and authenticated portal traffic to scale separately:

```
enzo-interiors/
├── apps/
│   ├── web/            # Next.js (App Router) — public marketing site + Quote Calculator
│   ├── admin/          # React/Vite SPA — Admin/Staff CRM Portal (PWA)
│   ├── portal/         # React/Vite SPA — Client self-service Portal (PWA)
│   └── api/            # NestJS — sole source of business logic, DB/Auth/Storage access
├── packages/
│   ├── shared/         # TS types, Zod schemas, Prisma types, API client
│   └── ui/             # Design system components (used by admin + portal only)
└── docs/               # Architecture, PRD/TRD, implementation plan, schema docs
```

### Apps at a Glance

| App | Framework | Rendering | Auth | PWA | Purpose |
|---|---|---|---|---|---|
| `apps/web` | Next.js (App Router) | SSR/SSG | Public + optional booking capture | ✗ | Marketing site, lead gen, quote calculator |
| `apps/admin` | React + Vite | CSR SPA | `/auth/admin/login` JWT | ✓ | Staff CRM, projects, quotes, invoices |
| `apps/portal` | React + Vite | CSR SPA | `/auth/portal/login` JWT | ✓ | Client dashboard, project approval, messages |
| `apps/api` | NestJS | N/A | JWT + RBAC Guards | N/A | RBAC-enforced API; no frontend accesses DB/S3 directly |

---

## Data Model

**Database:** PostgreSQL 16 via Prisma ORM.  
**Storage:** S3-compatible (MinIO or AWS S3); `apps/api` is sole accessor.  
**Key tables:** `staff_users`, `clients`, `projects`, `components`, `quotes`, `quote_line_items`, `invoices`, `bookings`, `availability_settings`, `conversations`/`messages`, `documents`, `portfolio_items`, `contact_submissions`, `activity_logs`.

**Critical rule:** `quote_line_items.unit_price` is a point-in-time snapshot — price changes never retroactively alter historical quotes.

For the full schema, see `docs/Enzo_Interiors_Backend_Schema_v2.0.md`.

---

## Tech Stack & Commands

**Note:** The project is at boilerplate stage. The following assumes pnpm monorepo setup is complete. Once package.json files are added to each app/package, these commands will work:

### Install & Setup
```bash
# Install all workspace dependencies
pnpm install

# Reinstall clean (including lock file)
pnpm install --force
```

### Development
```bash
# Run all apps in dev mode (watch, hot-reload)
pnpm dev

# Run a specific app
pnpm --filter=web dev
pnpm --filter=admin dev
pnpm --filter=portal dev
pnpm --filter=api dev

# Generate Prisma client after schema changes
pnpm --filter=api prisma generate
pnpm --filter=api prisma migrate dev --name <migration_name>
```

### Building
```bash
# Build all apps
pnpm build

# Build a specific app
pnpm --filter=web build
pnpm --filter=api build
```

### Type Checking & Linting
```bash
# TypeScript check across all workspaces
pnpm typecheck

# ESLint check
pnpm lint

# Fix ESLint issues
pnpm lint:fix
```

### Testing (once test suites are set up)
```bash
# Run all tests
pnpm test

# Run tests for a specific app
pnpm --filter=api test
pnpm --filter=api test:e2e

# Run tests in watch mode
pnpm test:watch
```

### Deployment
```bash
# Start production build
pnpm --filter=web start
pnpm --filter=admin start
pnpm --filter=portal start
pnpm --filter=api start
```

---

## Architecture Decisions & Constraints

### Permanent Out-of-Scope

These are final product decisions, not temporary shortcuts:

1. **No Payment Gateway** — Stripe/PayPal/etc. never included. Admin marks invoices "Paid" manually after receiving payment externally (bank transfer, card, etc.).
2. **Single-Tenant Only** — This platform serves Enzo Interiors exclusively. No `tenant_id` fields, no tenant-scoping logic, no multi-SaaS path anywhere.
3. **No Native Mobile Apps** — Mobile web only, via PWA (installable manifest + service worker).
4. **No AI-Generated/Photorealistic 3D Rendering** — The platform never generates photorealistic renders or AI-modeled 3D scenes of a client's actual room. It DOES support a catalog-based 3D/2D quote builder: admin-authored component models (built from simple box/panel definitions in the admin panel) and material boards, assembled by the client via drag-and-drop for a clearly-labeled *estimate* — not a real design/rendering deliverable. Prototyped in `apps/quote-builder`.

### Key Architectural Patterns

- **API-First:** All business logic lives in `apps/api` (NestJS). Frontends are thin consumers.
- **RBAC via Guards:** Authentication and role-scoping (Client / Designer-Installer / Admin) enforced centrally via NestJS Guards, not scattered checks.
- **Separate Login Flows:** `/auth/admin/login` for staff, `/auth/portal/login` for clients — different JWT issuers, different roles.
- **S3 as Sole Storage:** Frontends never hold storage credentials. API builds signed URLs at runtime.
- **PWA for Admin/Portal Only:** Public site is never indexed and has no PWA requirements. Admin + Portal both ship installable Web App Manifest + Workbox service worker.
- **Design System Split:** Public site uses its own component directory. Admin + Portal share `packages/ui` (more overlap in dashboards, sidebars, etc.).

---

## File Organization

### docs/
- `architecture.md` — Read first: system design, app boundaries, deployment topology, subsystem overview.
- `Implementation_Plan_Enzo_Interiors.md` — Branching strategy, implementation phases, delivery checklist.
- `Enzo_Interiors_PRD_v2.1.md` — Product requirements, personas, feature scope.
- `Enzo_Interiors_TRD_v3.1.md` — Technical requirements, stack details, PWA/RBAC/real-time specs.
- `Enzo_Interiors_Backend_Schema_v2.0.md` — PostgreSQL/Prisma schema, entity relationships, data integrity rules.
- `Enzo_Interiors_Storage_Schema_v1.md` — S3 bucket structure, folder layout, signed URL TTLs, retention policies.
- `Enzo_Interiors_UI_UX_Brief_v6.md` — Design tokens, brand colors, typography, component specs, accessibility.
- `Enzo_Interiors_App_Flow_v4.md` — End-to-end user flows (e.g. quote → booking → project → approval).
- `websitemap.md` — All routes for web, admin, portal.
- `Boilerplate Codebase.md` — Packed repo snapshot (reference only; don't edit).

### apps/web/
Next.js marketing site. Pages: Homepage, Services, Service Detail, Portfolio (gallery), About, Contact, Booking Wizard (5 steps), 404. Quote Calculator (must respond <200ms) calls `/quotes/estimate` on the API.

### apps/admin/
React/Vite admin CRM. Modules: Dashboard, Clients, Bookings & Availability, Quotes & Pricing, Projects (5-stage Kanban: Consultation → Design → Approval → Installation → Completed), Invoices, Messages, Content Manager, Settings. RBAC: Admin (full), Designer/Installer (assigned projects only).

### apps/portal/
React/Vite client portal. Modules: Dashboard, My Projects (with approval workflow), My Quotes, Messages (WebSocket real-time), Documents, Invoices (view-only), Settings. RBAC: Client (own records only).

### apps/api/
NestJS backend. All CRUD, auth (JWT + RBAC Guards), WebSocket gateway (messages), S3 signed URL generation. No frontend talks to DB or S3 directly.

### packages/shared/
TS types, Zod schemas, Prisma types (generated from `apps/api`), API client library.

### packages/ui/
Design system components (buttons, forms, cards, tables, dialogs, etc.). Used by admin + portal only. Public site has its own components. Token set per `docs/Enzo_Interiors_UI_UX_Brief_v6.md`: Inter font only, green-900 (#173C30) primary, 8px control corners, 12px card corners, WCAG-AA contrast.

---

## RBAC & Authentication

**Roles:** Client, Designer-Installer, Admin.

**Auth Flows:**
- **Admin Login** → `POST /auth/admin/login` → JWT → Admin Portal access
- **Client Login** → `POST /auth/portal/login` → JWT → Client Portal access

**Scope Enforcement:**
- Clients see only their own records (projects, quotes, invoices, messages).
- Designer/Installer see assigned projects/clients only.
- Admin sees all records.

All endpoints use NestJS Guards to enforce role + resource ownership. Never hardcode access checks in handlers; always use Guards.

---

## Development Workflow

### Creating a Feature

1. **Branch from `develop`** (or `main` if hotfix):  
   ```bash
   git checkout develop
   git pull
   git checkout -b feature/your-feature-name
   ```

2. **Implement across app layers:**
   - Update `docs/Enzo_Interiors_Backend_Schema_v2.0.md` if schema changes.
   - Implement API endpoint in `apps/api`, add RBAC Guard.
   - Implement UI in relevant app(s) (web, admin, portal, or shared in packages/ui).
   - Add types to `packages/shared`.

3. **Test locally:**
   - Type-check: `pnpm typecheck`
   - Lint: `pnpm lint`
   - Run unit/e2e tests if available.
   - Manual test the feature in browser/app.

4. **Commit with clear message:**
   ```bash
   git add .
   git commit -m "Add [feature]: Brief description"
   ```

5. **Push and open PR to `develop`:**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **PR merge to `develop` → staging deploy** → QA → **PR merge to `main` → production deploy**

---

## Critical Do's and Don'ts

### Do's
- ✅ Keep business logic in `apps/api` only.
- ✅ Use NestJS Guards for all auth/RBAC checks.
- ✅ Store all monetary values as `decimal`, never `float`.
- ✅ Build S3 signed URLs at runtime in the API; never return unsigned URLs or pre-signed URLs to cache.
- ✅ Reference S3 objects by key only in the database; never store full URLs or credentials.
- ✅ Use Prisma types from `packages/shared` for frontend code.
- ✅ Update documentation (especially `docs/architecture.md` or the schema) when making structural changes.
- ✅ Test RBAC with multiple roles (verify Designer/Installer cannot see other team members' assigned projects).

### Don'ts
- ❌ Never add a payment gateway, even as optional/experimental.
- ❌ Never add `tenant_id` fields or tenant-scoping logic.
- ❌ Never let frontends access PostgreSQL or S3 directly.
- ❌ Never hardcode RBAC checks in handlers; always use Guards.
- ❌ Never cache S3 signed URLs; always generate at runtime.
- ❌ Never use `float` for monetary fields.
- ❌ Don't break the single-app-per-deployment boundary (e.g. don't tightly couple admin + portal).

---

## Deployment & Environments

**Branching & Deploy Strategy:**
- `main` ← production (always deployable).
- `develop` ← staging (integration branch).
- `feature/*` ← short-lived branches off `develop`.
- `hotfix/*` ← urgent fixes off `main`, merged back to both `main` and `develop`.

**Infrastructure:**
- **Self-hosted:** Proxmox (home server) + Coolify (Docker PaaS).
- **Exposure:** Cloudflare Tunnel (no inbound router ports).
- **Monitoring:** Uptime Kuma (app uptime), Proxmox dashboard (host resources), GlitchTip (errors).
- **Database:** PostgreSQL 16 snapshots + off-site MinIO backup.

See `docs/Implementation_Plan_Enzo_Interiors.md` for full deployment & QA checklists.

---

## Where to Find Things

| Question | Location |
|---|---|
| What's the API contract? | `docs/Enzo_Interiors_TRD_v3.1.md` (API table) or `apps/api` (NestJS module/controller) |
| How should the Quote Calculator work? | `docs/Enzo_Interiors_App_Flow_v4.md` + `apps/api` `/quotes/estimate` endpoint |
| What routes exist? | `docs/websitemap.md` |
| What's the database schema? | `docs/Enzo_Interiors_Backend_Schema_v2.0.md` or `apps/api/prisma/schema.prisma` |
| Where do S3 files live? | `docs/Enzo_Interiors_Storage_Schema_v1.md` (folder layout) |
| Design tokens & component specs? | `docs/Enzo_Interiors_UI_UX_Brief_v6.md` |
| How do users move through the platform? | `docs/Enzo_Interiors_App_Flow_v4.md` (user journeys) |
| Branching & delivery checklist? | `docs/Implementation_Plan_Enzo_Interiors.md` |

---

## Setup Checklist (First-Time Development)

Before starting feature work, ensure:

- [ ] Clone repo: `git clone ...`
- [ ] Install pnpm (or use `npm install -g pnpm`).
- [ ] Install workspace dependencies: `pnpm install`
- [ ] Set up `.env.local` in each app with:
  - API base URL
  - S3 credentials (if local MinIO) / bucket names
  - JWT secret (if working on auth)
  - Any external service keys
- [ ] Start PostgreSQL (local Docker or your setup).
- [ ] Seed database if needed: `pnpm --filter=api prisma db seed`
- [ ] Start dev server: `pnpm dev`
- [ ] Verify each app loads without errors.

---

## References

- **Read first:** `docs/architecture.md`
- **Product vision:** `docs/Enzo_Interiors_PRD_v2.1.md`
- **Implementation roadmap:** `docs/Implementation_Plan_Enzo_Interiors.md`
- **API & tech specs:** `docs/Enzo_Interiors_TRD_v3.1.md`
- **Brand & design system:** `docs/Enzo_Interiors_UI_UX_Brief_v6.md`

---

**Last updated:** August 2026 | **Project Status:** Boilerplate, docs complete, apps ready for implementation.
