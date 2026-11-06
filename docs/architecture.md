# Enzo Interiors Platform — Architecture Document

**Prepared for:** NPATEL GROUP LTD
**Client:** Enzo Interiors (Bespoke Interior Design & Fitted Furniture, Leicester, UK)
**Source documents:** TRD v3.1, PRD v2.1, App Flow v4, Backend Schema v2.0, Storage Schema v1.0, UI/UX Brief v6, Boilerplate Codebase
**Date:** July 2026
**Status:** Consolidated architecture reference — single-tenant, payments out of scope permanently

---

## 1. System Overview

The Enzo Interiors Platform is a **multi-app, single-tenant system** built exclusively for Enzo Interiors (bespoke interior design & fitted furniture, Leicester). It is split into four independently deployable applications rather than one monolith, so public marketing traffic and authenticated portal traffic scale and deploy separately.

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
```

Permanent scope exclusions: no payment gateway (Stripe/PayPal/other) at any phase — invoices are tracked and marked "Paid" manually by Admin; and no multi-tenancy — no `tenant_id` field exists or is planned anywhere in the schema.

---

## 2. High-Level Architecture Diagram

```
                          ┌────────────────────────┐
                          │   Cloudflare Tunnel     │
                          │ (secure public exposure)│
                          └───────────┬─────────────┘
                                      │
        ┌─────────────────┬──────────┴───────────┬──────────────────┐
        │                  │                      │                  │
   apps/web           apps/admin              apps/portal        (future apps)
 Next.js SSR/SEO    React/Vite SPA (PWA)    React/Vite SPA (PWA)
 Public marketing    Staff/Admin CRM          Client self-service
        │                  │                      │
        └─────────┬────────┴───────────┬──────────┘
                   │                    │
                   ▼                    ▼
            ┌────────────────────────────────┐
            │        apps/api (NestJS)        │
            │  Business logic, RBAC Guards,   │
            │  Auth, WebSocket Gateway         │
            └───────┬───────────────┬──────────┘
                     │               │
                     ▼               ▼
           ┌──────────────┐   ┌──────────────────┐
           │ PostgreSQL 16 │   │ S3-compatible     │
           │ (Prisma ORM)  │   │ storage (MinIO/S3)│
           └──────────────┘   └──────────────────┘

  Self-hosted on Proxmox host → Coolify (Docker orchestration/PaaS)
  Monitoring: Uptime Kuma + Proxmox dashboard | Errors: GlitchTip
