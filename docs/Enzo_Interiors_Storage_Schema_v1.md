# Enzo Interiors Platform — Storage Schema Document (v1.0)

**Prepared for:** NPATEL GROUP LTD
**Client:** Enzo Interiors (Bespoke Interior Design & Fitted Furniture, Leicester, UK)
**Source documents:** Backend Schema v4, TRD v3.1, PRD v2.1
**Stack:** NestJS (apps/api) + PostgreSQL 16 + Prisma ORM + MinIO / AWS S3-compatible storage
**Date:** July 2026

**Scope:** This document defines S3/MinIO bucket structure, folder organisation, file naming conventions, access control, signed URL strategy, allowed file types, size limits, lifecycle/retention policies, backup strategy, and database-level guidelines for all storage-related fields in the Enzo Interiors Platform.

---

## 1. Storage Infrastructure Overview

The platform uses an S3-compatible object store (MinIO for self-hosted / AWS S3 for cloud) as the single storage backend for all binary assets. The NestJS API (`apps/api`) is the sole service that reads from or writes to storage — no client or public app ever accesses the bucket directly without a pre-signed URL issued by the API.

All storage references in the database are stored as **S3 object keys** (paths relative to the bucket root), never full public URLs. Full URLs are constructed at runtime by the API using the configured `STORAGE_BASE_URL` environment variable combined with the stored key.

---

## 2. Bucket Naming & Structure

### 2.1 Bucket Name

| Environment | Bucket Name |
|---|---|
| Production | `enzo-interiors-prod` |
| Staging | `enzo-interiors-staging` |
| Development (local MinIO) | `enzo-interiors-dev` |

**Rules:**
- All lowercase, hyphen-separated, no underscores (S3 DNS-compatibility requirement).
- Never store production and staging assets in the same bucket.
- Bucket names must not be changed after initial creation — all DB keys reference them via environment variable only.

### 2.2 Top-Level Folder Structure

```
enzo-interiors-prod/
├── documents/          # Client & project documents (contracts, plans, mood boards)
├── project-images/     # In-project progress/installation photos uploaded by staff
├── portfolio/          # Published portfolio item images (public-facing)
├── testimonials/       # Testimonial-linked images (if/when added)
├── logo/               # Business logo assets (business_settings.logo_url)
├── message-attachments/ # Files attached to chat messages
└── temp/               # Temporary upload staging area (TTL: 24 hours)
```

---

## 3. Folder Organisation by Use Case

### 3.1 Client Documents (`documents/`)

Maps to: `documents.storage_url`
Used for: Contracts, Quote PDFs, Invoice PDFs, Floor Plans, Mood Boards

```
documents/
└── {client_id}/
    └── {project_id}/      # If document is project-scoped
        └── {file_key}
    └── {file_key}         # If document is client-level only (no project)
```

**Key format:** `documents/{client_uuid}/{project_uuid?}/{document_uuid}_{sanitised_name}.{ext}`

**Example:** `documents/a1b2c3d4/e5f6a7b8/9c0d1e2f_signed-contract.pdf`

> **As built (CRM documents, Oct 2026):** the private bucket (`S3_PRIVATE_BUCKET`)
> uses `clients/{client_id}/projects/{project_id}/{uuid}-{sanitised-name}.{ext}`;
> every document has a project. Uploads go through the API (multipart, 25 MB,
> PDF / JPG / PNG / WebP / .doc(x) / .xls(x) / .pptx, checked by first bytes);
> downloads are 5-minute presigned GETs with `Content-Disposition: attachment`,
> made per request. See `apps/api/src/core/storage.ts`.

---

### 3.2 Project Images (`project-images/`)

Maps to: Any future `projects` image fields or staff-uploaded progress photos
Used for: Installation progress shots, site visit photos, internal reference imagery

```
project-images/
└── {project_id}/
    └── {image_uuid}_{sequence}_{sanitised_label}.{ext}
```

