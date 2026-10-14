# Technical Requirements Document (TRD): Enzo Interiors Platform

**Prepared for:** NPATEL GROUP LTD
**Client:** Enzo Interiors (Bespoke Interior Design & Fitted Furniture, Leicester, UK)
**Document Version:** 3.1 (Multi-App Architecture — Next.js Frontend — Payments removed, Single-Tenant confirmed)
**Date:** July 2026
**Source:** Enzo Interiors PRD v2.1, existing boilerplate codebase, and prior architecture/stack discussions in this Space

---

## 1. Purpose & Scope
This TRD defines the engineering plan for the Enzo Interiors Platform, restructured as four separate, independently deployable applications rather than a single monolithic SPA: a public **Frontend**, a **Backend API**, a **Staff/Admin Portal**, and a **Client Portal**. This reflects the architecture direction agreed earlier in this project — splitting concerns for cleaner deployment, independent scaling, and role isolation between public marketing traffic and authenticated portal traffic.

**Update (v3.1):** Real payment processing (Stripe) is confirmed **out of scope permanently** — invoices are tracked and marked Paid manually by Admin, with no payment gateway integration planned now or later. Multi-tenancy is also confirmed **out of scope permanently** — this platform is single-tenant, built exclusively for Enzo Interiors, with no reserved multi-tenant fields or future migration path required.

## 2. Repository & App Structure
A monorepo is recommended to share types and UI primitives across apps while keeping each deployable independently.

```
enzo-interiors/
├── apps/
│   ├── web/            # Next.js (App Router) — public marketing site
│   ├── admin/          # Staff/Admin Portal (CRM)
│   ├── portal/         # Client Portal
│   └── api/            # NestJS backend API
├── packages/
│   ├── shared/         # Shared TS types, Zod schemas, API client
│   └── ui/             # Shared design system components (buttons, cards, theme)
```

- **apps/web**: Public marketing site (Home, Services, Portfolio, About, Contact, Booking, Quote Calculator landing) — built in Next.js specifically for **SSR and SEO**, as previously agreed, since these are the pages that need to rank in search and load fast for first-time visitors [cite:5].
- **apps/admin**: Staff/Admin Portal (CRM) — Kanban projects, clients, quotes, invoices, bookings, messages, content manager. Client-side rendered SPA is acceptable here since it's authenticated and not indexed.
- **apps/portal**: Client Portal — dashboard, projects, quotes, messages, documents, invoices (view/status only). Also authenticated, no SEO requirement.
- **apps/api**: Backend API (NestJS) — all business logic, database access, auth, RBAC guards, and integrations (storage, WebSocket messaging), consumed by all three frontend apps [cite:8].

## 3. Technology Stack (Consolidated)

| Layer | Technology | Purpose |
|---|---|---|
| Public Frontend | Next.js (App Router) + TypeScript + Tailwind CSS | SSR/SEO for marketing site, fast first-load for prospects [cite:8] |
| Admin Portal | React + TypeScript (Vite) or Next.js CSR mode + Tailwind | Internal CRM, no SEO needed, reuses shared UI package |
| Client Portal | React + TypeScript (Vite) or Next.js CSR mode + Tailwind | Authenticated client-facing app, reuses shared UI package |
| Backend API | NestJS + TypeScript | Modular API with Guards/Interceptors for RBAC, houses all business logic [cite:7] |
| Database | PostgreSQL 16 | Relational integrity for quotes → invoices → bookings linkage, audit logs [cite:7] |
| ORM | Prisma | Type-safe schema shared with `packages/shared` |
| Auth | JWT-based, NestJS Guards | Separate login flows for Admin and Client, RBAC per role [cite:5] |
| Real-time | WebSocket (Socket.IO) via NestJS gateway | Powers Messages module across Portal and Admin |
| File Storage | S3-compatible bucket (self-hosted MinIO or cloud) | Documents, mood boards, quote PDFs |
| Payments | **Not applicable — removed from scope.** Invoices are tracked and marked Paid manually by Admin only; no payment gateway is integrated now or planned for the future. |
| Deployment/Orchestration | Docker + Coolify | Self-hosted PaaS layer for managing all four apps as containers [cite:9] |
| Hosting | Self-hosted on local Proxmox server | Founder's own infrastructure, zero recurring VPS cost [cite:6][cite:9] |
| Exposure | Cloudflare Tunnel | Secure public exposure of self-hosted apps without opening router ports [cite:9] |
| Monitoring | Uptime Kuma + Proxmox host dashboard | Application-level uptime checks + host-level CPU/RAM/disk monitoring [cite:9] |
| Error Tracking | GlitchTip (self-hosted, open-source Sentry alternative) | Production error visibility without a paid SaaS tool [cite:7] |

