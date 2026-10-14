# Product Requirements Document: Enzo Interiors Platform (Website + Client Portal + Admin CRM)

**Prepared for:** NPATEL GROUP LTD
**Client:** Enzo Interiors (Bespoke Interior Design & Fitted Furniture, Leicester, UK)
**Document Version:** 2.1 (Combined — includes Quote & Pricing System — Payments removed, Single-Tenant confirmed)
**Date:** July 2026

---

## 1. Overview
Enzo Interiors is a Leicester-based bespoke interior design and fitted furniture company specialising in Kitchens, Bedrooms, Media Walls, and Wardrobes. The platform consists of four connected products:
1. A **marketing website** to attract and convert new leads.
2. A **Quote & Pricing System** to give prospects instant, configurable price estimates.
3. A **client portal** where existing clients track their projects, documents, invoices and communicate with the Enzo team.
4. An **admin panel (internal CRM)** used by Enzo staff to manage clients, bookings, projects, invoicing, messaging, pricing, and content.

This platform is built exclusively for Enzo Interiors and is **not** intended to become a multi-tenant SaaS product for other businesses, now or in the future.

## 2. Problem Statement
Enzo Interiors currently manages client relationships, bookings, project tracking, and pricing across fragmented tools (spreadsheets, email, WhatsApp, paper invoices, verbal quotes). This causes delays in communication, inconsistent pricing, lost documents, and no single source of truth for business performance.

## 3. Goals & Objectives
- Provide a single, branded digital experience spanning marketing, quoting, client self-service, and internal operations.
- Give prospects a fast, transparent way to estimate project cost before booking a consultation.
- Give clients real-time visibility into project status, documents, and invoices.
- Give Enzo staff a CRM to manage the full client lifecycle: enquiry -> quote -> booking -> consultation -> design -> approval -> installation -> completion -> invoicing.
- Reduce manual admin overhead (status updates, invoice chasing, appointment scheduling, ad-hoc quoting).
- Present a premium, bespoke brand feel consistent with a luxury interiors business (not a generic SaaS look).

## 4. Target Users / Personas
| Persona | Description | Key Needs |
|---|---|---|
| Prospective Client | Homeowner researching kitchens/bedrooms/media walls/wardrobes | Browse portfolio, get inspired, get an instant price estimate, book a free consultation easily |
| Existing Client | Has signed a contract, project in progress | Track project timeline, approve designs, view invoices, message team, access documents |
| Admin / Founder (Oyz Khan) | Runs day-to-day operations | Manage bookings/availability, clients, projects (Kanban), quotes, invoicing, pricing catalog, messaging, business settings |
| Design Team / Installation Team | Internal staff assigned to projects | Update project stage, upload files, respond to client messages, build detailed quotes with 3D/2D design line items |

## 5. Scope

### 5.1 Marketing Website
- **Homepage**: animated hero with rotating service words, Glare Card service grid (Kitchens, Bedrooms, Media Walls, Wardrobes), "Why Enzo" bento section, portfolio gallery preview, auto-scrolling testimonials, booking CTA banner, Instagram feed, footer.
- **Services page**: alternating image/content sections per service category with "Get a Quote" CTAs.
- **Service Detail page** (per category — Kitchens, Bedrooms, Media Walls, Wardrobes): hero, description, features, materials/finishes, 4-step process (including 3D Design & Material Selection), 3-tier "Investment Guide" pricing cards (Essential/Premium/Luxury with "from £X"), FAQs, and a "Get a Free Quote" modal (name, email, phone, budget range, project details) [file:1].
- **Portfolio page**: filterable masonry gallery by category, before/after project detail lightbox with location, client, duration, year, description, and materials used [file:1].
- **About page**: founder/team profile, company timeline, values section, animated particle text branding.
- **Contact page**: contact form (name, email, phone, service interest, message), map embed, WhatsApp CTA.
- **Booking page**: 5-step wizard — service selection, date picker, time slot, contact details, confirmation.
- **404 page**: branded split-screen error page.

### 5.2 Quote & Pricing System
A dedicated quoting layer that upgrades the current static "from £X" pricing cards into an interactive, calculable system, split into two tiers of sophistication:

| Feature | Description |
|---|---|
| Simple/Average Quote Calculator | Instant estimate on the website: client selects service type + room size/tier (Essential/Premium/Luxury) and gets an average price range immediately, replacing the current static budget-range dropdown [file:1] |
| Detailed Component-Based Quote Builder | Line-item quote tool (used by admin/design team, and optionally self-serve on the site) where a base service price is combined with selectable components — worktop/door material, finish, size in m², LED/electrical add-ons, storage accessories — each carrying its own price weight, summing to a live running total |
| 2D/3D Modeling & Design Fee | Separate priced line item or add-on package for 3D visualisation/rendering services, since the process step "3D Design & Material Selection" already exists as a deliverable but is currently unpriced [file:1] |
| Component Pricing Library (Admin) | Admin-managed catalog of reusable components (materials, finishes, fittings, appliances) each with a name, category, and price, editable without code changes |
| Quote Request Modal | Existing lead-capture form (name, email, phone, budget range, details) enhanced to optionally attach a generated quote number/estimate before submission [file:1] |
| Quote Management (Admin) | Admin list of all submitted/generated quotes with status (Draft, Sent, Accepted, Expired), linked to the originating client record |
| Quote-to-Invoice Conversion | One-click conversion of an accepted quote into a CRM invoice, carrying over line items, avoiding re-entry of pricing data |
| Quote-to-Booking Handoff | Accepted quotes can pre-fill the booking wizard's service type and budget fields |

### 5.3 Client Portal (`/portal`)
| Feature | Description |
|---|---|
| Login/Signup | Client authentication entry point |
| Dashboard | Bento-grid overview: upcoming appointment, unread messages, documents count, invoice status, full project timeline |
| My Projects | Card grid of client projects with status, progress bar, start/completion dates |
| Project Detail | Timeline, mood boards, design approval workflow (Approve/Request Changes), revision notes, documents, messages tabs |
| My Quotes | View quotes issued to them (simple estimate or detailed component breakdown), accept/decline, request revisions |
| Messages | Chat-style conversation with Enzo team, file attachments |
| Documents | Searchable/filterable document list (Contracts, Quotes, Invoices, Plans, Mood Boards) with download |
| Invoices | Summary stats (Paid, Outstanding, Next Due), invoice table — **view/status only**; no in-app payment. Client pays via the business's own external means (bank transfer, card machine, etc.) and Admin marks the invoice Paid manually. |
| Settings | Profile, notification preferences (email/SMS/in-app), security (password, sessions), light/dark mode preference |