```

---

## 3. Subsystem: Public-Facing Frontend (`apps/web`)

| Aspect | Detail |
|---|---|
| Framework | Next.js (App Router) + TypeScript + Tailwind CSS |
| Rendering | SSR/SSG/ISR — chosen specifically for SEO and fast first-load on marketing pages (Services, Portfolio, Service Detail) |
| Pages | Homepage, Services, Service Detail (Kitchens/Bedrooms/Media Walls/Wardrobes), Portfolio (filterable masonry gallery + lightbox), About, Contact, Booking wizard (5 steps), 404 |
| Key feature | Quote Calculator — simple/average estimate calling `POST /quotes/estimate`, must respond <200ms |
| Lead capture | "Get a Free Quote" modal, Contact form, Booking wizard — all write to backend (`contact_submissions`, `bookings`, `quotes`) |
| PWA | Not required — SEO/discovery is the priority, not installability |
| Brand | Forest green (#1C4A3A) primary, cream backgrounds, Cormorant Garamond (headings) / Inter (body) per PRD; UI/UX Brief v6 defines stricter token set (green-900 #173C30, Inter-only, no serif, no pill buttons) for the newer authenticated UI direction |

---

## 4. Subsystem: Admin / Staff Portal (`apps/admin`)

| Aspect | Detail |
|---|---|
| Framework | React + TypeScript (Vite) or Next.js CSR mode + Tailwind, reusing `packages/ui` |
| Rendering | Client-side rendered SPA — authenticated, never indexed, no SEO need |
| PWA | Required — installable manifest, service worker (Workbox), standalone display, offline shell fallback, Web Push notifications |
| Core modules | Dashboard (bento: bookings, active projects, enquiries, invoices, messages, chart), Clients (CRM table + detail view), Bookings & Availability, Projects (5-stage Kanban: Consultation→Design→Approval→Installation→Completed), Invoices (builder, manual mark-paid), Messages (inbox + saved reply templates), Content Manager (testimonials/portfolio/contact submissions), Settings (business profile, team roles, audit log) |
| Navigation | Persistent sidebar (Dashboard, Clients, Bookings, Projects, Invoices, Messages, Content, Settings) |
| RBAC | Full access for Admin (Founder); Designer/Installer scoped to assigned projects/clients only |
| Auth | `/auth/admin/login`, JWT-based, NestJS Guards |

---

## 5. Subsystem: Client Portal (`apps/portal`)

| Aspect | Detail |
|---|---|
| Framework | React + TypeScript (Vite) or Next.js CSR mode + Tailwind, reusing `packages/ui` |
| Rendering | Client-side rendered SPA, authenticated, no SEO need |
| PWA | Required — same manifest/service-worker/push requirements as Admin Portal |
| Core modules | Dashboard (next appointment, unread messages, documents count, invoice status, project timeline), My Projects, Project Detail (timeline, mood boards, Approve/Request Changes), Messages (real-time chat via WebSocket), Documents (filter/download), Invoices (view/status only — no in-app payment), Settings (profile, notifications, security, theme) |
| Mobile nav | Dashboard, Projects, Messages, Invoices, More |
| Critical path | Design-approval loop — "Request Changes" restarts the project stage |
| Auth | `/auth/portal/login`, JWT-based, RBAC scoped strictly to own `client_id` |

---

## 6. Subsystem: Backend API (`apps/api`)

| Aspect | Detail |
|---|---|
| Framework | NestJS + TypeScript, modular structure with Guards/Interceptors for RBAC |
| Role | Sole owner of business logic, database access, auth, and storage access — no frontend app talks to Postgres or S3 directly |
| Real-time | Socket.IO WebSocket gateway powering Messages across Admin and Portal |
| RBAC | Client (own records only) / Designer-Installer (assigned projects/clients) / Admin (full access) enforced centrally via NestJS Guards |

### 6.1 Key API Domains

| Domain | Endpoint(s) | Method | Consumed by |
|---|---|---|---|
| Auth | `/auth/portal/login`, `/auth/admin/login` | POST | portal, admin |
| Public Content | `/content/services`, `/content/portfolio`, `/content/testimonials` | GET | web |
| Quote Calculator | `/quotes/estimate` | POST | web (public, real-time <200ms) |
| Clients | `/clients`, `/clients/:id` | GET/POST/PUT/DELETE | admin |
| Invoices | `/invoices`, `/invoices/:id/mark-paid` | GET/POST/PUT | admin, portal |
| Bookings | `/bookings`, `/availability` | GET/POST | web, admin |
| Projects | `/projects/:id/stage` | PATCH | admin |
| Messages | `/conversations/:id/messages` (WebSocket) | GET/POST | admin, portal |
| Documents | `/documents/upload` | POST | admin, portal |
| Site settings (v1) | `/settings`, `/settings/opening-hours` | GET/PUT | admin (Admin only); public status and hours via `/content/site` |
| Newsletter (v1) | `/newsletter`, `/newsletter/confirm`, `/newsletter/unsubscribe` (public); `/newsletter/subscribers`, `/newsletter/campaigns` (Admin) | GET/POST/PUT/DELETE | web, admin |

**Permanently removed:** `/payments/create-intent` and any Stripe/payment-gateway route — invoice status changes exclusively via manual Admin action.

---

## 7. Subsystem: Database (PostgreSQL 16 + Prisma)

Single-tenant relational schema — no `tenants` table, no `tenant_id` column anywhere.

### 7.1 Entity-Relationship Overview

```
staff_users ──< projects
staff_users ──< clients (assigned_staff_id)
clients ──< projects, invoices, bookings, documents, conversations ──< messages
projects ──< documents, testimonials, portfolio_items
projects ──1:1── invoices (nullable)
contact_submissions ──0:1── clients (converted lead)
```

### 7.2 Core Tables

| Table | Purpose | Key fields |
|---|---|---|
| staff_users | Admin/Designer/Installer accounts | name, email, password_hash, role |
| clients | Client records + portal auth | name, email, phone, address, status, assigned_staff_id, total_spent, password_hash |
| projects | Project pipeline tracking | client_id, type, status, progress_pct, current_stage, assigned_designer_id, client_visible |
| invoices | Billing (manual status only) | number, client_id, project_id, amount, status, due_date, paid_at |
| bookings | Consultation scheduling | client_id, service_type, date_time, status |
| availability_settings | Booking slot config | day_of_week, start_time, end_time, slot_duration_mins |
| conversations / messages | Chat system | conversation_id, sender_id/type, body, attachments (jsonb), read_at |
| saved_reply_templates | Admin quick replies | staff_id (nullable = global), title, body |
| notification_preferences | Per-user notification settings | owner_id/type, email/sms/in_app enabled flags |
| documents | Client/project files | client_id, project_id, type, storage_url, client_visible |
| testimonials | Published reviews | client_name, rating, review_text, project_id, is_published |
| portfolio_items | Public gallery entries | title, category, image_urls (jsonb array), is_published |
| contact_submissions | Public lead capture | name, email, service_interest, status |
| business_settings | Global business config | business_name, vat_rate, logo_url, brand_primary_color |
| activity_logs | Audit trail | staff_id, action, target_table, target_id, details (jsonb) |
| site_settings (v1) | The one settings row | status, launch_at, notification_emails, logo/favicon ids (light + dark), opening_hours (jsonb) |
| newsletter_subscribers (v1) | Double opt-in list | email (unique), status pending/confirmed/unsubscribed, token (unique), source |
| newsletter_campaigns (v1) | HTML newsletters | subject, html (sanitised), status draft/sending/sent, recipients, sent/failed counts, cursor |

### 7.3 Data Integrity Rules
- All monetary fields use `decimal`, never `float`.
- Cascading deletes are scoped tightly: a client delete is refused while projects or invoices reference it.
- Quotes are retired: the `quotes`, `quote_line_items` and `components` tables and `invoices.quote_id` / `bookings.linked_quote_id` stay in the schema (migrations only add) but no code uses them.
- Migrations only add (tables, nullable/defaulted columns, indexes) and are never edited once run, so a rolled-back release still runs on the newer schema.

---

## 8. Subsystem: Storage / S3

| Aspect | Detail |
|---|---|
| Backend | S3-compatible object store — MinIO (self-hosted) or AWS S3 (cloud) |
| Sole accessor | `apps/api` only — no frontend ever holds storage credentials or accesses the bucket directly |
| DB reference format | S3 object key only (never full URL, never pre-signed URL); full/signed URLs built at runtime |
| Buckets | `enzo-interiors-prod`, `enzo-interiors-staging`, `enzo-interiors-dev` — never mixed |

### 8.1 Top-Level Folder Structure

```
enzo-interiors-prod/
├── documents/            # Client & project documents (contracts, plans, mood boards)
├── project-images/       # Staff-uploaded progress/installation photos
├── portfolio/            # Published portfolio gallery images (public)
├── testimonials/         # Reserved for future testimonial images
├── logo/                 # Business logo assets
├── message-attachments/  # Chat file attachments
└── temp/                 # Staging area, 24-hour TTL
```

### 8.2 Access Control & Signed URLs
- All buckets are private by default; no public read access anywhere.
- API authenticates via a dedicated IAM service account key with `PutObject`/`GetObject`/`DeleteObject`/`ListBucket` only.
- All frontend file access is via time-limited pre-signed GET URLs: 15 min (client document download), 1 hr (admin document view), 7 days (public portfolio images), 30 min (message attachment preview), 30 days (logo assets).

### 8.3 Lifecycle & Retention

| Folder | Retention |
|---|---|
| `temp/` | 24 hours, auto-delete |
| `documents/` | 7 years (UK record-keeping) |
| `project-images/` | Indefinite, manual delete only |
| `portfolio/` | Indefinite while published; 90-day archive window after deletion |
| `logo/archive/` | 90 days, auto-delete |
| `message-attachments/` | 2 years, transitions to IA storage at 6 months (GDPR minimisation) |

### 8.4 Backup Strategy
S3 versioning enabled on production bucket; daily cross-bucket/cross-region replication to `enzo-interiors-backup`; PostgreSQL `pg_dump` snapshots timestamp-aligned with storage snapshots for point-in-time recovery; weekly orphan-check script compares S3 keys against DB references before any cleanup.

---

## 9. Cross-Cutting Concerns & Other Subsystems

### 9.1 Authentication & RBAC
Separate JWT-issuing login endpoints for Admin and Client (`/auth/admin/login`, `/auth/portal/login`); role scoping enforced centrally via NestJS Guards, not hardcoded checks, across three roles: Client, Designer/Installer, Admin.

Rate limiting is layered: Cloudflare at the edge (WAF, bot fight, per-path rate rules — floods stop before the home server), then `@nestjs/throttler` in the API with counters in Redis (shared across restarts and replicas, fail-open to memory), with tighter limits on every public write and a progressive sign-in lockout. 429s carry `Retry-After` and a human message the frontends show as-is.

#### Two-step sign-in, Google sign-in and Calendar

Staff password logins return a 10-minute `challenge` instead of a session; `POST /auth/admin/verify-code` (or the `enrol/email/*` / `enrol/totp/*` steps on first sign-in) trades it for the JWT. Each user is fixed to one method, emailed code or authenticator app (secret sealed with `APP_ENCRYPTION_KEY`, 10 recovery codes), and may "remember this device" for 30 days (token in the admin's localStorage, hashed row server-side, listed at `/auth/devices`). Wrong-code and code-email limits sit on the same Redis-backed `RateLimitStore` as the sign-in lockout. Only an Admin (`POST /users/:id/reset-2fa`) or the `auth:reset-2fa` script can reset a user. `DISABLE_2FA=true` is the emergency off switch.

"Sign in with Google" (`/auth/google/*`) is optional and only for staff who linked their Google `sub` in Account; it never creates accounts and skips the second step. The studio Google Calendar (`/calendar/*`, Admin) is read through `CacheService` (Redis, memory fallback) once a minute: busy timed events block booking times, a fresh check runs for the booked day at booking time, and a Google outage fails open. Bookings create, move and delete events. The OAuth callbacks are served on a second host on the API (`auth.enzo.client.npatelgroup.ltd`) because the client's domain is on Wix. With `TRUST_CLOUDFLARE=true` the client IP comes from `CF-Connecting-IP`, so the API must have no route that bypasses Cloudflare.

### 9.2 Real-Time Messaging
A single Socket.IO WebSocket gateway inside `apps/api` powers both the Admin inbox and Client Portal chat, keyed on `conversation_id`, with attachments referencing S3 keys.

### 9.3 Progressive Web App Layer (Portal + Admin only)
Both authenticated portals ship as installable PWAs via `vite-plugin-pwa`: Web App Manifest (192px/512px/maskable icons, standalone display), Workbox service worker (stale-while-revalidate for API GETs, cache-first for static assets), offline "reconnecting" state for live data, Web Push notifications, and `autoUpdate` service-worker registration. Requires HTTPS, satisfied via Cloudflare Tunnel. The public site is explicitly excluded from PWA requirements.

### 9.4 Deployment & Hosting Architecture
Self-hosted on the founder's own Proxmox server infrastructure (zero recurring VPS cost):
1. Proxmox host runs dedicated VM(s)/LXC container(s) for this project.
2. Coolify (self-hosted PaaS) manages Docker deployments for all four apps plus PostgreSQL and MinIO as managed services.
3. Cloudflare Tunnel exposes `web`, `admin.enzointeriors.co.uk`, and `portal.enzointeriors.co.uk` securely without opening inbound router ports.
4. Uptime Kuma polls public tunnel URLs; Proxmox's native dashboard covers host-level CPU/RAM/disk monitoring.
5. GlitchTip (self-hosted, open-source Sentry alternative) provides production error tracking without a paid SaaS tool.
6. Automated PostgreSQL volume snapshots at the Proxmox level, plus periodic off-site MinIO backup.

Open infrastructure question: whether home internet has a static IP/sufficient uptime for production hosting, or whether a hybrid Proxmox (dev/staging) + small VPS (production) split is more realistic.

### 9.5 Monitoring, Error Tracking & Audit
Uptime Kuma (app-level uptime) + Proxmox dashboard (host resources) + GlitchTip (error tracking) + `activity_logs` table (staff actions: price changes, deletions, storage operations) form the full observability stack — all self-hosted, no paid SaaS dependency.

### 9.6 Design System
Two component directories rather than one shared runtime package: one exclusively for the public Frontend, one shared between Admin and Client Portal (which overlap far more in dock/sidebar nav, bento dashboards, dark mode, cards, tables). Brand tokens per UI/UX Brief v6: Inter-only typography, green-900 (#173C30) primary, 8px control corners / 12px card corners, WCAG-AA contrast, 44px minimum touch targets, no decorative gradients/pills/dots.

---

### 9.x v3.0.0 additions (migrations 21–29)

| Area | Tables | Routes / notes |
|---|---|---|
| Enquiries | `contact_submissions.source`, `.ref_no`, `enquiry_messages` | `GET /enquiries/:id`, `POST /enquiries/:id/reply` (stored on the enquiry); booking and the contact form both create an enquiry |
| Invoices | `invoice_stages`, `site_settings.bank_details` | `PUT|DELETE /invoices/:id/stages/:stageId/paid`, `GET|PUT /settings/bank-details` |
| Mail | `gmail_accounts` (sealed refresh token only) | `/mailbox/*` (own mailbox, Admin/Designer/Editor), `/mailbox/callback` on the auth host |
| Team | `project_members`, `installer_assignments` | `/projects/:id/team/*`; installer pay visible to the Admin and that installer only |
| Clients / documents | `clients.password_is_default`, `documents.category`, `documents.client_can_download`, `invoices.client_can_download`, `projects.site_address`, `site_settings.document_categories` | `POST /account/password/keep`, `GET|PUT /documents/categories`, `PATCH /documents/:id/client-download`, `PATCH /invoices/:id/client-download` |
| Team chat | `staff_threads`, `staff_messages`, `staff_thread_reads` | `/team/*`; socket event `team:message` |
| Search / live refresh | `projects.ref_no` | `GET /search`; socket event `data:changed` (payload-less) |

### 9.y Inventory (migrations 34–35, `modules/inventory`, `data/inventory-store.ts`)

| Area | Tables | Routes / notes |
|---|---|---|
| Stock | `inventory_items`, `inventory_suppliers`, `stock_movements` (append-only ledger) | `/inventory/*`, Admin only. A count change is a conditional UPDATE on the locked item row plus a ledger row in one transaction; `on_hand >= 0` is a CHECK; a loser gets 409. Weighted average cost via `Prisma.Decimal`; an issue records the average at that moment. Low stock (free ≤ reorder level) rings the Admin bell once until restocked. |
| Project stock | `project_materials`, `stock_movements.project_id`, `inventory_settings` | `/projects/:id/materials/*`: Admin sets needs and holds; installers on the project use and return; designers read without cost. Free = `on_hand − Σ reserved` (holds are not stored on the item, so deleting a project frees them). A stage listener holds the remaining need at the chosen stage and releases all at the last; `projects` imports nothing from inventory. |

Removing the feature: delete `modules/inventory`, `data/inventory-store.ts`, the admin `Inventory` page and `ProjectMaterials` card, and their one-line registrations; the tables stay (migrations only add).

## 10. Technology Stack Summary

| Layer | Technology |
|---|---|
| Public Frontend | Next.js (App Router) + TypeScript + Tailwind CSS |
| Admin Portal | React + TypeScript (Vite/Next.js CSR) + Tailwind, PWA |
| Client Portal | React + TypeScript (Vite/Next.js CSR) + Tailwind, PWA |
| Backend API | NestJS + TypeScript |
| Database | PostgreSQL 16 via Prisma ORM |
| Real-time | Socket.IO (WebSocket gateway in NestJS) |
| File Storage | S3-compatible (self-hosted MinIO or cloud AWS S3) |
| Auth | JWT + NestJS Guards, separate Admin/Client login flows |
| Payments | Not applicable — permanently out of scope |
| Deployment | Docker + Coolify (self-hosted PaaS) |
| Hosting | Self-hosted Proxmox (home server) |
| Exposure | Cloudflare Tunnel |
| Monitoring | Uptime Kuma + Proxmox dashboard |
| Error Tracking | GlitchTip |

---

## 11. Permanent Out-of-Scope Decisions

- **Payments** — no Stripe/PayPal/any gateway, ever. Invoices are informational; Admin marks Paid manually after receiving payment externally (bank transfer, card machine, etc.).
- **Multi-tenancy** — this platform serves Enzo Interiors exclusively. No `tenant_id` fields, no tenant-scoping logic, no SaaS-for-other-businesses migration path anywhere in the schema or API.
- **Native mobile apps** — mobile web only, delivered as PWA for Admin/Portal.
- **Automated 3D rendering generation** — the platform prices/schedules 3D design work, it does not generate 3D models itself.

---

*Enzo Interiors Platform — Architecture Document · NPATEL GROUP LTD · Compiled July 2026 from TRD v3.1, PRD v2.1, Backend Schema v2.0, Storage Schema v1.0, App Flow v4, UI/UX Brief v6, and the Boilerplate Codebase.*
