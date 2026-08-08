# Implementation Plan – Enzo Interiors Platform

Prepared for: **NPATEL GROUP LTD**  
Project: **Enzo Interiors Platform (Web + Client Portal + Admin CRM)**

---

## 1. Repository & Branch Strategy

### 1.1 Monorepo Layout

The platform lives in a single monorepo, structured as: [file:1][file:3]

```txt
enzo-interiors/
├── apps/
│   ├── web/      # Next.js (App Router) — public marketing site
│   ├── admin/    # Staff/Admin Portal (CRM)
│   ├── portal/   # Client Portal
│   └── api/      # NestJS backend API
├── packages/
│   ├── shared/   # Shared TS types, Zod schemas, Prisma types, API client
│   └── ui/       # Shared design system components (Admin + Portal)
└── docs/         # Architecture, PRD/TRD, this implementation plan
```

### 1.2 Branch Types

Define the following branch types:

- `main`
  - Always deployable.
  - Mirrors **production** environment (Proxmox + Coolify, Cloudflare Tunnel exposure). [file:1][file:3]
- `develop`
  - Integration branch for features.
  - Mirrors **staging** environment.
- `feature/*`
  - Short‑lived branches for implementation of specific tasks.
- `hotfix/*`
  - Urgent fixes branched from `main` and merged back into both `main` and `develop`.

### 1.3 Branch Naming & Usage

**Naming examples:**

- `feature/web-nextjs-routing`
- `feature/api-auth-and-rbac`
- `feature/admin-quotes-module`
- `feature/portal-messages-websocket`
- `hotfix/api-invoice-status-bug`

**Rules:**

- New work:
  - Branch from `develop` into `feature/*`.
  - Raise PR from `feature/*` → `develop` when done.
- Releases:
  - After staging verification, raise PR from `develop` → `main`.
- Hotfixes:
  - Branch `hotfix/*` from `main`.
  - Merge `hotfix/*` back into `main` and `develop` after verification.

---

## 2. High‑Level Implementation Phases

### 2.1 Phase 0 – Design System & Shared Types

**Goal:** Finalize UI building blocks and domain types before deep backend integration. [file:3][file:4][file:5]

#### Scope

- **Design system (`packages/ui`):**
  - Buttons, cards, tables, modals, dock/sidebar navigation, dark mode, toast styles (Sonner). [file:4]
  - Separate visual language for public site vs Admin/Portal, per UI/UX Brief v6. [file:1][file:2]

- **Shared types (`packages/shared`):**
  - Core entities: `Client`, `StaffUser`, `Project`, `Quote`, `QuoteLineItem`, `Component`, `Invoice`, `Booking`, `Conversation`, `Message`, `Document`, `Testimonial`, `PortfolioItem`, `ContactSubmission`, `BusinessSettings`, `ActivityLog`. [file:1][file:2][file:3]

#### Branches

- `feature/design-system-core`
- `feature/shared-types-core`

#### AI Agent Usage

- Generate strongly‑typed React components (props, accessibility).
- Create TS interfaces matching PRD/TRD and backend schema docs. [file:1][file:2][file:3]

---

### 2.2 Phase 1 – Backend API & Database (`apps/api`)

**Goal:** Stand up NestJS API + PostgreSQL + Prisma as the single source of truth. [file:1][file:3]

#### 2.2.1 Set Up NestJS API

- Create modules:
  - `AuthModule`, `ClientsModule`, `ProjectsModule`, `QuotesModule`, `ComponentsModule`, `InvoicesModule`, `BookingsModule`, `MessagesModule`, `DocumentsModule`, `ContentModule`. [file:1][file:3]
- Implement controllers/services with DTOs aligned to shared types.

#### 2.2.2 Define Prisma Schema

- Implement tables as per architecture: [file:1][file:3]

```txt
staff_users
clients
projects
components
quotes
quote_line_items
invoices
bookings
conversations
messages
documents
testimonials
portfolio_items
contact_submissions
business_settings
activity_logs
```

- Enforce **single‑tenant** design (no `tenant_id`, no `tenants` table). [file:1][file:2][file:3]
- Integrity rules:
  - `decimal` for monetary fields.
  - Snapshot `unit_price` on `quote_line_items` to protect historical quotes. [file:1]

#### 2.2.3 Implement Core Endpoints

From TRD v3.1 and architecture: [file:1][file:3]

- Auth:
  - `POST /auth/admin/login`
  - `POST /auth/portal/login`
- Public content:
  - `GET /content/services`
  - `GET /content/portfolio`
  - `GET /content/testimonials`