### 5.4 Admin Panel / CRM (`/admin`)
| Feature | Description |
|---|---|
| Login | Separate admin authentication |
| Dashboard | Bento grid: today's bookings, active projects, new enquiries, outstanding invoices, unread messages, monthly bookings chart |
| Clients | Full CRM: searchable client table, add/edit/delete client, client detail view (overview, projects, invoices, documents, notes, activity log) [file:1] |
| Bookings & Availability | Calendar with booking density indicators, working-hours/slot-duration settings, manual booking creation, upcoming bookings list |
| Quotes & Pricing | Build/send simple or detailed quotes, manage the Component Pricing Library, track quote status, convert to invoice |
| Projects (Kanban) | 5-stage pipeline (Consultation, Design, Approval, Installation, Completed) with drag-and-drop, list view toggle, assign designer, file uploads, "send to client" visibility toggle, activity log |
| Invoices | Invoice builder (line items, VAT, totals), status tracking (Paid/Outstanding/Overdue/Draft), send/download/**mark-paid (manual only)** actions, live preview, populated automatically from accepted quotes |
| Messages | All-client inbox, saved reply templates, attachment support |
| Content Manager | Manage website content (testimonials, portfolio, contact submissions) |
| Settings | Business profile, booking settings, notification templates, team member management with roles, integrations, security audit log |

## 6. Data Model (Core Entities)
This is a **single-tenant** data model — every entity below belongs exclusively to Enzo Interiors, with no tenant/account-switching concept anywhere in the system.

- **Client**: name, email, phone, address, status (Active/Inactive), assigned staff, joined date, total spent, notes, activity log.
- **Project**: client link, name/type, status, progress %, timeline stages, documents, messages, images.
- **Quote**: client/service link, type (Simple/Detailed), line items (component references + prices), 3D/2D design fee, subtotal, total, status (Draft/Sent/Accepted/Expired), linked invoice ID.
- **Component**: name, category (worktop, door finish, lighting, appliance, etc.), unit price, description.
- **Invoice**: number, client/project/quote link, line items, amount, status (Paid/Outstanding/Overdue/Draft), due date. Status changed only via manual Admin action — no payment gateway involved.
- **Booking**: client, service type, date/time, status (Confirmed/Pending), optional linked quote.
- **Message**: sender, conversation thread, attachments, timestamp.
- **Document**: name, type, size, upload date, client-visibility flag.
- **Testimonial**: client name, rating, review text, associated project.

## 7. Design & Brand Requirements
- Visual identity: forest green (#1C4A3A / #2C4A35) primary, cream/off-white backgrounds (#F5F4F0, #F2F0EB), sage green accents (#8A9E8C), warm charcoal text (#2C2C2C).
- Typography: Cormorant Garamond (headings), Inter (body).
- Portal/Admin UX should feel like a bespoke OS: macOS-style animated dock navigation, frosted-glass panels, bento-grid dashboards, light/dark mode toggle.
- Quote builder UI should mirror the existing pricing-tier card style (Essential/Premium/Luxury) for consistency, with an added live-total sidebar for the detailed builder.
- Fully defined interaction states required for buttons, inputs, cards, toasts, and dock icons (default/hover/active/disabled/loading).
- Responsive breakpoints: Desktop 1440px, Tablet 768px, Mobile 375px.

## 8. Non-Functional Requirements
- **Performance**: fast page loads for image-heavy portfolio/gallery pages (lazy loading, optimized assets); quote calculations should update in real time (<200ms) as components are selected.
- **Security**: role-based access control (Client vs Admin vs Staff), secure authentication, audit logging of admin actions (including price changes to the Component Library), encrypted storage of documents/invoices/quotes.
- **Accessibility**: adequate colour contrast in both light/dark themes, keyboard navigable forms, modals, and quote builder controls.
- **Reliability**: no data loss on client/project/invoice/quote CRUD operations; confirmation dialogs for destructive actions (e.g., delete client, delete component).
- **Scalability**: architecture should support growth in Enzo Interiors' own client/project volume over time. **Multi-tenant architecture and serving other businesses is explicitly and permanently out of scope** — this is a single-business platform by design.

## 9. Technical Stack (Current Implementation)
- React with React Router (nested layouts for Portal/Admin).
- Motion (Framer Motion) for animations/transitions.
- Tailwind-style utility classes for styling; dark/light theme via `darkMode` context.
- Sonner for toast notifications.
- Component structure organized under `src/app/components/portal` and `src/app/components/pages` for both client portal, admin views, and marketing pages.
- Currently uses static/mock data (`mockData.ts`, in-page `allServices`, `projects`, `clients` arrays) for clients, projects, invoices, bookings, and pricing tiers — a backend/database, real auth, and a real pricing engine are needed for production [file:1].

## 10. Out of Scope (Permanent)
- **Real payment processing integration of any kind** — no Stripe, no other gateway, now or in any future phase. The previously mocked "Pay Now" modal is removed entirely; invoices are informational only, marked Paid manually by Admin.
- **Multi-tenant support for other businesses beyond Enzo Interiors** — permanently out of scope, not a future phase. No tenant-switching, no reserved tenant fields.
- Real-time messaging backend uses WebSocket (Socket.IO) as defined in the TRD — this remains in scope and is not affected by the above removals.
- Native mobile apps (mobile web only, delivered as PWA per TRD v3.1 §11).
- Automated 3D rendering generation (the platform will price/schedule 3D design work, not generate 3D models itself).

## 11. Success Metrics
- Quote-to-booking conversion rate (percentage of generated quotes that lead to a booked consultation).
- Reduction in time-to-respond for client messages, invoice queries, and quote requests.
- Increase in booking conversion rate from the marketing site.
- Percentage of clients actively using the portal (login frequency).
- Reduction in manual admin hours spent on scheduling, invoicing, and ad-hoc quoting.
- On-time project completion rate tracked via Kanban stage duration.

## 12. Open Questions / Risks
- Backend/database and authentication provider not yet finalized — required before production launch.
- Pricing rules for the Component Library need to be defined with the client (fixed prices vs. size-dependent formulas, e.g., £/m²).
- Whether the Simple/Average quote calculator should be public (self-serve on the website) or gated behind a lead-capture form.
- Data migration plan needed if Enzo currently holds client/pricing records elsewhere.
- Need to confirm hosting and server requirements, especially given power-efficient infrastructure priorities for self-managed servers.

**Resolved in this revision:** Payment gateway integration and multi-tenant support are no longer open questions — both are permanently confirmed out of scope.
