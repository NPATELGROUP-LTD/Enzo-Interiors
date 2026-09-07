# apps/web — over-engineering audit

Repo-wide scan of `apps/web` (25,695 source lines, 128 files, excluding `public/` and `node_modules/`).

**Constraint honoured throughout: nothing here changes a single rendered pixel.** Every item is dead code, a duplicated implementation, or a hand-rolled version of something the platform/stdlib already ships. The four-variant service-page system, the hero frame sequence, the 3D models and all section designs are *deliberate design* and are explicitly out of scope for deletion.

Out of scope by design: correctness bugs, security holes, performance. This pass is complexity only.

---

## Scoreboard

| Phase | Lines | Deps | Risk |
|---|---|---|---|
| 1. Dead code | −499 | −3 | none |
| 2. Deduplicate | −317 | 0 | low |
| 3. Comment archaeology | −900 | 0 | none |
| **Total** | **≈ −1,716** | **−3** | |

That is ~6.7% of the source tree. The 3 dependencies are `date-fns`, `class-variance-authority`, `@radix-ui/react-slot`.

---

# Phase 1 — Delete (zero behaviour change)

## 1.1 `date-fns` — installed, imported zero times

```
apps/web/package.json:15
```

Verified: `grep -rn "date-fns" src/` returns nothing.

**Change:** remove `"date-fns": "^4.4.0"` from `dependencies`, reinstall.

---

## 1.2 `Button.tsx` — a cva design system with one call site that overrides all of it

`src/components/ui/Button.tsx` (52 lines) declares 4 variants × 4 sizes plus `asChild` via Radix `Slot`, and pulls in two dependencies. It is imported by exactly one file and used exactly once:

```
src/components/layout/Navbar.tsx:345
```

That call passes a `className` overriding *every* class `variant="outline"` contributes (`border`, `bg`, `text`, and all three hover states). After `twMerge` resolves it, the variant contributes nothing at all.

**Change — at `Navbar.tsx:345`, replace:**

```tsx
<Button
  asChild
  variant="outline"
  size="sm"
  className={cn(
    "border-enzo-forest/30 bg-enzo-sand text-enzo-forest",
    "transition-all duration-300 ease-out",
    "hover:bg-enzo-forest hover:text-enzo-cream hover:border-enzo-forest",
    "hover:shadow-[0_8px_24px_rgba(28,74,58,0.25)] hover:scale-105",
    /* …rest of existing classes… */
  )}
>
  <Link href="/booking">…</Link>
</Button>
```

**with a plain `<Link>` carrying the base classes inline:**

```tsx
<Link
  href="/booking"
  className={cn(
    "inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-[13px]",
    "tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "border border-enzo-forest/30 bg-enzo-sand text-enzo-forest",
    "transition-all duration-300 ease-out",
    "hover:bg-enzo-forest hover:text-enzo-cream hover:border-enzo-forest",
    "hover:shadow-[0_8px_24px_rgba(28,74,58,0.25)] hover:scale-105",
    /* …rest of existing classes… */
  )}
>
  …
</Link>
```

The first two lines above are `buttonVariants`' base string plus `size="sm"` inlined verbatim — identical computed classes, identical rendering.

**Then delete:**
- `src/components/ui/Button.tsx`
- `"class-variance-authority"` and `"@radix-ui/react-slot"` from `package.json`

`cn()` in `src/lib/utils.ts` stays — it has 60+ callers.

---

## 1.3 Four fully dead components

Verified: no import of any of these exists anywhere in the tree.

| File | Lines | Note |
|---|---|---|
| `src/components/shared/TextRotate.tsx` | 110 | also the only user of `motion`'s `LayoutGroup` |
| `src/components/shared/FAQAccordion.tsx` | 78 | service pages render their own FAQ markup |
| `src/components/shared/ScrollReveal.tsx` | 51 | superseded by `fromOnScroll` in `useGSAP.ts` |
| `src/components/shared/SectionLabel.tsx` | 29 | superseded by `SectionIntro` |

**Change:** delete all four files. No import sites to update.

---

