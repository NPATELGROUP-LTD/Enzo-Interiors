# Enzo Interiors Platform: how the code works

A plain-language tour of the whole codebase: what each part is, how a request travels through it, and where to look when you want to change something. It describes version 3.1.0. For deep detail on any one subsystem, `CLAUDE.md` and `docs/architecture.md` are the reference; this document is the map.

---

## 1. The big picture

One company (Enzo Interiors, Leicester), four separate programs that talk to one database.

```
 Visitors            Staff                 Clients
    |                  |                      |
 apps/web          apps/admin             apps/portal
 (Next.js)         (React + Vite)         (React + Vite)
 public site       staff back office      client self-service
    \                  |                      /
     \                 |                     /
      +-------- HTTPS + Socket.IO ----------+
                       |
                   apps/api  (NestJS)
          all business rules, all security
                  /          \
        PostgreSQL 16        S3 storage (MinIO)
        (Prisma)             public bucket: website images
                             private bucket: client documents
```

The one rule that shapes everything: **the frontends never touch the database or storage.** They only call the API. The API decides who may see or change what. That is why every screen is "thin": it shows what the API sends and posts what the user types.

| App | Technology | Who uses it | What it is |
|---|---|---|---|
| `apps/web` | Next.js (server-rendered) | Anyone on the internet | Marketing site, consultation booking, contact form, newsletter sign-up |
| `apps/admin` | React + Vite (installable PWA) | Staff | The back office: CMS, clients, projects, quotes, invoices, mail, team chat, settings |
| `apps/portal` | React + Vite (installable PWA) | Clients, by invitation | See their projects, approve work, view quotes, invoices and documents, message the studio |
| `apps/api` | NestJS on Node | The three apps above | Everything: login, permissions, data, files, email, real-time, alerts |

Each app installs and builds on its own (`npm ci` inside its folder). They share no code. Where two apps need the same type, each keeps its own copy on purpose, so one can be deployed without the others.

### Where the data lives

- **PostgreSQL** holds all records. The schema is `apps/api/prisma/schema.prisma`. Code never uses Prisma directly: it goes through `DatabaseService` (`apps/api/src/data/`), which gives each table a small repository.
- **Two S3 buckets.** The *public* bucket holds website images, whose links are stable and can be cached. The *private* bucket holds client documents, and the API signs a fresh 5-minute link for each download. The database stores only the file's key, never a link.
- **Redis** (optional) keeps rate-limit counters and a short-lived cache. If it is missing, the API falls back to memory and carries on.

---

## 2. How one request travels through the API

Example: a Designer opens a project page in the admin.

```
Admin  --GET /projects/42-->  API
  1. Rate limiter           (300 requests/min per IP, stricter on public writes)
  2. Access-log middleware  (notes failures, sign-ins, changes; never bodies)
  3. JwtAuthGuard           (reads the token, re-checks the staff row in the DB)
  4. RolesGuard             (does the route's @Roles list include this role?)
  5. Controller             (checks the input shape)
  6. Service                (the business rules + AccessService scoping)
  7. Store / Prisma         (SQL)
  <- JSON back, never including a storage key or another person's data
```

Things worth knowing:

- **Guards do the security, handlers don't.** `@Roles('Admin', 'Designer')` above a route is the permission. A route with no `@Roles` is open to every staff role, and a test (`infra.db.test.ts`) fails if a new such route appears. Client tokens are refused everywhere unless a route names `'Client'`.
- **Sessions can be killed instantly.** Each token carries a `tv` number copied from the user's `token_version`. Changing a password, role or email bumps it, so every older session stops working on its next request.
- **Scoping is a service job.** `AccessService` answers "which projects/clients/documents may this person see?": an Admin sees all, a Designer or Installer sees only projects they are assigned to, a client sees only their own shared records. Out of scope returns 404, not 403, so existence is not leaked.
- **Money is exact.** Prices use `Prisma.Decimal`, never floating point. VAT is applied once on the subtotal.
- **Migrations only add.** New tables, nullable or defaulted columns, indexes. Nothing is dropped, renamed or rewritten, so the previous version of the app still runs on the new database. A migration that has run is never edited. We are at migration 31.

### Sign-in and two-step verification

