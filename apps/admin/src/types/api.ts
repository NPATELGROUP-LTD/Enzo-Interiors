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

export type StaffRole = 'Admin' | 'Editor' | 'Designer' | 'Installer';
export type PrincipalRole = StaffRole | 'Client';
export type ClientStatus = 'Active' | 'Inactive';
export type ServiceType = 'Kitchen' | 'Bedroom' | 'MediaWall' | 'Wardrobe';
export type ProjectStage =
  | 'Consultation'
  | 'Design'
  | 'Approval'
  | 'Installation'
  | 'Completed';
export type ComponentCategory =
  | 'Worktop'
  | 'DoorFinish'
  | 'Lighting'
  | 'Appliance'
  | 'StorageAccessory'
  | 'Electrical';
export type QuoteType = 'Simple' | 'Detailed';
export type QuoteStatus = 'Draft' | 'Sent' | 'Accepted' | 'Expired';
export type InvoiceStatus = 'Draft' | 'Sent' | 'Outstanding' | 'Paid' | 'Overdue';
export type BookingStatus = 'Pending' | 'Confirmed' | 'Cancelled';
export type DocumentType = 'Contract' | 'Quote' | 'Invoice' | 'Plan' | 'MoodBoard';
export type SubmissionStatus = 'New' | 'Contacted' | 'Converted' | 'Archived';
export type SenderType = 'Client' | 'Staff';

export const SERVICE_TYPES: ServiceType[] = ['Kitchen', 'Bedroom', 'MediaWall', 'Wardrobe'];
export const PROJECT_STAGES: ProjectStage[] = [
  'Consultation',
  'Design',
  'Approval',
  'Installation',
  'Completed',
];
export const COMPONENT_CATEGORIES: ComponentCategory[] = [
  'Worktop',
  'DoorFinish',
  'Lighting',
  'Appliance',
  'StorageAccessory',
  'Electrical',
];
export const STAFF_ROLES: StaffRole[] = ['Admin', 'Designer', 'Installer'];
export const DOCUMENT_TYPES: DocumentType[] = [
  'Contract',
  'Quote',
  'Invoice',
  'Plan',
  'MoodBoard',
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

export const CATEGORY_LABELS: Record<ComponentCategory, string> = {
  Worktop: 'Worktop',
  DoorFinish: 'Door Finish',
  Lighting: 'Lighting',
  Appliance: 'Appliance',
  StorageAccessory: 'Storage Accessory',
  Electrical: 'Electrical',
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
  total_spent: number;
  notes: string | null;
  has_portal_access: boolean;
  created_at: string;
  updated_at: string;
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

export interface ComponentItem {
  id: string;
  name: string;
  category: ComponentCategory;
  unit_price: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface QuoteLineItem {
  id: string;
  quote_id: string;
  component_id: string;
  component_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface Quote {
  id: string;
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
  lines: QuoteLineItem[];
  client_name: string;
}

export interface Invoice {
  id: string;
  number: string;
  client_id: string;
  project_id: string | null;
  quote_id: string | null;
  amount: number;
  vat_rate: number;
  status: InvoiceStatus;
  due_date: string;
  paid_at: string | null;
  created_at: string;
  client_name: string;
  project_name: string | null;
  net_amount: number;
  vat_amount: number;
  is_overdue: boolean;
  days_overdue: number;
}

export interface Booking {
  id: string;
  client_id: string;
  service_type: ServiceType;
  date_time: string;
  status: BookingStatus;
  linked_quote_id: string | null;
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

export interface MessageAttachment {
  name: string;
  size_bytes: number;
  storage_url: string;
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

export interface SavedReply {
  id: string;
  staff_id: string | null;
  title: string;
  body: string;
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
  storage_url: string;
  client_name: string;
  project_name: string | null;
  download_url: string;
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
  name: string;
  email: string;
  phone: string | null;
  service_interest: string | null;
  message: string;
  status: SubmissionStatus;
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
  documents: DocumentRecord[];
  quotes: Quote[];
  bookings: Booking[];
  activity: ActivityLog[];
  stats: {
    lifetime_value: number;
    outstanding: number;
    active_projects: number;
    total_projects: number;
  };
}

/** GET /projects/:id/detail */
export interface ProjectDetail {
  project: Project;
  client: { id: string; name: string; email: string } | null;
  documents: DocumentRecord[];
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

/** GET /dashboard/admin */
export interface AdminDashboard {
  bookings: {
    today: number;
    upcoming: number;
    awaiting_confirmation: number;
    next: Booking | null;
  };
  projects: {
    active: number;
    completed: number;
    awaiting_decision: number;
    by_stage: Record<ProjectStage, number>;
  };
  enquiries: { total: number; new: number; since_yesterday: number };
  invoices: {
    outstanding_total: number;
    due_this_week_total: number;
    overdue_count: number;
    paid_total: number;
  };
  messages: { unread: number; conversations_needing_reply: number };
  clients: { total: number; active: number };
  quotes: { draft: number; sent: number; accepted_awaiting_invoice: number };
  bookings_chart: Array<{ month: string; label: string; value: number }>;
  revenue_chart: Array<{ month: string; label: string; value: number }>;
}
