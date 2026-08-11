# packages/ui — Shared Design System

Shared UI component library for `apps/admin` and `apps/portal`.

## Status (Phase 0)

Core primitives are implemented against `docs/Enzo_Interiors_UI_UX_Brief_v6.md`:
Button, TextLink, Badge (status tags), Card, DashboardCard, Input, Textarea,
Label, Separator, Skeleton, Switch, Tabs, Table, Dialog, Tooltip, Toaster,
plus `useDarkMode` and the `tokens.css` token file.

**Deferred to Phase 3 (Admin) / Phase 4 (Portal):** the admin sidebar / client
portal dock navigation and bento dashboard layout primitives — these are
large, route-shaped components better built against real routes than
speculatively now. Add components on demand as each module needs them rather
than porting the full legacy set upfront.

**Dark mode:** `tokens.css`'s `.dark` values are carried from the pre-brief
boilerplate and are a placeholder — Brief v6 only specifies a light palette.
Get sign-off before shipping a dark-mode screen.

## Purpose

Provides reusable components and visual primitives for the two authenticated applications, reducing duplication and keeping the Admin and Client Portal experiences consistent.

## Includes

- Buttons, cards, tables, forms and modals.
- Admin sidebar and client portal dock navigation.
- Bento dashboard layout primitives.
- Light and dark theme support.
- Toast and notification styles.
- Accessible loading, empty, error and disabled states.

## Brand Tokens

- Primary green: `#173C30`.
- Typography: Inter.
- Control radius: 8px.
- Card radius: 12px.
- Minimum touch target: 44px.
- WCAG-AA contrast requirements.

## Usage

```ts
import { Button, Card } from '@enzo-interiors/ui';
```

## Scope

The public marketing site has a separate visual language and should not depend on authenticated portal-specific components.
