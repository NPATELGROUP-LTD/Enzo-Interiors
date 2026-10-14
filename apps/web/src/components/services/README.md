# `components/services` — file map

Everything that builds the two service routes. Folders map to routes, and
file names say which section of which page they are.

```
services/
├── shared/            used by BOTH routes
├── services-index/    only /services  (+ ConstantMarks: §03's four drawings)
└── service-detail/    only /services/[category]
    ├── variant.ts     how a page picks its design
    ├── hero/          4 designs + picker (+ heroParts: the shared chrome)
    ├── included/      one design (the quotation sheet), no picker
    ├── model/         real three.js viewer + 4 units (scene/)
    ├── process/       4 designs + picker
    └── investment/    4 designs + picker (+ 2 shared controls)
```

---

## `/services` — `app/(marketing)/services/page.tsx`

One design, five sections, no two sharing a layout or a scroll mechanic.

| § | File | What it is |
|---|---|---|
| 01 | `services-index/IndexHero.tsx` | The fold. Plan drawing (large, clickable, labelled "Open <service>") driven by the list beneath it. Auto-cycles until the visitor takes over. |
| 02 | `services-index/IndexPricingScale.tsx` | Every discipline plotted at its starting price on one horizontal money scale. Axis range and ticks derived from the data. **Pins** at `top top` from `md` up and scrubs the scale in over ~1.1 screens of scroll; the section is sized to fit one viewport so the pin never hides its own bottom. |
| 03 | `services-index/IndexConstants.tsx` | The four things that don't vary. A scroll-driven rule inks each one in, and each carries a drawn plan symbol from `ConstantMarks.tsx` that inks in on reach **or** hover. |
| 04 | `shared/QuestionsNotes.tsx` | FAQs, but not an accordion — two accordions were built here and both were rejected. Every answer is on the page, set as the *general notes* off a drawing sheet in two CSS multi-column columns. No state, no clicking, no keyboard contract. |
| 05 | `services-index/IndexClosing.tsx` | The ask, set on a drawing sheet: registration ticks at the corners, and a real title block ruled across the bottom with the facts in the narrow cells and the booking action in the wide one. Asks one question (which room), because that is the only one `/booking` reads. |

---

## `/services/[category]` — every section is four designs

A page uses the **same variant index across all sections**, so the four
published services are four different pages end to end — not one template
with the nouns swapped.

| Sheet | Folder | variant 0 | variant 1 | variant 2 | variant 3 |
|---|---|---|---|---|---|
| A1 | `hero/` | `HeroMasthead` | `HeroColumns` | `HeroAperture` | `HeroDoors` |
| A2 | `included/` | `ServiceIncluded` — one design (the quotation sheet); its **ground** alternates per variant |
| A3 | `model/` | one `ModelViewer`, four units — see `model/scene/units.tsx` |
| A4 | `process/` | `ProcessRail` | `ProcessTimeline` | `ProcessStair` | `ProcessAssembly` |
| A5 | `investment/` | `InvestmentSheets` | `InvestmentSlider` | `InvestmentDisplay` | `InvestmentDoors` |
| A6 | `shared/` | `QuestionsNotes` — shared component; its **ground** alternates per variant instead |
| — | `shared/` | `BookSurveyCta` — shared close |

### What each design actually is

**Hero (A1)** — one shared grammar, four mechanisms. The chrome is
identical on all four (`heroParts.tsx`: the sheet rule, the four facts, the
two actions, the masked title line), so the pages read as four sheets of one
publication. What changes is the composition and *how the picture arrives* —
and the mechanism is chosen for what the service is, never as decoration:

| | file | service | ground | composition | how it arrives |
|---|---|---|---|---|---|
| 1 | `HeroMasthead` | Kitchens | cream | straight down the page | **curtain** — mask opens down while the picture drifts up into it, a sand edge riding the opening line |
| 2 | `HeroColumns` | Bedrooms | near-black | title hard right, three bays | **three side wipes**, staggered; one photograph split across the panels, one fact under each |
| 3 | `HeroAperture` | Media Walls | forest | centred, symmetrical | **switch-on** — a strike of light, a full-width slit, then the frame opens to 21:9 |
| 4 | `HeroDoors` | Wardrobes | warm grey | picture first, masthead under it | **two doors slide apart** — the product is the mechanism |

The facts also sit differently on each (footer column / one under each bay /
a centred ruled strip / a row beside the actions), but they are the same
facts in the same order, from `heroFacts.ts`. Colour for the buttons comes
from `heroParts`' one `tone` prop, because a cream pill is invisible on the
cream masthead — hence no `quoteCta` prop.

**Included (A2)** — one design, the quotation sheet with the total left
blank: the few lines that are on every quote we write, then the authored
scope for this service, each line marked as priced per room rather than
included. There is no picker; only its *ground* alternates with the variant
index, so four service pages still do not read as one template.

**Model (A3)** — a real three.js viewer (`model/ModelViewer.tsx`, the scene
in `model/scene/`), one turnable unit per discipline: 1 a base run, worktop
and island whose doors open · 2 a full-height bay whose doors slide apart ·
3 a panelled wall whose lighting comes on · 4 a corner walk-in whose doors
strip away to show the internals. Scroll drives nothing: the camera flies
between named viewpoints on click, a drag orbits it, wheel and pinch zoom,
and one labelled control does what a photograph cannot.

It costs one WebGL context on one service page, and only if the visitor
goes looking for it: the canvas waits behind an IntersectionObserver until
the section is within 300px, and is never created under reduced motion,
where a still photograph of the same room stands in. Mobile gets the model
without the controls, as a slow hands-off loop.

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
| `shared/QuestionsNotes.tsx` | FAQ notes, light or dark, ground overridable via `className`. |
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
