/**
 * Local copies of the API's response shapes.
 *
 * Per the build brief there is NO shared package: apps/admin, apps/portal and
 * apps/api each keep their own types. These are hand-kept in sync with the JSON
 * apps/api actually returns (see apps/api/src/common/types/domain.ts) — field
 * names match exactly so the two cannot drift silently.
 *
 * This is the admin app's view: it consumes nearly the whole surface, so it
 * mirrors most of the domain. apps/portal keeps a narrower copy of its own.
 */

export type StaffRole = 'Admin' | 'Infra' | 'Editor' | 'Designer' | 'Installer';
export type PrincipalRole = StaffRole | 'Client';
export type ClientStatus = 'Active' | 'Inactive';
export type ServiceType = 'Kitchen' | 'Bedroom' | 'MediaWall' | 'Wardrobe';
/** A name from the Admin's ordered list (GET /projects/stages). */
export type ProjectStage = string;
export interface ProjectStageConfig {
  name: string;
  /** progress_pct a project takes on entering this stage. */
  progress: number;
  /** Where the client approves (next stage) or asks for changes (previous). */
  approval: boolean;
}
export type InvoiceStatus = 'Draft' | 'Sent' | 'Outstanding' | 'Paid' | 'Overdue';
export type BookingStatus = 'Pending' | 'Confirmed' | 'Cancelled';
export type DocumentType = 'Contract' | 'Invoice' | 'Plan' | 'MoodBoard' | 'Other';
export type SubmissionStatus = 'New' | 'Contacted' | 'Converted' | 'Archived';
export type SenderType = 'Client' | 'Staff';

export const SERVICE_TYPES: ServiceType[] = ['Kitchen', 'Bedroom', 'MediaWall', 'Wardrobe'];
export const STAFF_ROLES: StaffRole[] = ['Admin', 'Designer', 'Installer'];
export const DOCUMENT_TYPES: DocumentType[] = [
  'Contract',
  'Invoice',
  'Plan',
  'MoodBoard',
  'Other',
];
export const SUBMISSION_STATUSES: SubmissionStatus[] = [
  'New',
  'Contacted',
  'Converted',
  'Archived',
];

/** Human labels for enum values that are not display-ready. */
export const SERVICE_LABELS: Record<ServiceType, string> = {
  Kitchen: 'Kitchen',
  Bedroom: 'Bedroom',
  MediaWall: 'Media Wall',
  Wardrobe: 'Wardrobe',
};

export interface Principal {
  id: string;
  kind: 'Staff' | 'Client';
  role: PrincipalRole;
  name: string;
  email: string;
}

export interface LoginResponse {
  access_token: string;
  user: Principal;
  /** Present when "remember this device" was ticked. Persist it; send it with every sign-in. */
  deviceToken?: string;
  /** Present once, when an authenticator app has just been set up. */
  recoveryCodes?: string[];
}

export type TwoFactorMethod = 'email' | 'totp';

/** What password sign-in answers: a session, or the next step. */
export type LoginStart =
  | LoginResponse
  | { twoFactor: 'enrol'; challenge: string }
  | { twoFactor: 'email'; challenge: string; emailHint: string }
  | { twoFactor: 'totp'; challenge: string };

/** GET /auth/me: the principal plus how this person signs in. */
export interface Me extends Principal {
  twoFactorMethod: TwoFactorMethod | null;
  googleLinked: boolean;
  googleEmail: string | null;
}

export interface TrustedDevice {
  id: string;
  label: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string;
}

export interface CalendarStatus {
  configured: boolean;
  connected: boolean;
  email?: string;
  calendarId?: string;
  calendarName?: string;
  status?: 'connected' | 'needs_reconnect';
}

export interface CalendarChoice {
  id: string;
  name: string;
  primary: boolean;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  status: ClientStatus;
  assigned_staff_id: string | null;
  joined_date: string;
  /** Admin only: a Designer's copy of a client has no money in it. */
  total_spent?: number;
  /** In the client list only: projects in your scope not yet completed. */
  active_projects?: number;
  /** In the client list, Admin only: invoices still to be paid. */
  outstanding?: number;
  notes: string | null;
  /** A portal password is stored (an invitation was sent, or they set their own). */
  has_portal_access: boolean;
  /** Still the password that was emailed: they have neither changed it nor chosen to keep it. */
  password_is_default?: boolean;
  /** They have accepted the current portal terms. */
  terms_accepted?: boolean;
  terms_accepted_at?: string | null;
  created_at: string;
  updated_at: string;
}