- **Staff** sign in at `POST /auth/admin/login`. After the password comes a second step: each person picks *email code* or *authenticator app* once, then only that method. App users get 10 recovery codes. Wrong codes are limited (5 per emailed code, 20 per account per day). "Remember this device" is a 30-day token kept in the browser. Secrets are sealed with AES-256-GCM (`core/crypto.ts`). Code: `modules/auth/two-factor.ts`, `totp.ts`.
- **Clients** sign in at `POST /auth/portal/login`. They do not choose a password. See "Inviting a client" below.
- **Lockouts and limits.** Repeated failed sign-ins lock progressively. A password reset does not lift a lockout, because locks only expire.
- **Roles:** `Admin` (everything in the business), `Editor` (CMS only, can edit and send for review, cannot publish), `Designer` and `Installer` (only their own projects and those clients, no money), and `Infra` (runs the platform, sees none of the business data).

---

## 3. The public website (`apps/web`)

### Content comes from the CMS

Every sentence and image on the public site is a row in the `cms_entries` table (a collection, a slug, a `draft` body and a `published` body, as JSON). The site reads the published body through the API. The admin's CMS editor builds its forms from the shape of that JSON plus hints in `apps/api/src/modules/cms/schemas.ts`, so adding a paragraph to a page needs no code change in either app.

Shipped copy lives in `apps/web/src/data/pages/*.json`. On every deploy a script (`npm run cms:import`) loads it:

- Entries nobody has edited follow the shipped JSON, so new wording ships automatically.
- Entries someone edited are never overwritten. Pages and the company record only gain keys they lack; list collections are never back-filled.
- `lib/content/merge.ts` (`withShipped`) lets an edited page fall back to shipped copy for a key it does not have yet.

### Site status and gating

`site_settings` holds a live / coming-soon switch and a launch time. `isLive()` is the single rule used by the layout, robots, sitemap and `llms.txt`. Staff can preview a gated site through a 10-minute token that turns on Next.js draft mode. Settings › Pages can also switch individual pages off.

### The home page hero

Desktop (1024px and wider) has a scroll-scrubbed intro: 432 pre-rendered frames across three rooms (media wall, kitchen, bedroom), played on a canvas while GSAP pins the section.

```
Hero.tsx decides what to mount:
  phone / tablet ................ HeroStatic     (stacked offer, no frames)
  desktop, first visit .......... HeroSequence   (432 frames, scroll scrub)
  desktop, seen the intro, or
  reduced motion ................ HeroCtaStatic  (the closing scene, still)
```

- Reaching the closing "Stop Dreaming. Start Building." scene writes `enzo:hero-seen` to `localStorage`. On the **next** page view the intro is skipped and the frames are never downloaded. It is not removed mid-scroll, because pulling a pinned section out from under the scroll position would make the page jump.
- `HeroCtaStatic.tsx` is deliberately the same markup as the closing layer inside `HeroSequence.tsx`, only still. If you change one, change the other.
- A tiny script in `app/layout.tsx` runs before paint so the navbar shows or hides correctly with no flicker.

### Process section

`ProcessLedger.tsx` pins on scroll and shows six stages (Consultation, Design, Making, Production, Fitting, Handover). `ElevationDrawing.tsx` draws a technical sheet of a fitted wardrobe that builds stage by stage: each stage's linework is a timeline; when you move on, what is no longer needed inks out first (fast), then the next stage draws. Phones skip the animation and show the finished sheet.

### Booking (`/booking`)

A five-step flow: Service, Date and time, Your details, Review, Confirmed (`app/booking/BookingWizard.tsx`).

```
page load  -> GET /booking/availability   free days + times
customer   -> picks service, a day and a time, fills the details
Review     -> POST /booking
API        -> checks the slot is still free, inserts the appointment
              (a unique index makes a double booking impossible),
              creates an enquiry, emails the customer and the studio,
              adds the event to the studio's Google Calendar if connected
```

Which contact fields are Required, Optional or Hidden is set in Settings › Booking schedule and enforced by both the form and the API. Times are computed in the Europe/London zone by `apps/api/src/modules/booking/slots.ts`. A booking does **not** create a client account; the Admin does that later with "Add as client".

### Contact form, newsletter, SEO

The contact form posts to `POST /enquiries`: it saves an enquiry, emails the visitor a confirmation and alerts the studio. The newsletter uses double opt-in (a confirm link, only confirmed people are sent to, every email carries an unsubscribe link). Once live, the site is indexed with a sitemap, structured data, `llms.txt` and generated social cards.