- Quotes:
  - `POST /quotes` (create),
  - `GET /quotes`,
  - `POST /quotes/estimate` (simple/average calculator, <200ms) [file:1][file:2][file:3]
  - `POST /quotes/:id/convert-to-invoice`
- Components:
  - `GET/POST/PUT/DELETE /components`
- Invoices:
  - `GET/POST/PUT /invoices`
  - `PUT /invoices/:id/mark-paid` (manual status only, no payments). [file:1][file:2][file:3]
- Bookings:
  - `GET/POST /bookings`
  - `GET /availability`
- Projects:
  - `PATCH /projects/:id/stage`
- Messages:
  - WebSocket gateway: `/conversations/:id/messages` (Socket.IO). [file:1][file:3]
- Documents:
  - `POST /documents/upload` (S3 key reference only). [file:1]

#### 2.2.4 RBAC Guards

Implement NestJS Guards for: [file:3]

- **Client** – limited to own `client_id` records.
- **Designer/Installer** – limited to assigned projects/clients.
- **Admin** – full access, including pricing and mark‑paid actions.

#### Branches

- `feature/api-bootstrap`
- `feature/api-auth-and-rbac`
- `feature/api-quotes-and-components`
- `feature/api-invoices-and-bookings`
- `feature/api-messages-and-documents`

#### AI Agent Usage

- Scaffold Nest modules, controllers, DTOs, and Prisma models directly from TRD. [file:3]
- Generate Jest unit tests for guards and multi‑step flows (quote → invoice → booking).

---

### 2.3 Phase 2 – Public Web App (`apps/web` – Next.js)

**Goal:** Replace mock data with real API integration while preserving SSR/SEO. [file:1][file:2][file:5]

#### 2.3.1 Routes & Layout

Implement Next.js App Router pages: [file:5]

- `/` – Homepage
- `/services`
- `/services/[category]` – Kitchens / Bedrooms / Media Walls / Wardrobes
- `/portfolio`
- `/about`
- `/contact`
- `/booking`
- `*` – 404

Reuse Navbar/Footer and hero/sections already defined in the boilerplate: [file:4][file:5]

#### 2.3.2 Connect Public Content API

- Use `GET /content/services`, `/content/portfolio`, `/content/testimonials` to populate: [file:1][file:3][file:5]
  - Services page & Service Detail.
  - Portfolio gallery & project detail lightbox.
  - Testimonials on homepage.

#### 2.3.3 Implement Quote Calculator

- On Service Detail pages, use `POST /quotes/estimate` to compute instant estimates:
  - Inputs: service type, tier (Essential/Premium/Luxury), room size, etc. [file:2][file:5]
  - Show range with sub‑200ms response requirement. [file:2][file:3]

#### 2.3.4 Booking Wizard Integration

- 5‑step flow: [file:2][file:5]
  1. Service selection (prefill from accepted quote if present).
  2. Date picker (using `/availability`).
  3. Time slot selection.
  4. Contact details (write to `clients` + `bookings` as needed).
  5. Confirmation screen.

#### Branches

- `feature/web-nextjs-migration` (if starting from Vite SPA)
- `feature/web-api-integration`
- `feature/web-quote-calculator`
- `feature/web-booking-wizard`

#### AI Agent Usage

- Convert React Router pages (`HomePage`, `ServicesPage`, etc.) to Next.js App Router. [file:4]
- Generate typed hooks for calling shared API client from `packages/shared`.

---

### 2.4 Phase 3 – Admin Portal (`apps/admin`)

**Goal:** Deliver fully functional PWA CRM connected to the API. [file:1][file:2][file:3][file:5]

#### 2.4.1 Auth & Layout

- Wire `AdminLogin` to `POST /auth/admin/login`. [file:4][file:5]
- Implement auth context + route protection for `AdminLayout` and child routes.

#### 2.4.2 Clients & Client Detail

- Replace `mockData.ts` clients with API‑backed table (`/clients`). [file:4][file:5]
- Implement Client Detail tabs:
  - Overview, Projects, Invoices, Documents, Notes, Activity Log. [file:5]

#### 2.4.3 Bookings & Availability

- Connect admin calendar to `/bookings` and `/availability`. [file:5]
- Implement controls for working hours and slot duration settings.

#### 2.4.4 Quotes & Pricing

- Use `/components` for Component Pricing Library CRUD. [file:2][file:3][file:5]
- Build quote UI backed by `/quotes`:
  - Simple and detailed (line‑item with components).
  - Send quote, track status (Draft, Sent, Accepted, Expired).
  - Convert accepted quotes via `/quotes/:id/convert-to-invoice`. [file:2][file:3]

