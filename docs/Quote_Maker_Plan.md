# Quote maker — plan (v3.1.0)

Status: agreed scope, not built. Written 2026-11-06 from the owner's answers.
Source of the old logic: commit `db1a682`, `apps/quote-builder/src/lib/`
(`types.ts`, `nesting.ts`, `pricing.ts`, `quick.ts`, `panels.ts`, `geometry.ts`,
with tests) and `components/{planner,quick,studio,three}`.

## What it is

A visitor on the website (or staff in admin) designs a bedroom, media wall,
kitchen, office or alcove run, either by answering questions (the system fills
the walls) or by drawing on a 2D front-view canvas, or both: the questions end
on the canvas, and the canvas can start empty. A simple 3D preview shows the
result. The visitor gets a rounded price range and sends the design as an
enquiry. The Admin opens it, adjusts it, and turns it into a normal project
quote (Draft → Sent → Accepted → invoice, as today). The client sees the
drawing and 3D preview with the quote in the portal.

Every board, door, worktop and fitting is an **inventory item**: one record,
used by stock, purchase orders and the quote maker alike.

## Decisions (from the owner)

| Topic | Decision |
|---|---|
| Who | Public site + staff in admin |
| Price shown | Rounded range at once; the real quote comes from the Admin |
| 3D | A simple browser preview (boxes in the right sizes and finishes) is allowed; CLAUDE.md's rule is narrowed to "no photoreal or server-side rendering" |
| Catalogue editing | Admin everything; Editor edits specs and image only |
| Room types | Wardrobes/bedroom, media wall, home office, alcoves, kitchen |
| Kitchen | Cabinetry only (base, wall, tall) on any wall of a room plan, so single, galley, L, U and island all work; worktop priced from an inventory item; appliances are unpriced gaps; sinks, taps and appliance fitting stay manual quote lines |
| Entry | Two starts ("Answer a few questions", "Design it yourself") into one editor |
| Pricing | The prototype's maths: panels nested on whole sheets (an offcut shared across the room) + hardware + labour + margin, then rounded |
| Unit library | Editable by the Admin in admin; a starter set ships and is imported like the CMS (edited entries never overwritten) |
| Finishes | Inventory items ticked "show on website", with a public name, swatch and image |
| Submission | An enquiry (source `Quote`) carrying the design and range |
| Shipping | Four PRs into develop, released together as v3.1.0 |

## Data (migrations 37–39, add-only)

**37 `inventory_item_specs`** — nullable/defaulted columns on `inventory_items`:
`length_mm`, `width_mm`, `thickness_mm` (Int), `grain` (Bool, false),
`board_role` (`carcass | front | worktop | back`, null for non-sheets),
`swatch` (hex), `image_id` (a `media_assets` id, public bucket, picked with the
existing `MediaPicker`), `specs` (JSONB, free label/value pairs),
`show_on_site` (Bool, false), `public_name`, `quote_cost` (Decimal(12,2),
nullable: the price the quote maker uses; null falls back to `avg_cost`, and
£0 means "we'll price this for you"). `quote_cost` is Admin only.
Existing `size_note` stays and shows until dimensions are filled in.

**38 `quote_maker`**
- `unit_templates`: `id`, `slug` (unique), `name`, `description`,
  `room_types` (text[]), `mount` (`floor | wall | tall | gap`), `elevation_mm`,
  `structure` (JSONB: doors, drawers, shelves, back, plinth, worktop),
  `slots` (JSONB: slot key → allowed `board_role`s + default item id),
  `variants` (JSONB: width/height/depth + panels with slot, size, qty),
  `hardware` (JSONB: `[{item_id, qty}]`), `labour_hours` (Decimal, fitting
  time per unit × the pricing hourly rate) plus `labour_extra` (Decimal £,
  optional fixed add-on, e.g. LED or fire install),
  `active`, `position`, `updated_by`, timestamps. JSONB for the same reason as
  `cms_entries`: nothing joins on the inside, and it is edited as one thing.
  Item ids inside are checked by the API on save; a switched-off item makes the
  template unavailable to visitors until it is swapped, never a silent £0.
