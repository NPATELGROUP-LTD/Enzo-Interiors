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
export type ProjectStage =
  | 'Consultation'
  | 'Design'
  | 'Approval'
  | 'Installation'
  | 'Completed';
export type InvoiceStatus = 'Draft' | 'Sent' | 'Outstanding' | 'Paid' | 'Overdue';
export type BookingStatus = 'Pending' | 'Confirmed' | 'Cancelled';
export type DocumentType = 'Contract' | 'Invoice' | 'Plan' | 'MoodBoard';
export type SenderType = 'Client' | 'Staff';

export const PROJECT_STAGES: ProjectStage[] = [
  'Consultation',
  'Design',
  'Approval',
  'Installation',
  'Completed',
];

export const DOCUMENT_TYPES: DocumentType[] = [
  'Contract',
  'Invoice',
  'Plan',
  'MoodBoard',
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
};

/** Plain-English descriptions of each stage, for the client-facing timeline. */
export const STAGE_DESCRIPTIONS: Record<ProjectStage, string> = {
  Consultation: 'We visit, measure up and understand what you need.',
  Design: 'Your designer draws up the layout and prepares the 3D visuals.',
  Approval: 'Your turn — review the design and approve it or ask for changes.',
  Installation: 'Our fitters build and install everything on site.',
  Completed: 'Handed over, snagged and signed off.',
};

export interface Principal {
  id: string;
  kind: 'Staff' | 'Client';
  role: string;
  name: string;
  email: string;
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
  created_at: string;
  client_name: string;
  client_email: string;
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

/** GET /dashboard/portal */
export interface PortalDashboard {
  next_appointment: Booking | null;
  unread_messages: number;
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