#### 2.4.5 Projects Kanban

- Use `/projects` and `PATCH /projects/:id/stage` for 5‑stage Kanban:
  - Consultation → Design → Approval → Installation → Completed. [file:1][file:5]

#### 2.4.6 Invoices

- Connect invoice builder and list to `/invoices`. [file:1][file:2][file:3]
- Ensure status changes only via `mark-paid` endpoint (manual, no gateway). [file:1][file:2][file:3]

#### 2.4.7 Messages & Content Manager

- Wire `AdminMessages` to WebSocket messages gateway (`/conversations/:id/messages`). [file:1][file:3][file:5]
- Content Manager:
  - Testimonials, portfolio items, contact submissions via respective endpoints. [file:1][file:5]

#### 2.4.8 PWA Layer

- Add PWA support (installable, offline shell, push notifications): [file:3]
  - Web App Manifest (icons, name, short_name, start_url, display: `standalone`).
  - Service worker via `vite-plugin-pwa` or equivalent.
  - Offline fallback + “reconnecting” state for live data.

#### Branches

- `feature/admin-auth-and-layout`
- `feature/admin-clients-crud`
- `feature/admin-bookings`
- `feature/admin-quotes-pricing`
- `feature/admin-projects-kanban`
- `feature/admin-invoices`
- `feature/admin-messages`
- `feature/admin-content-manager`
- `feature/admin-pwa`

#### AI Agent Usage

- Generate React Query hooks per module (clients, bookings, quotes, invoices).
- Scaffold Workbox caching strategies and install/offline flows.

---

### 2.5 Phase 4 – Client Portal (`apps/portal`)

**Goal:** Deliver the client‑facing PWA connected to API, with messaging and document access. [file:1][file:2][file:3][file:5]

#### 2.5.1 Auth & Layout

- Wire `PortalLogin` to `POST /auth/portal/login`. [file:4][file:5]
- Protect `PortalLayout` routes:
  - Dashboard, Projects, Messages, Documents, Invoices, Settings. [file:5]

#### 2.5.2 Dashboard

- Fetch dashboard metrics:
  - Next upcoming appointment (from `/bookings`).
  - Unread messages count (messages).
  - Documents count (documents).
  - Invoice status summary.
  - Project timeline widget. [file:2][file:5]

#### 2.5.3 My Projects & Project Detail

- Connect list/cards to `/projects` scoped to the client. [file:1][file:5]
- Project Detail tabs:
  - Timeline, Mood boards, Design approval (Approve/Request Changes), Documents, Messages. [file:2][file:5]
- Write approval requests back to projects and messages.

#### 2.5.4 My Quotes & Invoices

- Link My Quotes to `/quotes` (client‑scoped). [file:2][file:5]
  - Accept/decline/request revision.
  - Reflect accepted quotes in `/invoices` (Portal Invoices page).
- Invoices page:
  - Summary stats (Paid, Outstanding, Next Due).
  - Table view; no in‑app payments, only status visibility. [file:2][file:5]

#### 2.5.5 Messages

- Wire `PortalMessages` to WebSocket gateway, same as Admin. [file:1][file:3][file:5]
- Attachments referencing S3 keys for document previews. [file:1]

#### 2.5.6 Documents & Settings

- Documents page:
  - Use document endpoints and pre‑signed URLs for downloads. [file:1]
- Settings:
  - Profile updates, notification preferences, security (password/sessions), light/dark mode toggle. [file:2][file:5]

#### 2.5.7 PWA Layer

- PWA requirements mirror Admin Portal: [file:3]
  - Manifest, service worker, offline shell, push notifications.
  - HTTPS via Cloudflare Tunnel for installability. [file:1][file:3]

#### Branches

- `feature/portal-auth-and-layout`
- `feature/portal-dashboard`
- `feature/portal-projects-and-approval`
- `feature/portal-quotes-and-invoices`
- `feature/portal-messages`
- `feature/portal-documents`
- `feature/portal-settings`
- `feature/portal-pwa`

#### AI Agent Usage

- Generate WebSocket client and reconnection logic.
- Implement optimistic UI for approval and messages.

---

## 3. AI Agents – Usage Guidelines

### 3.1 Code Generation & Refactors