/** A Designer's client edit or an Installer's stage move, waiting for an Admin. */
export interface ChangeRequest {
  id: string;
  kind: 'client_details' | 'project_stage';
  client_id: string;
  project_id: string | null;
  requested_by: string;
  requested_name: string;
  payload: Partial<Record<'phone' | 'address' | 'notes' | 'status', string>>;
  note: string | null;
  status: 'Pending' | 'Approved' | 'Declined';
  created_at: string;
}

export interface Project {
  id: string;
  /** PRJ-0012: shown with refNo(), searchable. */
  ref_no?: number;
  client_id: string;
  name: string;
  type: ServiceType;
  status: ProjectStage;
  progress_pct: number;
  current_stage: string | null;
  assigned_designer_id: string | null;
  assigned_installer_id: string | null;
  client_visible: boolean;
  /** Where the work happens; starts as the client's address. */
  site_address?: string | null;
  created_at: string;
  updated_at: string;
  /** On /projects responses; not on the rows inside a client's detail. */
  client_name?: string;
  assigned_designer_name?: string | null;
  assigned_installer_name?: string | null;
}

/** An installer's dates and pay on one project (calendar days as YYYY-MM-DD). Only the Admin and that installer ever receive it. */
export interface InstallerAssignment {
  start_date: string | null;
  end_date: string | null;
  /** Null until the Admin sends it; the installer sees nothing before. */
  sent_at: string | null;
  pay: number | null;
  pay_note: string | null;
  pay_status: 'pending' | 'approved' | 'declined';
  dates_status: 'pending' | 'approved';
  suggested_start: string | null;
  suggested_end: string | null;
  suggestion_comment: string | null;
  suggested_at: string | null;
}

