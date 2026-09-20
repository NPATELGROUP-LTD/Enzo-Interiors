/**
 * Enzo Interiors — API domain types.
 *
 * A 1:1 translation of docs/Enzo_Interiors_Backend_Schema_v2.0.md section 3
 * into TypeScript. Field names match the documented snake_case column names
 * exactly, so that the eventual Prisma/PostgreSQL swap is a mechanical change
 * rather than a rename pass, and so the JSON that goes over the wire to
 * apps/admin and apps/portal is the same shape those apps would see from a
 * real database.
 *
 * Prototype-phase deviations from the schema doc, all deliberate:
 *   - `uuid` columns are plain `string` ids. The seed uses readable stable ids
 *     ("cli_sarah_jones") rather than random UUIDs so the JSON files in
 *     apps/api/data/ can be read and cross-referenced by a human.
 *   - `decimal(n,2)` columns are `number`, always rounded to 2dp on write via
 *     common/util/money.ts. See that file for why this is tolerable here and
 *     why it is NOT how the Postgres schema should be defined.
 *   - `timestamptz` / `date` columns are ISO-8601 strings.
 *   - `jsonb` columns are their natural TS shape (arrays / objects).
 *   - `documents.storage_url` is a descriptive placeholder string, not an S3
 *     key. There is no object storage in this phase.
 *
 * These types are internal to apps/api. apps/admin and apps/portal each keep
 * their own local copies of the subset they consume; nothing is shared across
 * app boundaries by design.
 */

/* -------------------------------------------------------------------------- */
/* Enums                                                                      */
/* -------------------------------------------------------------------------- */

