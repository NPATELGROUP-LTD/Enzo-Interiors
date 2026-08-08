# packages/ui — Shared Design System

Shared UI component library for `apps/admin` and `apps/portal`.

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
