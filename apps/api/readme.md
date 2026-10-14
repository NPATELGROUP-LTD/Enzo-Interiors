# apps/api — Enzo Interiors Backend

NestJS service owning **all** business logic, auth, RBAC and data access for the
Enzo Interiors platform. `apps/admin` and `apps/portal` talk to it over HTTP and
WebSocket and never touch the datastore themselves.

**Prototype phase:** PostgreSQL is replaced by JSON files in `data/`. Everything
else — the module structure, the Guards, the RBAC model, the endpoint surface —
is the real thing.

---

## Run it

The API must be running before either frontend is useful.

```bash
npm install
```

```bash
npm run seed
```

```bash
npm run dev
```

Listens on **http://localhost:4000**. Then start `apps/admin` (5174) and
`apps/portal` (5175).

| Command | What it does |
|---|---|
| `npm run dev` | Watch mode on port 4000 |
| `npm run build` / `npm start` | Compile to `dist/`, then run it |
| `npm run seed` | **Reset all data to a known-good state** |
| `npm run typecheck` | `tsc --noEmit` over `src/` and `scripts/` |

> **`npm run seed` wipes every table**, so it only runs when `NODE_ENV` is
> `development` or `test`, and refuses if it is unset. Set it for the one
> command: `NODE_ENV=development npm run seed` (bash), or
> `$env:NODE_ENV='development'; npm run seed` (PowerShell). To seed anything
> else on purpose, set `ALLOW_DESTRUCTIVE_SEED=yes`.

> **Re-seeding while the API is running?** Stop it first. Repositories hold the
> table in memory for fast reads, so a seed written by a separate process is not
> picked up until the API restarts. Order: stop → `npm run seed` → `npm run dev`.

Configuration lives in `.env` (copy from `.env.example`): `PORT`, `JWT_SECRET`,
`JWT_EXPIRES_IN`, `CORS_ORIGINS`.

---

## Demo accounts

Seeded by `npm run seed`, and shown on both login screens.

| Role | Email | Password |
|---|---|---|
| Admin | `admin@enzointeriors.co.uk` | `admin123` |
| Designer | `designer@enzointeriors.co.uk` | `designer123` |
| Designer | `hannah@enzointeriors.co.uk` | `designer123` |
| Installer | `installer@enzointeriors.co.uk` | `installer123` |

| Client | Email | Password |
|---|---|---|
| Sarah Jones | `sarah.jones@example.com` | `client123` |
| David Okafor | `david.okafor@example.com` | `client123` |
| Amelia Hart | `amelia.hart@example.com` | `client123` |
| Raj Patel | `raj.patel@example.com` | `client123` |
| Eleanor Shaw | `eleanor.shaw@example.com` | `client123` |

The two login flows are **not** interchangeable: staff credentials fail at
`/auth/portal/login` and client credentials fail at `/auth/admin/login`.

> ### Not production-safe
> Passwords are stored and compared as **plaintext**, per the prototype brief.
> The column keeps its documented name (`password_hash`) so the PostgreSQL
> migration needs no rename, but it must hold a real bcrypt/argon2 hash and use
> a constant-time verify before this goes anywhere real. See
> `src/modules/auth/auth.service.ts`.

---

## Architecture

```
src/
├── common/
│   ├── access/access.service.ts   Row-level scoping ("may this user touch this record")
│   ├── guards/                    JwtAuthGuard + RolesGuard, both registered globally
│   ├── decorators/                @Public, @Roles, @CurrentUser
│   ├── types/domain.ts            Every table from Backend Schema v2.0
│   └── util/money.ts              2dp rounding for every monetary value
├── core/                          DatabaseService + AccessService + ActivityLogService (@Global)
├── data/
│   ├── json-repository.ts         findAll/findById/create/update/delete — the Prisma-shaped seam
│   └── database.service.ts        One repository per table
└── modules/                       One per domain
```

**Module layout:** modules with substantial domain logic (`clients`,
`invoices`, `projects`, `conversations`) split service / controller / dto into
separate files. Simpler resources keep everything in one module file, where
splitting would add navigation cost without adding clarity.

### RBAC is enforced in two layers

Both are required; neither is sufficient alone.

1. **`RolesGuard`** — *may this kind of user call this endpoint?* Driven by
   `@Roles('Admin', 'Designer')`. Coarse, no data access.
2. **`AccessService`** — *may this user touch this record?* Needs the data, so
   it cannot live in a guard.

| Role | Scope |
|---|---|
| Client | Own `client_id` only, and only projects/documents flagged client-visible |
| Designer / Installer | Clients assigned to them, plus the clients of projects they are assigned to |
| Admin | Everything |

