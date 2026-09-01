# `components/services` — file map

Everything that builds the two service routes. Folders map to routes, and
file names say which section of which page they are.

```
services/
├── shared/            used by BOTH routes
├── services-index/    only /services
└── service-detail/    only /services/[category]
    └── hero/          the four hero designs + the picker
```

## Which file builds what

### `/services` — `app/(marketing)/services/page.tsx`

| § | File | What it is |
|---|---|---|
| 01 | `services-index/IndexHero.tsx` | The fold. Plan drawing (large, clickable) driven by the list of disciplines beneath it. Auto-cycles until the visitor takes over. |
| 02 | `services-index/IndexPricingScale.tsx` | Every discipline plotted at its starting price on one horizontal money scale. Axis and ticks derived from the data. |
| 03 | `services-index/IndexConstants.tsx` | The four things that don't vary. A scroll-driven rule inks each one in as you reach it. |
| 04 | `shared/QuestionsAccordion.tsx` | FAQs. Sticky heading, `0fr→1fr` panels. |
| 05 | `shared/BookSurveyCta.tsx` | The closing ask. Type only. |

### `/services/[category]` — `app/(marketing)/services/[category]/page.tsx`

| Sheet | File | What it is |
|---|---|---|
| A1 | `service-detail/hero/ServiceHero.tsx` | Picks one of four hero designs — see below. |
| A2 | `service-detail/DetailIncludedRail.tsx` | Drag rail of included items, one plate each. Last plate can reach centre screen. |
| A3 | `service-detail/DetailFinishBlock.tsx` | Draggable CSS-3D sample block. Faces coloured from finish *names*. |
| A4 | `service-detail/DetailProcessRail.tsx` | Process stages on a rail that travels sideways as you scroll down. |
| A5 | `service-detail/DetailInvestment.tsx` | Pricing tiers with a live room-size estimate and rolling figures. |
| A6 | `shared/QuestionsAccordion.tsx` | Same component as `/services` §04. |
| — | `shared/BookSurveyCta.tsx` | Same component as `/services` §05. |

### The four hero designs

`hero/ServiceHero.tsx` chooses by the service's **published position**, so the
designs spread evenly and a newly added service just continues the cycle.
Set `heroVariant` on the record to pin one instead.

| # | File | Shape |
|---|---|---|
| 1 | `hero/HeroSplitPlate.tsx` | Hard 50/50 split — type left, photo right, edge to edge. |
| 2 | `hero/HeroPhotoOverlay.tsx` | Full-bleed photograph, type over its bottom edge. |
| 3 | `hero/HeroDrawingLed.tsx` | No photograph — the plan drawing leads. |
| 4 | `hero/HeroCentredStack.tsx` | Centred type over a 21:9 letterbox band. |

`hero/heroFacts.ts` derives the fact list all four share, so they stay four
*layouts* rather than four different sets of content.

### Shared

| File | What it is |
|---|---|
| `shared/RoomPlanDrawing.tsx` | The signature device: a plan of the room with the photograph clipped inside its footprint. Geometry comes from `lib/room-plan.ts`, seeded by the slug. |
| `shared/QuoteRequestModal.tsx` | `QuoteModalRoot` (context + sheet) and `QuoteTriggerButton`. Any CTA on a service page opens it. |
| `shared/QuestionsAccordion.tsx` | FAQ list, light or dark. |
| `shared/BookSurveyCta.tsx` | Closing CTA, light-agnostic. |

## Supporting modules (outside this folder)

| File | What it does |
|---|---|
| `lib/content/services.ts` | **Single source of truth** for services. Stands in for `GET /content/services`. |
| `lib/room-plan.ts` | Generates plan geometry from a slug. Pure, no React. |
| `lib/finish-swatch.ts` | Turns a finish name into a colour + surface character. Pure. |
| `lib/service-metrics.ts` | Derives comparison figures (starting price, lead weeks, counts) from a record. Pure. |
| `lib/quote-estimate.ts` | Room-size → price range. Stands in for `POST /quotes/estimate`. |

## House rules for this folder

- **Assume nothing about counts.** The client publishes services, tiers,
  process steps, materials and FAQs themselves. Every list is variable
  length; an empty array should render nothing rather than an empty section.
- **Derive, don't duplicate.** If a number can be computed from the record,
  compute it (`lib/service-metrics.ts`) rather than adding a field the
  client has to keep in sync.
- **Scroll-linked state reads live bounding boxes on `gsap.ticker`**, not
  cached ScrollTrigger bounds — see the note in
  `components/landing/ProcessLedger.tsx` for why.
- **No decorative icons.** Affordances are type, rules and motion.