## 1.4 `revealWhenVisible` — 49 lines (40 of them comment) with no caller

```
src/hooks/useGSAP.ts:192-240
```

Its docstring explains at length why it exists instead of a ScrollTrigger, for a landing §05 bug. Nothing calls it. If that bug recurs, the function is one `git show` away.

**Change:** delete lines 192–240 of `src/hooks/useGSAP.ts`.

---

## 1.5 Dead exports scattered across `lib/` and `components/`

Each verified as having zero references outside its own file.

| Symbol | File | Action |
|---|---|---|
| `formatPriceRange` + `GBP_FORMATTER` | `src/lib/quote-estimate.ts:89-98` | delete both |
| `EstimateQuoteInput` / `EstimateQuoteResult` | `src/lib/quote-estimate.ts:19-32` | inline into `estimateQuote`'s signature |
| `clearConsent` | `src/lib/consent.ts:126-134` | delete |
| `hasConsent` | `src/lib/consent.ts:136-142` | see note below |
| `CONSENT_VERSION` | `src/lib/consent.ts:52` | keep, drop `export` (used internally) |
| `ELEVATION_STAGE_COUNT` | `src/components/landing/ElevationDrawing.tsx:25` | drop `export`, used locally |
| `HERO_VARIANT_COUNT` | `.../hero/ServiceHero.tsx:47` | delete |
| `SectionVariantProps` | `.../service-detail/variant.ts:34-36` | delete |
| `ModelViewerProps` | `.../model/ModelViewer.tsx` | drop `export` |
| `QuoteRequestInfo` | `.../shared/QuoteRequestModal.tsx` | drop `export` |
| `HeroTone` | `.../hero/heroParts.tsx:22` | drop `export` |
| `TransitionCopy`, `HeroTransition` | `src/components/landing/hero-rooms.ts` | drop `export` (keep `HeroRoom`, used by `roomFrameUrl`) |
| `NavSection`, `NavPage`, `NavLink` | `src/lib/navigation.ts:28-60` | drop `export` — only `NAV_LINKS` crosses the boundary |
| `Rect` | `src/lib/room-plan.ts` | drop `export` |
| `ServiceMetrics` | `src/lib/service-metrics.ts:18` | drop `export` |
| `HoursWindow` | `src/lib/studio-hours.ts` | drop `export` |
| `TextRollProps`, `SectionIntroProps`, `ButtonProps`, `GsapConditions`, `GsapSetup` | various | drop `export` |

**Note on `hasConsent`:** its comment argues it is "the gate every future non-essential script must sit behind." That is a real argument, and this is a legal/consent path — the one item on this list worth a decision rather than a reflex. The site sets no non-essential cookies today, so the gate currently guards nothing. **Recommendation: keep `hasConsent`, delete `clearConsent`.** A three-line gate is cheap insurance; the withdrawal path is already covered by `reopenConsent` + `setConsent`.

---

## 1.6 `theme.css` — dead tokens and an unreachable dark theme

`src/styles/theme.css`

### a) The entire `.dark {}` block (lines 90–110) and `@custom-variant dark` (line 24) are unreachable

Nothing ever applies the `dark` class — verified across the whole tree. `src/components/ui/sonner.tsx:3-8` documents the same fact ("no theme toggle, no dark-mode switch anywhere in apps/web"). All 155 grep hits for "dark" are `enzo-dark` or `tone="dark"`, neither of which touches this block.

**Change:** delete lines 90–110 and line 24. **−22 lines.**

### b) Dead tokens — zero references in any `.ts`/`.tsx`

```
--chart-1 … --chart-5          (:root)  + --color-chart-1 … -5  (@theme)   → 10 lines
--switch-background            (:root)  + --color-switch-background         →  2 lines
--sidebar, --sidebar-foreground, --sidebar-primary,
--sidebar-primary-foreground, --sidebar-accent-foreground,
--sidebar-border, --sidebar-ring        (+ their @theme mirrors)            → 14 lines
--radius-sm / --radius-md / --radius-xl (@theme)                            →  3 lines
--color-accent-foreground, --color-card-foreground (@theme)                 →  2 lines
```

