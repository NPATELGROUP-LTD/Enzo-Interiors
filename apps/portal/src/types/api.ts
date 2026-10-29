/**
 * Local copies of the API response shapes this app consumes.
 *
 * Per the build brief there is NO shared package: apps/portal, apps/admin and
 * apps/api each keep their own types. Field names match the JSON apps/api
 * actually returns (see apps/api/src/common/types/domain.ts) exactly.
 *
 * This is deliberately NARROWER than the admin app's copy. A client only ever
 * sees their own records, and several admin-only fields never reach this app at
 * all, so modelling them here would imply access the API does not grant.
 */

export type ServiceType = 'Kitchen' | 'Bedroom' | 'MediaWall' | 'Wardrobe';
/** A name from the studio's ordered list (GET /projects/stages). */
export type ProjectStage = string;
export interface ProjectStageConfig {
  name: string;
  progress: number;
  /** The stage where the client approves or asks for changes. */
  approval: boolean;
}
export type InvoiceStatus = 'Draft' | 'Sent' | 'Outstanding' | 'Paid' | 'Overdue';
export type BookingStatus = 'Pending' | 'Confirmed' | 'Cancelled';
export type DocumentType = 'Contract' | 'Invoice' | 'Plan' | 'MoodBoard' | 'Other';
export type SenderType = 'Client' | 'Staff';

export const DOCUMENT_TYPES: DocumentType[] = [
  'Contract',
  'Invoice',
  'Plan',
  'MoodBoard',
  'Other',
];

export const SERVICE_LABELS: Record<ServiceType, string> = {
  Kitchen: 'Kitchen',
  Bedroom: 'Bedroom',
  MediaWall: 'Media Wall',
  Wardrobe: 'Wardrobe',
};

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  Contract: 'Contract',
  Invoice: 'Invoice',
  Plan: 'Plan',
  MoodBoard: 'Mood board',
  Other: 'Other',
};

/** A document's category as shown: the studio's own label, or the stored type's. */
export const categoryLabel = (category: string): string => DOCUMENT_LABELS[category as DocumentType] ?? category;

/** Plain-English descriptions of the default stages; a stage the studio added has none. */
export const STAGE_DESCRIPTIONS: Partial<Record<ProjectStage, string>> = {
  Consultation: 'We visit, measure up and understand what you need.',
  Design: 'Your designer draws up the layout and prepares the 3D visuals.',
  Approval: 'Your turn — review and approve it, or ask for changes.',
  Installation: 'Our fitters build and install everything on site.',
  Completed: 'Handed over, snagged and signed off.',
};

export interface Principal {
  id: string;
  kind: 'Staff' | 'Client';
  role: string;
  name: string;
  email: string;
  /** Still on the password the studio emailed: they are asked once to change it or keep it. */
  passwordIsDefault?: boolean;
}

export interface LoginResponse {
  access_token: string;
  user: Principal;
}

export interface Project {
  id: string;
  client_id: string;
  name: string;
  type: ServiceType;
  status: ProjectStage;
  progress_pct: number;
  current_stage: string | null;
  assigned_designer_id: string | null;
  client_visible: boolean;
  created_at: string;
  updated_at: string;
  client_name: string;
  assigned_designer_name: string | null;
}

/** One line of an invoice: a net (ex-VAT) price. */
export interface InvoiceItem {
  id: string;
  description: string;
  /** The heading this line sits under; consecutive lines with the same one are grouped. */
  section: string | null;
  /** The printed invoice's "Description" column. */
  detail: string | null;
  quantity: number;
  /** Net. 0 = a quantity-only row (materials), printed without a price. */
  unit_price: number;
  position: number;
}

export interface InvoiceStage {
  id: string;
  position: number;
  /** The trigger: "On start", "On installation"... */
  label: string;
  mode: 'percent' | 'fixed';
  /** Percent of the total payable, or £, per `mode`. */
  value: number;
  /** Worked out by the API; the stages sum exactly to the invoice amount. */
  amount: number;
  due_note: string | null;
  paid_at: string | null;
  /** Staff only. */
  paid_by?: string | null;
}

/** Settings > Bank details; printed on invoices, never on the public site. */
export interface BankDetails {
  account_name: string;
  bank_name: string;
  sort_code: string;
  account_number: string;
  reference_note: string | null;
}

export interface PaymentScheduleRow {
  label: string;
  amount: number;
  /** YYYY-MM-DD */
  date: string | null;
}

/** The company block printed on an invoice (from the CMS company entry). */
export interface InvoiceIssuer {
  name: string;
  address: string[];
  phone: string;
  email: string;
}

/**
 * GET /invoices (and /invoices/:id): the client's own invoices, never Drafts.
 * `amount` is the gross payable; `net_amount` + `vat_amount` split it, and
 * `items` are the net lines (empty on an invoice raised before lines existed).
 * The rows inside a project's detail are the plain invoice rows, without
 * `items`, names or the overdue fields.
 */
