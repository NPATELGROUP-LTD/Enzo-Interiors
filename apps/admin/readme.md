# apps/admin — Staff/Admin Portal

React and TypeScript CRM application used by Enzo Interiors staff to manage day-to-day operations.

## Purpose

Manages the complete client lifecycle: enquiry → quote → booking → consultation → design → approval → installation → completion → invoicing.

## Tech Stack

- React + TypeScript
- Vite
- Tailwind CSS
- PWA with installable manifest, service worker, offline shell and push notifications

## Core Modules

- Dashboard with bookings, projects, enquiries, invoices and messages.
- Clients CRM with searchable records, notes, documents and activity history.
- Bookings and availability management.
- Quotes and Pricing with simple/detailed quote builders and Component Pricing Library.
- Projects Kanban: Consultation → Design → Approval → Installation → Completed.
- Invoices with manual Mark Paid functionality; no payment gateway.
- Messages inbox with saved reply templates and attachments.
- Content Manager for testimonials, portfolio items and contact submissions.
- Settings for business profile, team roles, notifications and audit logs.

## Authentication and RBAC

Uses the separate `/auth/admin/login` flow with JWT authentication. Admin users have full access; Designers and Installers are scoped to assigned projects and clients. RBAC is enforced by `apps/api`.

## API Dependency

All data access goes through `apps/api`. This app must not access PostgreSQL or object storage directly.
