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
| Core modules | Dashboard (bento: bookings, active projects, enquiries, invoices, messages, chart), Clients (CRM table + detail view), Bookings & Availability, Quotes & Pricing (builder + Component Pricing Library), Projects (5-stage Kanban: Consultation→Design→Approval→Installation→Completed), Invoices (builder, manual mark-paid), Messages (inbox + saved reply templates), Content Manager (testimonials/portfolio/contact submissions), Settings (business profile, team roles, audit log) |
| Navigation | Persistent sidebar (Dashboard, Clients, Bookings, Quotes & Pricing, Projects, Invoices, Messages, Content, Settings) |
| RBAC | Full access for Admin (Founder); Designer/Installer scoped to assigned projects/clients only |
| Auth | `/auth/admin/login`, JWT-based, NestJS Guards |

---

## 5. Subsystem: Client Portal (`apps/portal`)

| Aspect | Detail |
|---|---|
| Framework | React + TypeScript (Vite) or Next.js CSR mode + Tailwind, reusing `packages/ui` |
| Rendering | Client-side rendered SPA, authenticated, no SEO need |
| PWA | Required — same manifest/service-worker/push requirements as Admin Portal |
| Core modules | Dashboard (next appointment, unread messages, documents count, invoice status, project timeline), My Projects, Project Detail (timeline, mood boards, Approve/Request Changes), My Quotes (accept/decline/revise), Messages (real-time chat via WebSocket), Documents (filter/download), Invoices (view/status only — no in-app payment), Settings (profile, notifications, security, theme) |
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
| Quotes | `/quotes`, `/quotes/:id/convert-to-invoice` | POST/GET | admin, portal |
| Components | `/components` | GET/POST/PUT/DELETE | admin |
| Invoices | `/invoices`, `/invoices/:id/mark-paid` | GET/POST/PUT | admin, portal |
| Bookings | `/bookings`, `/availability` | GET/POST | web, admin |
| Projects | `/projects/:id/stage` | PATCH | admin |
| Messages | `/conversations/:id/messages` (WebSocket) | GET/POST | admin, portal |
| Documents | `/documents/upload` | POST | admin, portal |

**Permanently removed:** `/payments/create-intent` and any Stripe/payment-gateway route — invoice status changes exclusively via manual Admin action.

---

## 7. Subsystem: Database (PostgreSQL 16 + Prisma)

Single-tenant relational schema — no `tenants` table, no `tenant_id` column anywhere.

### 7.1 Entity-Relationship Overview

```
staff_users ──< projects
staff_users ──< clients (assigned_staff_id)
clients ──< projects, quotes, invoices, bookings, documents, conversations ──< messages
projects ──< documents, testimonials, portfolio_items
quotes ──< quote_line_items >── components
quotes ──1:1── invoices (nullable)
projects ──1:1── invoices (nullable)
bookings ──0:1── quotes (linked_quote_id)
contact_submissions ──0:1── clients (converted lead)
```

### 7.2 Core Tables

| Table | Purpose | Key fields |
|---|---|---|
| staff_users | Admin/Designer/Installer accounts | name, email, password_hash, role |
| clients | Client records + portal auth | name, email, phone, address, status, assigned_staff_id, total_spent, password_hash |
| projects | Project pipeline tracking | client_id, type, status, progress_pct, current_stage, assigned_designer_id, client_visible |
| components | Pricing library | name, category, unit_price, is_active |
| quotes | Quote lifecycle | client_id, service_id, type (Simple/Detailed), subtotal, total, status, invoice_id |
| quote_line_items | Quote breakdown | quote_id, component_id, quantity, unit_price (snapshot), line_total |
| invoices | Billing (manual status only) | number, client_id, project_id, quote_id, amount, status, due_date, paid_at |
| bookings | Consultation scheduling | client_id, service_type, date_time, status, linked_quote_id |
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

### 7.3 Data Integrity Rules
- All monetary fields use `decimal`, never `float`.
- `quote_line_items.unit_price` is a point-in-time snapshot so later price changes never retroactively alter historical quotes.
- Cascading deletes are scoped tightly (e.g. deleting a quote cascades to its line items only, never to clients/invoices/components).

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
