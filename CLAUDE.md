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
  dark), notification emails, opening hours, booking schedule, newsletter, bank details, document categories,
  users). **Shell** (`components/layout/Desktop.tsx`, each app its own copy): no window around the page. A glass menu bar, then a heading row (the page's heading top left with a back link where there is one, its buttons top right; a page fills both through `<PageHeader>`, otherwise the section's name shows), then the page straight on the canvas with its cards floating. From lg up the admin's menu bar is Dashboard and four menus: **Work** (Clients, Projects, Quotes, Quote maker, Invoices, Inventory), **Inbox** (Enquiries, Bookings, Messages, Team, Mail; the name carries the total of its badges), **Website** (the CMS and its sections) and **Settings**. Each lists only what the role may open and an empty group is not shown; Work and Inbox open on a click or tap as well as on hover. Below lg the pages are a bottom bar of icons (`BottomBar.tsx`: admin Dashboard, Projects, Clients, Bookings first; portal Home, Projects, Messages, Documents) with the rest under More: one icon per 64px of width, eight at most (`lib/bar.ts`), in the page's column so nothing sits behind it. Each screen lists its own sub-views. View website is in the profile menu and on the CMS overview. **Opening animation** (`components/Splash.tsx`, `.splash` in `styles/theme.css`, `public/theme-init.js`): on a device's first load and again 8 hours after it last played (`enzo:splash-at` in localStorage), the logo on brand green slides up and the green lifts off with a sagging edge, about 1.6 s, over whatever page loads; it plays under reduced motion too (the owner's decision). The logo is Settings' "Logo on dark backgrounds", its address remembered from the last showing (`enzo:splash-logo`), else the shipped mark. Your own
  name/password/appearance are under the profile menu at `/account`. Plus the
  notification bell, search (Ctrl/⌘ K) and forgot/reset password (also used to
  accept an invitation). **Messages** (`/messages`, Admin + Designers; `?client=` opens
  or starts that client's thread; badge in the menu bar). **Mail** (`/mail`, Admin + Designer + Editor, shown only when `GOOGLE_GMAIL_REDIRECT_URI` is set; Account › Mail links and unlinks) and **Team** (`/team`, staff chat, unread badge). Ctrl/⌘ K also finds a record by its reference (`PRJ-0012`, `ENQ-4`, `EZ-…`, an invoice number) or by a name, email or phone, and opens it.
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

**Enquiries inbox:** `/enquiries` (Admin only; menu bar entry with a New badge). `GET /enquiries` (status filter, `before` cursor, `new_count`), `GET /:id`, `PATCH /:id` (status only: New / Contacted / Converted / Archived). "Add as client" opens `/clients?new=1` prefilled. `contact_submissions.source` (Contact / Booking / Quote, null on old rows, migration 21) tags where it came from; a visitor's booking also creates one (`kind` booking, no setup email: the Admin still adds the client with "Add as client"), staff bookings do not. `GET /enquiries/:id` returns the enquiry with its `messages`; `POST /enquiries/:id/reply` (Admin, 20 per 15 min) emails the enquirer as plain text from the studio mailbox, Reply-To the first notification address, stores it in `enquiry_messages` and moves New to Contacted; all sending is `EnquiriesService.deliverReply`. `DELETE /enquiries/:id` and `DELETE /appointments/:id` (Admin only, `{ password }` re-auth, 10 per 15 min, logged as `enquiry_delete` / `appointment_delete` with a `[SECURITY]` alert) remove a row for good: an enquiry takes its replies with it (FK cascade); a booking first has its Google Calendar event removed, frees its time and emails nobody (Cancel is the way to tell the customer). A booking's enquiry, and a client made from either, are separate and stay. The contact form emails the visitor a generic confirmation and the studio the enquiry plus the bell; with no notification address and no `ADMIN_EMAIL` the studio mail goes to the Admin users.

**Infra manager** (`staff_users.role = 'Infra'`, plain text, no migration): runs
the platform, never the business. It reaches Settings › Website, Pages, Alerts
and Users (`GET/PUT /settings`, `/alerts`, `/users`), the bell and its own account, and
nothing else: no client, project, invoice, document, message, enquiry or booking
(it is not an Admin to `AccessService`, and `infra.db.test.ts` asserts 403 on each
of those routes). It lands on `/settings`. Only Infra invites, promotes, demotes,
removes or resets two-step sign-in for an `Admin` or another Infra manager
(`PRIVILEGED_ROLES`, `assertMayManage` in `modules/auth/users.ts`); removing one
needs the caller's password again. An Admin manages Editor/Designer/Installer
directly and asks for another Admin to go (`POST /users/:id/removal-request`,
reason ≥ 5 characters, one pending per person): the Infra managers get the bell, a
push and an email, then approve with their password
(`POST /users/removal-requests/:id/approve`, claimed by one conditional UPDATE,
reverted if it fails) or decline with a note; the Admin is told. Table
`staff_removal_requests` (migration 17; `change_requests.client_id` is required,
so it is not a kind there). Nobody removes or demotes themselves or the last Admin
or the last Infra manager. The first Infra manager is made by script:
`npm run auth:make-infra -- <email>` (Docker: `docker compose run --rm seed npm
run auth:make-infra -- <email>`); use a separate login from the Admin. A route
with no `@Roles` is open to every staff role, Infra included, so
`infra.db.test.ts` lists the only four (own devices, own Google link) and fails
on any new one. Mock data adds `infra@` and `admin2@` with a pending request.

**Alerts** (`core/alert.service.ts`, `modules/alerts`, Settings › Alerts for Infra
only; migration 18 `alert_settings` + `alert_events`): problems are emailed to the
people who run the platform, from `ALERT_FROM` (an alias of the no-reply mailbox;
same SMTP login via `MailService.send({from})`), subject `[Enzo][ERROR] ...`
(`URGENT`, `ERROR`, `SECURITY`). Recipients = the saved list, else `ALERT_TO`.
What reports: a global filter on API 5xx (not 503), a failed customer email
(`MailService.onFailure`), Google Calendar `needs_reconnect`, a stopped newsletter
send, the website's `onRequestError` (`instrumentation.ts` → `POST /alerts/web`,
header `x-alert-secret` = `ALERT_SHARED_SECRET`, off when unset) and the admin and
portal (`lib/report.ts`, window errors, unhandled rejections and the ErrorBoundary →
`POST /alerts/browser`, public, known `Origin` only, 10/15 min, production builds
only). Everything is counted in `alert_events` (one row per fingerprint, 30 days) but
only the first of a problem per 15 minutes is emailed, with a count of the rest, and
each bucket (api, system, web, admin, portal, priority) stops at an hourly cap with
one "limit reached" email; this state is in memory, which is fine for one API
instance. An alert carries the route as written, the status, the first line of the
error (addresses, tokens, ids and query strings stripped by `alert-scrub.ts`) and
`file:line`: never a body, a person or a client. Errors can be switched off in
Settings; urgent and security cannot. `ALERT_FROM` unset sends from `MAIL_FROM`;
SMTP unset sends nothing.