- Use AI agents to:
  - Scaffold NestJS modules, controllers, DTOs, and unit tests from TRD sections. [file:3]
  - Migrate existing Vite SPA routes into Next.js App Router pages. [file:4][file:5]
  - Extract reusable hooks (`useNotifications`, `usePageTitle`, etc.) into `packages/shared`. [file:4]

### 3.2 Testing & Quality

- Ask agents to generate:
  - Jest/Vitest unit tests for:
    - Auth flows.
    - RBAC guards.
    - Quote→Invoice→Booking flows. [file:1][file:3]
  - Cypress/Playwright end‑to‑end tests for:
    - Booking wizard.
    - Simple/Average quote calculator.
    - Portal/Admin PWA install + offline behavior.

### 3.3 DevOps & Automation

- Use agents to help you:
  - Generate Dockerfiles for each app (web/admin/portal/api) and compose stacks for dev. [file:1][file:3]
  - Create GitHub Actions:
    - Lint + test on PR.
    - Build and push container images.
    - Trigger Coolify deploys to staging (`develop`) and production (`main`). [file:1][file:3]

---

## 4. Environments, Testing & Deployment

### 4.1 Environments

- **Local Development**
  - Run apps via pnpm/yarn and/or Docker Compose, pointing to local Postgres + MinIO.
- **Staging (`develop`)**
  - Deploy to Proxmox VM/LXC via Coolify.
  - Use staging subdomains (e.g., `staging-admin.enzointeriors.co.uk`, `staging-portal.enzointeriors.co.uk`) via Cloudflare Tunnel. [file:1][file:3]
- **Production (`main`)**
  - Separate Coolify apps using production DB and S3 bucket (`enzo-interiors-prod`). [file:1]

### 4.2 Testing Levels

- **Unit tests**
  - NestJS services, Prisma models, React hooks.
- **Integration tests**
  - API workflows: e.g., quote acceptance → invoice creation → booking linkage. [file:1][file:3]
- **End‑to‑end tests**
  - Key flows:
    - Marketing site: quote calculator, booking wizard. [file:2][file:5]
    - Portal: login, dashboard, project approval loop, messages, documents.
    - Admin: Kanban moves, quote/invoice lifecycle, content manager.

### 4.3 Release Flow

1. Implement in `feature/*` branch (from `develop`).
2. PR to `develop`:
   - CI: lint, unit tests, integration tests, core e2e.
3. On merge into `develop`, Coolify deploys staging automatically.
4. Manual QA on staging (you + client).
5. When approved, PR `develop` → `main`.
6. On merge into `main`, Coolify deploys production.

---

## 5. Power‑Efficient Infrastructure Notes

- Host on Proxmox using resource‑limited containers/VMs:
  - Constrain CPU/RAM for each app to avoid over‑provisioning. [file:1][file:3]
- Consolidate:
  - Postgres + MinIO on shared host where feasible to reduce overhead. [file:1]
- Backups & lifecycle:
  - Nightly DB snapshots when load is low. [file:1][file:3]
  - S3 lifecycle rules:
    - `temp/` 24h TTL.
    - Long‑term retention only where required (documents 7 years, etc.). [file:1]

---

## 6. Implementation Checklist (Condensed)

- **Phase 0**
  - [ ] Finalize Admin/Portal design system in `packages/ui`.
  - [ ] Create shared TS types in `packages/shared`.

- **Phase 1 – API & DB**
  - [ ] Set up NestJS app modules and Prisma schema.
  - [ ] Implement Auth, Clients, Projects, Quotes, Components, Invoices, Bookings, Messages, Documents, Content endpoints.
  - [ ] Add RBAC guards for Client / Staff / Admin roles.

- **Phase 2 – Web (Next.js)**
  - [ ] Implement all routes with SSR/SEO.
  - [ ] Integrate public content endpoints.
  - [ ] Build Quote Calculator using `/quotes/estimate`.
  - [ ] Wire Booking wizard to `/bookings` + `/availability`.

- **Phase 3 – Admin Portal**
  - [ ] Wire login + protected routes.
  - [ ] Implement Clients, Bookings, Quotes & Pricing, Projects, Invoices, Messages, Content Manager.
  - [ ] Enable PWA (manifest + service worker).

- **Phase 4 – Client Portal**
  - [ ] Wire login + protected routes.
  - [ ] Implement Dashboard, Projects, Quotes, Messages, Documents, Invoices, Settings.
  - [ ] Enable PWA (manifest + service worker).

- **DevOps**
  - [ ] Add Dockerfiles and Coolify apps for all services.
  - [ ] Configure staging/production environments.
  - [ ] Set up CI/CD with tests + deploy triggers.
