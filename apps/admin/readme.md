# apps/admin — Enzo Interiors Staff & Admin CRM

React + Vite SPA (installable PWA) for Enzo Interiors staff: clients, bookings,
quotes, projects, invoices, messages and content.

It is a **thin client**. Every read and write goes through `apps/api` over HTTP
and WebSocket — this app never touches a datastore, and it shares no code with
`apps/portal` or `apps/web`.

---

## Run it

**Start `apps/api` first** — the admin portal is useless without it.

```bash
npm install
```

```bash
npm run dev
```

Opens on **http://localhost:5174**.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on 5174 |
| `npm run build` | Typecheck, then production build (service worker included) |
| `npm run preview` | Serve the production build — use this to exercise the PWA |
| `npm run typecheck` | `tsc --noEmit` |

### Full run order

```bash
cd apps/api && npm install && npm run seed && npm run dev
```

Then, in a second terminal:

```bash
cd apps/admin && npm install && npm run dev
```

To reset all data to a known-good state: **stop the API**, run
`npm run seed` in `apps/api`, then start it again. (Repositories cache tables in
memory, so a running API will not pick up a seed written by another process.)

### Configuration

`.env` (copy from `.env.example`):

```
VITE_API_BASE_URL=http://localhost:4000
```

---

## Demo accounts

Listed on the login screen — click one to fill the form.

| Role | Email | Password | Sees |
|---|---|---|---|
| Admin | `admin@enzointeriors.co.uk` | `admin123` | Everything |
| Designer | `designer@enzointeriors.co.uk` | `designer123` | Their assigned clients only |
| Designer | `hannah@enzointeriors.co.uk` | `designer123` | Their assigned clients only |
| Installer | `installer@enzointeriors.co.uk` | `installer123` | Their assigned work only |

Sign in as **admin** and then as **designer** to see RBAC working: the Designer's
client list is a strict subset, the Pricing Library becomes read-only, the audit
log disappears, and mark-paid is gone.

Client accounts do not work here — they belong to the Client Portal on 5175.

> The "Demo accounts" panel on the login screen is a **prototype affordance**.
> Delete it before any real deployment.

---

## Screens

| Route | Screen |
|---|---|
| `/login` | Staff sign-in with demo account picker |
| `/dashboard` | Bento grid: bookings, projects, enquiries, invoices, messages, 12-month chart |
| `/clients` | Searchable table, add/edit/delete |
| `/clients/:id` | Detail with Overview / Projects / Invoices / Documents / Notes / Activity tabs |
| `/bookings` | Calendar with density, upcoming list, working-hours editor |
| `/quotes` | Quote builder (Simple + Detailed, live total) and Component Pricing Library |
| `/projects` | 5-stage Kanban with drag-and-drop, list view, assign designer, client-visible toggle |
| `/projects/:id` | Timeline, documents, invoices, activity log, stage controls |
| `/invoices` | Builder with VAT preview, status filters, **manual mark-paid** |
| `/messages` | All-client inbox, live over WebSocket, saved replies, attachments |
| `/content` | Enquiries inbox, testimonials, portfolio |
| `/settings` | Business profile, team & roles, saved replies, my account, audit log |

Every list screen has loading, empty and error states. Every form validates and
shows the API's own message. Every destructive action is behind a confirmation.

---

## Design system

`src/components/ui/index.tsx` implements
`docs/Enzo_Interiors_UI_UX_Brief_v6.md`, which calls itself a strict
implementation contract:

- Inter only — no serif anywhere
- 44px minimum control height and touch target
- 8px corners on controls, 12px on cards, tiles and modals
- No pill buttons, gradients, glows or decorative icons
- Status tags are **written labels only** — never dots
- Text links change colour and underline on hover, and nothing else
- 1px borders preferred over shadows; one permitted overlay shadow

`apps/portal` holds its own copy of these files. Per the build brief there is no
shared package: the two apps are kept consistent by following the same document,
not by importing from each other. **A token change must be made in both.**

> Dark mode is a **derived assumption**. Brief v6 mandates AA contrast "in every
> theme" and a light/dark toggle, but specifies light values only. The dark ramp
> in `src/styles/theme.css` is flagged there for design review.

---

## PWA

`vite-plugin-pwa` with `registerType: 'autoUpdate'`, per TRD §11.

- Installable: manifest with 192/512 and maskable icons, `display: standalone`
- Workbox service worker; API GETs use stale-while-revalidate so the shell
  paints last-seen data instantly
- Auth routes and all mutations are **excluded** from caching — a cached login
  or a replayed write would be a correctness bug
- Offline banner in the shell rather than a broken page

The service worker is **disabled in dev** (`devOptions.enabled: false`), because
aggressive caching makes "did my change land?" much harder to answer. To test
PWA behaviour, run `npm run build && npm run preview`.

> iOS Safari supports PWAs less fully than Android/Chrome (manual "Add to Home
> Screen", limited Web Push). That is a platform limitation, not a bug — flag it
> when demoing on iPhone.

---

## Structure

```
src/
├── components/
│   ├── ui/          Design system (Button, Card, Modal, Table, StatusTag, …)
│   └── layout/      AdminLayout — sidebar, mobile drawer, offline banner
├── hooks/           useQuery / useMutation, useUnreadCount
├── lib/             api client, auth, theme, socket, formatting, status tones
├── pages/           One file per screen
├── types/api.ts     Local copies of the API response shapes
└── styles/theme.css Brief v6 tokens
```

`src/types/api.ts` is hand-kept in sync with
`apps/api/src/common/types/domain.ts`. Field names match the API's JSON exactly,
so drift is visible rather than silent.
