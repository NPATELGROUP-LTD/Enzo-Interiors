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
| assigned_installer_id | uuid | FK → staff_users.id, nullable, indexed (migration 9); a Designer-role user. Either assignment gives access |
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
| discount | decimal(12,2) | not null, default 0 — fixed £ off the lines' subtotal, before VAT (migration 12) |
| job_name, job_address, job_notes | text | nullable — the printed invoice's job block |
| payment_schedule | jsonb | not null, default `[]` — `[{label, amount, date}]`, display only, never summed into `amount` |

Index: `idx_invoices_client_id`, `idx_invoices_status`

`invoice_items` (migration 10): `invoice_id` FK cascade, `description`, `quantity`, `unit_price` (net; 0 = quantity-only row),
`position`, plus `section` (heading the line sits under) and `detail` (second "Description" column), both nullable text (migration 12).
`amount` = round each line, sum, minus `discount`, plus VAT on that, rounded once (`modules/invoices/totals.ts`).

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
| conversations | client_id | uuid | FK → clients.id, not null, unique (one conversation per client) |
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

### 3.19 site_settings (v1) — additions
One row, id `site`. Added in migration `3_opening_hours_dark_favicon`, both nullable, no default, so no existing row changed:

| Field | Type | Constraints |
|---|---|---|
| favicon_dark_id | text | nullable; media id shown in dark mode; null = favicon_id for both |
| opening_hours | jsonb | nullable; `{ weekly: {monday: [{open, close}]…}, notes: {day: text}, note }`; null = the company record's hours |

### 3.20 newsletter_subscribers (v1)
| Field | Type | Constraints |
|---|---|---|
| id | text | PK |
| email | text | unique, stored lower-case |
| status | text | `pending` \| `confirmed` \| `unsubscribed`, default pending |
| token | text | unique; in the confirm/unsubscribe links |
| source | text | nullable; `coming_soon` \| `footer` |
| created_at, confirm_sent_at, confirmed_at, unsubscribed_at | timestamptz | created_at default now(); others nullable |

Indexes: (status, created_at), (status, id).

### 3.21 newsletter_campaigns (v1)
| Field | Type | Constraints |
|---|---|---|
| id | text | PK |
| subject | text | not null |
| html | text | not null; sanitised on save |
| status | text | `draft` \| `sending` \| `sent`, default draft |
| recipients, sent_count, failed_count | int | default 0 |
| cursor | text | nullable; last subscriber id sent, for resuming |
| created_by | text | nullable |
| created_at, updated_at, sent_at | timestamptz | sent_at nullable |

Index: (created_at).

### 3.22 Indexes added in `5_indexes` (v1)
- `notifications (recipient_id, read_at)` — the bell's unread count.
- `newsletter_subscribers (status, id)` — sending in id order by cursor.

### 3.23 Two-step sign-in, Google and the calendar (v1, `7_two_factor_google_calendar`)
Additive only. Secrets marked *sealed* are AES-256-GCM with `APP_ENCRYPTION_KEY` (`apps/api/src/core/crypto.ts`).

`staff_users` additions (all nullable unless shown):

| Field | Type | Constraints |
|---|---|---|
| two_factor_method | text | `email` \| `totp`; null = not chosen yet |
| totp_secret_enc | text | sealed authenticator secret |
| totp_confirmed_at | timestamptz | first code accepted |
| totp_last_step | int | last 30 s step accepted (replay protection) |
| recovery_hashes | jsonb | array of sha256 hex of unused recovery codes |
| login_code_hash, login_code_expires_at | text, timestamptz | the emailed sign-in code (sha256) |
| login_code_attempts | int | default 0 |
| google_sub | text | unique; linked Google account id |
| google_email | text | the linked Google address |

`appointments` additions: `google_event_id` text, `calendar_connection_id` text, `google_calendar_id` text (all nullable; the calendar copy and which Google calendar holds it).

`trusted_devices` ("remember this device", 30 days):

| Field | Type | Constraints |
|---|---|---|
| id | text | PK |
| staff_user_id | text | not null; index |
| token_hash | text | unique; sha256 of the browser's token (never stored) |
| label | text | nullable; user agent summary |
| created_at, last_used_at, expires_at | timestamptz | first two default now() |

`calendar_connections` (v1: one row, id `studio`):

| Field | Type | Constraints |
|---|---|---|
| id | text | PK |
| staff_user_id | text | nullable; null = the studio calendar |
| google_email | text | not null |
| calendar_id | text | default `primary` |
| calendar_name | text | nullable |
| refresh_token_enc | text | not null; sealed |
| status | text | `connected` \| `needs_reconnect`, default connected |
| connected_by | text | nullable |
| created_at, updated_at | timestamptz | default now() |

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
- **Migrations only add.** New tables, nullable or defaulted columns and indexes; no DROP, RENAME, ALTER COLUMN or data UPDATE, and a migration that has run is never edited. A rolled-back image must still run on the newer schema.
- **No payment gateway integration exists or is planned.** `invoices.status` and `invoices.paid_at` are updated exclusively through the Admin's manual "Mark Paid" action; there is no `/payments` domain in the API.

## v3.0.0 additions (migrations 21–29, all additive)

New tables: `enquiry_messages` (21), `project_members` and `installer_assignments` (22, 23), `invoice_stages` (24), `gmail_accounts` (25), `staff_threads`, `staff_messages`, `staff_thread_reads` (28).
New columns: `contact_submissions.source` / `ref_no`, `projects.ref_no` / `site_address`, `clients.password_is_default`, `documents.category` / `client_can_download`, `invoices.client_can_download`, `site_settings.bank_details` / `document_categories`. Columns and constraints are in `apps/api/prisma/schema.prisma`. The legacy `projects.assigned_designer_id` / `assigned_installer_id` stay and are copied into `project_members` by `npm run team:backfill`.

## Inventory (migrations 34–35, all additive)

| Table | Key columns | Constraints |
|---|---|---|
| `inventory_suppliers` | name, contact_name, email, phone, lead_days, notes | — |
| `inventory_items` | sku (unique), name, type (sheet / hardware / bought-in), category, unit, size_note, supplier_id, on_hand INT, avg_cost DECIMAL(12,2), reorder_level, low_notified, active | `on_hand >= 0` CHECK; supplier FK SET NULL |
| `stock_movements` | item_id, kind (receive / issue / return / adjust), quantity INT (signed), unit_cost DECIMAL(12,2), reason, project_id, by_id, by_name, created_at | append-only; item FK RESTRICT (items with history are switched off, not deleted); project FK SET NULL |
| `project_materials` | project_id, item_id, needed, reserved, issued | unique (project_id, item_id); counts ≥ 0 CHECK; project FK CASCADE, item FK RESTRICT |
| `inventory_settings` | one row: reserve_on_stage (stage name or null = holds by hand only) | — |

Quantities are whole numbers (whole sheets, units, boxes). Free stock is computed, never stored: `on_hand − SUM(project_materials.reserved)`.
