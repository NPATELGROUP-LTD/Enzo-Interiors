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
 *     ("cli_sarah_jones") rather than random UUIDs so demo records can be
 *     read and cross-referenced by a human.
 *   - `decimal(n,2)` columns are `number`, always rounded to 2dp on write via
 *     common/util/money.ts. See that file for why this is tolerable here and
 *     why it is NOT how the Postgres schema should be defined.
 *   - `timestamptz` / `date` columns are ISO-8601 strings.
 *   - `jsonb` columns are their natural TS shape (arrays / objects).
 *   - `documents.storage_url` holds the private-bucket object KEY (the
 *     column name predates the bucket). Never serialised; see DocumentsService.
 *
 * These types are internal to apps/api. apps/admin and apps/portal each keep
 * their own local copies of the subset they consume; nothing is shared across
 * app boundaries by design.
 */

/* -------------------------------------------------------------------------- */
/* Enums                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Admin does everything. Editor writes website content (cannot publish) and
 * never reaches the CRM. Designer works the CRM projects assigned to them (as
 * designer or installer): moves their stages, and asks an Admin to change a
 * client's details. Installer sees the same projects but only asks an Admin to
 * move a stage. Neither reaches the CMS. Infra (shown as "Infra manager")
 * runs the platform: users, website status, alerts. It never reaches clients,
 * projects, invoices, documents, messages, enquiries or bookings, and is not an
 * Admin to AccessService, so no data scope opens to it.
 */
