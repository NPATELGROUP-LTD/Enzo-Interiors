# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Current Development Phase

**v1 scope: the public website, the Admin CMS that runs it, consultation booking, and the CRM: Clients, Projects, Invoices, Documents and the Dashboard.**

- `apps/web` — Next.js marketing site. Reads all of its content from the API.
  `/booking` asks the API for free days/times and books through it.
- `apps/admin` — the Enzo Interiors admin. Menu bar: **Dashboard** (`/`, the
  landing page for Admin and Designers; an Editor lands on the CMS), **CMS** (Pages, then
  Services, Recent work, Testimonials, Team, FAQs, Menu, Company),
  **Clients** (`/clients`, `/clients/:id`, Admin + Designer; `?view=` /
  `?new=1`; a client's page has Invite to portal / Resend invite and, for an
  Admin, New project), **Projects** (`/projects` board/`?view=list`/`?new=1`,
  `/projects/:id`, Admin + Designer),
  **Bookings** (`/bookings`, Admin only: list, month view, move/cancel, New
  booking; `?view=` / `?new=1` / `#month` in the address) and **Settings**
  (`/settings/:section`, Admin only: website status, page on/off switches, logo & favicon (light +
  dark), notification emails, opening hours, booking schedule, newsletter,
  users). CMS, Clients, Projects, Invoices, Bookings and Settings each drop a menu on hover. Below xl the menu bar collapses into one app-name · current-page button that opens a page-menu popover (as in the portal; each screen lists its own sub-views). Your own
  name/password/appearance are under the profile menu at `/account`. Plus the
  notification bell, search (Ctrl/⌘ K) and forgot/reset password (also used to
  accept an invitation). **Messages** (`/messages`, Admin + Designers; `?client=` opens
  or starts that client's thread; badge in the menu bar).
- `apps/api` — NestJS on **PostgreSQL 16 via Prisma**. v1 mounts health, auth
  (incl. forgot/reset password, `/users` invites and roles, `/auth/profile`),
  media, the CMS (incl. the public `GET /content/site` bundle, which carries
  the site's live/coming-soon status and brand images, and editor review
  requests), site settings, the public `POST /enquiries`, **booking**
  (`/booking/*` public + settings, `/appointments` for staff),
  `/notifications` and the **newsletter** (`/newsletter` public sign-up,
  confirm, unsubscribe; admin subscribers, CSV, campaigns) and **clients**
  (`/clients`, `POST /clients/:id/invite`; portal `POST /auth/portal/forgot` /
  `reset`) and **projects** (`/projects`; the portal's list, detail, approve,
  request-changes are the only `'Client'` routes) and **documents**
  (`/documents`; the portal's list and `GET /documents/:id/download`) and
  **invoices** and the **dashboard** (below) and **messages** (`/conversations`
  + the Socket.IO gateway; `/saved-replies` and the Admin's `/activity-logs` from
  `modules/settings`). All CRM tables are kept (incl. the retired CRM `bookings`); the CRM's
  bookings and content modules were deleted (booking is `appointments`, content is the CMS;
  enquiries have their own inbox, below). The first admin
  is created on boot from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

**Enquiries inbox:** `/enquiries` (Admin only; menu bar entry with a New badge). `GET /enquiries` (status filter, `before` cursor, `new_count`), `GET /:id`, `PATCH /:id` (status only: New / Contacted / Converted / Archived). "Add as client" opens `/clients?new=1` prefilled.

**Roles (v1):** Settings › Users assigns `Admin`, `Editor`, `Designer` or
`Installer`. `Admin` does everything. The CMS is Admin + `Editor` only (API
`@Roles`, menu, routes and search): an Editor edits and sends changes for
review; cannot publish, add or delete entries, or see Bookings/Settings. An
Admin's send-back note stays on the entry (`cms_entries.review_feedback`)
until the next send or publish. Reviews live on the entry
(`cms_entries.review_*`) and clear on publish or send-back; both ends are told
through `notifications` (the bell) and admins by email too. **Clients:** Admin
all; `Designer` and `Installer` only clients with a project where
`projects.assigned_designer_id` or `assigned_installer_id` is them
(`AccessService.projectScope`; `clients.assigned_staff_id` grants nothing),
read-only; Editors none. Only an Admin writes a client. **Projects:** Admin all
(create, delete, assignment, `client_visible`, default off); a Designer only
projects they design or install (others 404), moving the stage directly and
editing `current_stage` only; an Installer reads the same and cannot move a
stage. Nobody types `progress_pct`: it follows the stage. **Change requests**
(`modules/change-requests`, migration 16): a Designer asks to change a
client's phone/address/notes, an Installer asks to move a stage
(`POST /change-requests`); one pending per person and target, asking again
replaces it. Admins are told by the bell and see them on the client/project
page and the dashboard; approve replays the change through
`ClientsService.update` / `ProjectsService.changeStage` as the Admin (claimed
with one conditional UPDATE), and the asker is told. Being
assigned rings the bell. A client sees their own `client_visible` projects;
project detail lists documents/invoices with that project_id AND its
client_id, and for clients no Draft invoices, no internal documents, no
activity; `storage_url` is never sent. **Documents** (private bucket,
`core/storage.ts` `PrivateStorage`): `AccessService.documentScope` = Admin
all, a Designer the files of their projects (by project, never by client;
also on client detail), a client their own `client_visible` ones; out of
scope is 404. Upload is multipart (`file` + client_id, project_id required and
the client's, type), ≤25 MB, PDF/JPG/PNG/WebP/Word/Excel/PowerPoint checked by
first bytes, key `clients/<id>/projects/<id>/<uuid>-<name>` made by the API,
`client_visible` false; `PATCH /documents/:id/visibility` is Admin-only; a
move stays within the client; delete (and client delete) removes the object,
best effort. `storage_url` holds the key and is never serialised; downloads
are `GET /documents/:id/download` → `{url}`, a 5-minute attachment link signed
per request (`S3_PRIVATE_BUCKET`, signed for the same public host as uploads).
`?inline=1` signs an inline link instead (only PDF/JPG/PNG/WebP, judged by the key's
extension, which the API set from the sniffed type); `preview` on a document says which.
The portal's View shows it in a modal; its CSP allows the media origin in `img-src`/`frame-src`.
Every `/clients`, `/projects`, `/invoices` and `/documents` route names its `@Roles`.
Deferred: projects from appointments/enquiries.

**Invoices** (`/invoices`, menu bar **Invoices**, Admin only): a client reads their
own, never Drafts (list, summary, one); a Designer/Editor gets 403, and no
money in `/clients` (`total_spent`, invoices, lifetime stats) or project detail.
Lines live in `invoice_items` (net prices, FK cascade); `invoices.amount` stays
the gross payable and is computed in the API with `Prisma.Decimal`
(`modules/invoices/totals.ts`: each line to the penny, VAT once on the subtotal);
an invoice with no lines keeps its stored amount. Lines/VAT edit only on a Draft
(or in the request that moves it back to Draft); Draft -> Sent -> Overdue, Paid
only via mark-paid (one transaction with the client's `total_spent`, refuses a
repeat); a Paid one is deleted only with the Admin's password. `project_id` must belong to the invoice's client. Numbers retry on a
unique clash. An invoice also carries a job block, a fixed £ `discount` taken
off the subtotal BEFORE VAT, per-line `section`/`detail` (a 0-priced line is a
quantity-only row) and a display-only `payment_schedule`. Admin and portal
render the same A4 sheet (`components/invoice/`, kept identical in both apps);
Print = browser PDF. `GET /invoices/export?ids=` (Admin) feeds a multi-client
PDF/CSV export. Deferred: emailing an invoice.

**Project stages** come from `site_settings.project_stages` (null = the default
five in `modules/projects/stages.ts`), edited at Settings › Project stages:
`{name, progress, approval}`, 1–20 unique names; the last is Completed, one may be
the client-approval stage; rename moves projects, removing an occupied one is 409.
Frontends read them via `useStages()` and pass them to `projectTone(status, stages)`.

**Web Push** (`modules/notifications/push.ts`): every bell notification
(`notify` staff, `notifyClient` portal) is also pushed to that person's
`push_subscriptions`. Off unless `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/
`VAPID_SUBJECT` are set (`npm run push:keys`; changing keys drops every
subscription). Endpoints are allowlisted to the browser push services.
`/notifications` serves both bells; each caller sees only its own rows.
After sign-in both apps show a "Turn on notifications?" card (the tap browsers
require before asking; iPhone in Safari gets the Home Screen step) and silently
re-register an already-allowed device on every start (`syncPush`), since sign-out
removes it. Every chat message is pushed to the other side (tag per chat) whether
or not they are connected; the bell + email keep the offline/15-minute rule.

**Client notification choices** (`modules/notifications/preferences.ts`):
`notification_preferences.categories` (nullable JSONB, migration 15) holds, per
kind of update (`project`, `invoice`, `document`, `message`), whether it may
reach the client `in_app`, by `email` or by `push`; null = the old all-in-one
`in_app_enabled` / `email_enabled` switches, push on. `NotificationsService.notifyClient`
is the one gate for the bell, devices and email (one generic `templates.notice`;
only to an Active client with a portal password); chat passes `push`/`email` false
and checks `allows()` itself. `GET/PUT /notification-preferences` serve the full
grid (portal Settings › Notifications). `store()` also emits `notification:new` to
room `user:<id>` through `RealtimeService` (joined by `MessagesGateway` on connect),
so both bells update and toast at once; the minute poll is the fallback.
`POST /push/test` (Settings › "Send a test notification") says how many of the
caller's devices were tried. Staff are also told of a new enquiry and of a
client's approval / change request.

**Password and invitation links:** a password reset does not lift a sign-in
lockout (locks only expire). Staff reset/invite tokens are claimed with one
conditional UPDATE; `POST /auth/admin/reset-password/check` and
`POST /auth/portal/reset/check` tell the page a link was already used before a
password is typed. Invoice line quantities are whole numbers (`@IsInt`).

**Re-authenticated deletes:** deleting a client (with all their projects,
invoices incl. Paid, documents, messages, in one transaction), a project
(its invoices and documents stay on the client, unlinked) or a Paid invoice
(total_spent recomputed) needs `{ password }` in the DELETE body
(`modules/auth/reauth.ts`; wrong = 403, throttled 10/15 min).

**Dashboard** (`modules/dashboard`, all SQL counts/sums, no table read whole):
`/dashboard/admin` (Admin: money from invoices via `Prisma.Decimal`, enquiries,
consultations from `appointments`, projects by stage, 12-month charts),
`/dashboard/designer` (Designer/Installer: only their projects and open work, no
money, enquiries or consultations), `/dashboard/portal` (Client: own, shared
projects, files on shared projects, non-Draft invoices, a consultation booked
with their email). Editor 403 on all. A client sees a document only if it AND
its project are shared (`AccessService.documentScope`); invoices reach them
whatever their project's visibility. A client changes their password at
`PUT /account/password` (bumps `token_version`, returns a fresh session) and
reads/writes `/notification-preferences`, both in `modules/auth/portal-account.ts`.

**Client portal access** is by invitation only: nobody types a client's
password. `POST /clients/:id/invite` (Admin) emails `PORTAL_URL/reset-password#token=…`,
a JWT with purpose `portal-password` bound to `clients.token_version` (7 days;
forgot = 30 min); `POST /auth/portal/reset` sets the bcrypt hash and bumps
`token_version` in one conditional UPDATE, so a link works once and old portal
sessions die. No reset columns on `clients`. `has_portal_access` = a bcrypt
hash is stored. Changing a client's email bumps `token_version` too.

**Legal pages (admin and portal):** `/privacy`, `/terms`, `/cookies` in each app,
open signed in or out (`legalKind()` in `App.tsx`, before the auth check), linked
from the sign-in screen and the profile menu. They are separate from the public
site's pages (those are CMS content). The text is code, in each app's
`lib/legal.ts` (admin: written for staff; portal: for clients; `pages/Legal.tsx`
and `LegalLinks` are identical copies). Controller Enzo Interiors Ltd
(16540291); NPATEL GROUP LTD (16236097) is the processor, under a contract that
must be signed before launch. No ICO or VAT number is shown (Enzo has neither
yet); do not invent one. They describe only what exists: when the access log
(IP/device) is built, add it to `what-we-collect` and `retention` in both files.
The apps set no cookies, only localStorage, so no banner. Google Fonts is loaded
from Google (disclosed). Terms are a draft for a solicitor.
- `apps/portal` — client portal (React/Vite PWA, same macOS look as admin).
  Clients reach it only by invitation: `/reset-password` (invite or reset; the
  token is read from the link and wiped from the address bar) and
  `/forgot-password`. Pages: Dashboard, Projects (+ detail: approve / request
  changes, downloads), Invoices (+ detail; Download = an A4
  PDF with real, selectable text drawn in the browser by `lib/invoicePdf.ts` (keep it in step with `InvoiceSheet`), jspdf lazy-loaded, kept out of the precache; Print), Documents (View +
  download = `GET /documents/:id/download` per click, never stored), Settings (password
  change adopts the returned token; email / in-portal preferences). Messages is
  a separate piece of work. Ports: dev 5175, docker 5275 (`PORTAL_PORT`);
  production host `PORTAL_HOST` (portal.enzointeriors.co.uk), compose service
  `portal`, CORS via `PORTAL_URL`. The service worker precaches the shell only:
  every API, cross-origin and `/api` request is network-only.

`packages/` was removed. Each app keeps a local copy of the types it consumes,
which is deliberate — see the header of `apps/api/src/common/types/domain.ts`.

Each app installs independently with `npm ci` in its own directory and builds
its own Docker image. There is no workspace-wide install.

---

## Quick Start

**Repository:** Enzo Interiors Platform — multi-app, single-tenant SPA with CRM for a bespoke interior design & fitted furniture company (Leicester, UK).

**Status:** v1 (public site + admin CMS) implemented on PostgreSQL. `docker compose up` brings up the whole stack; see `.env.example` and `docker-compose.yml`.

**Key docs:** Read `docs/architecture.md` and `docs/Implementation_Plan_Enzo_Interiors.md` before making architectural changes or adding features.

---

## Architecture Overview

The Enzo Interiors Platform is split into four independently deployable applications rather than one monolith, allowing public marketing traffic and authenticated portal traffic to scale separately:

```
enzo-interiors/
├── apps/
│   ├── web/            # Next.js (App Router) — public marketing site + Quote Calculator
│   ├── admin/          # React/Vite SPA — Admin/Staff CRM Portal (PWA)
│   ├── portal/         # React/Vite SPA — Client self-service Portal (PWA)
│   └── api/            # NestJS — sole source of business logic, DB/Auth/Storage access
└── docs/               # Architecture, PRD/TRD, implementation plan, schema docs
```

### Apps at a Glance

| App | Framework | Rendering | Auth | PWA | Purpose |
|---|---|---|---|---|---|
| `apps/web` | Next.js (App Router) | SSR/SSG | Public + optional booking capture | ✗ | Marketing site, lead gen, quote calculator |
| `apps/admin` | React + Vite | CSR SPA | `/auth/admin/login` JWT | ✓ | Staff CRM, projects, invoices |
| `apps/portal` | React + Vite | CSR SPA | `/auth/portal/login` JWT | ✓ | Client dashboard, project approval, messages |
| `apps/api` | NestJS | N/A | JWT + RBAC Guards | N/A | RBAC-enforced API; no frontend accesses DB/S3 directly |

---

## Data Model

**Database:** PostgreSQL 16 via Prisma ORM. Schema: `apps/api/prisma/schema.prisma`.
Services never touch Prisma directly — they go through `DatabaseService`, which
hands out a `PrismaRepository` per table.

**Storage:** S3-compatible (MinIO or AWS S3); `apps/api` is sole accessor. TWO
buckets: a **public** one for marketing images (stable URLs, embedded in cached
pages) and a **private** one for client documents (signed per request). The
"never return an unsigned URL" rule applies to the private bucket; see the
header of `apps/api/src/modules/media/media.module.ts` for why.  
**Key tables:** `staff_users`, `clients`, `projects`, `invoices`, `bookings`, `availability_settings`, `conversations`/`messages`, `documents`, `portfolio_items`, `contact_submissions`, `activity_logs`, plus the CMS tables `cms_entries` and `media_assets`.

**The CMS:** every editable thing on the public site is one row in `cms_entries`
(`collection` + `slug`, with a `draft` and a `published` JSONB body). One table
rather than eight, because all of them need the same four things — draft,
published, ordering, audit — and nothing JOINs on their innards. The per-
collection editing hints live in `apps/api/src/modules/cms/schemas.ts` and are
served to the admin, which generates its forms from them plus the shape of the
content itself. That is why adding a paragraph to a page needs no code change
in either app.

**Images:** every site image lives in the public bucket, the shipped ones
included. `media_assets.storage_key` is required; the URL is
`S3_PUBLIC_BASE_URL/key`. The files the site ships with (photos, logos, the
432 hero frames, the placeholders) live in `apps/api/seed-media/` and are
uploaded under `site/` by `npm run cms:import` (skips objects already there).
`apps/web/public` holds no content images — only the app's own icons.

**Content import:** `cms:import` runs on every deploy (compose `seed`, before
the API; bounded retries, always exits 0). Entries nobody has edited
(`updated_by = 'content import'`, draft = published, no review) follow the
shipped JSON; edited ones are never overwritten, and pages/company only gain
keys they lack. New seed-media files are uploaded; a shipped media id whose
`site/` key changed is re-pointed. Removed entries are not deleted.

**Site status:** `site_settings` (one row, `id='site'`): `live` / `coming_soon`,
optional `launch_at`, `notification_emails`, and `opening_hours` (JSONB:
per-day windows, a note per day, one shared note). Null `opening_hours` =
the company record's hours, which the Company editor no longer shows; the
site prints them in the footer, on /contact, under the booking calendar and
in JSON-LD (`apps/web/src/lib/content/hours.ts`). `isLive()` in
`apps/web/src/lib/content` is the one rule (live, or launch time passed); it
gates the layout, robots, sitemap and llms.txt. `pages` (JSONB, null) holds the
Settings › Pages switches (about, services, portfolio, booking, contact,
privacy, terms, cookies; home always on); defaults are computed on read
(`modules/site-settings/pages.ts`) and sent as `site.pages`. Booking off =
public `POST /booking` refused (403). Editors preview a gated site
through a 10-minute token → Next draft mode.

**Email:** `MailService` (core) over SMTP; unset `SMTP_HOST` = logged, not sent.
Locally, `COMPOSE_PROFILES=dev,db` runs Mailpit (UI on :8025) and the bundled
PostgreSQL. Production leaves both out: its database is a separate Docker
service reached through `DATABASE_URL` (`docs/prelaunch.md` → Database).

**Booking:** one `booking_settings` row (id `booking`, JSONB `config`:
weekly first/last start + breaks, slot length, gap, max per day, horizon,
notice, which contact fields, which services). Free times are computed in
`apps/api/src/modules/booking/slots.ts` in **Europe/London** (tested by
`npm test` in apps/api). `appointments.slot` is unique while a booking holds
its time and null once cancelled, so the database refuses double bookings.
Staff bookings skip the notice period and horizon. Customers are emailed on
book / move / cancel; admins get the email (notification_emails) and the bell.

**Brand:** `site_settings.logo_light_id / logo_dark_id / favicon_id /
favicon_dark_id` (media ids) replace `company.logos` on the site; the dark
favicon is served with `media="(prefers-color-scheme: dark)"` (shipped ones:
`apps/web/public/icon-dark.png`, `apps/admin/public/favicon-dark.png`); the Company editor hides `logos`
(`RETIRED` in `apps/admin/src/components/cms/guide.ts`, which also hides the
booking page's old `timeSlots` / `wordmark`). The default favicon is
`apps/web/public/icon.png`.

**Messages:** one `conversations` row per client (unique index on `client_id`,
migration `11_conversation_per_client`; a lost create race re-reads the winner) (Admin all, Designer/Installer
their projects' clients via AccessService, client their own, Editor none).
Attachments are `documents` ids shared with that client (`sharedWithClient`),
opened via `/documents/:id/download`. The chat's paperclip uploads from the device (`POST /documents/upload`; a client only to their own shared project, always shared and typed Other; staff with `share=true`, which needs a shared project). `MessagesGateway` authenticates the
handshake and every event with the shared `authenticate()` (one PK read), and
re-checks each room member before delivery, so a signed-out/demoted socket is
dropped; HTTP send/read go through the same `publish`/`read`. Nobody on the
other side connected = email (no message text; staff via `notification_emails`
+ bell, client to `PORTAL_URL/messages`), once per conversation and side per
15 min (`CacheService`). Single API instance: no Redis adapter; socket.io's
default `/socket.io` path rides the API's Traefik host (WebSocket upgrade passes
through Traefik and Cloudflare Tunnel as is).

**Newsletter:** `newsletter_subscribers` (double opt-in: `pending` until the
emailed link is clicked; only `confirmed` are sent to) and
`newsletter_campaigns` (HTML body sanitised on save by
`modules/newsletter/render.ts`, sent in batches with List-Unsubscribe
headers, resumed after a restart from `cursor`). Sign-up is on the
coming-soon page and in the footer.

**Rate limits:** `@nestjs/throttler` with counters in Redis (`REDIS_URL`,
the `redis` compose service, addressed as `enzo-redis`: on the shared coolify
network `redis` is Coolify's own, password-protected Redis); unset or down = in memory, the API keeps
serving (`core/rate-limit.ts`). 300/min per IP overall, tighter per public
write; sign-in locks progressively. The edge (Cloudflare) rules are in
`docs/prelaunch.md` → Rate limits.

**Hot paths query in SQL:** `PrismaRepository.findWhere / countWhere /
updateWhere` push the filter into PostgreSQL (the bell, availability, CMS
lookups, newsletter sending); `findAll(predicate)` stays for the rest.

**Migrations only add:** new tables, nullable or defaulted columns, indexes.
No DROP / RENAME / ALTER COLUMN / data UPDATE in a migration, and one that
has run is never edited, so the previous image still runs on the new schema
(`docs/prelaunch.md`). Defaults for new settings are computed on read, not
written into existing rows.

**Sessions:** JWTs carry `tv` = `staff_users.token_version`; `JwtAuthGuard`
re-reads the staff row per request, so a password change or reset (or a role
change) signs out every other session immediately. Portal clients
(`POST /auth/portal/login`, no 2FA yet) carry `clients.token_version` and must
be `Active`; both go through `authenticate()` in `common/guards/jwt-auth.guard.ts`
(for a socket gateway too). `RolesGuard` denies client tokens by default: a
route is open to clients only if its `@Roles` names `'Client'`. The three
global guards skip non-HTTP contexts.

**Two-step sign-in:** staff password logins (not Google, not the CRM portal) end
in a second step. Each user picks **Email code** or **Authenticator app** once,
at first sign-in (the app path first proves the mailbox with an emailed code),
then only that method (`staff_users.two_factor_*`); app users get 10 recovery
codes. Logic in `modules/auth/two-factor.ts` + `totp.ts`; secrets sealed by
`core/crypto.ts` (AES-256-GCM, `APP_ENCRYPTION_KEY`). "Remember this device" =
30-day token kept in the admin's localStorage (survives logout; revoked on
password change/reset and admin reset; listed under Account). Wrong codes: 5
per emailed code, 20 per account per 24 h; code emails 3 per 15 min. Only an
Admin can reset it (Settings › Users → Reset two-step sign-in, which also clears
devices and the Google link) or `npm run auth:reset-2fa -- <email>` (Docker:
`docker compose run --rm seed npm run auth:reset-2fa -- <email>`).
`DISABLE_2FA=true` is the emergency switch (warns at boot). The server clock
must be NTP-synced for authenticator codes.

**Google:** `GOOGLE_CLIENT_ID/SECRET`, `GOOGLE_AUTH_REDIRECT_URI`,
`GOOGLE_CALENDAR_REDIRECT_URI` (unset = no Google UI). *Sign in with Google*
(`modules/auth/google.ts`): staff link it under Account (needs current
password); matched by Google `sub`, never creates accounts, skips 2FA, emails the
owner on link; password change/reset and admin reset unlink it. *Calendar*
(`modules/calendar`): an Admin connects the studio calendar in Settings ›
Booking schedule; busy timed events (not all-day, transparent or our own) block
booking times, bookings create/move/delete events. Google is read once a minute
for a fixed window through `CacheService` (Redis, memory fallback), the booked
day is re-checked at booking time, and a Google outage fails open. Read/write
call budgets are separate; a revoked token = `needs_reconnect` + bell. OAuth
callbacks are served on `auth.enzo.client.npatelgroup.ltd` (second Traefik host
on the API). `TRUST_CLOUDFLARE=true` takes the client IP from
`CF-Connecting-IP` (`core/client-ip.ts`) — only safe if the API is reachable
only through Cloudflare. Migration `7_two_factor_google_calendar`.

**Retired:** quotes and the part library are gone from the code (the quote builder is its own project). The tables `quotes`, `quote_line_items`, `components` and the columns `invoices.quote_id` / `bookings.linked_quote_id` stay in the schema because migrations only add; nothing reads or writes them. The old `unit_price` snapshot rule went with them.

For the full schema, see `docs/Enzo_Interiors_Backend_Schema_v2.0.md`.

---

## Commands

Each app installs and runs from its own directory with npm. PostgreSQL and
MinIO only ever run in Docker (`docker-compose.yml`); there is no host database.

```bash
# Everything, built as deployed (reads the root .env)
docker compose up -d --build --wait
docker compose run --rm seed              # re-run the content import (up runs it too)
docker compose run --rm seed npm run mock:seed   # mock records + sign-ins beside real data; mock:clear removes them
docker compose down --volumes             # wipe DB + uploads, start from nothing

# Dev: DB + storage in Docker, apps on the host
docker compose up -d --wait postgres minio minio-init redis   # redis optional
cd apps/api   && npm ci && npm run db:setup && npm run dev   # :4000
cd apps/admin && npm ci && npm run dev                       # :5174
cd apps/web   && npm ci && npm run dev                       # :3000
cd apps/portal && npm ci && npm run dev                      # :5175
```

| App | Check |
|---|---|
| `apps/api` | `npm run typecheck`, `npm test`, `npm run build` |
| `apps/api` (DB) | `npm run test:db` — boots the real app on a random port against a real PostgreSQL |

`test:db` needs the compose `postgres` service up. It uses a separate `enzo_test` database
(created on first run, migrated with `prisma migrate deploy`; refuses any name not ending
`_test`, so the dev `enzo` data is never touched), 2FA off, no Redis/SMTP. Helper:
`apps/api/src/test-support/app.ts` (`startTestApp()`); add `*.db.test.ts` files and list them in the script. CI runs it as `api (database tests)`.
| `apps/admin` | `npm run typecheck`, `npm test`, `npm run build` |
| `apps/portal` | `npm run typecheck`, `npm run lint`, `npm run build` |
| `apps/web` | `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` |

Schema changes: edit `apps/api/prisma/schema.prisma`, then
`npx prisma migrate dev --name <name>` in `apps/api`.

---

## Architecture Decisions & Constraints

### Permanent Out-of-Scope

These are final product decisions, not temporary shortcuts:

1. **No Payment Gateway** — Stripe/PayPal/etc. never included. Admin marks invoices "Paid" manually after receiving payment externally (bank transfer, card, etc.).
2. **Single-Tenant Only** — This platform serves Enzo Interiors exclusively. No `tenant_id` fields, no tenant-scoping logic, no multi-SaaS path anywhere.
3. **No Native Mobile Apps** — Mobile web only, via PWA (installable manifest + service worker).
4. **No Automated 3D Rendering** — Platform prices/schedules 3D design work; it does NOT generate 3D models.

### Key Architectural Patterns

- **API-First:** All business logic lives in `apps/api` (NestJS). Frontends are thin consumers.
- **RBAC via Guards:** Authentication and role-scoping (Client / Designer-Installer / Admin) enforced centrally via NestJS Guards, not scattered checks.
- **Separate Login Flows:** `/auth/admin/login` for staff, `/auth/portal/login` for clients — different JWT issuers, different roles.
- **S3 as Sole Storage:** Frontends never hold storage credentials. API builds signed URLs at runtime.
- **PWA for Admin/Portal Only:** The public site is indexed once Live (robots, sitemap, JSON-LD, `/llms.txt`, generated OG cards) and has no PWA requirements. Admin + Portal both ship installable Web App Manifest + Workbox service worker.
- **Design System Split:** Public site uses its own component directory. Admin and Portal follow the same UI/UX brief, each with its own copy of the components.

---

## File Organization

### docs/
- `architecture.md` — Read first: system design, app boundaries, deployment topology, subsystem overview.
- `Implementation_Plan_Enzo_Interiors.md` — Branching strategy, implementation phases, delivery checklist.
- `Enzo_Interiors_PRD_v2.1.md` — Product requirements, personas, feature scope.
- `Enzo_Interiors_TRD_v3.1.md` — Technical requirements, stack details, PWA/RBAC/real-time specs.
- `Enzo_Interiors_Backend_Schema_v2.0.md` — PostgreSQL/Prisma schema, entity relationships, data integrity rules.
- `Enzo_Interiors_Storage_Schema_v1.md` — S3 bucket structure, folder layout, signed URL TTLs, retention policies.
- `Enzo_Interiors_UI_UX_Brief_v6.md` — Design tokens, brand colors, typography, component specs, accessibility.
- `Enzo_Interiors_App_Flow_v4.md` — End-to-end user flows (e.g. booking → project → approval).
- `websitemap.md` — All routes for web, admin, portal.
- `Boilerplate Codebase.md` — Packed repo snapshot (reference only; don't edit).

### apps/web/
Next.js marketing site. Pages: Homepage, Services, Service Detail, Portfolio (gallery), About, Contact, Booking Wizard (5 steps), 404. Quote Calculator (must respond <200ms) calls `/quotes/estimate` on the API.

### apps/admin/
React/Vite admin CRM. Modules: Dashboard, Clients, Bookings & Availability, Projects (Kanban over the configurable stages; default Consultation → Design → Approval → Installation → Completed), Invoices, Messages, Content Manager, Settings. RBAC: Admin (full), Designer/Installer (assigned projects only).

### apps/portal/
React/Vite client portal. Modules: Dashboard, My Projects (with approval workflow), Messages (WebSocket real-time), Documents, Invoices (view-only), Settings. RBAC: Client (own records only).

### apps/api/
NestJS backend. All CRUD, auth (JWT + RBAC Guards), WebSocket gateway (messages), S3 signed URL generation. No frontend talks to DB or S3 directly.

---

## RBAC & Authentication

**Roles:** Client, Designer-Installer, Admin.

**Auth Flows:**
- **Admin Login** → `POST /auth/admin/login` → JWT → Admin Portal access
- **Client Login** → `POST /auth/portal/login` → JWT → Client Portal access

**Scope Enforcement:**
- Clients see only their own records (projects, invoices, messages).
- Designer/Installer see assigned projects/clients only.
- Admin sees all records.

All endpoints use NestJS Guards to enforce role + resource ownership. Never hardcode access checks in handlers; always use Guards.

---

## Development Workflow

### Creating a Feature

1. **Branch from `develop`** (or `main` if hotfix):  
   ```bash
   git checkout develop
   git pull
   git checkout -b feature/your-feature-name
   ```

2. **Implement across app layers:**
   - Update `docs/Enzo_Interiors_Backend_Schema_v2.0.md` if schema changes.
   - Implement API endpoint in `apps/api`, add RBAC Guard.
   - Implement UI in the relevant app(s); each keeps its own local types.

3. **Test locally:**
   - Run the app's checks (see Commands).
   - Run unit/e2e tests if available.
   - Manual test the feature in browser/app.

4. **Commit with clear message:**
   ```bash
   git add .
   git commit -m "Add [feature]: Brief description"
   ```

5. **Push and open PR to `develop`:**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **PR squash-merged to `develop`** (no staging environment exists yet) → QA → **`release/vX.Y.Z` cut from `develop`, stripped, PR (merge commit) → `main` → production deploy**

### Git workflow

- `main` = production only. Every push to `main` deploys via Coolify. Changes arrive only by PR from a `release/vX.Y.Z` branch (merge commit, never squash); tag each release `vX.Y.Z`. `main` holds only what production needs: the release branch runs `.github/strip-for-release.sh` (removes docs, AI/design tooling, promo-video, apps/portal, readmes) before its PR. Never merge `develop` into `main` directly.
- `develop` = integration branch (PR required, CI green, no force-push).
- Work on `feature/`, `fix/`, `chore/`, `docs/` branches cut from `develop`, one concern each, **squash-merged** into `develop`, then deleted. No stacked PRs.
- `hotfix/` branches are cut from `main`, PR'd to `main`, then PR'd to `develop` the same day.
- `release/vX.Y.Z` branches: cut from `develop`, run `sh .github/strip-for-release.sh`, commit, PR to `main`, tag after merge, then delete the branch. Nothing else is committed on them.
- Conventional commits: `feat(api):`, `fix(web):`, `chore:`, `docs:`, imperative and specific.
- Rollback = `git revert` the PR, never force-push `main`.
- Local compose needs a one-time `docker network create coolify` (the compose file joins the external network Coolify/Traefik uses in production).

---

## Critical Do's and Don'ts

### Do's
- ✅ Keep business logic in `apps/api` only.
- ✅ Use NestJS Guards for all auth/RBAC checks.
- ✅ Store all monetary values as `decimal`, never `float`.
- ✅ Build S3 signed URLs at runtime in the API; never return unsigned URLs or pre-signed URLs to cache.
- ✅ Reference S3 objects by key only in the database; never store full URLs or credentials.
- ✅ Keep each frontend's API types in its own `src/types`, mirroring what the API serves.
- ✅ Update documentation (especially `docs/architecture.md` or the schema) when making structural changes.
- ✅ Test RBAC with multiple roles (verify Designer/Installer cannot see other team members' assigned projects).

### Don'ts
- ❌ Never add a payment gateway, even as optional/experimental.
- ❌ Never add `tenant_id` fields or tenant-scoping logic.
- ❌ Never let frontends access PostgreSQL or S3 directly.
- ❌ Never hardcode RBAC checks in handlers; always use Guards.
- ❌ Never cache S3 signed URLs; always generate at runtime.
- ❌ Never use `float` for monetary fields.
- ❌ Don't break the single-app-per-deployment boundary (e.g. don't tightly couple admin + portal).

---

## Deployment & Environments

**Branching & Deploy Strategy:**
- `main` ← production (always deployable).
- `develop` ← integration branch (no staging environment exists yet; nothing deploys from it).
- `feature/*` ← short-lived branches off `develop`.
- `hotfix/*` ← urgent fixes off `main`, merged back to both `main` and `develop`.

**Infrastructure:**
- **Self-hosted:** Proxmox (home server) + Coolify (Docker PaaS).
- **Exposure:** Cloudflare Tunnel (no inbound router ports).
- **Monitoring:** Uptime Kuma (app uptime), Proxmox dashboard (host resources), GlitchTip (errors).
- **Database:** PostgreSQL 16 snapshots + off-site MinIO backup.

See `docs/Implementation_Plan_Enzo_Interiors.md` for full deployment & QA checklists.

---

## Where to Find Things

| Question | Location |
|---|---|
| What's the API contract? | `docs/Enzo_Interiors_TRD_v3.1.md` (API table) or `apps/api` (NestJS module/controller) |
| How should the Quote Calculator work? | `docs/Enzo_Interiors_App_Flow_v4.md` + `apps/api` `/quotes/estimate` endpoint |
| What routes exist? | `docs/websitemap.md` |
| What's the database schema? | `docs/Enzo_Interiors_Backend_Schema_v2.0.md` or `apps/api/prisma/schema.prisma` |
| Where do S3 files live? | `docs/Enzo_Interiors_Storage_Schema_v1.md` (folder layout) |
| Design tokens & component specs? | `docs/Enzo_Interiors_UI_UX_Brief_v6.md` |
| How do users move through the platform? | `docs/Enzo_Interiors_App_Flow_v4.md` (user journeys) |
| Branching & delivery checklist? | `docs/Implementation_Plan_Enzo_Interiors.md` |

---

## Setup Checklist (First-Time Development)

- [ ] `cp .env.example .env` at the root and fill in the secrets.
- [ ] Copy each app's `.env.example` (`apps/api/.env`, `apps/admin/.env.local`, `apps/web/.env.local`).
- [ ] `docker compose up -d --wait postgres minio minio-init`
- [ ] `npm ci && npm run db:setup` in `apps/api`, then start the three apps.

---

## References

- **Read first:** `docs/architecture.md`
- **Product vision:** `docs/Enzo_Interiors_PRD_v2.1.md`
- **Implementation roadmap:** `docs/Implementation_Plan_Enzo_Interiors.md`
- **API & tech specs:** `docs/Enzo_Interiors_TRD_v3.1.md`
- **Brand & design system:** `docs/Enzo_Interiors_UI_UX_Brief_v6.md`

---

**Last updated:** September 2026 | **Project Status:** v1 (public site + admin CMS) implemented; CRM and portal kept in code, not mounted.