export const STAFF_ROLES = ['Admin', 'Designer', 'Installer'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const CLIENT_STATUSES = ['Active', 'Inactive'] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const SERVICE_TYPES = ['Kitchen', 'Bedroom', 'MediaWall', 'Wardrobe'] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

/** The 5 Kanban stages, in pipeline order. The order is meaningful. */
export const PROJECT_STAGES = [
  'Consultation',
  'Design',
  'Approval',
  'Installation',
  'Completed',
] as const;
export type ProjectStage = (typeof PROJECT_STAGES)[number];

export const COMPONENT_CATEGORIES = [
  'Worktop',
  'DoorFinish',
  'Lighting',
  'Appliance',
  'StorageAccessory',
  'Electrical',
] as const;
export type ComponentCategory = (typeof COMPONENT_CATEGORIES)[number];

export const QUOTE_TYPES = ['Simple', 'Detailed'] as const;
export type QuoteType = (typeof QUOTE_TYPES)[number];

export const QUOTE_STATUSES = ['Draft', 'Sent', 'Accepted', 'Expired'] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const INVOICE_STATUSES = ['Draft', 'Sent', 'Outstanding', 'Paid', 'Overdue'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const BOOKING_STATUSES = ['Pending', 'Confirmed', 'Cancelled'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const SENDER_TYPES = ['Client', 'Staff'] as const;
export type SenderType = (typeof SENDER_TYPES)[number];

export const OWNER_TYPES = ['Client', 'Staff'] as const;
export type OwnerType = (typeof OWNER_TYPES)[number];

export const DOCUMENT_TYPES = ['Contract', 'Quote', 'Invoice', 'Plan', 'MoodBoard'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const SUBMISSION_STATUSES = ['New', 'Contacted', 'Converted', 'Archived'] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/* -------------------------------------------------------------------------- */
/* Tables                                                                     */
/* -------------------------------------------------------------------------- */

/** Every record carries a string PK. PrismaRepository is generic over this. */
export interface BaseRecord {
  id: string;
}

/** Schema 3.1 */
export interface StaffUser extends BaseRecord {
  name: string;
  email: string;
  /**
   * MOCK ONLY. This holds a PLAINTEXT password, not a hash, per the prototype
   * brief. The column keeps its documented name so the Postgres migration does
   * not need a rename, but the value must be replaced with a real bcrypt or
   * argon2 hash before this leaves the prototype. NOT PRODUCTION-SAFE.
   */
  password_hash: string;
  role: StaffRole;
  created_at: string;
  updated_at: string;
}

/** Schema 3.2 */
export interface Client extends BaseRecord {
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  status: ClientStatus;
  assigned_staff_id: string | null;
  joined_date: string;
  total_spent: number;
  notes: string | null;
  /** MOCK ONLY. Plaintext, exactly as StaffUser.password_hash above. */
  password_hash: string;
  created_at: string;
  updated_at: string;
}

/** Schema 3.3 */
export interface Project extends BaseRecord {
  client_id: string;
  name: string;
  type: ServiceType;
  status: ProjectStage;
  /** 0 to 100. Clamped on write by the projects service. */
  progress_pct: number;
  current_stage: string | null;
  assigned_designer_id: string | null;
  client_visible: boolean;
  created_at: string;
  updated_at: string;
}

/** Schema 3.4 — the Component Pricing Library. */
export interface ComponentItem extends BaseRecord {
  name: string;
  category: ComponentCategory;
  unit_price: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Schema 3.5 */
export interface Quote extends BaseRecord {
  client_id: string;
  service_id: ServiceType;
  type: QuoteType;
  design_fee: number;
  subtotal: number;
  vat_rate: number;
  total: number;
  status: QuoteStatus;
  invoice_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Schema 3.6.
 *
 * `unit_price` is a POINT-IN-TIME SNAPSHOT of ComponentItem.unit_price taken
 * when the line was created. Editing a component's price later must never
 * rewrite this value. That rule is enforced in quotes.service.ts and is the
 * single most important data-integrity rule in this schema
 * (Backend Schema section 6, and the "Critical rule" in CLAUDE.md).
 */
export interface QuoteLineItem extends BaseRecord {
  quote_id: string;
  component_id: string;
  /** Denormalised at creation so a renamed or deactivated component still reads correctly. */
  component_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

/** Schema 3.7 */
export interface Invoice extends BaseRecord {
  /** e.g. INV-2026-0041 */
  number: string;
  client_id: string;
  project_id: string | null;
  quote_id: string | null;
  amount: number;
  vat_rate: number;
  status: InvoiceStatus;
  due_date: string;
  /** Set ONLY by the Admin-only manual mark-paid action. No gateway writes here, ever. */
  paid_at: string | null;
  created_at: string;
}

/** Schema 3.8 */
export interface Booking extends BaseRecord {
  client_id: string;
  service_type: ServiceType;
  date_time: string;
  status: BookingStatus;
  linked_quote_id: string | null;
  created_at: string;
}

/** Schema 3.9 — one row per day of week, 0 = Sunday. */
export interface AvailabilitySetting extends BaseRecord {
  day_of_week: number;
  /** "HH:MM", 24-hour. */
  start_time: string;
  end_time: string;
  slot_duration_mins: number;
  is_closed: boolean;
}

/** Schema 3.10 */
export interface Conversation extends BaseRecord {
  client_id: string;
  /**
   * Not in the schema doc. Denormalised so the admin inbox can list threads
   * with a meaningful label without joining messages.
   */
  subject: string;
  created_at: string;
}

export interface MessageAttachment {
  name: string;
  size_bytes: number;
  /** Placeholder descriptor, not a real S3 key. No object storage this phase. */
  storage_url: string;
}

/** Schema 3.10 */
export interface Message extends BaseRecord {
  conversation_id: string;
  /** Polymorphic: a clients.id or a staff_users.id, disambiguated by sender_type. */
  sender_id: string;
  sender_type: SenderType;
  body: string;
  attachments: MessageAttachment[] | null;
  read_at: string | null;
  created_at: string;
}

/** Schema 3.11 — staff_id null means a shared/global template. */
export interface SavedReplyTemplate extends BaseRecord {
  staff_id: string | null;
  title: string;
  body: string;
}

/**
 * Schema 3.12.
 *
 * These toggles are stored and returned faithfully but NOTHING sends. Real
 * email and SMS delivery is permanently out of scope for this phase; nothing
 * in this codebase may call a mail or SMS provider.
 */
export interface NotificationPreference extends BaseRecord {
  owner_id: string;
  owner_type: OwnerType;
  email_enabled: boolean;
  sms_enabled: boolean;
  in_app_enabled: boolean;
}

/** Schema 3.13 */
export interface DocumentRecord extends BaseRecord {
  client_id: string;
  project_id: string | null;
  name: string;
  type: DocumentType;
  size_bytes: number;
  upload_date: string;
  client_visible: boolean;
  /** Placeholder descriptor, not an S3 key. Metadata-only uploads this phase. */
  storage_url: string;
}

/** Schema 3.14 */
export interface Testimonial extends BaseRecord {
  client_name: string;
  /** 1 to 5. */
  rating: number;
  review_text: string;
  project_id: string | null;
  is_published: boolean;
  created_at: string;
}

/** Schema 3.15 */
export interface PortfolioItem extends BaseRecord {
  project_id: string | null;
  title: string;
  category: ServiceType;
  location: string | null;
  year: number | null;
  duration_weeks: number | null;
  description: string | null;
  materials_used: string | null;
  /** Ordered. Index 0 is the cover image. */
  image_urls: string[];
  is_published: boolean;
}

/** Schema 3.16 */
export interface ContactSubmission extends BaseRecord {
  name: string;
  email: string;
  phone: string | null;
  service_interest: string | null;
  message: string;
  status: SubmissionStatus;
  created_at: string;
}

/** Schema 3.17 — a singleton row. */
export interface BusinessSettings extends BaseRecord {
  business_name: string;
  vat_rate: number;
  logo_url: string | null;
  brand_primary_color: string;
  email_from_address: string | null;
}

/**
 * Schema 3.18.
 *
 * `staff_id` is documented as not-null, but the design-approval loop means a
 * CLIENT can also cause an audited state change (Approve, Request Changes,
 * Accept quote). Rather than drop those from the audit trail — which would
 * leave gaps in exactly the flow the docs call the critical path — the column
 * holds either principal and `actor_type` disambiguates it. Flagged here as a
 * deliberate deviation from Backend Schema v2.0 section 3.18.
 */
export interface ActivityLog extends BaseRecord {
  staff_id: string;
  actor_type: OwnerType;
  actor_name: string;
  /** e.g. 'price_change', 'client_delete', 'invoice_mark_paid' */
  action: string;
  target_table: string;
  target_id: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

/* -------------------------------------------------------------------------- */
/* CMS                                                                        */
/* -------------------------------------------------------------------------- */

/** The collections a CmsEntry can belong to. Also the admin CMS menu order. */
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
 * One editable thing on the public site.
 *
 * `draft` is what the admin edits; `published` is what apps/web renders. They
 * diverge the moment someone saves, and converge again on publish — which is
 * the whole point, and how the admin knows to show an "unpublished changes"
 * badge. A null `published` means this entry has never been live, so the
 * public bundle leaves it out entirely rather than showing a half-written row.
 *
 * The shape of `draft` is not typed here because it differs per collection.
 * It is described by the field descriptors in modules/cms/schemas.ts, which
 * validate writes and are served to the admin to render its forms.
 */
export interface CmsEntry extends BaseRecord {
  collection: CmsCollection;
  slug: string;
  sort_order: number;
  draft: Record<string, unknown>;
  published: Record<string, unknown> | null;
  published_at: string | null;
  updated_at: string;
  updated_by: string | null;
}

/**
 * An image or file the CMS can point at.
 *
 * `storage_key` is an S3 object key and NEVER a URL — read URLs are signed at
 * request time by the storage service and are never stored or cached. `src`
 * is the escape hatch for the assets that shipped inside apps/web/public and
 * were never uploaded; exactly one of the two is set.
 */
export interface MediaAsset extends BaseRecord {
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
}