- `quote_designs`: `id`, `ref_no` (autoincrement → `QD-0007`), `source`
  (`web | staff`), `room_type`, `design` (JSONB: walls, placed units with
  template + variant + finish per slot), `answers` (JSONB, nullable),
  `estimate_low` / `estimate_high` (Decimal), `enquiry_id` (FK
  `contact_submissions`, cascade), `created_by`, timestamps. Retention: a
  design with no client (its enquiry never converted, no `project_quotes`
  pointing at it) is deleted 12 months after `created_at` by an hourly
  clean-up in the API (as the access log does); privacy text in both apps'
  `lib/legal.ts` says so.
- `project_quotes.design_id` (nullable FK, set null): the drawing behind a quote.

**39 `quote_pricing`** — `site_settings.quote_pricing` (JSONB, null = defaults
computed on read): margin %, range low/high %, kerf, edge trim, rounding £,
labour hourly rate. VAT is not here: the range and generated quotes use the
existing global `vat_rate` setting, as quotes and invoices do today.
Admin only; never in `/content/site` or `GET /settings` for other roles.

## API (`apps/api/src/modules/quote-maker`)

The engine is ported from the prototype once, into the API, with its tests
(`nesting.test.ts`, `pricing.test.ts`, `quick` fill). Integer pence inside the
engine, `Prisma.Decimal` at the edges, as in `invoices/totals.ts`. **The
browser never prices**: costs never leave the API, and a design posted from
anywhere is re-priced on the server.

| Route | Who | Does |
|---|---|---|
| `GET /quote-maker/catalogue` | Public | Room types, active templates (sizes, structure, mount; no panels or costs), show-on-site finishes (public name, swatch, image URL, role). Cached; `data:changed` busts it |
| `POST /quote-maker/estimate` | Public, throttled | Design in → rounded range out (and "we'll price this for you" if any item used has no cost). Debounced by the page |
| `POST /quote-maker/submit` | Public, throttled + honeypot | Stores `quote_designs` + an enquiry (`source: Quote`); visitor email with the range; studio email + bell, as the contact form |
| `GET/PUT /quote-maker/templates…` | Admin | Unit library CRUD (switch off, not delete, once used) |
| `POST /quote-maker/designs/:id/estimate` | Admin | Full breakdown: cutting list per sheet, sheets per item, hardware, labour, cost, margin |
| `POST /quote-maker/designs/:id/quote` | Admin | Draft `project_quote` for a chosen project of the client: one line per unit (cost + margin %), worktop and labour lines, `design_id` set. The existing quote editor takes over |
| `POST /quote-maker/designs/:id/materials` | Admin | Adds the cutting list's sheets and hardware as `project_materials` needs (then Shortfall / purchase orders work as today) |
| `PATCH /inventory/items/:id/specs` | Admin, Editor | Specs, dimensions, image, swatch, public name only (allow-listed DTO) |
| `GET /inventory/catalogue` | Admin, Editor | Items with spec fields only: no cost, stock, supplier or orders |

Portal: the quote detail gains the design's geometry and finish names/images
(no panels, costs or lines), so the client sees the 2D drawing and 3D preview.

Guards: every route names `@Roles`; the Editor's two inventory routes are
added to the role tests. Validation at the public boundary: design size caps
(≤ 8 walls, ≤ 80 units, dimension bounds per template, known ids only), body
size limit, throttles like `POST /enquiries`.

## Frontends

- **apps/admin**
  - Inventory: item form gains Specs (dimensions, grain, role, specs list,
    image, swatch, show on website, public name). Editors get an Inventory
    menu entry that opens this catalogue view only.
  - Quote maker → a Unit library page (templates, variants, panels, slots,
    hardware, labour) and Pricing settings.
  - Quote maker editor (room plan → walls → front-view canvas, 3D tab,
    breakdown tab). Opened from an enquiry ("Open design") or from Quotes
    ("New from design"). "Make quote" and "Add to project stock" buttons.