**Access log** (`core/access-log.service.ts`, `data/access-store.ts`, migration 19
`access_events`; Settings › Security for Infra only, `GET /access-log`, Admin gets
403): who signed in, what changed or was refused, from where. A middleware
(`CoreModule.configure`) writes on `res.finish`, so a guard's or the rate limiter's
refusal is seen too; `SignInNote` (an interceptor) tells it who a login response
signed in. Logged: sign-ins (kind `signin`), every non-GET, every 4xx/5xx, and the
reads in `READS` (downloads, exports, these logs being opened; repeats within a
minute collapse). Not logged: plain successful GETs, unmatched paths, `QUIET`
heartbeats. A row holds the route as a pattern (never the URL or a query), the first
`:id`, status, IP (`clientIp`), country (`CF-IPCountry`, believed only with
`TRUST_CLOUDFLARE=true`) and "Chrome · Windows" from `deviceOf`; never a body or a
raw user agent. A failed sign-in keeps the typed address masked. Rows are deleted
after 90 days (hourly, in the writer). Alerts it raises: a 429 on a sign-in route
(lockout or rate limit), and a staff sign-in from a country or device not seen in the
last 90 days (their first one is not). `ActivityLogService.record` also emails a
`[SECURITY]` alert for `SECURITY_ACTIONS` (staff invited, role changed, removed,
two-step reset, Admin removal requested, client/project/invoice deleted), naming who
did it and never the target. `GET /activity-logs` is Admin + Infra; Infra gets
`details: null` except on `PLATFORM_TABLES` rows. If the access log changes, change
the privacy text in `apps/admin` and `apps/portal` `lib/legal.ts`.

