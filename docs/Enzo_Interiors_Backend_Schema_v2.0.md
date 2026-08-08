# Enzo Interiors Platform — Backend Schema Document (v2.0)

**Prepared for:** NPATEL GROUP LTD
**Client:** Enzo Interiors (Bespoke Interior Design & Fitted Furniture, Leicester, UK)
**Source documents:** TRD v3.1, PRD v2.1, App Flow v4, UI/UX Brief v6, Boilerplate Codebase
**Stack:** NestJS (apps/api) + PostgreSQL 16 + Prisma ORM
**Date:** July 2026

**Change log (v2.0):** Removed `tenants` table and every `tenant_id` column — this platform is confirmed single-tenant, permanently. Removed the `/payments/create-intent` endpoint and all Stripe references — no payment gateway exists or is planned; invoices are marked Paid manually by Admin only. Added the additional tables surfaced from a full pass of the boilerplate and PRD (`availability_settings`, `saved_reply_templates`, `notification_preferences`, `portfolio_items`, `contact_submissions`, `business_settings`, `activity_logs`) so the schema is complete before development starts.

---

## 1. Purpose

This document defines the complete backend database schema for the Enzo Interiors Platform (`apps/api`), translating the entity plan validated in TRD v3.1 §5 and PRD v2.1 §6 into concrete Prisma/PostgreSQL tables, field types, constraints, relationships, and indexes. It is the single source of truth for `packages/shared` Prisma types consumed by `apps/web`, `apps/admin`, and `apps/portal`.

## 2. Entity-Relationship Overview

```
staff_users ──< projects
staff_users ──< clients (assigned_staff_id)
clients ──< projects
clients ──< quotes
clients ──< invoices
clients ──< bookings
clients ──< documents
clients ──< conversations ──< messages
projects ──< documents
projects ──< testimonials
projects ──< portfolio_items
quotes ──< quote_line_items >── components
quotes ──1:1── invoices (nullable)
projects ──1:1── invoices (nullable)
bookings ──0:1── quotes (linked_quote_id)
contact_submissions ──0:1── clients (converted lead)
```

This is a **single-tenant** system — there is no tenant/account concept anywhere in this schema, and none is planned.

## 3. Table Definitions

### 3.1 staff_users
| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| name | varchar(120) | not null |
| email | varchar(160) | unique, not null |
| password_hash | varchar(255) | not null |
| role | enum(Admin, Designer, Installer) | not null, default 'Designer' |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

### 3.2 clients
| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| name | varchar(120) | not null |
| email | varchar(160) | unique, not null |
| phone | varchar(30) | nullable |
| address | text | nullable |
| status | enum(Active, Inactive) | default 'Active' |
| assigned_staff_id | uuid | FK → staff_users.id, nullable |
| joined_date | date | default now() |
| total_spent | decimal(12,2) | default 0.00 |
| notes | text | nullable |
| password_hash | varchar(255) | not null (client portal auth) |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

Index: `idx_clients_status`, `idx_clients_assigned_staff_id`

### 3.3 projects
| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| client_id | uuid | FK → clients.id, not null |
| name | varchar(160) | not null |
| type | enum(Kitchen, Bedroom, MediaWall, Wardrobe) | not null |
| status | enum(Consultation, Design, Approval, Installation, Completed) | default 'Consultation' |
| progress_pct | smallint | default 0, check 0–100 |
| current_stage | varchar(80) | nullable |
| assigned_designer_id | uuid | FK → staff_users.id, nullable |
| client_visible | boolean | default true |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

Index: `idx_projects_client_id`, `idx_projects_status`

### 3.4 components (Component Pricing Library)
| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| name | varchar(120) | not null |
| category | enum(Worktop, DoorFinish, Lighting, Appliance, StorageAccessory, Electrical) | not null |
| unit_price | decimal(10,2) | not null |
| description | text | nullable |
| is_active | boolean | default true |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