- **apps/web**: `/quote`, behind a new Settings › Pages switch `quote`
  (default off). Landing with the two starts → room type → questions or empty
  canvas → editor (2D + 3D via the three/r3f the site already ships, loaded
  lazily) → contact details → sent page with the range. Reads `searchParams`
  before any early return (see the booking page note in CLAUDE.md).
- **apps/portal**: drawing + 3D on the quote detail.

Each app keeps its own copy of the geometry/drawing code and types (house
rule). The 3D model is ported from `components/three/UnitModel.tsx`.

## PRs

1. **`feature/inventory-specs`** — migration 37, specs DTO + Editor routes,
   item form + Editor catalogue view, role tests.
2. **`feature/quote-engine`** — migrations 38–39, engine port + tests,
   templates CRUD, catalogue/estimate routes, starter library + import script
   (run by the compose `seed` service), `quote-maker.db.test.ts`.
3. **`feature/quote-maker-admin`** — admin editor, unit library, pricing,
   design → quote, design → project stock, portal preview, CLAUDE.md 3D rule
   change.
4. **`feature/quote-maker-web`** — public `/quote`, submit → enquiry, emails,
   page switch, privacy text (admin/portal `lib/legal.ts`; the site's privacy
   page is CMS content the owner updates).

Then `release/v3.1.0`.

## Answered (2026-11-06)

1. **Cost basis:** each item's set `quote_cost`, falling back to `avg_cost`.
2. **Labour:** both. Hours per unit × the hourly rate in Pricing settings, plus
   an optional fixed £ extra per template.
3. **VAT:** the existing global `vat_rate` setting, as quotes and invoices use.
4. **Kitchen starter set:** ship as proposed and edit later in the Unit
   library. Widths (mm): base 300/400/500/600/800/1000, sink base 600/1000,
   drawer base 400/600, corner base, wall 300–1000 and corner wall, tall
   larder 600, oven housing 600, fridge housing 600, appliance gaps
   (dishwasher, cooker, fridge 600; unpriced), end panel, plinth, worktop.
   Heights: base 720, wall 720, tall 2150.
5. **Old designs:** deleted with their enquiry, and any design with no client
   is also deleted 12 months after it was sent.

## Not doing (v1)

Appliance and sink pricing, photoreal or server-side renders, a design saved
and resumed by an anonymous visitor (needs an account or a link token), CNC/
cutting-sheet export files, multiple quote options per design.

## Progress and changes to this plan

- **PR 1** `feature/inventory-specs` (#137) and Settings › VAT (#136): merged 2026-11-07. Migration 37.
- **PR 2** `feature/quote-engine`: migration 38 is `unit_templates` + `quote_maker_settings`. Changes from the plan above:
  - Pricing settings are their own one-row table, not `site_settings.quote_pricing`, so they can never ride along in `GET /settings` or `/content/site`.
  - Pricing settings also hold a **default board per role** (carcass, front, worktop, back). A slot falls back to it, so the Admin picks four boards once instead of a default on every slot of every unit. A slot may still name its own default.
  - The public routes sit behind a new Settings › Pages switch `quote` (default off, API only until PR 4 adds the toggle and the page).
  - `quote_designs`, `project_quotes.design_id` and the 12-month clean-up move to PR 3, with the first code that writes them (migration 39).
  - The questions → units fill moves to PR 3, with the editor it fills.
  - The admin breakdown is `POST /quote-maker/breakdown` on a posted design; `designs/:id/estimate` comes with saved designs in PR 3.
  - No template delete yet (switch off); delete-when-unused comes with designs.
- Release: v3.1.0 is taken by history (release/v3.5.0 exists); ship as the next version.