**Health, attack alerts and the daily summary** (`modules/infra`, `data/infra-store.ts`,
migration 20 adds `alert_settings.digest_on` / `digest_day`; Settings › Health for Infra
only, `GET /infra/stats`, Admin/Editor 403). Counts and sizes, never a client's content:
database size, connections and the biggest tables from PostgreSQL's catalogue; object
count and bytes per bucket via ListObjectsV2 (cached 10 min, stops at 50k files); the
cache (`CacheService.stats()`: Redis or memory, keys, hits/misses since start); the last
24 hours of 5xx and 4xx by hour, failed sign-ins and top failing routes from
`access_events` (every failure is logged, successful reads are not, so there is no
request total); problems emailed (7 days); and a checklist of switches (`SMTP_HOST`,
recipients, `ALERT_SHARED_SECRET`, `TRUST_CLOUDFLARE`, VAPID, Redis, `DISABLE_2FA`).
`InfraWatch` runs every 5 minutes on a timer: 10+ failed sign-ins from one address in
10 minutes, or 100+ refusals (401/403/404/429) in 5, raise a `[SECURITY]` alert (alert
only: blocking is by hand in Cloudflare, since many people share an address); and from
08:00 Europe/London it sends the `[DAILY]` summary once a day to the alert recipients
(`InfraStore.claimDigest` is one conditional UPDATE, so a restart cannot resend it; a
failed send is not retried that day, its absence is the signal). The Infra manager turns
it off and sends one now in Settings › Alerts. It carries no names or money.

**Monitoring** (`docs/monitoring.md`): alerts, the daily summary and Settings › Health are
email only, tagged `[Enzo][URGENT|ERROR|SECURITY|DAILY]`. UptimeRobot and Coolify watch from
outside; `.github/workflows/security.yml` runs `npm audit`, gitleaks and semgrep (none is a
required check) and `.github/dependabot.yml` opens weekly PRs into develop.