## 4. Why Next.js for the Public Frontend Specifically
Splitting the public site into its own Next.js app (rather than folding it into the authenticated portals) was agreed earlier specifically because SSR gives search engines fully rendered HTML for Services, Portfolio, and Service Detail pages, and improves Core Web Vitals for image-heavy pages like the portfolio gallery [cite:5][cite:8]. The Admin and Client Portals don't carry this requirement since they sit behind login and are never indexed, so they can remain client-rendered SPAs sharing the existing component logic already built in the boilerplate (dock navigation, bento dashboards, dark/light theme).

## 5. Data Model & Database Schema
Owned entirely by `apps/api` and shared via Prisma types in `packages/shared`. **This platform is single-tenant** — there is no `tenants` table and no `tenant_id` column anywhere in the schema, since Enzo Interiors is the only business this system will ever serve:

| Table | Key Fields | Relationships |
|---|---|---|
| clients | name, email, phone, address, status, assigned_staff_id, joined_date, total_spent, notes | has many projects, quotes, invoices, bookings, messages, documents |
| projects | client_id, name, type, status, progress_pct, current_stage | belongs to client; has many documents, messages, images |
| quotes | client_id, service_id, type (simple/detailed), design_fee, subtotal, total, status, invoice_id (nullable) | belongs to client; has many quote_line_items |
| quote_line_items | quote_id, component_id, quantity, unit_price, line_total | belongs to quote and component |
| components | name, category, unit_price, description, is_active | referenced by quote_line_items |
| invoices | number, client_id, project_id, quote_id (nullable), amount, vat_rate, status, due_date, paid_at | belongs to client, optionally project/quote; status updated manually by Admin |
| bookings | client_id, service_type, date_time, status, linked_quote_id (nullable) | belongs to client |
| messages | sender_id, conversation_id, body, attachments, timestamp, read_at | belongs to conversation |
| documents | name, type, size, upload_date, client_visible (bool), storage_url | belongs to client/project |
| testimonials | client_name, rating, review_text, project_id, is_published | optionally linked to project |
| staff_users | name, email, role (Admin/Designer/Installer), password_hash | assigned to projects/clients |

## 6. API Design (apps/api, consumed by all three frontends)

| Domain | Endpoint | Method | Consumed By |
|---|---|---|---|
| Auth | /auth/portal/login, /auth/admin/login | POST | portal, admin |
| Public Content | /content/services, /content/portfolio, /content/testimonials | GET | web |
| Quote Calculator | /quotes/estimate | POST | web (public, real-time <200ms) |
| Clients | /clients, /clients/:id | GET/POST/PUT/DELETE | admin |
| Quotes | /quotes, /quotes/:id/convert-to-invoice | POST/GET | admin, portal |
| Components | /components | GET/POST/PUT/DELETE | admin |
| Invoices | /invoices, /invoices/:id/mark-paid | GET/POST/PUT | admin, portal |
| Bookings | /bookings, /availability | GET/POST | web, admin |
| Projects | /projects/:id/stage | PATCH | admin |
| Messages | /conversations/:id/messages (WebSocket) | GET/POST | admin, portal |
| Documents | /documents/upload | POST | admin, portal |

**Removed in v3.1:** `/payments/create-intent` — no payment gateway integration exists or is planned; invoice status is updated only via `/invoices/:id/mark-paid`, triggered manually by Admin.

## 7. RBAC Model
Role-based access control enforced centrally in `apps/api` via NestJS Guards, previously agreed as a core requirement rather than hardcoded role checks [cite:8]:

- **Client**: scoped to own client_id records only (projects, quotes, invoices, messages, documents).
- **Designer/Installer (Staff)**: scoped to assigned projects/clients; can update project stages, upload files, respond to messages.
- **Admin (Founder)**: full access, including Component Pricing Library edits, staff management, invoice mark-paid actions, and audit log visibility.

