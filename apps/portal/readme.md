# apps/portal — Enzo Interiors Client Portal

React + Vite SPA (installable PWA) where Enzo Interiors clients track their
project, approve designs, read messages, and view documents and invoices.

It is a **thin client**. Every read and write goes through `apps/api` over HTTP
and WebSocket — this app never touches a datastore, and it shares no code with
`apps/admin` or `apps/web`.

---

## Run it

**Start `apps/api` first** — the portal is useless without it.

```bash
npm install
```

```bash
npm run dev
```

Opens on **http://localhost:5175**.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on 5175 |
| `npm run build` | Typecheck, then production build (service worker included) |
| `npm run preview` | Serve the production build — use this to exercise the PWA |
| `npm run typecheck` | `tsc --noEmit` |

### Configuration

`.env` (copy from `.env.example`):

```
VITE_API_BASE_URL=http://localhost:4000
```

---

## Accounts

There are no demo accounts. An Admin invites a client from the admin
(client page → Invite to portal); the email links to `PORTAL_URL/reset-password`,
where the client chooses a password. Staff accounts do not work here.

---

## Screens

| Route | Screen |
|---|---|
| `/login` | Client sign-in |
| `/reset-password`, `/forgot-password` | Invitation / reset link, and asking for one |
| `/dashboard` | Bento: decisions awaiting you, next appointment, unread, documents, invoices, timeline |
| `/projects` | Card grid with progress and plain-English stage descriptions |
| `/projects/:id` | Timeline, designs, documents, invoices, **Approve / Request changes** |
| `/messages` | Live chat with the Enzo team, attachments |
| `/documents` | Searchable, filterable by type |
| `/invoices`, `/invoices/:id` | Summary, table and a printable invoice — **view only** |
| `/settings` | Profile, notification preferences, password, theme |

Every list screen has loading, empty and error states. Every form validates and
shows the API's own message.

### The design-approval loop

The critical path in the docs. On a project at the **Approval** stage the client
gets two equally-weighted actions:

- **Approve design** → project advances to Installation
- **Request changes** → project goes **back to Design**, with a required note

Both write through `apps/api`, so the admin's Kanban and activity log reflect
the decision immediately. Requesting changes is not a dead end: the note is
attached to the project's audit trail for the designer to read.

### No payments, by design

There is no Pay button anywhere, and there never will be. Payment is arranged
directly with Enzo Interiors; an Admin records it manually and the status here
updates on the next fetch. The Invoices screen says so in plain English so
nobody hunts for a control that does not exist.

---

## Design system

`src/components/ui/index.tsx` implements
`docs/Enzo_Interiors_UI_UX_Brief_v6.md` — Inter only, 44px minimum touch
targets, 8px/12px corners, written-label status tags, no pills or gradients, and
stable text-link hovers.

`apps/admin` holds its own copy of these files. Per the build brief there is no
shared package: the two apps are kept consistent by following the same document,
not by importing from each other. **A token change must be made in both.**

Navigation follows the brief's Client Portal direction exactly: a bottom dock on
mobile with **Dashboard, Projects, Messages, Invoices, More**, which becomes a
sidebar on desktop.

> Dark mode is a **derived assumption** — see the note in `src/styles/theme.css`.

---

## PWA

`vite-plugin-pwa` (`autoUpdate`): installable manifest, and a service worker
that precaches the app shell only. API answers, signed document links and
anything else cross-origin or under `/api` are network-only and never stored.
Disabled in dev; test with `npm run build && npm run preview`.

---

## Structure

```
src/
├── components/
│   ├── ui/          Design system (own copy)
│   └── layout/      PortalLayout — bottom dock, sidebar, More sheet, offline banner
├── hooks/           useQuery / useMutation, useUnreadCount
├── lib/             api client, auth, theme, socket, formatting, status tones
├── pages/           One file per screen
├── types/api.ts     Local copies of the API response shapes this app consumes
└── styles/theme.css Brief v6 tokens
```

`src/types/api.ts` is deliberately **narrower** than the admin app's copy — a
client only ever sees their own records, so modelling admin-only fields here
would imply access the API does not grant.