Keep `--sidebar-accent` / `--color-sidebar-accent` — `BookingWizard.tsx:194` uses `bg-sidebar-accent`.

**Change:** delete the listed declarations. **−31 lines.**

### c) `.shell-inset` — zero usages

In the `@layer components` block alongside `.shell`. It is `.shell` minus `width: 100%`, with its own explanatory comment. Nothing references it.

**Change:** delete the rule and its comment. **−12 lines.**

theme.css subtotal: **−65 lines.**

---

## 1.7 `SectionIntro` — two props and a whole tone branch nobody uses

`src/components/shared/SectionIntro.tsx` takes 12 props. Measured call-site usage across 25 files:

| Prop | Uses | Verdict |
|---|---|---|
| `index` | 266 | keep |
| `datum` | 52 | keep |
| `layout="split"` | 25 | keep |
| `tone="dark"` | 13 | keep |
| `actions` | 11 | keep |
| `splitTemplate` | 4 | keep |
| `ledeShort` | 3 | keep |
| `titleClassName` | 1 | keep (marginal) |
| **`splitGapClassName`** | **0** | **delete** |
| **`tone="ink"`** | **0** | **delete** |

`tone="ink"` costs far more than its prop line: it forces a three-way `dark / ink / neither` conditional through **six** separate `cn()` blocks (lines 191–193, 209–211, 259–261, 298–300, 330–331) plus the `inkText` const and a 6-line contrast-ratio comment (lines 126–133).

**Change:**

1. Delete the `splitGapClassName` prop, its 6-line docstring, and its use at line 281:
   ```diff
   - split && (splitGapClassName ?? "gap-x-12"),
   + split && "gap-x-12",
   ```

2. Delete `tone="ink"` from the union (line 62), the `ink` const (line 124), `inkText` (lines 126–133), and collapse all six `cn()` blocks from three branches to two:
   ```diff
   - dark && "text-enzo-cream",
   - ink && inkText,
   - !dark && !ink && "text-primary",
   + dark ? "text-enzo-cream" : "text-primary",
   ```
   …and the same shape for the other five.

3. Delete the now-dead `ink` ternary inside the rule's inline `color` style (lines 228–233):
   ```diff
   - color: dark ? "rgba(212,201,181,0.55)" : ink ? "rgba(30,30,28,0.4)" : "rgba(28,74,58,0.35)",
   + color: dark ? "rgba(212,201,181,0.55)" : "rgba(28,74,58,0.35)",
   ```

**−30 lines, and the component drops from three colour modes to two.**

---

## 1.8 Three unnecessary `"use client"` directives

Each has no hook, no event handler and no browser API — Server Components wearing a client boundary, which pulls them and their imports into the client bundle for nothing.

| File | Why it is safe to drop |
|---|---|
| `src/components/landing/HeroCtaButton.tsx` | imports only `Link`, `ArrowUpRight`, `cn` |
| `src/components/services/services-index/ConstantMarks.tsx` | imports only `cn`; animation is pure CSS (`DRAW_MS`) |
| `src/components/services/service-detail/hero/heroParts.tsx` | no hooks; importing the client `QuoteTriggerButton` does not require it |

**Change:** delete line 1 (`"use client";`) from those three.

**Keep `"use client"` on:**
- `RotatingBadge.tsx` — uses `useId()`, not available in RSC.
- `scene/ServiceScene.tsx` — mounts `<Canvas>` from `@react-three/fiber`.

---

# Phase 2 — Deduplicate (same behaviour, one implementation)

## 2.1 `parsePriceLabel` — byte-identical in two files

```
src/lib/quote-estimate.ts:57-62     (private)
src/lib/service-metrics.ts:38-43    (exported)
```

Both are:

```ts
const digits = label.replace(/[^0-9.]/g, "");
if (!digits) return null;
const value = Number(digits);
return Number.isFinite(value) ? value : null;
```

**Change:** delete the copy in `quote-estimate.ts` and import the one already exported:

```ts
import { parsePriceLabel } from "@/lib/service-metrics";
```

**−6 lines.**

---