**Example:** `project-images/e5f6a7b8/3f4a5b6c_001_kitchen-installation.jpg`

---

### 3.3 Portfolio Images (`portfolio/`)

Maps to: `portfolio_items.image_urls` (JSONB array of S3 keys)
Used for: Published portfolio gallery images visible on the public marketing site

```
portfolio/
└── {portfolio_item_id}/
    └── {image_uuid}_{sequence}.{ext}
```

**Example:** `portfolio/7d8e9f0a/1a2b3c4d_001.jpg`

The `image_urls` JSONB column stores an **ordered array of S3 keys** (not full URLs). The first element is treated as the cover/hero image for the portfolio card.

```json
// portfolio_items.image_urls example
[
  "portfolio/7d8e9f0a/1a2b3c4d_001.jpg",
  "portfolio/7d8e9f0a/2b3c4d5e_002.jpg",
  "portfolio/7d8e9f0a/3c4d5e6f_003.jpg"
]
```

---

### 3.4 Testimonial Images (`testimonials/`)

Maps to: `testimonials` table (no image field currently — reserved for Phase 2 if client photos are added)
Used for: Client headshots or project completion photos linked to a testimonial

```
testimonials/
└── {testimonial_id}/
    └── {image_uuid}.{ext}
```

No DB field is currently defined for testimonial images. If added in a future migration, it should follow the same S3-key-only convention as `portfolio_items.image_urls`.

---

### 3.5 Business Logo Assets (`logo/`)

Maps to: `business_settings.logo_url`
Used for: Primary business logo used in email templates, PDF headers, admin UI

```
logo/
└── {timestamp}_{variant}.{ext}
```

**Variants:** `primary`, `white`, `dark`, `favicon`

**Examples:**
```
logo/20260715_primary.svg
logo/20260715_white.png
logo/20260715_favicon.ico
```

Only one active logo set exists at any time. When a new logo is uploaded, the previous file is **not deleted immediately** — it is moved to `logo/archive/` for a 90-day retention period before expiry.

---

### 3.6 Message Attachments (`message-attachments/`)

Maps to: `messages.attachments` (JSONB array of S3 keys)
Used for: Files sent in client-staff chat conversations

```
message-attachments/
└── {conversation_id}/
    └── {message_id}/
        └── {file_uuid}_{sanitised_name}.{ext}
```

**Example:** `message-attachments/conv-uuid/msg-uuid/abc123_floor-plan-v2.pdf`

The `messages.attachments` JSONB column stores an **array of S3 keys**:

```json
// messages.attachments example
[
  "message-attachments/c1d2e3f4/a5b6c7d8/abc123_floor-plan-v2.pdf"
]
```

---

### 3.7 Temporary Upload Staging (`temp/`)

Used for: Multipart upload staging before the API processes and moves files to their final destination

```
temp/
└── {upload_session_uuid}/
    └── {filename}
```

All objects under `temp/` have a **TTL of 24 hours** enforced by an S3 lifecycle rule. The API moves confirmed uploads to their permanent path and deletes the temp object as part of the same atomic operation.

---

## 4. File Naming Conventions