---

## 4. The admin (`apps/admin`)

Menu bar: Dashboard, CMS, Clients, Projects, Quotes, Invoices, Bookings, Enquiries, Messages, Team, Mail, Settings, plus the notification bell, search (Ctrl/⌘ K) and the profile menu. Which entries a person sees depends on their role. Below 1280px the bar collapses into a single button that opens a menu.

### Dashboard (`modules/dashboard`)

Three variants, all computed in SQL (no table is read whole): `/dashboard/admin` (money, enquiries, consultations, projects by stage, 12-month charts), `/dashboard/designer` (their projects only, no money), and `/dashboard/portal` for clients. "Received" counts the stage payments actually paid, so a part-paid invoice shows up.

### CMS

Pages, Services, Recent work, Testimonials, Team, FAQs, Menu and Company. An Editor edits and sends changes for review; an Admin publishes or sends it back with a note. The review state lives on the entry itself, and both sides are told through the bell (and the Admin by email too).

### Enquiries

Every booking and every contact-form message lands here (`modules/enquiries`), tagged with its source and given a reference like `ENQ-0004`. An Admin changes its status (New, Contacted, Converted, Archived), replies by email directly from the screen (the sent reply is stored on the enquiry, so the whole conversation stays in one place), or clicks "Add as client" to open a pre-filled client form.

### Clients

An Admin creates clients. A client has an address, phone and email in one place; project and invoice forms pre-fill from it so nobody types the same details twice.

**Inviting a client.** Nobody types a client's password.
1. The Admin clicks "Invite to portal".
2. The API creates a random strong password, stores only its bcrypt hash, and emails the client a sign-in link plus that password.
3. On first sign-in the portal pops up "we recommend changing this password", and the client may change it or keep it.
4. The emailed password expires after 7 days (`clients.default_password_expires_at`, migration 30). An expired one is refused with a message pointing at "Forgot password", and that attempt is not counted as a failure. Changing, keeping, or resetting the password ends the expiry. "Resend invite" issues a fresh password and a fresh 7 days.
5. Forgot password and invitation links are single-use JWTs bound to `clients.token_version`, claimed with one conditional `UPDATE`, so a link works once and old sessions die.

### Projects

Projects move through configurable stages (Settings › Project stages: name, progress %, and whether that stage needs client approval; several stages may need approval). Progress is never typed: it follows the stage.

- **Team.** A project can have several designers and several installers (`project_members` table). The older single-designer/installer columns remain as a fallback until `npm run team:backfill` has copied them across.
- **Installers.** The Admin sets each installer's start and end dates and chooses when to send them. Each installer has their own pay, visible only to the Admin and that installer. They approve dates and pay separately, and can suggest other dates; the Admin accepts or declines.
- **Change requests.** A Designer who wants to change a client's phone/address/notes, or an Installer who wants to move a stage, files a request (`modules/change-requests`). An Admin approves (the change is replayed as the Admin) or declines, and the asker is told.
- **Project thread.** Each project has a staff-only thread with text, files and video (100 MB limit: mp4, mov, webm). Its audience is the project's members plus all Admins. Clients never see it.
- A client sees only projects the Admin has marked `client_visible`, and can approve a stage or request changes.

### Documents

Files go into the private bucket under `clients/<id>/projects/<id>/<uuid>-<name>`. Uploads are limited to 25 MB and the file type is checked by its first bytes, not its name. A file starts hidden from the client; the Admin shares it per document and can allow or forbid download. Categories are editable in Settings. For clients the portal shows documents in a viewer with a watermark, blocks save and print, and blanks the view when the tab loses focus. This is a deterrent, not a lock: browsers cannot truly stop screenshots.

### Quotes (`modules/quotes`, migration 31)

Admin only. An Admin writes an itemised quote for a client's project: lines (quantity and net price), a pre-VAT discount, VAT, a valid-until date and notes, drawn on the same A4 sheet as invoices. States: Draft, Sent, Accepted, Declined, Withdrawn. The client opens it in the portal and accepts or declines once, with an optional note; the Admin is told by the bell and email. A declined quote can be edited and re-sent. On an accepted quote, "Create invoice" copies the lines into one Draft invoice with the 50/40/10 stages. Nothing is created automatically.