export interface Invoice {
  id: string;
  number: string;
  /** An Admin allowed saving and printing it; otherwise the portal only shows it. */
  client_can_download?: boolean;
  client_id: string;
  project_id: string | null;
  amount: number;
  vat_rate: number;
  status: InvoiceStatus;
  due_date: string;
  paid_at: string | null;
  created_at: string;
  items?: InvoiceItem[];
  client_name: string;
  project_name: string | null;
  /** Lines added up, before the discount. */
  subtotal_amount: number;
  /** Fixed £ off the subtotal, before VAT. */
  discount: number;
  /** After the discount, before VAT. */
  net_amount: number;
  vat_amount: number;
  is_overdue: boolean;
  days_overdue: number;
  job_name: string | null;
  job_address: string | null;
  job_notes: string | null;
  payment_schedule: PaymentScheduleRow[];
  client_email: string | null;
  client_phone: string | null;
  issuer: InvoiceIssuer;
  /** Payment stages; empty or absent = paid in one go. Not on the rows inside a client's or project's detail. */
  stages?: InvoiceStage[];
  /** Money recorded as received, and what is still owed. */
  paid_amount?: number;
  balance_amount?: number;
  bank_details?: BankDetails | null;
}

export interface Booking {
  id: string;
  client_id: string;
  service_type: ServiceType;
  date_time: string;
  status: BookingStatus;
  created_at: string;
  client_name: string;
  client_email: string;
}

/** A shared document by id; opened through GET /documents/:id/download. */
export interface MessageAttachment {
  document_id: string;
  name: string;
  size_bytes: number;
}

/** GET /conversations/:id/documents: what may be attached in that thread. */
export interface AttachableDocument {
  id: string;
  name: string;
  type: DocumentType;
  size_bytes: number;
  upload_date: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_type: SenderType;
  body: string;
  attachments: MessageAttachment[] | null;
  read_at: string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  client_id: string;
  subject: string;
  created_at: string;
  client_name: string;
  last_message: Message | null;
  unread_count: number;
  message_count: number;
}

export interface DocumentRecord {
  id: string;
  client_id: string;
  project_id: string | null;
  name: string;
  type: DocumentType;
  size_bytes: number;
  upload_date: string;
  client_visible: boolean;
  client_name: string;
  project_name: string | null;
  /** Its Settings › Document categories label (older files: their type). */
  category: string;
  /** An Admin allowed saving it; otherwise the portal only lets the client view it. */
  client_can_download: boolean;
  /** Whether it can be shown in the page (View) as well as downloaded. */
  preview: 'pdf' | 'image' | null;
}

/** GET /documents/:id/download: a five-minute link, fetched per click and never kept. */
export interface DocumentDownload {
  url: string;
  expires_in: number;
}

export interface ActivityLog {
  id: string;
  actor_type: 'Staff' | 'Client';
  actor_name: string;
  action: string;
  target_table: string;
  target_id: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface BusinessSettings {
  id: string;
  business_name: string;
  vat_rate: number;
  logo_url: string | null;
  brand_primary_color: string;
  email_from_address: string | null;
}

export interface NotificationPreference {
  id: string;
  owner_id: string;
  owner_type: 'Staff' | 'Client';
  email_enabled: boolean;
  sms_enabled: boolean;
  in_app_enabled: boolean;
  /** What each kind of update may do, defaults filled in by the API. */
  categories: Record<NotifyCategory, Record<NotifyChannel, boolean>>;
}

export type NotifyCategory = 'project' | 'invoice' | 'document' | 'message';
export type NotifyChannel = 'in_app' | 'email' | 'push';

/** GET /projects/:id/detail */
export interface ProjectDetail {
  project: Project;
  client: { id: string; name: string; email: string } | null;
  /** Without client_name / project_name: the project and client are above. */
  documents: Array<Omit<DocumentRecord, 'client_name' | 'project_name'>>;
  invoices: Invoice[];
  activity: ActivityLog[];
  timeline: Array<{
    stage: ProjectStage;
    position: number;
    reached: boolean;
    current: boolean;
  }>;
  awaiting_client_decision: boolean;
}

/** GET /dashboard/portal */
export interface PortalDashboard {
  /** A website consultation booked with the client's email. */
  next_appointment: { id: string; service_label: string; starts_at: string } | null;
  documents_count: number;
  invoices: {
    paid_total: number;
    outstanding_total: number;
    next_due: Invoice | null;
  };
  projects: {
    total: number;
    active: number;
    awaiting_your_approval: Array<{ id: string; name: string; type: ServiceType }>;
  };
  timeline: Array<{
    id: string;
    name: string;
    type: ServiceType;
    status: ProjectStage;
    progress_pct: number;
    current_stage: string | null;
    updated_at: string;
  }>;
}
/** A hand-written quote for a project (migration 31). Money on the lines is before VAT. */
export type QuoteStatus = 'Draft' | 'Sent' | 'Accepted' | 'Declined';

export interface QuoteItem {
  id: string;
  quote_id: string;
  description: string;
  section: string | null;
  detail: string | null;
  quantity: number;
  unit_price: number;
  position: number;
}

export interface Quote {
  id: string;
  number: string;
  client_id: string;
  project_id: string;
  client_name: string;
  project_name: string | null;
  title: string | null;
  status: QuoteStatus;
  /** The gross payable. */
  amount: number;
  vat_rate: number;
  discount: number;
  subtotal_amount: number;
  net_amount: number;
  vat_amount: number;
  valid_until: string | null;
  expired: boolean;
  notes: string | null;
  sent_at: string | null;
  responded_at: string | null;
  response_comment: string | null;
  invoice_id: string | null;
  created_at: string;
  items: QuoteItem[];
}