## 2.2 The GBP formatter — three identical `Intl.NumberFormat` instances

```
src/lib/quote-estimate.ts:89-93
src/components/services/service-detail/investment/RollingFigure.tsx:17-21
src/components/services/services-index/IndexPricingScale.tsx:57-61
```

All three are exactly:

```ts
new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 })
```

`RollingFigure.tsx` already exports its copy as `GBP`. The `quote-estimate.ts` copy dies with `formatPriceRange` in §1.5.

**Change:** move the single instance into `src/lib/service-metrics.ts` beside `parsePriceLabel` (currency parsing and currency formatting belong together), export it as `GBP`, and import it in `RollingFigure.tsx` and `IndexPricingScale.tsx`.

**−8 lines, and one place to change if the currency ever does.**

---

## 2.3 `prefers-reduced-motion` — read five different ways

The worst consistency problem in the codebase. Same question, five mechanisms:

| Mechanism | Sites |
|---|---|
| `usePrefersReducedMotion()` | 5 |
| `useMediaQuery("(prefers-reduced-motion: reduce)")` | 5 |
| bare `window.matchMedia(...).matches` inside an effect | 7 |
| `useGSAP`'s `reduced` callback argument | many |
| `prefersReducedMotion()` in `lib/motion.ts` | 0 — **dead** |

**Change:**

1. **Delete `prefersReducedMotion()` from `src/lib/motion.ts` (lines 40–49)** — zero callers, and it duplicates the hook. **−10 lines.**

2. Replace the inline `useMediaQuery` calls with the named hook:
   - `src/components/about/AboutJourney.tsx:126`
   - `src/components/about/AboutStatement.tsx:50`
   - `src/components/portfolio/PortfolioMasthead.tsx:40`
   - `src/components/services/services-index/IndexHero.tsx:55`

   ```diff
   - const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
   + const reduced = usePrefersReducedMotion();
   ```

   Drop the now-unused `useMediaQuery` import where it was the only use (`AboutStatement`, `PortfolioMasthead`, `IndexHero`).

3. The bare `window.matchMedia` reads inside GSAP effects should use the `reduced` argument `useGSAP` already hands them: `RollingFigure.tsx:31`, `RoomSizeControl.tsx:39`, `AboutTeam.tsx:191`, `PortfolioWall.tsx:114,155,179`. `SmoothScroll.tsx:25` is genuinely outside React's render path — leave it.

**Net −12 lines, but the real win is that "how does this file check reduced motion?" has one answer.**

---

## 2.4 Modal plumbing hand-rolled three times — `<dialog>` does all of it natively

Scroll lock, Escape-to-close, focus trap and focus restore are re-implemented in:

| File | Lines | What it hand-rolls |
|---|---|---|
| `src/components/portfolio/CaseStudySheet.tsx:60-118` | ~50 | Escape + arrow keys + **manual Tab focus trap** + scroll lock + focus restore |
| `src/components/services/shared/QuoteRequestModal.tsx:105-131` | ~30 | Escape + scroll lock + scrollbar-gap padding + focus restore |
| `src/components/layout/Navbar.tsx:218-238` | ~20 | scroll lock + Escape, as two separate effects |

The native `<dialog>` element with `showModal()` provides, free and correct: Escape-to-close, a real focus trap, `inert` on everything behind it, focus restore to the invoking element on close, and a `::backdrop`.

The hand-written Tab trap at `CaseStudySheet.tsx:82-98` is the riskiest 17 lines here — its `querySelectorAll` selector covers only `a[href]`, `button:not([disabled])` and `[tabindex]:not([tabindex="-1"])`, so an `input`, `select`, `textarea` or `[contenteditable]` inside the sheet escapes the trap.

**Change — `CaseStudySheet.tsx`:** make the panel a `<dialog ref={dialogRef}>`, call `dialogRef.current?.showModal()` when `open` flips true and `.close()` when it flips false, and reduce the keydown effect to the arrow keys alone:

