# docs — Project Documentation

Reference documentation for the Enzo Interiors Platform. Read the relevant documents before changing the architecture, data model, API contracts or user flows.

## Documents

| Document | Purpose |
|---|---|
| `architecture.md` | System architecture, application boundaries and deployment topology |
| `Enzo_Interiors_PRD_v2.1.md` | Product requirements, personas, goals and feature scope |
| `Enzo_Interiors_TRD_v3.1.md` | Technical requirements, stack, API, RBAC and PWA requirements |
| `Enzo_Interiors_Backend_Schema_v2.0.md` | PostgreSQL/Prisma schema and relationships |
| `Enzo_Interiors_Storage_Schema_v1.md` | MinIO/S3 bucket structure, access control and retention |
| `Enzo_Interiors_UI_UX_Brief_v6.md` | Design system, brand tokens and interaction requirements |
| `Enzo_Interiors_App_Flow_v4.md` | End-to-end user flows |
| `websitemap.md` | Routes for the public site, Client Portal and Admin CRM |
| `Implementation_Plan_Enzo_Interiors.md` | Branching strategy, implementation phases and delivery checklist |

## Permanent Decisions

- No payment gateway; Admin marks invoices Paid manually.
- Single-tenant platform exclusively for Enzo Interiors; no `tenant_id` fields.
- No native mobile apps; Admin and Portal are delivered as PWAs.
- No automated 3D rendering generation; the platform only prices and schedules design work.

See the root [README.md](../README.md) for the high-level project overview.