### 3.5 quotes
| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| client_id | uuid | FK → clients.id, not null |
| service_id | varchar(40) | not null (Kitchen/Bedroom/MediaWall/Wardrobe) |
| type | enum(Simple, Detailed) | not null |
| design_fee | decimal(10,2) | default 0.00 |
| subtotal | decimal(12,2) | not null |
| vat_rate | decimal(4,2) | default 20.00 |
| total | decimal(12,2) | not null |
| status | enum(Draft, Sent, Accepted, Expired) | default 'Draft' |
| invoice_id | uuid | FK → invoices.id, nullable |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

Index: `idx_quotes_client_id`, `idx_quotes_status`

### 3.6 quote_line_items
| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| quote_id | uuid | FK → quotes.id, not null, on delete cascade |
| component_id | uuid | FK → components.id, not null |
| quantity | decimal(8,2) | default 1 |
| unit_price | decimal(10,2) | not null (snapshot at time of quote) |
| line_total | decimal(12,2) | not null (generated: quantity × unit_price) |

### 3.7 invoices
| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| number | varchar(20) | unique, not null (e.g. INV-2026-0041) |
| client_id | uuid | FK → clients.id, not null |
| project_id | uuid | FK → projects.id, nullable |
| quote_id | uuid | FK → quotes.id, nullable |
| amount | decimal(12,2) | not null |
| vat_rate | decimal(4,2) | default 20.00 |
| status | enum(Draft, Sent, Outstanding, Paid, Overdue) | default 'Draft' |
| due_date | date | not null |
| paid_at | timestamptz | nullable — set only when Admin manually marks Paid; **no payment gateway writes to this table** |
| created_at | timestamptz | default now() |

Index: `idx_invoices_client_id`, `idx_invoices_status`

### 3.8 bookings
| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| client_id | uuid | FK → clients.id, not null |
| service_type | enum(Kitchen, Bedroom, MediaWall, Wardrobe) | not null |
| date_time | timestamptz | not null |
| status | enum(Pending, Confirmed, Cancelled) | default 'Pending' |
| linked_quote_id | uuid | FK → quotes.id, nullable |
| created_at | timestamptz | default now() |

Index: `idx_bookings_date_time`

### 3.9 availability_settings
| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| day_of_week | smallint | 0–6, not null |
| start_time | time | not null |
| end_time | time | not null |
| slot_duration_mins | smallint | default 60 |
| is_closed | boolean | default false |

### 3.10 conversations & messages
| Table | Field | Type | Constraints |
|---|---|---|---|
| conversations | id | uuid | PK |
| conversations | client_id | uuid | FK → clients.id, not null |
| conversations | created_at | timestamptz | default now() |
| messages | id | uuid | PK |
| messages | conversation_id | uuid | FK → conversations.id, not null |
| messages | sender_id | uuid | not null (client_id or staff_user_id, polymorphic) |
| messages | sender_type | enum(Client, Staff) | not null |
| messages | body | text | not null |
| messages | attachments | jsonb | nullable (array of storage_url) |
| messages | read_at | timestamptz | nullable |
| messages | created_at | timestamptz | default now() |

### 3.11 saved_reply_templates
| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| staff_id | uuid | FK → staff_users.id, nullable (null = shared/global template) |
| title | varchar(120) | not null |
| body | text | not null |

### 3.12 notification_preferences
| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| owner_id | uuid | not null (client_id or staff_id) |
| owner_type | enum(Client, Staff) | not null |
| email_enabled | boolean | default true |
| sms_enabled | boolean | default false |
| in_app_enabled | boolean | default true |

### 3.13 documents
| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| client_id | uuid | FK → clients.id, not null |
| project_id | uuid | FK → projects.id, nullable |
| name | varchar(160) | not null |
| type | enum(Contract, Quote, Invoice, Plan, MoodBoard) | not null |
| size_bytes | integer | not null |
| upload_date | timestamptz | default now() |
| client_visible | boolean | default true |
| storage_url | varchar(500) | not null (MinIO/S3 key) |