`JwtAuthGuard` is global, so **routes are authenticated by default** and opening
one requires an explicit, greppable `@Public()`. The principal is built only
from the verified token — no role, client id or staff id is ever read from a
header or request body.

### Every write endpoint

1. Validates the payload (`ValidationPipe`, `whitelist` + `forbidNonWhitelisted`,
   so unexpected fields are rejected rather than ignored)
2. Enforces RBAC from the session
3. Writes through to the JSON file **on disk** before responding
4. Appends an `activity_logs` entry
5. Returns the updated resource

---

## Data integrity rules

These come from Backend Schema v2.0 §6 and are enforced in code, not just
documented:

- **Money is never a float in spirit.** Every monetary value passes through
  `money()` and is held at exactly 2dp. `money.ts` explains why this is adequate
  for a prototype and not for production.
- **Cascades are tightly scoped.** Deleting a client is *refused* while
  projects or invoices reference it.
- **`Paid` has exactly one writer.** Only `PUT /invoices/:id/mark-paid`, only
  Admin, always manual. The generic invoice edit route rejects `status: 'Paid'`.
  There is no payment gateway and there never will be.

---

## Endpoint surface

| Method | Path | Access |
|---|---|---|
| POST | `/auth/admin/login`, `/auth/portal/login` | Public |
| GET | `/auth/me` | Any session |
| GET | `/content/services`, `/content/portfolio`, `/content/testimonials` | Public |
| GET | `/availability`, `/availability/slots?date=` | Public — booking wizard |
| POST | `/contact-submissions` | Public — contact form |
| GET/POST/PUT/DELETE | `/clients`, `/clients/:id`, `/clients/:id/detail` | Staff (scoped); create/delete Admin |
| GET/POST/PUT/PATCH/DELETE | `/projects`, `/projects/:id/stage`, `/projects/:id/detail` | Staff (scoped) |
| POST | `/projects/:id/approve`, `/projects/:id/request-changes` | Client |
| GET/POST/PUT/DELETE | `/invoices`, `/invoices/summary` | Read scoped; write Admin |
| PUT | `/invoices/:id/mark-paid` | **Admin only, manual** |
| GET/POST/PUT/DELETE | `/bookings`, `/bookings/upcoming` | Staff (scoped) |
| PUT | `/availability` | Admin |
| GET/POST/PUT | `/conversations`, `/conversations/:id/messages`, `/:id/read` | Scoped |
| WS | Socket.IO — `message:send`, `message:new`, `conversation:join`, `typing` | Scoped |
| POST/PUT/DELETE | `/documents/upload`, `/documents/:id` | Staff (metadata only) |
| GET/POST/PUT/DELETE | `/testimonials`, `/portfolio-items` | Read staff; write Admin |
| GET/PUT | `/contact-submissions` | Staff |
| GET/PUT | `/business-settings` | Read any; write Admin |
| GET/POST/PUT/DELETE | `/staff`, `/saved-replies` | Read staff; team write Admin |
| GET/PUT | `/notification-preferences`, `/account/password` | Own record |
| GET | `/activity-logs` | Admin |
| GET | `/dashboard/admin`, `/dashboard/portal` | Staff / Client |

`/dashboard/*` is an addition beyond the documented table: the bento grids need
aggregates across eight tables, and composing them client-side would mean eight
over-fetching requests per load and business arithmetic duplicated in two
frontends. Everything it returns is derived from data the caller could already
read, under the same scoping.

---

## Prototype-phase deviations

All deliberate, all flagged in code:

| Documented | Here | Why |
|---|---|---|
| PostgreSQL + Prisma | JSON files in `data/` | Prototype brief. `JsonRepository` mirrors the Prisma method surface so the swap is contained. |
| `decimal(n,2)` | `number` at 2dp via `money()` | JSON has no decimal type. |
| bcrypt `password_hash` | plaintext | Prototype brief. Loudly commented. |
| S3 keys + signed URLs | `placeholder://…` strings | No object storage this phase; uploads store metadata only. |
| `activity_logs.staff_id` not-null, staff only | Also holds a client id, with `actor_type` | The approval loop means clients cause audited changes. Dropping those would leave gaps in the flow the docs call the critical path. |
| Email / SMS notifications | Stored toggles, nothing sends | Out of scope. Nothing calls a mail or SMS provider. |
| PRD "invoice line items" | `amount` + `vat_rate` | Backend Schema has no `invoice_line_items` table, and §7 says implement the documented tables exactly. |

Quotes and the part library are retired. Their tables (`quotes`,
`quote_line_items`, `components`) and `invoices.quote_id` stay in the schema
(migrations only add) but no code reads or writes them.
