# Enzo Interiors Platform — Website / App Sitemap

**Compiled from:** PRD v2.1, App Flow v4, TRD v3.1, Architecture.md, UI/UX Brief v6, Backend Schema v2.0, Boilerplate Codebase
**Apps:** `apps/web` (public site), `apps/portal` (Client Portal), `apps/admin` (Admin/CRM)

This document lists every page in the platform, its route, and the sections/components rendered on it.

---

## 1. Public Marketing Website (`apps/web`)

Next.js, SSR/SEO-optimized. Shared on every page: **Navbar** (transparent-over-hero → solid on scroll, nav links: Home/Services/Portfolio/About/Contact, "Client Portal" link, "Book a Consultation" CTA, mobile full-screen menu) and **Footer** (brand + newsletter signup, Services links, Company links, Contact details, social icons, bottom bar with copyright/legal links).

### 1.1 Homepage — `/`
- Animated hero with rotating service words (multi-slide hero, ~4 viewport heights)
- Glare Card service grid (Kitchens, Bedrooms, Media Walls, Wardrobes)
- "Why Enzo" bento-style features section
- Portfolio gallery preview (teaser grid linking to full Portfolio page)
- Auto-scrolling testimonials column
- Booking CTA banner
- Instagram feed embed
- Footer

### 1.2 Services — `/services`
- Page hero/intro
- Alternating image/content sections, one per service category (Kitchens, Bedrooms, Media Walls, Wardrobes)
- "Get a Quote" CTA per service section
- Footer

### 1.3 Service Detail — `/services/:category` (Kitchens / Bedrooms / Media Walls / Wardrobes)
- Hero (category-specific imagery + heading)
- Description
- Features list
- Materials/finishes showcase
- 4-step process section (incl. "3D Design & Material Selection")
- Investment Guide pricing cards — 3 tiers: Essential / Premium / Luxury ("from £X")
- Quote Calculator (simple/average instant estimate, calls `POST /quotes/estimate`, real-time <200ms)
- FAQs accordion
- "Get a Free Quote" modal (name, email, phone, budget range, project details, optional quote number attach)
- Footer

### 1.4 Portfolio — `/portfolio`
- Page hero/intro
- Filterable masonry gallery (filter by category)
- Project Detail Lightbox (opens on item click): before/after images, location, client, duration, year, description, materials used
- Footer

### 1.5 About — `/about`
- Founder/team profile section
- Company timeline
- Values section
- Animated particle text branding element
- Footer

### 1.6 Contact — `/contact`
- Contact form (name, email, phone, service interest, message)
- Map embed
- WhatsApp CTA
- Contact details block
- Footer

### 1.7 Booking Wizard — `/booking`
5-step wizard (can be pre-filled from an accepted quote via Quote-to-Booking Handoff):
1. Service selection
2. Date picker
3. Time slot selection
4. Contact details
5. Confirmation
- Footer

### 1.8 Quote Builder — `/quote-builder` (standalone prototype, `feature/3d-2d-quote-builder`)
Not yet linked from the main navigation. Data lives in the browser (localStorage) until `apps/api` exists.
- `/quote-builder` — choose quick estimate or room planner
- `/quote-builder/quick` — quick estimate: room type, wall length, door finish → live price range
- `/quote-builder/plan` — room planner: room (rectangle or L-shape) → drag-and-drop layout with 2D plan / 3D view and finishes per unit → estimate with board cutting diagrams; `?studio=1` shows cost and margin
- `/quote-builder/admin` — studio catalogue (staff): boards with photos, units with sizes, panel lists and live 3D preview, margin and price-range settings, saved estimates

### 1.9 404 Not Found — `*` (any unmatched route)
- Branded split-screen error page
- Link back to Home

---

## 2. Client Portal (`apps/portal`) — `/portal/*`

React/Vite SPA, PWA-enabled (installable, offline shell, push notifications). Shared: **PortalLayout** (bottom dock/mobile nav: Dashboard, Projects, Messages, Invoices, More), light/dark theme.

### 2.1 Login/Signup — `/portal/login`
- Client authentication form (`/auth/portal/login`)
- Signup entry point

### 2.2 Dashboard — `/portal/dashboard`
Bento-grid overview:
- Next upcoming appointment
- Unread messages count
- Documents count
- Invoice status summary
- Full project timeline widget

### 2.3 My Projects — `/portal/projects`
- Card grid of client projects (status, progress bar, start/completion dates)

### 2.4 Project Detail — `/portal/projects/:id`
- Timeline tab
- Mood boards tab
- Design approval workflow: **Approve Design** / **Request Changes** actions, revision notes
- Documents tab
- Messages tab