### 3.14 testimonials
| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| client_name | varchar(120) | not null |
| rating | smallint | not null, check 1–5 |
| review_text | text | not null |
| project_id | uuid | FK → projects.id, nullable |
| is_published | boolean | default false |
| created_at | timestamptz | default now() |

### 3.15 portfolio_items
| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| project_id | uuid | FK → projects.id, nullable |
| title | varchar(160) | not null |
| category | enum(Kitchen, Bedroom, MediaWall, Wardrobe) | not null |
| location | varchar(120) | nullable |
| year | smallint | nullable |
| duration_weeks | smallint | nullable |
| description | text | nullable |
| materials_used | text | nullable |
| image_urls | jsonb | not null |
| is_published | boolean | default true |

### 3.16 contact_submissions
| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| name | varchar(120) | not null |
| email | varchar(160) | not null |
| phone | varchar(30) | nullable |
| service_interest | varchar(60) | nullable |
| message | text | not null |
| status | enum(New, Contacted, Converted, Archived) | default 'New' |
| created_at | timestamptz | default now() |

### 3.17 business_settings
| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| business_name | varchar(160) | default 'Enzo Interiors' |
| vat_rate | decimal(4,2) | default 20.00 |
| logo_url | varchar(500) | nullable |
| brand_primary_color | varchar(10) | default '#1C4A3A' |
| email_from_address | varchar(160) | nullable |

### 3.18 activity_logs
| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| staff_id | uuid | FK → staff_users.id, not null |
| action | varchar(120) | not null (e.g. 'price_change', 'client_delete') |
| target_table | varchar(60) | not null |
| target_id | uuid | not null |
| details | jsonb | nullable |
| created_at | timestamptz | default now() |

## 4. RBAC Enforcement Model (NestJS Guards)

| Role | Scope | Notes |
|---|---|---|
| Client | own client_id records only | projects, quotes, invoices (view/status only), messages, documents |
| Designer/Installer | assigned projects/clients | can update project stage, upload files, respond to messages |
| Admin (Founder) | full access | Component Library edits, staff management, invoice mark-paid, audit log |

## 5. API-to-Table Mapping (selected)

| Endpoint | Method | Primary Table(s) |
|---|---|---|
| /quotes/estimate | POST | components (read), quotes (write, Simple) |
| /clients, /clients/:id | GET/POST/PUT/DELETE | clients |
| /quotes/:id/convert-to-invoice | POST | quotes, invoices, quote_line_items |
| /invoices/:id/mark-paid | PUT | invoices (Admin-only, manual) |
| /projects/:id/stage | PATCH | projects |
| /conversations/:id/messages | GET/POST (WS) | conversations, messages |
| /documents/upload | POST | documents |
| /bookings, /availability | GET/POST | bookings, availability_settings |
| /content/testimonials, /content/portfolio | GET | testimonials, portfolio_items |

**Confirmed removed:** `/payments/create-intent` and any Stripe-related route — no payment gateway integration exists in this system.

## 6. Notes & Constraints

- All monetary fields use `decimal` (never float) to avoid rounding errors in quote/invoice totals.
- `quote_line_items.unit_price` is a snapshot copy of `components.unit_price` at quote time so later price changes in the Component Library never retroactively alter historical quotes.
- Cascading deletes are scoped tightly: deleting a `quote` cascades to its `quote_line_items`, but never to `clients`, `invoices`, or `components`.
- **No `tenant_id` field exists anywhere in this schema.** This is a single-tenant system by permanent design decision — Enzo Interiors is the only business this platform will ever serve.
- **No payment gateway integration exists or is planned.** `invoices.status` and `invoices.paid_at` are updated exclusively through the Admin's manual "Mark Paid" action; there is no `/payments` domain in the API.