**Roles (v1):** Settings › Users assigns `Admin`, `Editor`, `Designer` or
`Installer` (and, by an Infra manager, `Infra`). `Admin` does everything in the
business. The CMS is Admin + `Editor` only (API
`@Roles`, menu, routes and search): an Editor edits and sends changes for
review; cannot publish, add or delete entries, or see Bookings/Settings. An
Admin's send-back note stays on the entry (`cms_entries.review_feedback`)
until the next send or publish. Reviews live on the entry
(`cms_entries.review_*`) and clear on publish or send-back; both ends are told
through `notifications` (the bell) and admins by email too. **Clients:** Admin
all; `Designer` and `Installer` only clients with a project
they are a member of (`project_members`, migration 22: any number of designers and installers per project; the legacy `projects.assigned_designer_id` / `assigned_installer_id` still grant access and mirror the first of each)
(`AccessService.projectScope`; `clients.assigned_staff_id` also grants a Designer the client, which is how a Designer sees one they added before any project),
read-only; Editors none. An Admin or a Designer adds a client (`POST /clients`, **name only is enough**: `email` is optional, a Designer's is assigned to them and Active); only an Admin edits one and invites it. `GET /clients` also carries `active_projects` (SQL count, within the caller's project scope) and, Admin only, `outstanding` (SQL sum of Sent/Outstanding/Overdue invoices); the list opens a client's page, where Edit, Delete and Invite live. A client with no email is stored with a unique stand-in `client-<uuid>@no-email.invalid` (`modules/clients/no-email.ts`; `clients.email` stays NOT NULL UNIQUE, no migration), shown as `''`, never emailed, and `POST /clients/:id/invite` refuses it until an Admin adds a real address. **Projects:** Admin all
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
PDF/CSV export. Deferred: emailing an invoice. An invoice can be paid in stages (`invoice_stages`, migration 24): a label (the trigger), a percentage of the gross or a fixed £ amount, worked out in the API with `Prisma.Decimal` (each to the penny, the last takes the remainder, a mix that does not sum to the total is refused). Stages edit until one is paid. The Admin records each stage paid with a date (`PUT /invoices/:id/stages/:stageId/paid`; undo with `DELETE` while the invoice is not fully paid); the invoice becomes Paid only when every stage is, through the mark-paid transaction (client `total_spent` once). Whole-invoice mark-paid is refused while a stage is unpaid; an invoice with no stages behaves as before. Settings › Bank details (Admin only, `site_settings.bank_details`) is printed on every invoice sheet/PDF and only sent inside authenticated invoice payloads, never `/content/site` or `GET /settings` (an Infra manager is 403 on it). Settings › VAT (Admin only, `GET/PUT /settings/vat`, the existing `business_settings.vat_rate` row, created on first save; none = 0%) is the rate a new quote or invoice starts with, in the editors and when the API gets no `vat_rate`; saved ones keep their own. Purchase orders keep their own default (20%: the supplier's VAT, not ours). Invoices have `client_can_download` (default false, `PATCH /invoices/:id/client-download`): without it a client sees the invoice but gets no Download / Print. `job_address` defaults to the project's `site_address`, then the client's.

**Project team** (`modules/projects/team.*`, migrations 22 `project_members` and 23 `installer_assignments`): the Admin adds and removes designers and installers on a project (`POST /projects/:id/team`, `DELETE .../team/:memberId`; `PUT /projects/:id` no longer takes `assigned_*`). `npm run team:backfill` (Docker: `docker compose run --rm seed npm run team:backfill`) copies the legacy single designer/installer into the table (idempotent; reads also do it per project) and is run once after deploying v3. For each installer the Admin sets start/end dates and a pay amount + note (`PUT .../team/:memberId/installation`), then **Send to installer** (`POST .../send`: bell, push, email; before that the installer sees nothing). The installer approves or declines the pay (`POST .../pay`) and approves the dates (`POST .../dates/approve`) separately, or suggests other dates with a comment (`POST .../dates/suggest`); the Admin accepts or declines (`POST .../suggestion`) and is told of each answer by bell and email. An Admin edit to dates or pay after sending resets that approval and tells the installer. **Pay (`installer_assignments.pay`, `pay_note`) is visible only to the Admin and that installer, once sent**: one allow-listed view (`termsView`), never in lists, the dashboard, another member's view, the client's, activity logs (names only), bells, push or email. Designers see team names only.

**Team chat** (`modules/team-chat`, migration 28 `staff_threads` / `staff_messages` / `staff_thread_reads`; admin `/team` and a Team card on each project; staff only, clients and Infra get 403): a project thread (`GET /team/projects/:id/thread`) for the people on the project plus every Admin (a Designer or Installer off the project gets 404; an Editor reaches no project thread), and direct chats (`POST /team/direct`), one per pair, readable only by the two (not even an Admin). One file per message: JPG/PNG/WebP, PDF or MP4/MOV/WebM up to 100 MB, sniffed by first bytes, kept in the private bucket under `team/<thread>/…` and opened through a 5-minute signed link per request; keys never leave the API. Live over the socket (`team:message`, sender excluded); the bell and push say who and where, never the message text. Ceilings: uploads are buffered in memory, and files are not removed when a project is deleted.

**Live refresh, search and the home intro:** after any successful write the API sends a payload-less `data:changed` over the socket (`ChangeBroadcast`, coalesced 500 ms); `useQuery` in the admin and portal refetches quietly on it, on tab focus and every 60 s. Column headers sort the main list tables (`useSort`, `sortRows`). `projects.ref_no` and `contact_submissions.ref_no` (migration 29, autoincrement, unique) display as `PRJ-0012` / `ENQ-0004`. `GET /search?q=` (Admin, Designer, Installer; 403 otherwise) finds clients, projects, invoices, enquiries and bookings by reference, name, email or phone; a Designer or Installer only gets their own clients and projects, never invoices, enquiries or bookings. On the public home page reaching the hero's CTA stores `enzo:hero-seen` in localStorage; later visits (desktop, motion allowed) do not mount the hero or load its frames, read once per page view so it never vanishes under someone mid-scroll.

**Quotes** (`/quotes`, menu bar **Quotes**, migration 31 `project_quotes` + `project_quote_items`; the retired `quotes` tables are untouched): an Admin writes a quote for a project of a client (net lines, discount before VAT, VAT, valid-until, notes; `amount` is the gross from `invoices/totals.ts`) and sends it. Draft -> Sent (the client is told, kind `invoice`) -> Accepted | Declined, answered once by the client in the portal (`POST /quotes/:id/respond`, one conditional UPDATE; Admins are told, kind `request`). A Declined quote is edited and sent again; Sent can be withdrawn to Draft; only Draft/Declined are deleted. A line is a cost plus a margin % (migration 32 `cost_price`, `margin_pct`; the API works `unit_price` out to the penny and ignores the browser's sum); the editor reorders lines by drag (dnd-kit) or arrow keys and has a Client preview tab. A client's quote carries totals only (`items: []`, so no lines, cost or margin): the portal shows "Installation charges", subtotal, discount, VAT and total. `POST /quotes/:id/invoice` turns an Accepted quote into one Draft invoice with the lines, VAT, discount and the 50/40/10 stages. Admin and Client only (a client never sees a Draft); Designers and Editors get 403. A quote opens at `/quotes/:id` on the invoice's letterhead sheet (`InvoiceSheet kind="quote"` + `quoteSheet()`, identical copies in admin and portal): lines and sections are edited on the sheet like an invoice's (cost + margin per line), a Client copy tab shows what the client gets (totals only), and the quote carries `issuer`, `client_email`, `client_phone`, `job_address` for the letterhead. The admin no longer offers to write a quote by hand: a quote is made from a design (`POST /quotes` stays for the API and tests). `apps/api/src/modules/quotes`, `quotes.db.test.ts`.

**Inventory** (`/inventory`, menu bar **Inventory**, Admin only; migration 34 `inventory_items` / `inventory_suppliers` / `stock_movements`): stock for the whole business in whole units (Sheet, Hardware, Bought-in; sheet size is a note). Every change is an append-only `stock_movements` row (receive with a net cost, issue, adjust ± with a reason) written with the item's count in one transaction by `InventoryStore.book` (`data/inventory-store.ts`): every count or hold change first locks the item row (`SELECT … FOR UPDATE`), a CHECK keeps `on_hand` ≥ 0, and a receipt re-averages `avg_cost` in SQL decimals. An item with history is switched off, never deleted. At or under `reorder_level` of **free** stock the Admins get one bell + push + email (`LowStockWatch`, `low_notified`, re-armed after a restock; kind `stock`). **Project stock** (migration 35 `project_materials`, `stock_movements.project_id`, `inventory_settings`; `modules/inventory/project-stock.ts`, admin `components/ProjectMaterials.tsx` on the project page): per project and item `needed` / `reserved` (held) / `issued` (used). Held stock is not stored on the item: free = `on_hand` − Σ `reserved`, so deleting a project (lines cascade) frees it. The Admin sets needs and holds/lets go (never more than free or still needed; "Hold what is needed" takes what it can, the rest shows as short); an Installer on the project, and the Admin, books Use (from the hold first, then free) and Return (at most what was used); workshop use without a project cannot take held stock; a Designer reads it; cost (Σ issue − return at the cost booked) is Admin only. The stage chosen on the Inventory page (`PUT /inventory/settings`, null = by hand) holds each line's remaining need when a project enters it; the last stage lets every hold go. Projects tells it through `stageListeners` in `projects.service.ts`, so projects imports nothing from inventory; a renamed stage is not followed (pick it again). Self-contained: `modules/inventory/` + the store + one line each in `DatabaseService` and `AppModule` (+ the `ProjectMaterials` line in ProjectDetail); admin `pages/Inventory.tsx` keeps its own types. **Purchase orders** (migration 36 `purchase_orders` / `purchase_order_items`, `stock_movements.po_id`; `modules/inventory/orders.ts`, admin `components/inventory/Orders.tsx`, tabs Orders and Shortfall): one supplier per order, net line costs, VAT and gross from `invoices/totals.ts`, shown as `PO-0001`. Draft (edited whole, deleted) -> Sent (Mark as sent; Print / PDF reuses the invoice print rules) -> Part-received -> Received, or Cancelled while nothing has arrived; Sent goes back to Draft. Status moves are one conditional UPDATE. Book in (`POST /inventory/orders/:id/receive`) is one transaction that locks the order: each line's `received` rises by a conditional UPDATE that never passes `quantity` (and a CHECK), and each is a receipt at the line's cost. On order = Sent/Part-received lines not yet in, shown on each item. Shortfall (`GET /inventory/shortfall`) suggests, per item, the projects' unheld need plus enough to sit above the reorder level, less free stock and what is on order; each supplier's group becomes one Draft. Price history (`GET /inventory/items/:id/prices`) is the receipts, with the order's supplier. `GET /inventory/projects/:id/cost` (Admin) gives stock used vs the cost side of the project's accepted quotes. A quote line's name offers the active items (a datalist): picking one fills the name and its average cost; no inventory = plain text. A supplier with orders is not deleted. **Item specs** (migration 37): size in mm, grain, board role, swatch, a public-bucket photo (`image_id`, FK set null), a `[{label, value}]` spec list, `show_on_site` + `public_name` (finishes the quote maker may offer) and `quote_cost` (Admin only; null = `avg_cost`). The Admin edits them in the item form; an **Editor** gets Inventory as a catalogue only (`GET /inventory/catalogue`, `PUT /inventory/items/:id/specs`, allow-listed: never cost, stock, supplier or orders; anything else in the body is a 400). `inventory.db.test.ts`.

**Quote maker** (`modules/quote-maker`, `data/quote-maker-store.ts`, migration 38 `unit_templates` / `quote_maker_settings`; plan in `docs/Quote_Maker_Plan.md`): the API side of the bedroom / media wall / office / alcove / kitchen quote maker. `engine.ts` is the prototype's maths (commit `db1a682`), pure and tested: panels nested on whole sheets per board across the whole design (guillotine, grain kept, kerf and edge trim, oversize pieces charged the boards to joint them), + hardware (`qty × cost`) + labour (`labour_hours × hourly_rate + labour_extra`) per unit, × (1 + margin), + VAT from Settings › VAT, range ± % rounded to £`round_to`. Pence inside, £ out. An item's cost is `quote_cost`, else `avg_cost`; any board or fitting used at £0 makes the range `priced: false` (shown as "we'll price this for you"), never a low figure. A slot's board is the visitor's pick (only `show_on_site` items of the slot's roles), else the slot's own default (switched off = the unit is unavailable, never a silent swap), else the Pricing settings' default for the role. The **browser never prices**: `GET /quote-maker/catalogue` and `POST /quote-maker/estimate` (Public, 60/min, behind the Settings › Pages switch `quote`, default off, 403 while off) carry no costs, panels, hardware, labour or names of boards not on offer; a design is ≤ 80 units and ≤ 3000 pieces (`MAX_PIECES`, about 90 ms worst case). Admin only: the unit library (`GET/POST /quote-maker/templates`, `GET/PUT /quote-maker/templates/:id`, whole replace, item ids checked on save, `problems` lists why a unit cannot be priced; no delete yet: switch off), Pricing settings (`GET/PUT /quote-maker/pricing`, logged `quote_pricing_update`) and `POST /quote-maker/breakdown` (sheets with cutting layouts, hardware, labour, cost, margin, per-unit lines; staff may price any active board and switched-off units). The starter library (`starter.ts`, 26 units incl. the agreed kitchen set; appliance gaps are `mount: 'gap'`, unpriced; plinth and worktop are cut with each base unit) is imported by `cms:import` on every deploy: missing units added, ones still `updated_by = 'starter library'` follow the shipped copy, edited ones kept; it names no boards, so nothing prices until the four role defaults are chosen. Variant ids are kept on save (designs point at them). **Saved designs** (`modules/quote-maker/designs.ts`, its own module; migration 39 `quote_designs` + `project_quotes.design_id`, set null; Admin only): `POST /quote-maker/fill` turns the questions (room type, layout, wall lengths, ceiling, island, wall units above, a finish per role, appliance gaps) into a plan to carry on from; `GET/POST /quote-maker/designs`, `GET/PUT/DELETE /quote-maker/designs/:id` (the plan is checked: walls per layout, sizes, every unit real and on its wall; it is priced again on every save, unpriced = null range, never refused); `POST .../:id/quote {project_id}` writes a Draft project quote through `QuotesService.create` (one line per kind of unit per run, `cost_price` + the pricing margin, gaps as 0-priced rows, ≤ 50 lines; `design_id` is set only here, never from a body); `POST .../:id/materials {project_id}` raises the project's needs to the whole sheets and fittings it uses (never lowers one). Admin screens: menu **Quotes** (`/quotes`, one page with tabs Designs, Quotes, Unit library, Pricing via `?tab=`; `/quote-maker/new`, `/quote-maker/:id` the design editor: room + questions, each run drawn from the front to scale in mm with drag / arrow-key moves and overlap warnings, the API's breakdown with cutting layouts beside it, and a 3D view (plain `three`, lazy-loaded chunk, boxes at true sizes and colours, no render)). `apps/admin/src/components/quote-maker/` keeps its own types. `engine.test.ts`, `quote-maker.db.test.ts`, admin `plan.test.ts`. **Website** (`/quote`, `apps/web/src/app/(marketing)/quote`, `components/quote/`, `lib/quote-maker.ts`, own types): room → questions or empty walls → each wall from the front (drag / arrows) + 3D (plain `three`, `next/dynamic`, no SSR) with the range from a debounced `POST /quote-maker/estimate` → contact → sent. `POST /quote-maker/start` (Public, 30/min, page switch) fills the questions with the catalogue's units and finishes only. `POST /quote-maker/submit` (Public, 5 per 15 min like `POST /enquiries`, honeypot `website` = quiet 204) checks and prices the plan on the server (`resolve(publicOnly)`), stores the enquiry (`kind: quote`, source Quote, details Room / Layout / Units / Estimate) through `EnquiriesService.store`, then the design (`source: web`, `enquiry_id`; a failed design save is logged and the lead still goes out), then `EnquiriesService.announce(row, range)` (the visitor's confirmation carries the range). `GET /quote-maker/designs?enquiry_id=` gives the enquiry page its **Open design QD-…**. `QuoteDesignsService.purge` (hourly timer) deletes `source = web` designs older than 12 months with no project quote and an enquiry not Converted; staff designs never (portal `lib/legal.ts` retention says so; the website's privacy page is CMS content the owner updates). The tool's words are in code, not the CMS. Settings › Pages has the `quote` switch; off = `PageUpdating`. **Rooms:** a visitor picks one or more room types (questions, one Sizes form each) or Draw it yourself = one blank room of any size that takes any unit (`room_type: 'custom'`, `CUSTOM_ROOM`: valid on a design, never a unit's room, never filled; the admin lists it as Any room). `submit` takes `rooms: [{room_type, design, answers?}]` (1 to 5): each room is priced and saved as its own design, the enquiry's estimate is their sum (unpriced if any room is) and its `Design` detail lists every ref. `ROOM_TYPES[].layouts` are the layouts the website offers per room (the API does not enforce them), and `RECIPE` in `engine.ts` lays each room out differently (bedroom: wardrobes; media wall: a column each side; office / kitchen: a tall unit at the start of wall A). The Design step is a full-screen dialog (portal, z 105: over the site frame, under the cookie banner; the page behind is inert).

**Mail folders:** `GET /mailbox/labels` lists the person's Gmail folders and own labels (system ones in Gmail's order); `GET /mailbox/threads?label=<id>` lists one (Spam and Trash included). The Mail page uploads through `api.upload` (XHR) for a progress bar. **Contact page:** `contact.when.rows` (label + lead time in words) is the C3 chart, editable in the CMS; the hours sit in the enquiry's rail. **Home process:** the importer adds the Production stage to an edited home page (`addProductionStage`, drop it after the v3.0.1 rollout). **Pull to refresh:** an installed admin/portal (standalone display mode) reloads on a drag down from the top (`components/PullToRefresh.tsx`, identical copies; the page sets `overscroll-behavior: none`, so the browser's own is off). The portal's service worker registers no runtime route on purpose: a route's `fetch()` runs under `/sw.js`'s `connect-src`, which refuses the private bucket and broke document images. **Install prompt:** admin and portal show an install card on a phone that has not installed the app (`components/InstallPrompt.tsx`, identical copies).

**Project stages** come from `site_settings.project_stages` (null = the default
five in `modules/projects/stages.ts`), edited at Settings › Project stages:
`{name, progress, approval}`, 1–20 unique names; the last is Completed, any number may be
approval stages (never the first, the last or two adjacent): the client approves (next stage) or asks for changes (back one); rename moves projects, removing an occupied one is 409.
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
with their email). Editor 403 on all. The admin page (`pages/Dashboard.tsx`) greets by time of day with one line about today, has the role's "New …" shortcuts and a bento of cards that each open their filtered list: today's consultations and paid this month carry a this-month-vs-last figure and a 12-month mini line (hover or drag reads a month), then new enquiries, outstanding invoices, "awaiting client decision" (`projects.awaiting_decision` + `quotes.sent`, the Sent `project_quotes`) and the pipeline (each stage opens `/projects?view=list&stage=…`). No active-clients card. A client sees a document only if it AND
its project are shared (`AccessService.documentScope`); invoices reach them
whatever their project's visibility. A client changes their password at
`PUT /account/password` (bumps `token_version`, returns a fresh session) and
reads/writes `/notification-preferences`, both in `modules/auth/portal-account.ts`.