export const STAFF_ROLES = ['Admin', 'Infra', 'Editor', 'Designer', 'Installer'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/** Roles only an Infra manager may invite, change or remove (and whose two-step sign-in only they reset). */
export const PRIVILEGED_ROLES: readonly StaffRole[] = ['Admin', 'Infra'];

/** The roles the admin invites and assigns. */
export const ADMIN_ROLES = STAFF_ROLES;

export const CLIENT_STATUSES = ['Active', 'Inactive'] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const SERVICE_TYPES = ['Kitchen', 'Bedroom', 'MediaWall', 'Wardrobe'] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

/**
 * A project stage is a name from the Admin's ordered list (Settings › Project
 * stages; null = the default five, see modules/projects/stages.ts).
 */
export type ProjectStage = string;

export interface ProjectStageConfig {
  name: string;
  /** progress_pct a project takes on entering this stage unless one is given. */
  progress: number;
  /** The stage where the client approves or sends the design back (at most one). */
  approval: boolean;
}

export const INVOICE_STATUSES = ['Draft', 'Sent', 'Outstanding', 'Paid', 'Overdue'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const BOOKING_STATUSES = ['Pending', 'Confirmed', 'Cancelled'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const SENDER_TYPES = ['Client', 'Staff'] as const;
export type SenderType = (typeof SENDER_TYPES)[number];

export const OWNER_TYPES = ['Client', 'Staff'] as const;
export type OwnerType = (typeof OWNER_TYPES)[number];

/** Other: a file sent in a chat (a photo of the room, a sketch). */
export const DOCUMENT_TYPES = ['Contract', 'Invoice', 'Plan', 'MoodBoard', 'Other'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const SUBMISSION_STATUSES = ['New', 'Contacted', 'Converted', 'Archived'] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const ENQUIRY_KINDS = ['contact', 'quote', 'booking'] as const;
export type EnquiryKind = (typeof ENQUIRY_KINDS)[number];

export const SITE_STATUSES = ['live', 'coming_soon'] as const;
export type SiteStatus = (typeof SITE_STATUSES)[number];

/** Settings › Pages: the public pages that can be switched off. Home is always on. */
export const PAGE_KEYS = ['about', 'services', 'portfolio', 'booking', 'contact', 'privacy', 'terms', 'cookies'] as const;
export type PageKey = (typeof PAGE_KEYS)[number];

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
  /** bcrypt hash (AuthService). */
  password_hash: string;
  role: StaffRole;
  /** Bumped on password change/reset; JWTs carrying an older one are refused. */
  token_version: number;
  /** sha256 of the emailed reset token. The token itself is never stored. */
  reset_token_hash: string | null;
  reset_expires_at: string | null;
  created_at: string;
  updated_at: string;
  // Two-step sign-in and Google. Optional so a create may leave them out (the
  // columns are nullable/defaulted); a row read back always has them.
  /** "email" | "totp"; null until chosen at the first sign-in. */
  two_factor_method?: TwoFactorMethod | null;
  /** Sealed by core/crypto.ts. */
  totp_secret_enc?: string | null;
  totp_confirmed_at?: string | null;
  /** The last TOTP step accepted (replay protection). */
  totp_last_step?: number | null;
  /** sha256 hex of each unused recovery code. */
  recovery_hashes?: string[] | null;
  /** sha256 of the emailed sign-in code. */
  login_code_hash?: string | null;
  login_code_expires_at?: string | null;
  login_code_attempts?: number;
  /** Google's stable account id, once linked. Unique. */
  google_sub?: string | null;
  google_email?: string | null;
}

export type TwoFactorMethod = 'email' | 'totp';

/** A browser remembered for 30 days; only the token's sha256 is stored. */
export interface TrustedDevice extends BaseRecord {
  staff_user_id: string;
  token_hash: string;
  label: string | null;
  created_at: string;
  last_used_at: string;
  expires_at: string;
}

/** A Google Calendar bookings are copied into. v1: one row, id "studio". */
export interface CalendarConnection extends BaseRecord {
  /** Null = the studio calendar. */
  staff_user_id: string | null;
  google_email: string;
  calendar_id: string;
  calendar_name: string | null;
  /** Sealed by core/crypto.ts. */
  refresh_token_enc: string;
  status: 'connected' | 'needs_reconnect';
  connected_by: string | null;
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
  /** bcrypt hash; anything else never matches (auth.service verify()). */
  password_hash: string;
  created_at: string;
  updated_at: string;
  /** As StaffUser.token_version. Optional so a create may leave it out (defaulted column). */
  token_version?: number;
  /** True while the password is the one emailed at invite; cleared when they change or keep it. */
  password_is_default?: boolean;
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
  /**
   * Legacy single designer / installer: they mirror the team's first of each
   * (modules/projects/team.service.ts) and still grant access. The team is
   * `project_members`. Optional so a create may leave them out.
   */
  assigned_designer_id: string | null;
  assigned_installer_id?: string | null;
  client_visible: boolean;
  /** Where the work happens; null = the client's own address. */
  site_address?: string | null;
  created_at: string;
  updated_at: string;
}

export const TEAM_ROLES = ['Designer', 'Installer'] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

/** A designer or installer on a project. No money, no dates: safe to show any member. */
export interface ProjectMember extends BaseRecord {
  project_id: string;
  staff_id: string;
  role: TeamRole;
  added_by: string | null;
  created_at: string;
}

/**
 * An installer's dates and pay on one project, 1:1 with their member row. Only
 * the Admin and that installer ever see it. Dates are `YYYY-MM-DD`.
 */
export interface InstallerAssignment extends BaseRecord {
  member_id: string;
  start_date: string | null;
  end_date: string | null;
  sent_at: string | null;
  pay: number | null;
  pay_note: string | null;
  pay_status: 'pending' | 'approved' | 'declined';
  dates_status: 'pending' | 'approved';
  suggested_start: string | null;
  suggested_end: string | null;
  suggestion_comment: string | null;
  suggested_at: string | null;
  updated_at: string;
}

/** Schema 3.7 */
export interface Invoice extends BaseRecord {
  /** e.g. INV-2026-0041 */
  number: string;
  client_id: string;
  project_id: string | null;
  amount: number;
  vat_rate: number;
  status: InvoiceStatus;
  due_date: string;
  /** Set ONLY by the Admin-only manual mark-paid action. No gateway writes here, ever. */
  paid_at: string | null;
  created_at: string;
  /** Fixed £ off the lines' subtotal, before VAT. 0 = none. */
  discount: number;
  job_name: string | null;
  job_address: string | null;
  job_notes: string | null;
  /** Shown under the totals (deposit received, due on delivery...). Never summed into `amount`. */
  payment_schedule: PaymentScheduleRow[];
  /** An Admin lets the client save or print it from the portal; false = view only. */
  client_can_download?: boolean;
}

export interface PaymentScheduleRow {
  label: string;
  amount: number;
  /** YYYY-MM-DD, or null. */
  date: string | null;
}

/** A payment stage: the invoice is Paid only when every one has `paid_at`. `amount` is worked out, see invoices/stages.ts. */
export interface InvoiceStage extends BaseRecord {
  invoice_id: string;
  position: number;
  /** The trigger, e.g. "On start". */
  label: string;
  mode: 'percent' | 'fixed';
  /** Percent of the gross payable, or £, per `mode`. */
  value: number;
  amount: number;
  due_note: string | null;
  paid_at: string | null;
  /** The Admin who recorded the payment; staff only. */
  paid_by: string | null;
}

/** One line of an invoice. Net (ex-VAT) price; the invoice's amount is derived from its lines. */
export interface InvoiceItem extends BaseRecord {
  invoice_id: string;
  description: string;
  /** The heading the line sits under; consecutive lines with the same one are grouped. */
  section: string | null;
  /** The printed invoice's "Description" column. */
  detail: string | null;
  quantity: number;
  /** 0 = a quantity-only row (materials): printed with no price, adds nothing. */
  unit_price: number;
  position: number;
  created_at: string;
}

/** Schema 3.8 */
export interface Booking extends BaseRecord {
  client_id: string;
  service_type: ServiceType;
  date_time: string;
  status: BookingStatus;
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

/**
 * A document from the Documents module, by id. The name and size are a
 * snapshot for the chat bubble; opening it goes through GET
 * /documents/:id/download, which checks access again. No storage key here.
 */
export interface MessageAttachment {
  document_id: string;
  name: string;
  size_bytes: number;
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
  /** Per-type choices; null/missing = the defaults (modules/notifications/preferences.ts). */
  categories?: Partial<Record<'project' | 'invoice' | 'document' | 'message', Partial<Record<'in_app' | 'email' | 'push', boolean>>>> | null;
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
  /** Settings › Document categories label; null = `type`. */
  category?: string | null;
  /** An Admin lets the client save it from the portal; false = view only. */
  client_can_download?: boolean;
  /** Private-bucket object key, never a URL. Never leaves the API. */
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
  kind: EnquiryKind;
  /** The form's extra fields (tier, room, preferred date...). */
  details: Record<string, string> | null;
  /** The tag in the inbox; null on rows from before it existed (the kind says enough). */
  source: EnquirySource | null;
  created_at: string;
}

export const ENQUIRY_SOURCES = ['Contact', 'Booking', 'Quote'] as const;
export type EnquirySource = (typeof ENQUIRY_SOURCES)[number];

/** What an Admin sent an enquirer from the inbox. */
export interface EnquiryMessage extends BaseRecord {
  enquiry_id: string;
  direction: 'out' | 'in';
  body: string;
  to_address: string;
  sent_by: string | null;
  sent_at: string;
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
 * CLIENT can also cause an audited state change (Approve, Request Changes). Rather than drop those from the audit trail — which would
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
  /** Set while an editor's changes wait for an admin: who asked, when, their note. */
  review_by: string | null;
  review_at: string | null;
  review_note: string | null;
  review_feedback: string | null;
}

/**
 * An image or file the CMS can point at.
 *
 * `storage_key` is an object key in the PUBLIC bucket and never a URL; the
 * URL is built from S3_PUBLIC_BASE_URL when the row is served. `source` says
 * where the file came from: "upload", "site", or "unsplash"/"randomuser" for a
 * placeholder still to be replaced.
 */
export interface MediaAsset extends BaseRecord {
  storage_key: string;
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

/** General site settings. A single row, id "site". */
export interface SiteSettings extends BaseRecord {
  status: SiteStatus;
  /** Once set and passed, the site is live whatever `status` says. */
  launch_at: string | null;
  notification_emails: string[];
  /** Media ids. Null logo = the shipped one; null favicon = the site's /icon.png. */
  logo_light_id: string | null;
  logo_dark_id: string | null;
  favicon_id: string | null;
  /** Dark-mode favicon; null = favicon_id for both. */
  favicon_dark_id: string | null;
  /** Null until saved in Settings; the company record's hours until then. */
  opening_hours: OpeningHours | null;
  /** Saved page switches; keys left out take PAGE_DEFAULTS (site-settings/pages.ts). */
  pages: Partial<Record<PageKey, boolean>> | null;
  /** Settings › Project stages; null = DEFAULT_STAGES (projects/stages.ts). */
  project_stages: ProjectStageConfig[] | null;
  /** Settings › Document categories; null = the document types (modules/documents). */
  document_categories: string[] | null;
  /** Settings › Bank details, printed on invoices. Admin and authenticated invoice payloads only. */
  bank_details: BankDetails | null;
  updated_at: string;
  updated_by: string | null;
}

export interface BankDetails {
  account_name: string;
  bank_name: string;
  /** "12-34-56" */
  sort_code: string;
  /** 8 digits */
  account_number: string;
  reference_note: string | null;
}

/** Keyed by lower-case weekday name, "monday" … "sunday". */
export interface OpeningHours {
  /** "HH:MM" windows, in order. An empty list is a closed day. */
  weekly: Record<string, Array<{ open: string; close: string }>>;
  /** A note beside one day ("Late opening"). Days without one are left out. */
  notes: Record<string, string>;
  /** One note under the whole list. */
  note: string;
}

/* -------------------------------------------------------------------------- */
/* Consultation bookings                                                      */
/* -------------------------------------------------------------------------- */

/** The booking settings row. `config` is validated by BookingConfigDto. */
export interface BookingSettingsRow extends BaseRecord {
  config: Record<string, unknown>;
  updated_at: string;
  updated_by: string | null;
}

export const APPOINTMENT_STATUSES = ['Confirmed', 'Cancelled'] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export interface Appointment extends BaseRecord {
  reference: string;
  service: string;
  service_label: string;
  starts_at: string;
  ends_at: string;
  /** starts_at while the booking holds the slot; null once cancelled. Unique. */
  slot: string | null;
  status: AppointmentStatus;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  postcode: string | null;
  notes: string | null;
  details: Record<string, string> | null;
  source: 'website' | 'admin';
  created_by: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  /** The Google Calendar copy, once synced. Optional so a create may leave them out. */
  google_event_id?: string | null;
  calendar_connection_id?: string | null;
  /** The calendar that event is in; null reads as the connection's current one. */
  google_calendar_id?: string | null;
}

/** One line in a staff member's notification bell. */
export interface Notification extends BaseRecord {
  recipient_id: string;
  kind: 'booking' | 'review' | 'review_reply' | 'project' | 'message' | 'invoice' | 'document' | 'enquiry' | 'request';
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

/**
 * An Admin's request to remove another Admin, waiting for an Infra manager
 * (modules/auth/users). Its own table: change_requests.client_id is required.
 */
export interface StaffRemovalRequest extends BaseRecord {
  target_id: string;
  target_name: string;
  target_email: string;
  requested_by: string;
  requested_name: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Declined';
  decided_by: string | null;
  decided_name: string | null;
  decision_note: string | null;
  decided_at: string | null;
  created_at: string;
}

/** A Designer's client edit or an Installer's stage move, waiting for an Admin (modules/change-requests). */
export interface ChangeRequest extends BaseRecord {
  kind: 'client_details' | 'project_stage';
  client_id: string;
  project_id: string | null;
  requested_by: string;
  requested_name: string;
  /** client_details: { phone?, address?, notes? }; project_stage: { status }. */
  payload: Record<string, string>;
  note: string | null;
  status: 'Pending' | 'Approved' | 'Declined';
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
}

/** A browser's Web Push subscription. owner_type names the table owner_id is in. */
export interface PushSubscriptionRecord extends BaseRecord {
  owner_id: string;
  owner_type: 'staff' | 'client';
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
}

/* -------------------------------------------------------------------------- */
/* Newsletter                                                                 */
/* -------------------------------------------------------------------------- */

export type SubscriberStatus = 'pending' | 'confirmed' | 'unsubscribed';

export interface NewsletterSubscriber extends BaseRecord {
  email: string;
  status: SubscriberStatus;
  token: string;
  source: string | null;
  created_at: string;
  confirm_sent_at: string | null;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
}

export type CampaignStatus = 'draft' | 'sending' | 'sent';

export interface NewsletterCampaign extends BaseRecord {
  subject: string;
  html: string;
  status: CampaignStatus;
  recipients: number;
  sent_count: number;
  failed_count: number;
  cursor: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
}

export type AlertKind = 'urgent' | 'error' | 'security';
export type AlertSource = 'api' | 'web' | 'admin' | 'portal' | 'system';

/** Who the alert emails go to. A single row, id "alerts". */
export interface AlertSettings extends BaseRecord {
  recipients: string[];
  errors_on: boolean;
  digest_on: boolean;
  digest_day: string | null;
  updated_at: string;
  updated_by: string | null;
}

/** A kind of problem and how often it has happened (modules/alerts). Id = its fingerprint. */
export interface AlertEvent extends BaseRecord {
  kind: AlertKind;
  source: AlertSource;
  title: string;
  route: string | null;
  location: string | null;
  status: number | null;
  release: string | null;
  count: number;
  first_at: string;
  last_at: string;
}