```tsx
useEffect(() => {
  if (!open) return;
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); onStep(1); }
    if (e.key === "ArrowLeft")  { e.preventDefault(); onStep(-1); }
  };
  document.addEventListener("keydown", onKeyDown);
  return () => document.removeEventListener("keydown", onKeyDown);
}, [open, onStep]);
```

Wire `onClose={onClose}` on the `<dialog>` so Escape still calls back into React state. Scroll lock stays (`<dialog>` does not lock the page). The Escape handler, the Tab trap, the `returnFocusTo` ref and the focus `setTimeout` all go.

Keep the existing GSAP enter timeline and every existing class — the visual result is unchanged. `::backdrop` is not used; the current scrim element stays.

**Apply the same treatment to `QuoteRequestModal.tsx` and the Navbar mobile sheet.**

**≈ −100 lines, and the accessibility gets *better*, not worse.**

---

## 2.5 145 `<meshStandardMaterial>` tags, ~15 distinct materials

```
src/components/services/service-detail/model/scene/units.tsx     87 occurrences (754-line file)
src/components/landing/MediaWallScene.tsx                        52 occurrences
src/components/services/service-detail/model/scene/sceneKit.tsx   6 occurrences
```

The same handful of lines repeat throughout:

```tsx
<meshStandardMaterial color={STONE} roughness={0.94} />                    // × 14
<meshStandardMaterial color={FOREST} roughness={0.72} />                   // ×  9
<meshStandardMaterial color={FOREST_DEEP} roughness={0.9} />               // ×  8
<meshStandardMaterial color={SAGE} roughness={0.5} />                      // ×  6
<meshStandardMaterial color={LINEN} roughness={0.95} />                    // ×  6
<meshStandardMaterial color={BRASS} roughness={0.25} metalness={0.75} />   // ×  6
```

**Change:** add one table and one component to `sceneKit.tsx`:

```tsx
const MATERIALS = {
  stone:  { color: STONE,       roughness: 0.94 },
  forest: { color: FOREST,      roughness: 0.72 },
  deep:   { color: FOREST_DEEP, roughness: 0.9  },
  sage:   { color: SAGE,        roughness: 0.5  },
  linen:  { color: LINEN,       roughness: 0.95 },
  brass:  { color: BRASS,       roughness: 0.25, metalness: 0.75 },
  // …the remaining ~9 combinations, read off the existing tags
} as const;

export function Mat({ kind }: { kind: keyof typeof MATERIALS }) {
  return <meshStandardMaterial {...MATERIALS[kind]} />;
}
```

Then `<meshStandardMaterial color={STONE} roughness={0.94} />` becomes `<Mat kind="stone" />` at all 145 sites.

Identical render output — the props pass through verbatim. **≈ −100 lines, and retuning a finish becomes a one-line edit instead of a 14-site find-and-replace.**

---

## 2.6 The four hero variants repeat the same eight-line preamble

```
.../hero/HeroMasthead.tsx:52-58
.../hero/HeroColumns.tsx:49-54
.../hero/HeroAperture.tsx:83-89
.../hero/HeroDoors.tsx:44-50
```

All four open with the identical three queries plus `rule`:

```tsx
const meta  = gsap.utils.toArray<HTMLElement>("[data-hero-meta]", section);
const lines = gsap.utils.toArray<HTMLElement>("[data-hero-line]", section);
const body  = gsap.utils.toArray<HTMLElement>("[data-hero-body]", section);
const rule  = section.querySelector<HTMLElement>("[data-hero-rule]");
```

…and all four then repeat the same reduced-motion escape hatch (`gsap.set(lines, { opacity: 1, yPercent: 0, y: 0 })` and `gsap.set([...meta, ...body], { opacity: 1, y: 0 })` — 5 occurrences each across the tree).

**Change:** add to `heroParts.tsx`:

```tsx
export function heroCommonParts(section: HTMLElement) {
  return {
    meta:  gsap.utils.toArray<HTMLElement>("[data-hero-meta]", section),
    lines: gsap.utils.toArray<HTMLElement>("[data-hero-line]", section),
    body:  gsap.utils.toArray<HTMLElement>("[data-hero-body]", section),
    rule:  section.querySelector<HTMLElement>("[data-hero-rule]"),
  };
}

export function heroRestMotion(p: ReturnType<typeof heroCommonParts>) {
  gsap.set(p.lines, { opacity: 1, yPercent: 0, y: 0 });
  gsap.set([...p.meta, ...p.body], { opacity: 1, y: 0 });
  if (p.rule) gsap.set(p.rule, { scaleX: 1 });
}
```

