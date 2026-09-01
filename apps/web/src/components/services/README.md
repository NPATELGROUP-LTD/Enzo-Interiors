# `components/services` — file map

Everything that builds the two service routes. Folders map to routes, and
file names say which section of which page they are.

```
services/
├── shared/            used by BOTH routes
├── services-index/    only /services
└── service-detail/    only /services/[category]
    ├── variant.ts     how a page picks its design
    ├── hero/          4 designs + picker
    ├── included/      4 designs + picker
    ├── model/         4 3D models + picker (+ Box3D, ModelStage)
    ├── process/       4 designs + picker
    └── investment/    4 designs + picker (+ 2 shared controls)
```

---

## `/services` — `app/(marketing)/services/page.tsx`

One design, five sections, no two sharing a layout or a scroll mechanic.

| § | File | What it is |
|---|---|---|
| 01 | `services-index/IndexHero.tsx` | The fold. Plan drawing (large, clickable, labelled "Open <service>") driven by the list beneath it. Auto-cycles until the visitor takes over. |
| 02 | `services-index/IndexPricingScale.tsx` | Every discipline plotted at its starting price on one horizontal money scale. Axis range and ticks derived from the data. |
| 03 | `services-index/IndexConstants.tsx` | The four things that don't vary. A scroll-driven rule inks each one in. |
| 04 | `shared/QuestionsAccordion.tsx` | FAQs. Sticky heading, `0fr→1fr` panels. |
| 05 | `services-index/IndexClosing.tsx` | The ask on the left, what a survey actually involves on the right. |

---

## `/services/[category]` — every section is four designs

A page uses the **same variant index across all sections**, so the four
published services are four different pages end to end — not one template
with the nouns swapped.

| Sheet | Folder | variant 0 | variant 1 | variant 2 | variant 3 |
|---|---|---|---|---|---|
| A1 | `hero/` | `HeroMasthead` | `HeroOverlap` | `HeroPlanCentre` | `HeroSpecCard` |
| A2 | `included/` | `IncludedLedger` | `IncludedSpine` | `IncludedCourses` | `IncludedRail` |
| A3 | `model/` | `ModelKitchenRun` | `ModelWardrobeBay` | `ModelMediaWall` | `ModelWalkIn` |
| A4 | `process/` | `ProcessRail` | `ProcessTimeline` | `ProcessStair` | `ProcessDrawers` |
| A5 | `investment/` | `InvestmentSheets` | `InvestmentSlider` | `InvestmentBuildUp` | `InvestmentDoors` |
| A6 | `shared/` | `QuestionsAccordion` — shared component; its **ground** alternates per variant instead |
| — | `shared/` | `BookSurveyCta` — shared close |

### What each design actually is

**Hero (A1)** — the four differ in *ground* as well as layout, which is
what finally stopped the pages opening identically:

| | file | ground | axis | image |
|---|---|---|---|---|
| 1 | `HeroMasthead` | cream | top-to-bottom | one wide 21:8 band |
| 2 | `HeroOverlap` | near-black | layered, off-centre | tall plate, type across it |
| 3 | `HeroPlanCentre` | forest | symmetrical | none — the plan drawing |
| 4 | `HeroSpecCard` | warm grey | card + side strip | narrow full-height strip |

They also differ in where the facts live (footer column / inline rule /
centred rule / ruled table rows). Each renders its own quote button, because
a cream pill is invisible on the cream masthead — hence no `quoteCta` prop.

**Included (A2)** — 1 two ruled columns with leader lines, a bill of
quantities · 2 items alternating around a rule that draws as you scroll ·
3 a wall that lays itself course by course as you scroll, in stretcher
bond · 4 items hung from a rail on drops of varied length.

**Model (A3)** — a turnable 3D model of the product, one per discipline:
1 a base run, worktop and island whose doors open · 2 a full-height bay
whose doors slide apart · 3 a panelled wall whose lighting comes on · 4 a
corner walk-in whose doors strip away to show the internals.

This replaced four material/finish displays. Four ways of listing the same
finish names was four ways of showing a colour chart, and a colour chart is
not what anyone is trying to picture — the object is. All four are CSS 3D
built on `model/Box3D.tsx` and turned by `model/ModelStage.tsx`, so no
second WebGL context is spent (the landing page already has one).

**Process (A4)** — 1 travels sideways as you scroll down · 2 vertical with a
sticky stage counter · 3 each stage indented one step further · 4 a drawer
bank you pull open.

**Investment (A5)** — 1 fanned tier sheets · 2 a budget slider that tells
you what the money buys · 3 one wall stacked in priced steps, each showing
only what it adds · 4 tiers as door fronts that slide open.

All four investment layouts share `RoomSizeControl` and `RollingFigure`, so
the pricing *behaviour* is identical everywhere and only the presentation
differs.

### How a page picks its design — `service-detail/variant.ts`

By the service's **published position**, so the designs stay evenly spread
however many services exist and a fifth service starts the cycle again with
no authoring. Set `heroVariant` on the record to pin a page to one set.

Adding a fifth design means adding one file per section and one entry to
each section's `VARIANTS` array. Nothing else changes.

---

## Shared

| File | What it is |
|---|---|
| `shared/RoomPlanDrawing.tsx` | The signature device: a plan of the room with the photograph clipped inside its footprint. Geometry from `lib/room-plan.ts`, seeded by the slug. |
| `shared/QuoteRequestModal.tsx` | `QuoteModalRoot` (context + sheet) and `QuoteTriggerButton`. Any CTA on a service page opens it. |
| `shared/QuestionsAccordion.tsx` | FAQ list, light or dark, ground overridable via `className`. |
| `shared/BookSurveyCta.tsx` | Closing CTA for the detail pages. |

## Supporting modules (outside this folder)

| File | What it does |
|---|---|
| `lib/content/services.ts` | **Single source of truth** for services. Stands in for `GET /content/services`. |
| `lib/room-plan.ts` | Generates plan geometry from a slug. Pure, no React. |
| `lib/service-metrics.ts` | Derives comparison figures from a record. Pure. |
| `lib/quote-estimate.ts` | Room-size → price range. Stands in for `POST /quotes/estimate`. |

---

## House rules for this folder

- **Assume nothing about counts.** The client publishes services, tiers,
  process steps, materials and FAQs themselves. Every list is variable
  length; an empty array renders nothing rather than an empty section.
- **Derive, don't duplicate.** If a number can be computed from the record,
  compute it (`lib/service-metrics.ts`) rather than adding a field the
  client has to keep in sync.
- **Scroll-linked state reads live bounding boxes on `gsap.ticker`**, not
  cached ScrollTrigger bounds — see the note in
  `components/landing/ProcessLedger.tsx` for why.
- **No decorative icons.** Affordances are type, rules and motion.
- **Variants must differ in layout, not just in copy.** If two designs would
  render the same arrangement with different words, they are one design.