**Client portal access** is by invitation. `POST /clients/:id/invite` (Admin) generates a random 14-character password (crypto), stores its bcrypt hash with `clients.password_is_default = true`, bumps `token_version` and emails `PORTAL_URL/login` plus that password; Resend invite issues a new one. The emailed password stops working after 7 days (`clients.default_password_expires_at`, migration 30; null = no expiry): a sign-in with it then answers 401 pointing at Forgot password and is not counted as a failed attempt, and changing, keeping or resetting clears the date. This knowingly relaxes the earlier "nobody types a password" rule at the owner's request. The password is never logged and the invite is throttled (route 20/h, 5/h per client). On first sign-in the portal offers Change password or Keep (`POST /account/password/keep`); changing, keeping or a reset clears the flag; `/auth/me` and the login answer carry `passwordIsDefault`. Changing a client's email while the flag is set clears the password. Forgot/reset links are JWTs with purpose `portal-password` bound to `clients.token_version` (forgot = 30 min); `POST /auth/portal/reset` sets the hash and bumps `token_version` in one conditional UPDATE, so a link works once and old portal sessions die. No reset columns on `clients`. `has_portal_access` = a bcrypt hash is stored.

**Portal terms acceptance** (migration 33: `clients.terms_version` / `terms_accepted_at`, table `terms_acceptances`): a client must accept the portal Terms before using it. `PORTAL_TERMS_VERSION` (`modules/auth/terms.ts`, mirrored as `TERMS_VERSION` in the portal's `lib/legal.ts`) is the text they accept; `termsAccepted` (`terms_version === current`) rides on the login answer and `/auth/me`, and the portal's `TermsPrompt` (not dismissible: "I agree" or sign out; shown before the default-password prompt) opens whenever it is `false`, so existing clients are asked on their next open or sign-in. `POST /account/terms/accept` (Client, 10 per 15 min, body `{version}`, 409 if it is not the current one) stores one `terms_acceptances` row (time, version, IP, `deviceOf` browser kind, name and email snapshot; no FK, so it outlives the client) and sets the client's columns; a repeat is a no-op. The Admin asks again with `POST /clients/:id/terms/reset` (button on the client page) or `POST /clients/terms/reset` (everyone; "Ask all to accept terms" on Clients): it only clears `terms_version`, never the history, and is logged as `client_terms_reset`. The Terms have an `agreement` clause (acting in the account is binding, consumer rights unaffected) and Privacy lists the record (kept 6 years after the project, never purged by code). Enforcement is the blocking window plus the record; the API does not refuse a client's other requests until they accept. Bump the version (both files) when the Terms change in substance.

**Legal pages (admin and portal):** `/privacy`, `/terms`, `/cookies` in each app,
open signed in or out (`legalKind()` in `App.tsx`, before the auth check), linked
from the sign-in screen and the profile menu. They are separate from the public
site's pages (those are CMS content). The text is code, in each app's
`lib/legal.ts` (admin: written for staff; portal: for clients; `pages/Legal.tsx`
and `LegalLinks` are identical copies). Controller Enzo Interiors Ltd
(16540291); NPATEL GROUP LTD (16236097) is the processor, under a contract that
must be signed before launch. The ICO registration number (ZC047912, given by the owner) is shown in the
controller line; no VAT number is shown (Enzo has none yet), do not invent one. They describe only what exists: when the access log
(IP/device) is built, add it to `what-we-collect` and `retention` in both files.
The apps set no cookies, only localStorage, so no banner. Google Fonts is loaded
from Google (disclosed). Terms are a draft for a solicitor.
- `apps/portal` — client portal (React/Vite PWA, same shell and look as the admin: pages in the menu bar from lg up, bottom bar below).
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
A page that reads `searchParams`, `cookies()` or `headers()` must do it **before** any
early return (`apps/web/src/app/booking/page.tsx`): the Docker build has no API, so
`isPageOn` falls back to the defaults (booking off) and a page that returns early is
prerendered static, then throws `DYNAMIC_SERVER_USAGE` (a 500) once production has it on.

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
Staff bookings skip the notice period and horizon. The website's form may send `services` (up to 10 slugs, each checked like `service`, which stays the first); `service_label` is their names joined. Contact fields (phone, address, postcode, notes) are Required / Optional / Hidden in Settings, enforced for visitors and staff; name, email, service and time are always required; defaults are computed on read (phone, address and postcode required, notes optional; a saved schedule keeps its own rules). Customers are emailed on
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
Admin or Infra manager can reset it (Settings › Users → Reset two-step sign-in,
which also clears devices and the Google link; an Admin's or Infra manager's only by
an Infra manager) or `npm run auth:reset-2fa -- <email>` (Docker:
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
*Mail* (`modules/mailbox`, `GOOGLE_GMAIL_REDIRECT_URI`, unset = no Mail UI; migration 25 `gmail_accounts`): each Admin/Designer/Editor links their own Gmail (scope `gmail.modify`), separate from the studio Calendar and from Sign in with Google; only the sealed refresh token is stored. Mail is read and sent live; no message content is stored or logged. Every `/mailbox` route works on the caller's own mailbox only; Installer and Infra get 403 (`mailbox.db.test.ts`). Connecting is two steps (the callback parks a one-time result, `POST /mailbox/connect/complete` links it for the signed-in starter only). `GmailService.sendAs` is the single send function. Message HTML is sanitised by `modules/newsletter/render.ts` and shown in a script-free sandboxed iframe with remote images off until asked. A revoked token = `needs_reconnect` + bell. Activity `mail_send` logs recipient domains only. The OAuth consent screen is **Internal** (Workspace; no Google verification).

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
- Pre-prod (Coolify, branch `pre-prod`, tested before `main`) uses `docker-compose.preprod.yml`: a copy of `docker-compose.yml` with its own image tags, host ports (+10000), Traefik router names, hosts from `PREPROD_*_HOST` and preprod-only aliases on the shared `coolify` network. Change both files together.
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

**Last updated:** October 2026 (v3.0.0) | **Project Status:** v1 (public site + admin CMS) implemented; CRM and portal kept in code, not mounted.