| Rule | Detail |
|---|---|
| **Case** | Always lowercase |
| **Separators** | Hyphens (`-`) for human-readable words; underscores (`_`) only as delimiter between UUID and filename |
| **Spaces** | Never — replace with `-` |
| **Special characters** | Strip all except `-`, `_`, `.` — sanitise at upload time in the API |
| **UUID prefix** | Every file key includes the row's UUID as a prefix to guarantee uniqueness and enable reverse-lookup |
| **Sequence numbers** | Use 3-digit zero-padded integers (`_001`, `_002`) for ordered sets (portfolio images, project photos) |
| **Max key length** | 200 characters (well within S3's 1,024-byte limit; keeps DB varchar(500) field comfortably below max) |

**Sanitisation function (NestJS utility — pseudocode):**
```typescript
function sanitiseFilename(original: string): string {
  return original
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_.]/g, '')
    .substring(0, 80); // cap the human-readable portion
}
```

---

## 5. Allowed File Types & Size Limits

### 5.1 Documents (`documents/`)

| Type | MIME Types | Max Size |
|---|---|---|
| PDF | `application/pdf` | 20 MB |
| Word Document | `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | 10 MB |
| Excel / CSV | `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `text/csv` | 5 MB |
| Images (mood boards, plans) | `image/jpeg`, `image/png`, `image/webp` | 15 MB |

### 5.2 Project & Portfolio Images (`project-images/`, `portfolio/`)

| Type | MIME Types | Max Size |
|---|---|---|
| JPEG | `image/jpeg` | 25 MB (original); serve WebP derivatives |
| PNG | `image/png` | 25 MB |
| WebP | `image/webp` | 15 MB |
| HEIC/HEIF | `image/heic`, `image/heif` | 30 MB (convert to WebP on ingest) |

> **Image processing note:** All images uploaded to `portfolio/` and `project-images/` should be processed through a NestJS image pipeline (Sharp) to generate:
> - Original (stored as-is)
> - `_thumb` variant (400×300, WebP)
> - `_medium` variant (1200×900, WebP)
> The DB key stored should point to the **original**; variants use the same key with `_thumb` / `_medium` suffix inserted before the extension.

### 5.3 Message Attachments (`message-attachments/`)

| Type | MIME Types | Max Size |
|---|---|---|
| PDF | `application/pdf` | 10 MB |
| Images | `image/jpeg`, `image/png`, `image/webp` | 10 MB |
| Word/Excel | Office MIME types above | 5 MB |

**Blocked for all use cases:**
- Executables: `.exe`, `.sh`, `.bat`, `.ps1`, `.msi`
- Archives: `.zip`, `.tar`, `.gz`, `.rar` (unless explicitly whitelisted per future requirement)
- Scripts: `.js`, `.ts`, `.py`, `.php`

### 5.4 Business Logo (`logo/`)

| Type | MIME Types | Max Size |
|---|---|---|
| SVG | `image/svg+xml` | 500 KB |
| PNG | `image/png` | 2 MB |
| ICO | `image/x-icon` | 100 KB |

---

## 6. Access Control

### 6.1 Bucket Policy

- **All buckets: private by default.** No public read access at the bucket or object level.
- The NestJS API authenticates to the bucket using a dedicated **service account IAM key** (`STORAGE_ACCESS_KEY_ID` / `STORAGE_SECRET_ACCESS_KEY` env vars).
- No application frontend (apps/web, apps/admin, apps/portal) has direct storage credentials.

### 6.2 IAM Permissions (minimum privilege)

| Operation | API Service Account | Notes |
|---|---|---|
| `s3:PutObject` | Yes — All paths | Upload only |
| `s3:GetObject` | Yes — All paths | For generating signed URLs |
| `s3:DeleteObject` | Yes — All paths | For cleanup on record deletion |
| `s3:ListBucket` | Yes — Scoped to bucket | Admin diagnostics only |
| `s3:GetBucketPolicy` | No | Not needed at runtime |
| Public `s3:GetObject` | No, never | All reads via signed URLs |

### 6.3 Pre-Signed URL Strategy

All file access from client-facing apps is gated behind **time-limited pre-signed GET URLs** generated by the API. The API never returns raw S3 keys to the frontend — it always resolves them to signed URLs at response time.

| Use Case | Signed URL TTL | Notes |
|---|---|---|
| Document download (Client Portal) | 15 minutes | Short-lived; client re-requests if expired |
| Document view (Admin CRM) | 1 hour | Admin sessions are longer-lived |
| Portfolio images (public site) | 7 days | Low sensitivity; cached by CDN |
| Message attachment preview | 30 minutes | Inline preview in chat UI |
| Logo assets | 30 days | Stable; rarely changes |
| Temp upload confirmation | 5 minutes | Only used during upload flow |

**Pre-signed URL generation (NestJS service — pseudocode):**
```typescript
async getSignedUrl(key: string, ttlSeconds: number): Promise<string> {
  const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
  return getSignedUrl(this.s3Client, command, { expiresIn: ttlSeconds });
}
```

> **Never log or persist signed URLs in the database.** They are ephemeral and generated fresh per request.

---

## 7. Lifecycle & Retention Policies

| Folder | Retention Rule | Action |
|---|---|---|
| `temp/` | 24 hours from creation | Auto-delete via S3 lifecycle rule |
| `documents/` | 7 years from upload date | Align with UK business record-keeping obligations |
| `project-images/` | Indefinite (project lifetime) | Manual deletion only when project is hard-deleted |
| `portfolio/` | Indefinite while `is_published = true`; 90 days after portfolio item deletion | Move to `portfolio/archive/` on soft-delete; lifecycle rule deletes after 90 days |
| `testimonials/` | Indefinite while testimonial exists | Delete on testimonial hard-delete |
| `logo/` (current) | Indefinite | Never auto-deleted |
| `logo/archive/` | 90 days from archival | Auto-delete via S3 lifecycle rule |
| `message-attachments/` | 2 years from message creation | Aligns with GDPR data minimisation; Admin can extend per legal hold |

### 7.1 S3 Lifecycle Rules (configure in bucket settings)

```xml
<!-- temp/ prefix: delete after 1 day -->
<Rule>
  <ID>expire-temp-uploads</ID>
  <Filter><Prefix>temp/</Prefix></Filter>
  <Status>Enabled</Status>
  <Expiration><Days>1</Days></Expiration>
</Rule>

<!-- logo/archive/ prefix: delete after 90 days -->
<Rule>
  <ID>expire-logo-archive</ID>
  <Filter><Prefix>logo/archive/</Prefix></Filter>
  <Status>Enabled</Status>
  <Expiration><Days>90</Days></Expiration>
</Rule>

<!-- portfolio/archive/ prefix: delete after 90 days -->
<Rule>
  <ID>expire-portfolio-archive</ID>
  <Filter><Prefix>portfolio/archive/</Prefix></Filter>
  <Status>Enabled</Status>
  <Expiration><Days>90</Days></Expiration>
</Rule>

<!-- message-attachments/: transition to cheaper storage tier after 6 months, delete after 2 years -->
<Rule>
  <ID>message-attachments-lifecycle</ID>
  <Filter><Prefix>message-attachments/</Prefix></Filter>
  <Status>Enabled</Status>
  <Transition>
    <Days>180</Days>
    <StorageClass>STANDARD_IA</StorageClass>
  </Transition>
  <Expiration><Days>730</Days></Expiration>
</Rule>
```

---

## 8. Backup Strategy

### 8.1 Primary Backup

| Method | Detail |
|---|---|
| **S3 Versioning** | Enable object versioning on `enzo-interiors-prod`. All overwrites and deletes are versioned, allowing point-in-time recovery. |
| **Cross-bucket replication** | Replicate `enzo-interiors-prod` to `enzo-interiors-backup` in a separate AWS region (or second MinIO node) daily. |
| **Database backup alignment** | PostgreSQL backups (pg_dump) should be timestamped to align with storage snapshots, so a DB restore and storage restore can be matched to the same point in time. |

### 8.2 Backup Retention

| Backup Type | Retention |
|---|---|
| Object versions (versioning) | 90 days of version history |
| Cross-bucket replication | 1 year |
| pg_dump snapshots | 30 days rolling |

### 8.3 Recovery Procedure (summary)

1. Identify the target restore timestamp from the incident report.
2. Restore PostgreSQL from the nearest pg_dump snapshot prior to the timestamp.
3. Use S3 versioning to restore any objects modified or deleted after that timestamp.
4. Run the orphan-check script (see §9.5) to validate DB–storage consistency post-restore.

---

## 9. Database Guidelines for Storage Fields

> **Assessment conclusion:** The four storage-referencing fields in the schema (`documents.storage_url`, `messages.attachments`, `business_settings.logo_url`, `portfolio_items.image_urls`) each introduce non-trivial integrity risks between the database and S3. Database-level guidelines are required and are documented below.

### 9.1 Field Inventory

| Table | Field | DB Type | Storage Path Prefix | Format |
|---|---|---|---|---|
| `documents` | `storage_url` | `varchar(500)` | `documents/` | Single S3 key string |
| `messages` | `attachments` | `jsonb` | `message-attachments/` | Array of S3 key strings |
| `portfolio_items` | `image_urls` | `jsonb` | `portfolio/` | Ordered array of S3 key strings |
| `business_settings` | `logo_url` | `varchar(500)` | `logo/` | Single S3 key string, nullable |

### 9.2 Naming Conventions for Storage URL Values

- **Always store the S3 object key only** — never the full URL, never a pre-signed URL.
  - Correct: `documents/a1b2c3d4/e5f6a7b8/9c0d1e2f_signed-contract.pdf`
  - Wrong: `https://s3.amazonaws.com/enzo-interiors-prod/documents/...`
  - Wrong: `https://s3.amazonaws.com/enzo-interiors-prod/documents/...?X-Amz-Signature=...`
- The API constructs full URLs at runtime: `${STORAGE_BASE_URL}/${key}` for CDN delivery, or generates a signed URL for secure access.
- Keys must always start with the correct folder prefix for their use case (as defined in §3). The API should validate the prefix before writing to the DB.
- `varchar(500)` is sufficient for all single-key fields — the longest possible key (200 chars, per §4) plus the bucket prefix leaves ample headroom.

### 9.3 JSONB Array Fields (`attachments`, `image_urls`)

Both `messages.attachments` and `portfolio_items.image_urls` use JSONB to store arrays of S3 keys.

**Enforced schema (validated in NestJS DTO before DB write):**
```typescript
// Both fields must conform to:
z.array(z.string().min(10).max(200)).min(0).max(20)
// portfolio_items.image_urls: min(1) — at least one image required
// messages.attachments: min(0) — optional, null if no attachments
```

**Ordering matters for `portfolio_items.image_urls`:** element `[0]` is always the cover image. The API must preserve array order on update and never shuffle keys.

**Null vs empty array:**
- `messages.attachments` → `null` when no attachments (not `[]`)
- `portfolio_items.image_urls` → never null; always at least one key

### 9.4 Referential Integrity Between DB Records and S3 Objects

S3 has no foreign key concept, so integrity must be enforced entirely by the API layer:

| Rule | Implementation |
|---|---|
| **Write atomically** | Always write the S3 object first, then write the DB record. If the DB write fails, delete the S3 object in the catch block (compensating transaction). Never write the DB record first. |
| **Validate key existence before DB write** | After uploading to S3, confirm the object exists (HeadObject check) before persisting the key to the database. |
| **Never store a key that hasn't been confirmed uploaded** | Temp keys (`temp/...`) must never be written to the live tables. Only write final destination keys. |
| **Delete S3 object on record deletion** | When a `documents` row is deleted, immediately delete `storage_url` from S3. When a `portfolio_items` row is deleted, delete all keys in `image_urls`. When a `messages` row is deleted, delete all keys in `attachments`. |
| **Logo replacement** | When `business_settings.logo_url` is updated, move the old key to `logo/archive/{old_key_basename}` before writing the new key. Do not delete the old file immediately. |

### 9.5 Orphaned File Cleanup

An orphaned file is an S3 object with no corresponding database record referencing its key.

**When orphans occur:**
- API crash between S3 upload and DB write
- Failed compensating deletes
- Manual DB record deletions that bypassed the service layer

**Orphan-check script (run weekly, or after any bulk migration):**
```typescript
// Pseudocode — implement as a NestJS scheduled task or CLI script
async function checkOrphans() {
  // 1. Collect all keys from S3 (list all objects in bucket, excluding temp/)
  const s3Keys = await listAllS3Keys(bucket, ['documents/', 'portfolio/', 'message-attachments/', 'logo/']);

  // 2. Collect all keys from DB
  const dbKeys = [
    ...await db.documents.findMany({ select: { storage_url: true } }).map(r => r.storage_url),
    ...await db.businessSettings.findMany({ select: { logo_url: true } }).map(r => r.logo_url).filter(Boolean),
    // Flatten JSONB arrays:
    ...(await db.portfolioItems.findMany({ select: { image_urls: true } })).flatMap(r => r.image_urls),
    ...(await db.messages.findMany({ select: { attachments: true }, where: { attachments: { not: null } } }))
         .flatMap(r => r.attachments as string[]),
  ];

  const dbKeySet = new Set(dbKeys);
  const orphans = s3Keys.filter(k => !dbKeySet.has(k));

  // 3. Log orphans; flag for manual review before deletion
  console.log(`Found ${orphans.length} orphaned S3 objects`);
  // Do NOT auto-delete without review — log to activity_logs or output CSV
}
```

### 9.6 Cascade Delete Behaviour

| DB Delete Event | Required S3 Action | Cascade Trigger |
|---|---|---|
| `documents` row deleted | Delete `documents.storage_url` from S3 | NestJS service hook (no Prisma cascade) |
| `portfolio_items` row deleted | Delete all keys in `portfolio_items.image_urls` | NestJS service hook |
| `messages` row deleted | Delete all keys in `messages.attachments` | NestJS service hook |
| `conversations` row deleted | Delete all attachment keys for all child messages | NestJS service hook (recursive) |
| `clients` row deleted | Delete all `documents` storage objects for the client | NestJS service hook (pre-delete documents) |
| `business_settings.logo_url` updated | Move old key to `logo/archive/` | NestJS service hook |

> **Important:** Prisma cascade deletes (e.g. `onDelete: Cascade` on `quote_line_items`) do **not** trigger S3 cleanup — S3 deletion must always be handled explicitly in the NestJS service layer before or after the DB operation.

### 9.7 Activity Log Integration

All storage write/delete operations performed by staff should be recorded in `activity_logs`:

```typescript
// Example activity_log entry for document deletion
{
  staff_id: currentUser.id,
  action: 'document_delete',
  target_table: 'documents',
  target_id: documentId,
  details: {
    storage_key: document.storage_url,
    s3_delete_status: 'success' | 'failed'
  }
}
```

Log `s3_delete_status` separately from the DB operation so failed S3 deletes are surfaced for the orphan-check process.

---

## 10. Environment Variables Reference

| Variable | Description | Example |
|---|---|---|
| `STORAGE_PROVIDER` | `minio` or `s3` | `s3` |
| `STORAGE_BUCKET` | Active bucket name | `enzo-interiors-prod` |
| `STORAGE_REGION` | AWS region (or MinIO equivalent) | `eu-west-2` |
| `STORAGE_ACCESS_KEY_ID` | IAM service account key | — |
| `STORAGE_SECRET_ACCESS_KEY` | IAM service account secret | — |
| `STORAGE_BASE_URL` | Base URL for CDN/public delivery (if applicable) | `https://cdn.enzoportal.co.uk` |
| `STORAGE_ENDPOINT` | Custom endpoint for MinIO | `http://localhost:9000` |
| `STORAGE_SIGNED_URL_DEFAULT_TTL` | Default signed URL TTL in seconds | `900` (15 min) |

---

*Enzo Interiors Platform — Storage Schema Document v1.0 · NPATEL GROUP LTD · July 2026*