/** A designer or installer on a project. `assignment` is an installer's, for the Admin and that installer only. */
export interface TeamMember {
  id: string;
  staff_id: string;
  name: string;
  role: 'Designer' | 'Installer';
  assignment?: InstallerAssignment;
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

export interface Invoice {
  id: string;
  number: string;
  client_id: string;
  project_id: string | null;
  amount: number;
  vat_rate: number;
  status: InvoiceStatus;
  due_date: string;
  paid_at: string | null;
  created_at: string;
  /** Rows inside a client's or project's detail have no items or names. */
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
  /** An Admin lets the client save or print it from the portal; false = view only. */
  client_can_download?: boolean;
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

export interface AvailabilitySetting {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_mins: number;
  is_closed: boolean;
}

/** A document by id; opened through GET /documents/:id/download. */
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
  /** Its Settings › Document categories label (older files: their type). */
  category: string;
  /** An Admin lets the client save it from the portal; false = they can only view it. */
  client_can_download: boolean;
  client_name: string;
  project_name: string | null;
  /** How it can be shown in the page, from the type checked at upload; null = download only. */
  preview: 'pdf' | 'image' | null;
}

/** GET /documents/:id/download: a five-minute link, fetched per click and never kept. */
export interface DocumentDownload {
  url: string;
  expires_in: number;
}

export interface Testimonial {
  id: string;
  client_name: string;
  rating: number;
  review_text: string;
  project_id: string | null;
  is_published: boolean;
  created_at: string;
}

export interface PortfolioItem {
  id: string;
  project_id: string | null;
  title: string;
  category: ServiceType;
  location: string | null;
  year: number | null;
  duration_weeks: number | null;
  description: string | null;
  materials_used: string | null;
  image_urls: string[];
  is_published: boolean;
}

export interface ContactSubmission {
  id: string;
  /** ENQ-0004: shown with refNo(), searchable. */
  ref_no?: number;
  name: string;
  email: string;
  phone: string | null;
  service_interest: string | null;
  message: string;
  status: SubmissionStatus;
  kind: 'contact' | 'quote' | 'booking';
  details: Record<string, string> | null;
  /** The tag in the inbox; null on rows from before it existed. */
  source: 'Contact' | 'Booking' | 'Quote' | null;
  created_at: string;
}

/** What an Admin emailed an enquirer from the inbox. */
export interface EnquiryMessage {
  id: string;
  enquiry_id: string;
  direction: 'out' | 'in';
  body: string;
  to_address: string;
  sent_by: string | null;
  sent_at: string;
}

export interface BusinessSettings {
  id: string;
  business_name: string;
  vat_rate: number;
  logo_url: string | null;
  brand_primary_color: string;
  email_from_address: string | null;
}

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  staff_id: string;
  actor_type: 'Staff' | 'Client';
  actor_name: string;
  action: string;
  target_table: string;
  target_id: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface NotificationPreference {
  id: string;
  owner_id: string;
  owner_type: 'Staff' | 'Client';
  email_enabled: boolean;
  sms_enabled: boolean;
  in_app_enabled: boolean;
}

/** GET /clients/:id/detail */
export interface ClientDetail {
  client: Client;
  assigned_staff: { id: string; name: string; role: StaffRole } | null;
  projects: Project[];
  invoices: Invoice[];
  /** Where a file is kept is the API's business; it is never sent. */
  documents: Array<Omit<DocumentRecord, 'client_name' | 'project_name'>>;
  activity: ActivityLog[];
  stats: {
    /** Admin only. */
    lifetime_value?: number;
    outstanding?: number;
    active_projects: number;
    total_projects: number;
  };
}

/** GET /projects/:id/detail */
export interface ProjectDetail {
  project: Project;
  client: { id: string; name: string; email: string } | null;
  /** This project's and this client's only; never where the file is stored. */
  documents: Array<Omit<DocumentRecord, 'client_name' | 'project_name'>>;
  invoices: Invoice[];
  activity: ActivityLog[];
  /** Empty for a client. */
  team: TeamMember[];
  timeline: Array<{
    stage: ProjectStage;
    position: number;
    reached: boolean;
    current: boolean;
  }>;
  awaiting_client_decision: boolean;
}

/** GET /dashboard/admin (Admin only) */
export interface AdminDashboard {
  appointments: {
    today: number;
    upcoming: number;
    next: { id: string; reference: string; name: string; service_label: string; starts_at: string } | null;
  };
  projects: DashboardProjects;
  enquiries: { total: number; new: number; since_yesterday: number };
  invoices: {
    outstanding_total: number;
    due_this_week_total: number;
    overdue_count: number;
    paid_total: number;
    paid_this_month: number;
  };
  clients: { total: number; active: number };
  /** Quotes sent and not yet answered. */
  quotes: { sent: number };
  appointments_chart: Array<{ month: string; label: string; value: number }>;
  revenue_chart: Array<{ month: string; label: string; value: number }>;
}

export interface DashboardProjects {
  /** The configured stages, in order. */
  stages: ProjectStage[];
  active: number;
  completed: number;
  awaiting_decision: number;
  by_stage: Record<ProjectStage, number>;
}

/** GET /dashboard/designer: only the projects they are on, and nothing financial. */
export interface DesignerDashboard {
  projects: DashboardProjects;
  tasks: Array<{
    id: string;
    name: string;
    type: ServiceType;
    client_name: string;
    status: ProjectStage;
    progress_pct: number;
    current_stage: string | null;
    roles: Array<'Designer' | 'Installer'>;
    updated_at: string;
  }>;
}

/** Staff chat (GET /team/*): a project's thread or a direct chat. Staff only. */
export interface TeamThreadSummary {
  id: string;
  kind: 'project' | 'direct';
  title: string;
  project_id: string | null;
  unread_count: number;
  last_message: { body: string; created_at: string; sender_id: string } | null;
  created_at: string;
}
export interface TeamMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_name: string;
  body: string;
  /** Names and sizes only; a file opens through a signed link. */
  attachments: Array<{ name: string; size_bytes: number; type: string }> | null;
  created_at: string;
}
export interface TeamPerson {
  id: string;
  name: string;
  role: string;
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
  /** The price each the client pays: cost + margin. */
  unit_price: number;
  /** Studio only: what the line costs, and the % added on top. Null on older quotes. */
  cost_price: number | null;
  margin_pct: number | null;
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
  /** For the letterhead sheet. */
  issuer: InvoiceIssuer;
  client_email: string | null;
  client_phone: string | null;
  job_address: string | null;
}