### Invoices (`modules/invoices`)

Admin only to write. Lines live in `invoice_items`; `invoices.amount` is the gross payable, computed in the API (each line to the penny, VAT once on the subtotal). Lines and VAT can be edited only while Draft. Payment is split into **stages** (default 50% at start, 40% at installation, 10% after completion; each has a label and is either a percentage or a fixed £ amount). The Admin marks each stage paid with a date; the invoice becomes Paid only when every stage is paid. A global bank-details block (Settings › Bank details) prints on every invoice. There is **no payment gateway**, by permanent decision: money is taken outside the system and recorded by hand. Deleting a Paid invoice needs the Admin's password again.

### Messages and Team chat

- **Messages** (`modules/conversations`): one conversation per client between that client and the studio.
- **Team** (`modules/team-chat`): staff direct messages and the per-project threads. Never visible to clients or Infra.
- Both ride the Socket.IO gateway on the API. The gateway authenticates every connection and re-checks each member before delivering, so a signed-out or demoted person is dropped. If the other side is offline, they get a bell entry and an email, at most once per conversation per 15 minutes. Push notifications and bells carry who and where, never the message text.

### Mail (`modules/mailbox`)

Each staff member can connect their **own** Gmail (separate from the studio-calendar connection and from Sign in with Google). It lists every folder and label, reads and searches messages, shows attachments, sends, replies and forwards (with attachments), and marks read/unread. It uses the single Google scope `gmail.modify`, never deletes or trashes mail, and stores only an encrypted refresh token. Enquiry replies can thread with it.

### Search

The search bar (`modules/search`) takes a reference number (`ENQ-0004`, `PRJ-0012`, an invoice number) or a small detail (name, email, phone) and returns records the caller is allowed to see, so a Designer's results include only their own clients and projects. Choosing a result opens it.

### Settings

Website status, page switches, logo and favicon (light and dark), notification emails, opening hours, booking schedule (and the Google Calendar connection), newsletter, project stages, document categories, bank details, users, and, for Infra only, Alerts, Security and Health.

### Keeping screens fresh

After any successful write, the API broadcasts a bare `data:changed` ping, bundled into one every half second (`notifications/change-broadcast.ts`). Every open `useApi` hook in the admin and portal quietly refetches. Refetches also happen when the tab regains focus and every minute. The hook keeps the same data object when nothing changed, so a form being edited does not get overwritten.

---

## 5. The client portal (`apps/portal`)

Clients arrive only through an invitation. They get a dashboard, their shared projects (with approve and request-changes), quotes, invoices (view, print, and an A4 PDF drawn in the browser by `lib/invoicePdf.ts`), documents, messages and settings (change password, choose which notifications to receive by bell, email and push). The look matches the admin. Both apps show an install prompt on phones that have not installed them; "Not now" hides it for two weeks. The service worker caches only the app shell: every API call goes to the network.

The client's notification choices are stored per kind of update (project, invoice, document, message). `NotificationsService.notifyClient` is the one gate for the bell, devices and email.

---

## 6. Cross-cutting systems

| Concern | How it works | Where |
|---|---|---|
| **Email** | One `MailService` over SMTP. Unset `SMTP_HOST` just logs. Locally, Mailpit catches mail on :8025. | `core/mail.service.ts` |
| **Notifications** | Every bell notification is also stored for the person, pushed to their devices (Web Push, needs VAPID keys) and emitted live over Socket.IO. | `modules/notifications` |
| **Google Calendar** | An Admin connects the studio calendar once. Busy times block booking slots; bookings create, move and delete events. A Google outage fails open. | `modules/calendar` |
| **Activity log** | Who changed what. `SECURITY_ACTIONS` (a user invited, role changed, record deleted…) also send a `[SECURITY]` email. | `core/activity-log.service.ts` |
| **Access log** | Sign-ins, changes and refusals with route pattern, IP, country and device; kept 90 days; never bodies. Visible to Infra. | `core/access-log.service.ts` |
| **Alerts** | Errors are emailed to the platform's operators (`[Enzo][ERROR]`, `URGENT`, `SECURITY`), deduplicated, capped per hour, with sensitive details scrubbed. | `core/alert.service.ts`, `modules/alerts` |
| **Health + daily summary** | Settings › Health shows database size, storage, cache, 24-hour failures and a checklist; an 08:00 `[DAILY]` email summarises it. | `modules/infra` |
| **Rate limits** | 300/min per IP, tighter on public writes; counters in Redis when available. | `core/rate-limit.ts` |
| **Legal pages** | Privacy, Terms and Cookies in the admin and the portal are code, not CMS (`apps/*/src/lib/legal.ts`). They state the controller (Enzo Interiors Ltd, company 16540291, ICO registration ZC047912) and processor (NPATEL GROUP LTD). The public site's legal pages are CMS content. If a feature changes what is collected, update the text in both apps. | `lib/legal.ts` |