## 8. Deployment Architecture (Self-Hosted on Proxmox)
Reflecting the self-hosting decision made earlier in this Space [cite:6][cite:9]:

1. **Proxmox host**: runs one or more VMs/LXC containers dedicated to this project, isolated from other workloads on the same hardware.
2. **Coolify**: self-hosted PaaS layer inside the VM, managing Docker deployments for all four apps (`web`, `admin`, `portal`, `api`) plus PostgreSQL and MinIO as managed services within Coolify.
3. **Cloudflare Tunnel**: exposes `web` (public), `admin.enzointeriors.co.uk`, and `portal.enzointeriors.co.uk` securely without opening inbound ports on the home network.
4. **Monitoring**: Uptime Kuma polling the public Cloudflare Tunnel URLs for uptime alerts identical to what a real client would notice, paired with Proxmox's native host-level resource dashboard [cite:9].
5. **Backups**: automated PostgreSQL volume snapshots at the Proxmox level, plus periodic off-site backup of the MinIO document bucket.

Open infrastructure question carried over from earlier discussion: whether the home internet connection has a static IP and sufficient uptime/bandwidth for production client-facing hosting, or whether a hybrid setup (Proxmox for dev/staging, small VPS for production) is more realistic [cite:9].

## 9. Non-Functional Requirements
- **Performance**: quote calculator (`/quotes/estimate`) must respond in under 200ms; Next.js `web` app uses ISR/SSG for portfolio and service pages to minimize server load.
- **Security**: RBAC enforced at API Guard level; documents/invoices/quotes encrypted at rest; audit log for admin price changes and destructive actions.
- **Accessibility**: WCAG-AA contrast across both themes; keyboard-navigable modals and quote builder controls.
- **Reliability**: DB transactions around multi-step flows (quote acceptance → invoice creation); confirmation dialogs before destructive deletes.
- **Scalability**: this platform is designed exclusively for Enzo Interiors' own operational scale (single business, single set of staff/clients). No multi-tenant architecture, reserved tenant fields, or SaaS-for-other-businesses migration path is planned — this is a permanent, deliberate scope decision, not a phased one.

## 10. Open Technical Decisions
- Whether `admin` and `portal` apps stay as Vite SPAs or also migrate to Next.js CSR-mode for shared tooling consistency with `web`.
- MinIO (self-hosted) vs a cloud S3 provider for document storage, weighed against Proxmox server storage capacity.
- Static IP / bandwidth confirmation for home hosting vs hybrid Proxmox+VPS split [cite:9].
- Pricing formula rules for the Component Library (fixed vs £/m² size-dependent) — pending client sign-off.
- Final choice on Coolify-managed Postgres vs a dedicated database VM if traffic grows (single-tenant scaling only — not related to multi-tenancy).

---

## 11. Progressive Web App (PWA) Requirements — Client Portal & Admin Portal

Both the Client Portal (`apps/portal`) and Staff/Admin Portal (`apps/admin`) must be delivered as installable, app-like Progressive Web Apps, so users experience them like a native mobile app rather than a browser tab, especially on smaller/mobile layouts.

### 11.1 Why PWA (not React Native)
Since both portals already exist as React SPAs sharing a design system (`packages/ui`) with the mobile-responsive bento dashboards, dock navigation, and bottom sheet components already built in the boilerplate, a PWA layer adds native-like install/offline behavior without a separate React Native codebase or app-store submission overhead — a good fit for a solo-founder build that needs to ship fast [web:21].

