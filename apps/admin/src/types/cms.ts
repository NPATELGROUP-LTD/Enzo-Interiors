/**
 * The CMS types, mirroring what apps/api serves.
 *
 * As everywhere else in this app, these are a local copy of the subset this
 * portal consumes rather than a shared package — the same convention the rest
 * of src/types/api.ts follows.
 */

export const CMS_COLLECTIONS = [
  'pages',
  'services',
  'portfolio',
  'testimonials',
  'team',
  'faqs',
  'navigation',
  'company',
] as const;
export type CmsCollection = (typeof CMS_COLLECTIONS)[number];

/**
 * What the server says about a collection, fetched rather than hard-coded.
 *
 * The form UI is generated from the shape of the content itself plus these
 * hints — see the API's modules/cms/schemas.ts for why the content model is
 * not described field-by-field on either side.
 */
export interface CollectionSchema {
  collection: CmsCollection;
  label: string;
  singular: string;
  description: string;
  fixed: boolean;
  titleField: string;
  listColumns: string[];
  mediaKeys: string[];
  mediaListKeys: string[];
  longTextKeys: string[];
  references: Record<string, CmsCollection>;
  readonlyKeys: string[];
  publishFlagKey?: string;
}

export interface CmsOverview {
  schemas: CollectionSchema[];
  counts: Record<string, { total: number; dirty: number }>;
}

export interface CmsEntrySummary {
  id: string;
  collection: CmsCollection;
  slug: string;
  sort_order: number;
  title: string;
  columns: Record<string, string>;
  published_at: string | null;
  updated_at: string;
  updated_by: string | null;
  /** Never published, so the public site is not showing it at all. */
  isNew: boolean;
  /** Saved since the last publish. */
  isDirty: boolean;
}

export interface CmsEntry {
  id: string;
  collection: CmsCollection;
  slug: string;
  sort_order: number;
  draft: Record<string, unknown>;
  published: Record<string, unknown> | null;
  published_at: string | null;
  updated_at: string;
  updated_by: string | null;
  isDirty: boolean;
}

export interface MediaAsset {
  id: string;
  storage_key: string | null;
  src: string | null;
  alt: string;
  title: string | null;
  source: string;
  width: number | null;
  height: number | null;
  byte_size: number | null;
  mime_type: string | null;
  created_at: string;
  updated_at: string;
  /** The URL that actually renders, whether uploaded or shipped with the site. */
  src_resolved: string;
}

export interface UploadTicket {
  url: string;
  storage_key: string;
  expires_in: number;
}

export const UPLOAD_ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,application/pdf';
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
