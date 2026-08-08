# apps/api — Backend API

NestJS and TypeScript backend that owns the Enzo Interiors platform's business logic, authentication, database access, RBAC, messaging and file storage.

## Tech Stack

- NestJS + TypeScript
- PostgreSQL 16
- Prisma ORM
- Socket.IO WebSocket gateway
- JWT authentication
- MinIO or AWS S3-compatible object storage

## API Domains

| Domain | Endpoint examples |
|---|---|
| Auth | `/auth/admin/login`, `/auth/portal/login` |
| Public Content | `/content/services`, `/content/portfolio`, `/content/testimonials` |
| Quotes | `/quotes`, `/quotes/estimate`, `/quotes/:id/convert-to-invoice` |
| Clients | `/clients`, `/clients/:id` |
| Components | `/components` |
| Invoices | `/invoices`, `/invoices/:id/mark-paid` |
| Bookings | `/bookings`, `/availability` |
| Projects | `/projects/:id/stage` |
| Messages | `/conversations/:id/messages` via WebSocket |
| Documents | `/documents/upload` |

## RBAC

- **Client:** own client records only.
- **Designer/Installer:** assigned projects and clients only.
- **Admin:** full access, including pricing changes and manual invoice status updates.

## Data and Storage Rules

- This is a single-tenant system. There is no `tenants` table or `tenant_id` field.
- Monetary values use decimal types, never floating-point numbers.
- Quote line items store historical unit-price snapshots.
- Frontends never connect directly to PostgreSQL or S3.
- Database records store object keys; the API generates time-limited signed URLs.

## Scope Decisions

There is no payment gateway and no `/payments` domain. Invoices are marked Paid manually by Admin.
