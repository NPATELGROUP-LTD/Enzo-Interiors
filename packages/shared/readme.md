# packages/shared — Shared Types and API Client

Shared TypeScript types, Zod schemas, Prisma-derived types and typed API utilities used by `apps/web`, `apps/admin` and `apps/portal`.

## Purpose

Provides a single source of truth for domain models and API contracts so all applications remain consistent with the backend schema.

## Includes

- TypeScript types for clients, staff, projects, quotes, invoices, bookings, messages, documents and content.
- Zod schemas for runtime validation of forms and API payloads.
- Typed API client and request/response models.
- Shared constants and domain enums.

## Usage

```ts
import type { Client, Quote } from '@enzo-interiors/shared';
import { quoteSchema } from '@enzo-interiors/shared/schemas';
```

## Maintenance

Update this package whenever the Prisma schema or API contract changes. Types should remain aligned with `apps/api` and must be consumed by all frontend applications instead of duplicating domain definitions.