Each variant keeps its own unique queries (`shutters`, `doors`, `panels`, `band`, `edge`) and its own entirely distinct timeline — the four designs stay four designs.

**≈ −22 lines.**

---

## 2.7 The count-up tween, written three times

```
src/components/about/AboutNumbers.tsx:44-78
src/components/services/service-detail/investment/RollingFigure.tsx:26-55
src/components/services/services-index/IndexPricingScale.tsx:146-198
```

All three build the same GSAP proxy-object counter: `{ value }` proxy → `gsap.to` → `onUpdate` writes `textContent` → reduced-motion short-circuit → cleanup that remembers the interrupted position.

**Change:** extract to `src/lib/motion.ts`:

```ts
/** Tweens `node`'s textContent from `from` to `to`. Returns a cleanup fn. */
export function countTo(
  node: HTMLElement,
  from: number,
  to: number,
  format: (n: number) => string,
  reduced: boolean,
): () => void {
  if (reduced) {
    node.textContent = format(to);
    return () => {};
  }
  const proxy = { value: from };
  const tween = gsap.to(proxy, {
    value: to,
    duration: 0.55,
    ease: EASE.exit,
    onUpdate: () => { node.textContent = format(Math.round(proxy.value)); },
  });
  return () => tween.kill();
}
```

`RollingFigure` passes `GBP.format`, `AboutNumbers` passes `String`, `IndexPricingScale` passes `GBP.format`. Each call site keeps its own `shown` ref for interrupt continuity.

**≈ −35 lines.**

---

## 2.8 `TextRoll` maps the same array twice

```
src/components/shared/TextRoll.tsx:55-90
```

Two blocks differing only in the `animate` target (`y: active ? "-100%" : 0` vs `y: active ? 0 : "100%"`) and one `aria-hidden`. The 3-line `delay` computation is copy-pasted into both.

**Change:** one local component, mapped twice:

```tsx
const Row = ({ to, hidden }: { to: string | number; hidden?: boolean }) => (
  <div className={cn("flex select-none", hidden && "absolute inset-0")} aria-hidden={hidden}>
    {letters.map((letter, i) => (
      <motion.span
        key={i}
        animate={{ y: to }}
        transition={{
          ease: [0.4, 0, 0.2, 1],
          duration: 0.35,
          delay: STAGGER * (center ? Math.abs(i - (letters.length - 1) / 2) : i),
        }}
        className="inline-block"
      >
        {letter === " " ? " " : letter}
      </motion.span>
    ))}
  </div>
);
```

**≈ −18 lines.**

**Bonus:** `center` is never passed at any of the 3 call sites (`Footer.tsx:305,351`, `Navbar.tsx:464`). Delete the prop and its docstring too — the `delay` then collapses to `STAGGER * i`.

---

## 2.9 `gsap.registerPlugin(ScrollTrigger)` called six times

```
src/hooks/useGSAP.ts:16               ← the real one, runs on first import
src/components/layout/Footer.tsx:17
src/components/shared/SectionIntro.tsx:22
src/components/services/services-index/IndexPricingScale.tsx:55
src/components/landing/HeroSequence.tsx:200
src/components/shared/SmoothScroll.tsx:21
```

`registerPlugin` is idempotent, and every one of these files already imports from `@/hooks/useGSAP`, which registers at module scope on first import. The five extras are noise.

**Change:** delete the 5 redundant calls (keep `useGSAP.ts:16`). Where that leaves an unused `ScrollTrigger` import, drop that too.

`PortfolioWall.tsx:53` registers `Flip`, a different plugin — **keep that one.**

**−6 lines.**

---

## 2.10 `SectionIntro` re-implements the helper it already imports

```
src/components/shared/SectionIntro.tsx:163-181
```

