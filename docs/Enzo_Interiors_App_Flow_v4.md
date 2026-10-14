# Enzo Interiors Platform — App Flow Document

**Prepared for:** NPATEL GROUP LTD
**Client:** Enzo Interiors (Bespoke Interior Design & Fitted Furniture, Leicester, UK)
**Source:** Enzo Interiors PRD v2.0, TRD v3.0, and Boilerplate Codebase
**Date:** July 2026

---

## Document Purpose

This App Flow Document maps every user journey across the three frontend apps — public marketing site, Client Portal, and Admin/CRM — showing screen-to-screen navigation, decision points, and where each flow calls the shared `apps/api` backend. Real payment processing and multi-tenant support are out of scope for the current build and are noted as future phases where relevant.

---

## 1. Public Website Flow (apps/web)

```
Homepage -> Services -> Service Detail (Kitchens/Bedrooms/Media Walls/Wardrobes)
                          |--> Quote Calculator (Simple estimate) -> Get a Free Quote Modal -> Submit -> Confirmation
                          |--> Portfolio -> Project Detail Lightbox
Homepage -> About
Homepage -> Contact -> Contact Form Submit -> Confirmation
Homepage / Any Page -> Booking Wizard (5 steps: Service -> Date -> Time -> Contact Details -> Confirmation)
Any unmatched route -> 404 Page
```

- Entry points: Homepage hero, header nav, or a direct service link.
- Quote flow: selecting a room size/tier triggers `POST /quotes/estimate` for a real-time (<200ms) price range.
- Booking flow: can be pre-filled from an accepted quote (Quote-to-Booking Handoff).
- Exit point: booked consultation (`POST /bookings`) or submitted quote request.

---

## 2. Client Portal Flow (apps/portal)

| Step | Screen | Action / Decision |
|---|---|---|
| 1 | Login/Signup | Authenticate via `/auth/portal/login` |
| 2 | Dashboard | Bento overview routes to any module |
| 3 | My Projects -> Project Detail | Approve or Request Changes on designs |
| 4 | My Quotes | Accept (triggers Quote-to-Invoice) or Decline/Revise |
| 5 | Messages | Real-time chat via WebSocket |
| 6 | Documents | Filter by type and download |
| 7 | Invoices | View invoice status (Paid/Outstanding/Overdue) — marked Paid manually by Admin, no live payment gateway in current build |
| 8 | Settings | Profile, notifications, security, theme |

- Design-approval loop is the critical path: "Request Changes" restarts the project stage.
- Offline behavior: service worker keeps app shell visible with "offline — reconnecting" state.
- Invoice payment is currently informational/manual (Admin marks Paid); no payment gateway is integrated in this phase.

---

## 3. Admin/CRM Flow (apps/admin)

```
Login -> Dashboard (bento: bookings, active projects, enquiries, invoices, messages, chart)
   |--> Clients -> Client Detail (overview, projects, invoices, documents, notes, activity log)
   |--> Bookings & Availability -> Calendar / Manual Booking Creation
   |--> Quotes & Pricing -> Build Quote -> Send -> Client Accepts -> Convert to Invoice
   |        |--> Component Pricing Library (CRUD)
   |--> Projects (Kanban) -> Drag stage -> Assign designer -> Upload files
   |--> Invoices -> Invoice Builder -> Send/Mark Paid (manual status update)
   |--> Messages -> All-client inbox -> Reply
   |--> Content Manager -> Manage testimonials/portfolio
   |--> Settings -> Business profile, team roles, audit log
```

- Quote-to-Invoice handoff carries over every line item without re-entry.
- RBAC gating: Admin has full access; Designer/Installer scoped to assigned projects/clients.
- Invoicing tracks status (Paid/Outstanding/Overdue/Draft) via manual admin action, not an automated payment gateway.

---

## 4. Cross-App / Backend Interaction Flow

- Quote lifecycle: web/admin creates quote -> client accepts in portal -> admin converts to invoice -> client views invoice status in portal.
- Messaging: single WebSocket gateway powers both Admin inbox and Client Portal chat.
- Auth separation: distinct login endpoints issue role-scoped JWTs.
- The platform currently serves a single business (Enzo Interiors) only; no tenant-switching or account-isolation logic exists in this build.

---

## 5. PWA Install & Offline Flow (Portal + Admin only)

- Install flow: manifest + service worker detected -> platform-specific "Add to Home Screen" prompt -> standalone launch.
- Update flow: service worker uses `autoUpdate` so new logic loads without manual reinstall.