---

## 7. Data model in one page

```
staff_users ──< project_members >── projects >── clients
                                      │            │
                                      ├──< documents (private bucket, key only)
                                      ├──< project_quotes ──< project_quote_items
                                      ├──< invoices ──< invoice_items
                                      │           └──< invoice_stages (paid per stage)
                                      └──< staff_threads ──< staff_messages
clients ──< conversations ──< messages
contact_submissions (enquiries, ENQ-ref)   appointments (bookings, unique slot)
cms_entries (draft + published JSON)       media_assets (public bucket keys)
site_settings (one row)   booking_settings (one row)   alert_settings / alert_events
notifications  push_subscriptions  access_events  activity_logs
newsletter_subscribers / newsletter_campaigns
```

Retired but kept (because migrations only add): the old `quotes`, `quote_line_items`, `components` tables and `bookings`. Nothing reads or writes them.

---

## 8. Deployment, branches and checks

- **Hosting:** a home server running Proxmox, with Coolify (Docker) and a Cloudflare Tunnel (no inbound ports opened). Each push to `main` deploys.
- **Branches:** `main` is production only. Work happens on `feature/`, `fix/`, `chore/`, `docs/` branches cut from `develop` and merged by pull request. A release is `release/vX.Y.Z` cut from `develop`, run through `.github/strip-for-release.sh` (which removes docs and tooling production does not need), merged into `main` with a merge commit and tagged. Never merge `develop` into `main` directly.
- **After deploying v3:** run `docker compose run --rm seed npm run team:backfill` once.
- **Checks (per app):** `npm run typecheck`, `npm test`, `npm run build`; the API also has `npm run test:db`, which boots the real app against a real PostgreSQL in Docker (a separate `enzo_test` database). CI runs them, plus `npm audit`, secret scanning and static analysis. CI currently runs on a self-hosted runner chosen by the repository variable `CI_RUNNER` (see `docs/ci-runner.md`).
- **Local development:** start PostgreSQL and MinIO with `docker compose up -d --wait postgres minio minio-init`, then run each app with `npm run dev` (api :4000, web :3000, admin :5174, portal :5175).

---

## 9. Where to look when you want to change something

| I want to change… | Start here |
|---|---|
| Wording or images on the public site | Admin › CMS (no code); shipped defaults in `apps/web/src/data/pages/` |
| The home hero or Process drawing | `apps/web/src/components/landing/` (`Hero.tsx`, `HeroSequence.tsx`, `HeroCtaStatic.tsx`, `ProcessLedger.tsx`, `ElevationDrawing.tsx`) |
| Booking form steps or look | `apps/web/src/app/booking/BookingWizard.tsx`; rules in `apps/api/src/modules/booking/` |
| Who can do what | The route's `@Roles(...)`, then `apps/api/src/common/access/` |
| An email's wording | `apps/api/src/core/mail.service.ts` |
| Invoice maths or stages | `apps/api/src/modules/invoices/totals.ts`, `invoices.service.ts` |
| Legal text | `apps/admin/src/lib/legal.ts`, `apps/portal/src/lib/legal.ts` |
| A database table | `apps/api/prisma/schema.prisma` plus a new additive migration |
| A setting an Admin can flip | `modules/site-settings` / `modules/settings`, and the matching page in `apps/admin/src/pages/settings/` |

### Rules to keep in mind

1. Business logic lives in the API only.
2. Permissions are guards and `@Roles`, never ad hoc `if` checks in handlers.
3. Money is `Decimal`, never `float`.
4. Storage keys in the database, signed links made at request time, never cached.
5. Migrations add, never remove.
6. No payment gateway, no multi-tenancy, no native apps, no 3D generation. These are permanent decisions.