### 2.5 My Quotes — `/portal/quotes`
- List of quotes issued (Simple estimate or Detailed component breakdown)
- Accept action (triggers Quote-to-Invoice conversion)
- Decline / Request Revision actions

### 2.6 Messages — `/portal/messages`
- Chat-style conversation thread with Enzo team (real-time via WebSocket)
- File attachment support

### 2.7 Documents — `/portal/documents`
- Searchable/filterable document list (Contracts, Quotes, Invoices, Plans, Mood Boards)
- Download action per document

### 2.8 Invoices — `/portal/invoices`
- Summary stats (Paid, Outstanding, Next Due)
- Invoice table — view/status only, no in-app payment (Admin marks Paid manually)

### 2.9 Settings — `/portal/settings`
- Profile section
- Notification preferences (email/SMS/in-app)
- Security (password, sessions)
- Light/dark mode preference toggle

---

## 3. Admin Panel / CRM (`apps/admin`) — `/admin/*`

React/Vite SPA, PWA-enabled. Shared: **AdminLayout** (persistent sidebar: Dashboard, Clients, Bookings, Quotes & Pricing, Projects, Invoices, Messages, Content, Settings), RBAC-gated (Admin full access; Designer/Installer scoped to assigned projects/clients).

### 3.1 Login — `/admin/login`
- Staff authentication form (`/auth/admin/login`, separate from client login)

### 3.2 Dashboard — `/admin/dashboard`
Bento grid:
- Today's bookings
- Active projects
- New enquiries
- Outstanding invoices
- Unread messages
- Monthly bookings chart

### 3.3 Clients — `/admin/clients`
- Searchable/filterable client table
- Add / edit / delete client actions

### 3.4 Client Detail — `/admin/clients/:id`
- Overview tab
- Projects tab
- Invoices tab
- Documents tab
- Notes tab
- Activity log tab

### 3.5 Bookings & Availability — `/admin/bookings`
- Calendar view with booking density indicators
- Working-hours / slot-duration settings
- Manual booking creation form
- Upcoming bookings list

### 3.6 Quotes & Pricing — `/admin/quotes`
- Quote builder (Simple or Detailed line-item quote)
- Send quote action; client accept/revise status tracking
- Quote status list (Draft, Sent, Accepted, Expired)
- Convert-to-Invoice action
- **Component Pricing Library** (sub-section): CRUD for reusable components — name, category, unit price, description

### 3.7 Projects (Kanban) — `/admin/projects`
- 5-stage Kanban board: Consultation → Design → Approval → Installation → Completed
- Drag-and-drop stage transitions ("Move to…" alternative for accessibility)
- List view toggle
- Assign designer control
- File upload per project
- "Send to client" visibility toggle
- Activity log

### 3.8 Invoices — `/admin/invoices`
- Invoice builder (line items, VAT, totals, live preview)
- Status tracking (Draft/Sent/Outstanding/Paid/Overdue)
- Send / Download / Mark-Paid (manual only) actions
- Auto-populated from accepted quotes

### 3.9 Messages — `/admin/messages`
- All-client inbox
- Saved reply templates
- Attachment support

### 3.10 Content Manager — `/admin/content`
- Testimonials management (publish/unpublish, rating, review text)
- Portfolio management (portfolio items, images, category, publish state)
- Contact submissions inbox (lead status: New/Contacted/Converted/Archived)

### 3.11 Settings — `/admin/settings`
- Business profile (name, VAT rate, logo, brand color)
- Booking settings
- Notification templates
- Team member management (roles: Admin/Designer/Installer)
- Integrations
- Security audit log (`activity_logs`)

---

## 4. Cross-Cutting Flows (span multiple pages)

- **Quote lifecycle:** Service Detail (web) or Quotes & Pricing (admin) creates quote → client accepts in My Quotes (portal) → admin converts to invoice → client views status in Invoices (portal).
- **Booking flow:** Any page → Booking Wizard, optionally pre-filled from an accepted quote.
- **Messaging:** Single WebSocket gateway powers both Admin Messages inbox and Portal Messages chat.
- **Design approval loop:** Portal Project Detail "Request Changes" restarts the project's Kanban stage in Admin Projects.
- **PWA install/offline:** Applies only to Portal and Admin — install prompt, offline "reconnecting" shell state, auto-updating service worker.

---

*Generated from Enzo Interiors project files: PRD v2.1, App Flow v4, TRD v3.1, Architecture.md, Backend Schema v2.0, UI/UX Brief v6, and the Boilerplate Codebase.*