### 11.2 Core PWA Requirements
| Requirement | Detail |
|---|---|
| Installability | Both portals must be installable to home screen/desktop via a complete Web App Manifest (name, short_name, icons at 192px/512px/maskable, start_url, display: standalone, theme_color, background_color) [web:16][web:14] |
| Service Worker | Registered on both apps to enable offline caching of shell/static assets and graceful offline fallback screens, using Workbox strategies (e.g., stale-while-revalidate for API GETs, cache-first for static assets) [web:24][web:19] |
| Standalone Display | `display: standalone` (or `fullscreen`) in the manifest removes browser chrome so the portal looks and feels like a native app when launched from the home screen [web:20] |
| App-like Navigation | Retain the existing bottom dock (Portal) and sidebar (Admin) as persistent app-shell navigation, matching native tab-bar conventions on mobile widths [file:2] |
| Offline Handling | Core shell (nav, layout, cached last-seen dashboard data) loads offline; live data (messages, invoices) shows a clear "offline — reconnecting" state rather than breaking |
| Push Notifications | Web Push API integrated with the existing notification system (unread messages, invoice due, appointment reminders) already scaffolded via `useNotifications` hook, extended to trigger real OS-level push on mobile/desktop [web:17] |
| Responsive/Adaptive Layout | All portal screens (Dashboard, Projects, Messages, Documents, Invoices, Settings for Client; Dashboard, Clients, Bookings, Quotes, Projects Kanban, Invoices, Messages for Admin) must adapt cleanly across Desktop 1440px, Tablet 768px, and Mobile 375px breakpoints already defined in the PRD, with mobile treated as a first-class app experience, not a shrunk desktop view [file:1] |
| HTTPS Requirement | PWA installability requires apps served over HTTPS (or localhost in dev) — satisfied via the Cloudflare Tunnel exposure already planned for `portal.enzointeriors.co.uk` and `admin.enzointeriors.co.uk` [web:16][cite:9] |
| App Icons & Splash | Branded icons and splash screens generated per platform (iOS apple-touch-icon, Android maskable icons, Windows tile) using the existing Enzo forest-green/cream brand palette |

### 11.3 Implementation Approach
- Add `vite-plugin-pwa` to both `apps/portal` and `apps/admin` build configs (both remain Vite-based React SPAs per Section 3), auto-generating the manifest and service worker on build [web:11][web:19].
- Use Workbox's `generateSW` or `injectManifest` mode depending on how much custom caching logic (e.g., prioritizing fresh invoice/quote data) is needed beyond the defaults.
- Cache-bust and auto-update service workers on new deployments (`registerType: 'autoUpdate'`) so clients/staff always get the latest CRM logic without manual reinstalls [web:15].
- Mobile-first QA pass on both portals specifically testing: install prompt behavior (Android "Add to Home Screen", iOS Safari "Add to Home Screen" limitations), offline fallback screens, and touch-target sizing across the dock/sidebar navigation.
- Lighthouse PWA audit run against both `portal` and `admin` builds as a CI gate before each release, checking manifest completeness, service worker registration, and installability criteria [web:14][web:22].

### 11.4 Notes & Constraints
- iOS Safari has more limited PWA support than Android/Chrome (no full Web Push support until recent iOS versions, manual "Add to Home Screen" only) — this should be flagged to the client as a platform limitation, not a bug, when demoing on iPhone [web:20].
- The public marketing site (`apps/web`, Next.js) does **not** need PWA treatment — installability and offline support are only required for the authenticated Client and Admin portals, since the marketing site's priority remains SSR/SEO for discovery, not installation [cite:5].

---

## 12. Design System Phase (Pre-Development) — All Apps

Before development begins on any of the four apps, every UI component must be designed and finalized in isolation, covering the public Frontend (`apps/web`), Client Portal, and Admin Portal. Rather than a single shared package or Storybook setup, this is organized as **two separate, simple component directories** — one exclusively for the public Frontend, and one shared between the Client Portal and Admin Portal, since those two apps share far more visual/functional overlap (dock/sidebar navigation, bento dashboards, dark mode, cards, tables) than either does with the marketing site. Each directory is built once and then copied into the relevant app's own codebase, with no shared runtime dependency between apps post-copy.

*(Section unchanged from v3.0 — see full component directory structure, showcase page requirements, documentation standards, and sequencing recommendation as previously defined.)*

## 13. Explicit Out-of-Scope Confirmation (v3.1)

To avoid future scope creep or accidental re-introduction during development, the following are permanently confirmed **out of scope**, not deferred:

- **Payment processing of any kind** — no Stripe, no PayPal, no other gateway, now or in any future phase. Invoices remain informational; Admin marks them Paid manually after receiving payment through the business's own external means (bank transfer, card machine, etc.).
- **Multi-tenancy** — this platform will never serve any business other than Enzo Interiors. No `tenant_id` fields, no tenant-scoping logic, no SaaS-for-other-businesses migration path exists anywhere in this schema or API design.