The file imports from `@/hooks/useGSAP`, then hand-builds `gsap.timeline({ paused: true })` → populate → `ScrollTrigger.create({ animation: tl })`, and carries an 8-line comment (155–162) re-explaining why. That is exactly `scrollTimeline()`, exported from the module it is already importing — and 5 other files use it correctly.

**Change:**

```diff
- const tl = gsap.timeline({ paused: true });
- tl.to(meta, {...}).to(rule, {...}).to(titleLines, {...}).to(ledeEl, {...});
- ScrollTrigger.create({ trigger: root, start: REVEAL_START, once: true, animation: tl });
+ scrollTimeline(
+   (tl) => { tl.to(meta, {...}).to(rule, {...}).to(titleLines, {...}).to(ledeEl, {...}); },
+   { trigger: root, start: REVEAL_START, once: true },
+ );
```

Delete the 8-line duplicate comment — `scrollTimeline`'s own docstring already says it. Drop the now-unused `ScrollTrigger` import and the `registerPlugin` call from §2.9.

**≈ −14 lines.**

---

## 2.11 Navbar: two ResizeObservers plus a redundant resize listener

```
src/components/layout/Navbar.tsx:79-87    ResizeObserver #1 (linksRow → closedWidth)
src/components/layout/Navbar.tsx:96-135   ResizeObserver #2 (logo + cta → dockBox) + window resize
```

Two observers and a `window.addEventListener("resize")` for three elements that all resize from the same cause. The `window` listener is redundant with observer #2 — the logo and CTA are text-sized elements that change width whenever the viewport does, which is precisely what ResizeObserver reports.

**Change:** merge into one `useLayoutEffect` with a single `ResizeObserver` observing all three elements and calling both measure functions. Drop the `window` resize listener.

Keep the comment at lines 122–128 explaining why the dock itself must never be observed (feedback loop) — that one is load-bearing.

**≈ −10 lines.**

---

# Phase 3 — Comment archaeology

`src/` carries **4,097 comment lines against 24,856 source lines — 16%.** That is not documentation density; it is a changelog living in the source.

Worst ratio: `src/hooks/useGSAP.ts` at **152 comment lines in a 267-line file (57%)**, including a 40-line essay (lines 96–135) narrating a `Cannot read properties of undefined (reading 'end')` crash, and a 45-line one (lines 192–217) about a §05 reveal bug attached to a function nothing calls.

## The distinction to apply

**Keep** comments answering *"why is the code like this, and what breaks if you change it?"* These are load-bearing and should survive untouched:

- `useGSAP.ts:59-65` — why `always: "(min-width: 0px)"` exists (remove it and every non-reduced-motion visitor loses their animations)
- `SectionIntro.tsx:24-29` — why initial states are inline `style` and not Tailwind `translate-*` (Tailwind v4 composes `translate` on top of `transform`; GSAP can never cancel it)
- `Navbar.tsx:70-76` — why `closedWidth` must be a measured px value, not `fit-content`
- `Navbar.tsx:122-128` — why the dock must not observe itself
- `app/booking/services.ts:1-8` — why this data file is separate from `BookingWizard.tsx`
- `theme.css` — the `--muted-foreground` contrast-ratio note, `scrollbar-gutter`, and "deliberately not `scroll-behavior: smooth`"
- `consent.ts:1-33` — the PECR / UK-GDPR reasoning
- `SmoothScroll.tsx:1-10` — why Lenis over ScrollSmoother
- Every WCAG / contrast-ratio justification

**Cut** comments narrating a past incident. These are archaeology; `git log` holds them, and they mislead a reader into treating a fixed bug as a live constraint:

| Location | Cut | Lines |
|---|---|---|
| `useGSAP.ts:96-135` | the "Trap 1 / Trap 2" crash narrative — compress to 4 lines: *"Build the timeline, then attach the ScrollTrigger. A trigger passed into `gsap.timeline({scrollTrigger})` measures at construction, while the timeline is still empty. Never write `gsap.from(el, { scrollTrigger })` in this codebase."* | −36 |
| `useGSAP.ts:192-240` | whole function, already deleted in §1.4 | (counted) |
| `Hero.tsx:12-17` | "That used to throw `removeChild`…" | −6 |
| `SectionIntro.tsx:155-162` | replaced by `scrollTimeline` in §2.10 | (counted) |
| `theme.css` `@layer utilities` | the Turbopack cascade-layer investigation — keep one line: *"Layered explicitly; unlayered rules lose to Tailwind's utility layer here."* | −12 |
| `theme.css` `.shell` | the "it ran full-bleed for a while; it does not now" history — keep the 2-line what-it-does | −18 |
| `ServiceHero.tsx:3-8` | "An earlier set gave the four pages…" — keep the table, cut the two rejected iterations | −7 |
| `TextRoll.tsx:9-14` | "that propagation path turned out not to reliably reach nested children" | −6 |
| `navigation.ts:3-15` | "The hover panels used to be a grab-bag…" — keep the 3-line rule, cut the before-state | −10 |
| `ImageWithFallback.tsx`, `sonner.tsx`, `SectionLabel.tsx`, `ScrollReveal.tsx` | "Ported from Boilerplate:…" provenance lines — git history records the port | −8 |

Applying the same rule across the remaining ~110 files — cut incident narration, keep constraint documentation — reclaims **≈ 900 lines** and takes the ratio from 16% to roughly 12%, where what remains is all signal.

**This is the highest-value phase for the stated goal ("easy to understand") and the lowest-risk: it cannot change behaviour at all.**

---

# Not cut, and why

Recorded so a later pass does not re-litigate them:

- **The four-variant service page system** (`variant.ts` + 4 heroes + 4 process + 4 investment + 4 models, ~3,500 lines). This is the product. Four service pages that are four genuinely different designs is a deliberate decision documented in `variant.ts`, and collapsing it would change every service page.
- **The 5 near-identical variant pickers** (`ServiceHero`, `ServiceProcess`, `ServiceInvestment`, `ServiceModel`, `ServiceIncluded`). A generic `<VariantPicker variants={…}/>` would save ~40 lines and cost the per-section type safety on differing props (`steps`, `pricing`, `category`). Not worth it.
- **`motion` alongside `gsap`.** Two animation runtimes is a real smell, but once `TextRotate` is deleted (§1.3), `motion` earns its place in 4 files through `AnimatePresence` exit animations (`Navbar`, `QuoteRequestModal`, `BookingWizard`) — genuinely awkward in GSAP with React unmounting. **Revisit if `TextRoll` and `not-found.tsx` ever move to CSS**, at which point it is down to 3 files and worth reconsidering.
- **`not-found.tsx`'s SVG `pathLength` draw.** CSS `stroke-dasharray` / `stroke-dashoffset` does this natively, but it is a rewrite of a working page for ~15 lines. Low priority.
- **`lib/content/index.ts` barrel** (17 lines). Barrels can obscure the dependency graph, but this one has 30+ importers and a stable surface. Keep.
- **93 MB of hero frames** in `public/frames` (432 × webp). Not code, but it dominates the repo. Worth confirming these are served from a CDN in production, and whether 144 frames per room could be 96. Flagged, not recommended.

---

# Suggested order

1. **Phase 1** — pure deletion, no call sites to fix except §1.2. Land it, then run `pnpm --filter=web typecheck && pnpm --filter=web build`. TypeScript catches anything missed.
2. **Phase 3** — comments only, cannot break the build. Land separately so the diff is reviewable as prose.
3. **Phase 2** — real refactors. Land §2.1, §2.2, §2.3, §2.9, §2.10 first (mechanical). Then §2.5 and §2.7 (mechanical but large). **Do §2.4 (`<dialog>`) last and on its own branch** — it is the only item here touching focus behaviour, and it wants a keyboard pass on each of the three modals before merge.

Verification after each phase: `pnpm --filter=web typecheck`, `pnpm --filter=web lint`, `pnpm --filter=web build`, then a browser pass over `/`, `/services`, `/services/kitchens`, `/portfolio`, `/about`, `/contact`, `/booking` with the console open.
