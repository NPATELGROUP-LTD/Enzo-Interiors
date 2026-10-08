/**
 * Enzo Interiors — prototype seed.
 *
 * Rewrites every table in PostgreSQL from scratch, so the environment can be
 * reset to a known-good state at any time:
 *
 *     npm run seed
 *
 * Design notes:
 *
 * - Ids are readable and stable ("cli_sarah_jones", not a UUID) so the JSON
 *   files can be cross-referenced by eye and so re-seeding does not churn the
 *   diff. Real records created through the API get generated ids instead.
 *
 * - Historical dates (joined_date, created_at) are fixed absolute dates in the
 *   July–September 2026 window the brief asks for. Forward-looking dates
 *   (bookings, invoice due dates) are computed relative to the real current
 *   date, so a reviewer running this months from now still sees upcoming
 *   appointments and a live-looking pipeline rather than an all-past dataset.
 *
 * - Passwords are written as bcrypt hashes. The readable values in this file
 *   are the demo credentials printed at the end of a run; they are hashed on
 *   the way into the database, never stored as typed.
 */

import { hashPassword } from '../src/modules/auth/auth.service';
import { DatabaseService } from '../src/data/database.service';
import { PrismaService } from '../src/data/prisma.service';
import { sum } from '../src/common/util/money';
import {
  ActivityLog,
  AvailabilitySetting,
  Booking,
  BusinessSettings,
  Client,
  ContactSubmission,
  Conversation,
  DocumentRecord,
  Invoice,
  Message,
  NotificationPreference,
  PortfolioItem,
  Project,
  SavedReplyTemplate,
  StaffUser,
  Testimonial,
} from '../src/common/types/domain';

/* -------------------------------------------------------------------------- */
/* Date helpers                                                               */
/* -------------------------------------------------------------------------- */

const NOW = new Date();

/** An absolute historical timestamp, e.g. at('2026-07-14', '09:30'). */
function at(date: string, time = '09:00'): string {
  return new Date(`${date}T${time}:00.000Z`).toISOString();
}

/** ISO timestamp `days` from now (negative for the past), at the given time. */
function fromNow(days: number, time = '09:00'): string {
  const target = new Date(NOW);
  target.setDate(target.getDate() + days);
  const [hours = '9', minutes = '0'] = time.split(':');
  target.setHours(Number(hours), Number(minutes), 0, 0);
  return target.toISOString();
}

/** Date-only (YYYY-MM-DD) `days` from now. */
function dateFromNow(days: number): string {
  return fromNow(days).slice(0, 10);
}

const VAT = 20;

/* -------------------------------------------------------------------------- */
/* staff_users                                                                */
/* -------------------------------------------------------------------------- */

// The fixtures only spell out what differs per row; these columns never do.
const staffDefaults = { token_version: 0, reset_token_hash: null, reset_expires_at: null };

const staffUsers: StaffUser[] = ([
  {
    id: 'stf_admin',
    name: 'Oyz Khan',
    email: 'admin@enzointeriors.co.uk',
    password_hash: 'admin123',
    role: 'Admin',
    created_at: at('2026-01-12'),
    updated_at: at('2026-01-12'),
  },
  {
    id: 'stf_designer',
    name: 'Priya Raman',
    email: 'designer@enzointeriors.co.uk',
    password_hash: 'designer123',
    role: 'Designer',
    created_at: at('2026-02-03'),
    updated_at: at('2026-02-03'),
  },
  {
    id: 'stf_installer',
    name: 'Marcus Bell',
    email: 'installer@enzointeriors.co.uk',
    password_hash: 'installer123',
    role: 'Installer',
    created_at: at('2026-02-17'),
    updated_at: at('2026-02-17'),
  },
  {
    id: 'stf_designer_hannah',
    name: 'Hannah Whitfield',
    email: 'hannah@enzointeriors.co.uk',
    password_hash: 'designer123',
    role: 'Designer',
    created_at: at('2026-04-06'),
    updated_at: at('2026-04-06'),
  },
] as Array<Omit<StaffUser, keyof typeof staffDefaults>>).map((row) => ({ ...staffDefaults, ...row }));

/* -------------------------------------------------------------------------- */
/* clients                                                                    */
/* -------------------------------------------------------------------------- */

const clients: Client[] = [
  {
    id: 'cli_sarah_jones',
    name: 'Sarah Jones',
    email: 'sarah.jones@example.com',
    phone: '07700 900318',
    address: '42 Elms Road, Stoneygate, Leicester, LE2 3JD',
    status: 'Active',
    assigned_staff_id: 'stf_designer',
    joined_date: '2026-05-18',
    total_spent: 0, // recomputed from paid invoices at the end of this file
    notes: 'Prefers a matt painted finish. Kitchen island is the priority; wardrobe is phase two.',
    password_hash: 'client123',
    created_at: at('2026-05-18'),
    updated_at: at('2026-08-11'),
  },
  {
    id: 'cli_david_okafor',
    name: 'David Okafor',
    email: 'david.okafor@example.com',
    phone: '07700 900742',
    address: '11 Brambling Way, Oadby, Leicester, LE2 5TR',
    status: 'Active',
    assigned_staff_id: 'stf_designer',
    joined_date: '2026-06-02',
    total_spent: 0,
    notes: 'Media wall must accommodate a 77" OLED and hide the existing gas fire flue.',
    password_hash: 'client123',
    created_at: at('2026-06-02'),
    updated_at: at('2026-08-19'),
  },
  {
    id: 'cli_amelia_hart',
    name: 'Amelia Hart',
    email: 'amelia.hart@example.com',
    phone: '07700 900155',
    address: '8 Kirkdale Road, Wigston, Leicester, LE18 2EJ',
    status: 'Active',
    assigned_staff_id: 'stf_designer_hannah',
    joined_date: '2026-04-21',
    total_spent: 0,
    notes: 'Completed June install. Very happy — agreed to a testimonial and portfolio photography.',
    password_hash: 'client123',
    created_at: at('2026-04-21'),
    updated_at: at('2026-07-30'),
  },
  {
    id: 'cli_raj_patel',
    name: 'Raj Patel',
    email: 'raj.patel@example.com',
    phone: '07700 900623',
    address: '96 Sibson Road, Birstall, Leicester, LE4 4NH',
    status: 'Active',
    assigned_staff_id: 'stf_designer_hannah',
    joined_date: '2026-06-14',
    total_spent: 0,
    notes: 'Wardrobe install underway. Kitchen enquiry opened separately in August.',
    password_hash: 'client123',
    created_at: at('2026-06-14'),
    updated_at: at('2026-08-22'),
  },
  {
    id: 'cli_eleanor_shaw',
    name: 'Eleanor Shaw',
    email: 'eleanor.shaw@example.com',
    phone: '07700 900281',
    address: '3 Coventry Road, Market Harborough, LE16 9BX',
    status: 'Active',
    assigned_staff_id: 'stf_admin',
    joined_date: '2026-07-09',
    total_spent: 0,
    notes: 'Listed building — bedroom joinery must be freestanding, nothing fixed to the walls.',
    password_hash: 'client123',
    created_at: at('2026-07-09'),
    updated_at: at('2026-08-25'),
  },
  {
    id: 'cli_tom_bradley',
    name: 'Tom Bradley',
    email: 'tom.bradley@example.com',
    phone: '07700 900904',
    address: '27 Melton Road, Syston, Leicester, LE7 2BQ',
    status: 'Inactive',
    assigned_staff_id: 'stf_designer',
    joined_date: '2026-03-11',
    total_spent: 0,
    notes: 'Media wall completed March. Final invoice still outstanding — chase before quoting again.',
    password_hash: 'client123',
    created_at: at('2026-03-11'),
    updated_at: at('2026-07-02'),
  },
  {
    id: 'cli_grace_mensah',
    name: 'Grace Mensah',
    email: 'grace.mensah@example.com',
    phone: '07700 900537',
    address: '54 Forest Road, Loughborough, LE11 3NW',
    status: 'Inactive',
    assigned_staff_id: 'stf_admin',
    joined_date: '2026-07-27',
    total_spent: 0,
    notes: 'Went quiet after the design presentation. Worth one follow-up call in September.',
    password_hash: 'client123',
    created_at: at('2026-07-27'),
    updated_at: at('2026-08-14'),
  },
];

/* -------------------------------------------------------------------------- */
/* projects — every stage and every service type represented                   */
/* -------------------------------------------------------------------------- */

const projects: Project[] = [
  {
    id: 'prj_jones_kitchen',
    client_id: 'cli_sarah_jones',
    name: 'Stoneygate Kitchen Renovation',
    type: 'Kitchen',
    status: 'Installation',
    progress_pct: 78,
    current_stage: 'Carcasses fitted, worktop template booked',
    assigned_designer_id: 'stf_designer',
    client_visible: true,
    created_at: at('2026-05-20'),
    updated_at: fromNow(-3, '14:20'),
  },
  {
    id: 'prj_jones_wardrobe',
    client_id: 'cli_sarah_jones',
    name: 'Stoneygate Master Wardrobe',
    type: 'Wardrobe',
    status: 'Design',
    progress_pct: 35,
    current_stage: 'First-pass elevations with the client',
    assigned_designer_id: 'stf_designer',
    client_visible: true,
    created_at: at('2026-07-15'),
    updated_at: fromNow(-6, '11:05'),
  },
  {
    id: 'prj_okafor_mediawall',
    client_id: 'cli_david_okafor',
    name: 'Oadby Media Wall',
    type: 'MediaWall',
    status: 'Approval',
    progress_pct: 55,
    current_stage: 'Awaiting client sign-off on the 3D render',
    assigned_designer_id: 'stf_designer',
    client_visible: true,
    created_at: at('2026-06-05'),
    updated_at: fromNow(-2, '16:40'),
  },
  {
    id: 'prj_okafor_bedroom',
    client_id: 'cli_david_okafor',
    name: 'Oadby Guest Bedroom',
    type: 'Bedroom',
    status: 'Consultation',
    progress_pct: 10,
    current_stage: 'Initial survey booked',
    assigned_designer_id: null,
    client_visible: true,
    created_at: at('2026-08-19'),
    updated_at: at('2026-08-19'),
  },
  {
    id: 'prj_hart_kitchen',
    client_id: 'cli_amelia_hart',
    name: 'Wigston Shaker Kitchen',
    type: 'Kitchen',
    status: 'Completed',
    progress_pct: 100,
    current_stage: 'Handover complete, snagging signed off',
    assigned_designer_id: 'stf_designer_hannah',
    client_visible: true,
    created_at: at('2026-04-24'),
    updated_at: at('2026-07-28'),
  },
  {
    id: 'prj_patel_wardrobe',
    client_id: 'cli_raj_patel',
    name: 'Birstall Walk-In Wardrobe',
    type: 'Wardrobe',
    status: 'Installation',
    progress_pct: 82,
    current_stage: 'Internals fitted, mirrored doors due Thursday',
    assigned_designer_id: 'stf_designer_hannah',
    client_visible: true,
    created_at: at('2026-06-18'),
    updated_at: fromNow(-1, '09:15'),
  },
  {
    id: 'prj_patel_kitchen',
    client_id: 'cli_raj_patel',
    name: 'Birstall Kitchen Extension',
    type: 'Kitchen',
    status: 'Consultation',
    progress_pct: 5,
    current_stage: 'Awaiting builder’s floor plan',
    assigned_designer_id: null,
    // Not yet shared with the client — exercises the "send to client" toggle
    // and proves the portal genuinely hides it.
    client_visible: false,
    created_at: at('2026-08-22'),
    updated_at: at('2026-08-22'),
  },
  {
    id: 'prj_shaw_bedroom',
    client_id: 'cli_eleanor_shaw',
    name: 'Market Harborough Bedroom Suite',
    type: 'Bedroom',
    status: 'Design',
    progress_pct: 40,
    current_stage: 'Freestanding layout options in progress',
    assigned_designer_id: 'stf_designer_hannah',
    client_visible: true,
    created_at: at('2026-07-12'),
    updated_at: fromNow(-4, '13:00'),
  },
  {
    id: 'prj_bradley_mediawall',
    client_id: 'cli_tom_bradley',
    name: 'Syston Media Wall',
    type: 'MediaWall',
    status: 'Completed',
    progress_pct: 100,
    current_stage: 'Installed and handed over',
    assigned_designer_id: 'stf_designer',
    client_visible: true,
    created_at: at('2026-03-14'),
    updated_at: at('2026-06-26'),
  },
  {
    id: 'prj_mensah_kitchen',
    client_id: 'cli_grace_mensah',
    name: 'Loughborough Kitchen Refit',
    type: 'Kitchen',
    status: 'Approval',
    progress_pct: 60,
    current_stage: 'Design presented, awaiting a decision',
    assigned_designer_id: 'stf_admin',
    client_visible: true,
    created_at: at('2026-07-30'),
    updated_at: at('2026-08-14'),
  },
];

/* -------------------------------------------------------------------------- */
/* invoices — linked to projects, mixed statuses                           */
/* -------------------------------------------------------------------------- */

/** The printed-invoice fields (migration 12) are left blank on the demo invoices. */
type SeedInvoice = Omit<Invoice, 'discount' | 'job_name' | 'job_address' | 'job_notes' | 'payment_schedule'>;
const BLANK_LAYOUT = { discount: 0, job_name: null, job_address: null, job_notes: null, payment_schedule: [] };

const invoices: SeedInvoice[] = [
  {
    id: 'inv_jones_kitchen',
    number: 'INV-2026-0001',
    client_id: 'cli_sarah_jones',
    project_id: 'prj_jones_kitchen',
    amount: 13831.2,
    vat_rate: VAT,
    status: 'Paid',
    due_date: '2026-06-21',
    paid_at: at('2026-06-18', '15:42'),
    created_at: at('2026-05-24'),
  },
  {
    id: 'inv_hart_kitchen',
    number: 'INV-2026-0002',
    client_id: 'cli_amelia_hart',
    project_id: 'prj_hart_kitchen',
    amount: 13527.6,
    vat_rate: VAT,
    status: 'Paid',
    due_date: '2026-05-28',
    paid_at: at('2026-05-27', '10:08'),
    created_at: at('2026-04-28'),
  },
  {
    id: 'inv_okafor_mediawall',
    number: 'INV-2026-0003',
    client_id: 'cli_david_okafor',
    project_id: 'prj_okafor_mediawall',
    amount: 3944.4,
    vat_rate: VAT,
    status: 'Outstanding',
    due_date: dateFromNow(9),
    paid_at: null,
    created_at: at('2026-06-10'),
  },
  {
    id: 'inv_patel_wardrobe',
    number: 'INV-2026-0004',
    client_id: 'cli_raj_patel',
    project_id: 'prj_patel_wardrobe',
    amount: 4512,
    vat_rate: VAT,
    status: 'Sent',
    due_date: dateFromNow(18),
    paid_at: null,
    created_at: at('2026-06-22'),
  },
  {
    id: 'inv_bradley_mediawall',
    number: 'INV-2026-0005',
    client_id: 'cli_tom_bradley',
    project_id: 'prj_bradley_mediawall',
    amount: 6480,
    vat_rate: VAT,
    status: 'Overdue',
    due_date: '2026-07-14',
    paid_at: null,
    created_at: at('2026-06-26'),
  },
  {
    id: 'inv_shaw_bedroom',
    number: 'INV-2026-0006',
    client_id: 'cli_eleanor_shaw',
    project_id: 'prj_shaw_bedroom',
    amount: 1440,
    vat_rate: VAT,
    status: 'Draft',
    due_date: dateFromNow(30),
    paid_at: null,
    created_at: fromNow(-5),
  },
  {
    id: 'inv_mensah_deposit',
    number: 'INV-2026-0007',
    client_id: 'cli_grace_mensah',
    project_id: 'prj_mensah_kitchen',
    amount: 960,
    vat_rate: VAT,
    status: 'Outstanding',
    due_date: dateFromNow(4),
    paid_at: null,
    created_at: at('2026-08-06'),
  },
];

/* -------------------------------------------------------------------------- */
/* bookings — spread across the next 30 days                                    */
/* -------------------------------------------------------------------------- */

/**
 * Historical bookings.
 *
 * The brief only asks for bookings across the next 30 days, but the admin
 * dashboard charts consultations per month over the trailing year — with
 * forward-only data that chart is a single bar, which makes it useless for
 * reviewing the screen. These back-fill a believable run of past appointments
 * for a business trading since the spring.
 */
const pastBookings: Booking[] = [
  { id: 'bkg_hist_01', client_id: 'cli_tom_bradley', service_type: 'MediaWall', date_time: at('2026-03-16', '10:00'), status: 'Confirmed', created_at: at('2026-03-12') },
  { id: 'bkg_hist_02', client_id: 'cli_amelia_hart', service_type: 'Kitchen', date_time: at('2026-04-23', '14:00'), status: 'Confirmed', created_at: at('2026-04-18') },
  { id: 'bkg_hist_03', client_id: 'cli_amelia_hart', service_type: 'Kitchen', date_time: at('2026-04-30', '09:30'), status: 'Confirmed', created_at: at('2026-04-25') },
  { id: 'bkg_hist_04', client_id: 'cli_sarah_jones', service_type: 'Kitchen', date_time: at('2026-05-19', '11:00'), status: 'Confirmed', created_at: at('2026-05-14') },
  { id: 'bkg_hist_05', client_id: 'cli_sarah_jones', service_type: 'Kitchen', date_time: at('2026-05-28', '15:30'), status: 'Confirmed', created_at: at('2026-05-22') },
  { id: 'bkg_hist_06', client_id: 'cli_amelia_hart', service_type: 'Kitchen', date_time: at('2026-05-11', '10:30'), status: 'Confirmed', created_at: at('2026-05-06') },
  { id: 'bkg_hist_07', client_id: 'cli_david_okafor', service_type: 'MediaWall', date_time: at('2026-06-04', '13:00'), status: 'Confirmed', created_at: at('2026-06-01') },
  { id: 'bkg_hist_08', client_id: 'cli_david_okafor', service_type: 'MediaWall', date_time: at('2026-06-15', '09:00'), status: 'Confirmed', created_at: at('2026-06-09') },
  { id: 'bkg_hist_09', client_id: 'cli_raj_patel', service_type: 'Wardrobe', date_time: at('2026-06-17', '16:00'), status: 'Confirmed', created_at: at('2026-06-12') },
  { id: 'bkg_hist_10', client_id: 'cli_raj_patel', service_type: 'Wardrobe', date_time: at('2026-06-29', '11:30'), status: 'Confirmed', created_at: at('2026-06-24') },
  { id: 'bkg_hist_11', client_id: 'cli_eleanor_shaw', service_type: 'Bedroom', date_time: at('2026-07-10', '10:00'), status: 'Confirmed', created_at: at('2026-07-08') },
  { id: 'bkg_hist_12', client_id: 'cli_eleanor_shaw', service_type: 'Bedroom', date_time: at('2026-07-21', '14:30'), status: 'Confirmed', created_at: at('2026-07-16') },
  { id: 'bkg_hist_13', client_id: 'cli_sarah_jones', service_type: 'Wardrobe', date_time: at('2026-07-17', '09:30'), status: 'Confirmed', created_at: at('2026-07-15') },
  { id: 'bkg_hist_14', client_id: 'cli_grace_mensah', service_type: 'Kitchen', date_time: at('2026-07-31', '15:00'), status: 'Confirmed', created_at: at('2026-07-28') },
  { id: 'bkg_hist_15', client_id: 'cli_grace_mensah', service_type: 'Kitchen', date_time: at('2026-08-12', '11:00'), status: 'Confirmed', created_at: at('2026-08-06') },
  { id: 'bkg_hist_16', client_id: 'cli_raj_patel', service_type: 'Kitchen', date_time: at('2026-08-20', '13:30'), status: 'Confirmed', created_at: at('2026-08-18') },
  { id: 'bkg_hist_17', client_id: 'cli_sarah_jones', service_type: 'Kitchen', date_time: at('2026-08-05', '09:00'), status: 'Confirmed', created_at: at('2026-08-01') },
];

const bookings: Booking[] = [
  ...pastBookings,
  { id: 'bkg_okafor_survey', client_id: 'cli_david_okafor', service_type: 'Bedroom', date_time: fromNow(2, '10:00'), status: 'Confirmed', created_at: at('2026-08-19') },
  { id: 'bkg_jones_template', client_id: 'cli_sarah_jones', service_type: 'Kitchen', date_time: fromNow(3, '09:30'), status: 'Confirmed', created_at: at('2026-08-12') },
  { id: 'bkg_patel_kitchen', client_id: 'cli_raj_patel', service_type: 'Kitchen', date_time: fromNow(6, '14:00'), status: 'Pending', created_at: at('2026-08-23') },
  { id: 'bkg_shaw_design', client_id: 'cli_eleanor_shaw', service_type: 'Bedroom', date_time: fromNow(9, '11:00'), status: 'Confirmed', created_at: at('2026-08-25') },
  { id: 'bkg_jones_wardrobe', client_id: 'cli_sarah_jones', service_type: 'Wardrobe', date_time: fromNow(14, '15:30'), status: 'Pending', created_at: fromNow(-4) },
  { id: 'bkg_mensah_followup', client_id: 'cli_grace_mensah', service_type: 'Kitchen', date_time: fromNow(21, '13:00'), status: 'Pending', created_at: fromNow(-2) },
  { id: 'bkg_patel_snagging', client_id: 'cli_raj_patel', service_type: 'Wardrobe', date_time: fromNow(27, '10:30'), status: 'Confirmed', created_at: fromNow(-1) },
  { id: 'bkg_bradley_cancelled', client_id: 'cli_tom_bradley', service_type: 'MediaWall', date_time: fromNow(11, '16:00'), status: 'Cancelled', created_at: at('2026-08-04') },
];

/* -------------------------------------------------------------------------- */
/* availability_settings — 0 = Sunday                                          */
/* -------------------------------------------------------------------------- */

const availabilitySettings: AvailabilitySetting[] = [
  { id: 'avl_0', day_of_week: 0, start_time: '00:00', end_time: '00:00', slot_duration_mins: 60, is_closed: true },
  { id: 'avl_1', day_of_week: 1, start_time: '09:00', end_time: '17:30', slot_duration_mins: 60, is_closed: false },
  { id: 'avl_2', day_of_week: 2, start_time: '09:00', end_time: '17:30', slot_duration_mins: 60, is_closed: false },
  { id: 'avl_3', day_of_week: 3, start_time: '09:00', end_time: '17:30', slot_duration_mins: 60, is_closed: false },
  { id: 'avl_4', day_of_week: 4, start_time: '09:00', end_time: '19:00', slot_duration_mins: 60, is_closed: false },
  { id: 'avl_5', day_of_week: 5, start_time: '09:00', end_time: '17:00', slot_duration_mins: 60, is_closed: false },
  { id: 'avl_6', day_of_week: 6, start_time: '10:00', end_time: '14:00', slot_duration_mins: 30, is_closed: false },
];

/* -------------------------------------------------------------------------- */
/* conversations + messages                                                   */
/* -------------------------------------------------------------------------- */

const conversations: Conversation[] = [
  { id: 'cnv_jones', client_id: 'cli_sarah_jones', subject: 'Stoneygate Kitchen — install week', created_at: at('2026-07-30') },
  { id: 'cnv_okafor', client_id: 'cli_david_okafor', subject: 'Media wall render feedback', created_at: at('2026-08-03') },
  { id: 'cnv_patel', client_id: 'cli_raj_patel', subject: 'Wardrobe internals + door delivery', created_at: at('2026-08-07') },
  { id: 'cnv_shaw', client_id: 'cli_eleanor_shaw', subject: 'Freestanding options for a listed building', created_at: at('2026-08-15') },
  { id: 'cnv_mensah', client_id: 'cli_grace_mensah', subject: 'Following up on your kitchen design', created_at: at('2026-08-10') },
];

interface MessageSpec {
  conversation_id: string;
  client_id: string;
  staff_id: string;
  /** [senderType, body, daysAgo, attachments?] */
  entries: Array<{
    from: 'Client' | 'Staff';
    body: string;
    daysAgo: number;
    attachments?: Message['attachments'];
    unread?: boolean;
  }>;
}

const messageSpecs: MessageSpec[] = [
  {
    conversation_id: 'cnv_jones',
    client_id: 'cli_sarah_jones',
    staff_id: 'stf_designer',
    entries: [
      { from: 'Client', body: 'Hi Priya — is the install still on track for the week of the 17th?', daysAgo: 12 },
      { from: 'Staff', body: 'Hi Sarah, yes. Carcasses go in on the Monday and the worktop template is booked for the Thursday.', daysAgo: 12 },
      { from: 'Client', body: 'Perfect. Do I need to clear the utility room as well, or just the kitchen?', daysAgo: 11 },
      { from: 'Staff', body: 'Just the kitchen, but if you can leave a clear route through from the front door that would help the fitters.', daysAgo: 11 },
      { from: 'Client', body: 'Will do. One more thing — can we still change the pendant finish?', daysAgo: 5 },
      { from: 'Staff', body: 'We can, up until the order goes in on Friday. I will bring the two brass options to the fitting.', daysAgo: 5 },
      { from: 'Client', body: 'The brushed one on the left, please. Thanks Priya!', daysAgo: 4, unread: true },
    ],
  },
  {
    conversation_id: 'cnv_okafor',
    client_id: 'cli_david_okafor',
    staff_id: 'stf_designer',
    entries: [
      { from: 'Staff', body: 'Hi David — the 3D render for the media wall is ready for you in the portal under Designs.', daysAgo: 9 },
      { from: 'Client', body: 'Looks great. Only concern is the flue box on the right, it looks quite dominant.', daysAgo: 8 },
      { from: 'Staff', body: 'Agreed. I can push the shelving across to balance it and drop the box depth by 40mm.', daysAgo: 8 },
      { from: 'Client', body: 'Yes please. Once I see that I am happy to approve.', daysAgo: 7 },
      { from: 'Staff', body: 'Updated render uploaded. Have a look and hit Approve if you are content.', daysAgo: 2, unread: true },
    ],
  },
  {
    conversation_id: 'cnv_patel',
    client_id: 'cli_raj_patel',
    staff_id: 'stf_designer_hannah',
    entries: [
      { from: 'Client', body: 'Morning Hannah — the internals look excellent. When are the mirrored doors arriving?', daysAgo: 6 },
      { from: 'Staff', body: 'Thursday this week. Marcus will fit them the same afternoon.', daysAgo: 6 },
      { from: 'Client', body: 'Great. Also, I have started thinking about the kitchen extension — who should I speak to?', daysAgo: 5 },
      { from: 'Staff', body: 'I have opened an enquiry for you. We will book a survey once your builder sends the floor plan.', daysAgo: 5 },
      { from: 'Client', body: 'Perfect, I will chase them this week.', daysAgo: 3 },
    ],
  },
  {
    conversation_id: 'cnv_shaw',
    client_id: 'cli_eleanor_shaw',
    staff_id: 'stf_designer_hannah',
    entries: [
      { from: 'Client', body: 'Just to reconfirm — nothing can be fixed to the walls, it is Grade II listed.', daysAgo: 11 },
      { from: 'Staff', body: 'Understood. Everything is freestanding with a scribed filler, no fixings into the plaster.', daysAgo: 11 },
      { from: 'Client', body: 'Thank you. Could we see a version with the tallboy on the window side?', daysAgo: 10 },
      { from: 'Staff', body: 'Yes — I will have both layouts ready for the design visit.', daysAgo: 9 },
      { from: 'Client', body: 'Lovely, see you then.', daysAgo: 8 },
    ],
  },
  {
    conversation_id: 'cnv_mensah',
    client_id: 'cli_grace_mensah',
    staff_id: 'stf_admin',
    entries: [
      { from: 'Staff', body: 'Hi Grace — following up on the kitchen design we presented. Any thoughts so far?', daysAgo: 16 },
      { from: 'Client', body: 'Thanks Oyz — still discussing it at home. The Dekton pushed it slightly over what we had in mind.', daysAgo: 15 },
      { from: 'Staff', body: 'Understood. I can re-quote on quartz which would bring it down meaningfully, no obligation.', daysAgo: 15 },
      { from: 'Client', body: 'That would be helpful, thank you.', daysAgo: 14 },
    ],
  },
];

const messages: Message[] = [];
for (const spec of messageSpecs) {
  spec.entries.forEach((entry, index) => {
    const createdAt = fromNow(-entry.daysAgo, `${9 + (index % 8)}:${index % 2 ? '35' : '05'}`);
    messages.push({
      id: `${spec.conversation_id}_msg_${index + 1}`,
      conversation_id: spec.conversation_id,
      sender_id: entry.from === 'Client' ? spec.client_id : spec.staff_id,
      sender_type: entry.from,
      body: entry.body,
      attachments: entry.attachments ?? null,
      // Unread messages are the ones the *recipient* has not opened. Leaving a
      // few unread is what makes the dashboard "unread messages" tiles real.
      read_at: entry.unread ? null : createdAt,
      created_at: createdAt,
    });
  });
}

/* -------------------------------------------------------------------------- */
/* saved_reply_templates                                                      */
/* -------------------------------------------------------------------------- */

const savedReplyTemplates: SavedReplyTemplate[] = [
  { id: 'srt_booking_confirm', staff_id: null, title: 'Consultation confirmed', body: 'Thanks for booking with Enzo Interiors. Your consultation is confirmed — we will call the day before to check access and parking. If anything changes, just reply here.' },
  { id: 'srt_design_ready', staff_id: null, title: 'Design ready to view', body: 'Your design is now available in the portal under Designs. Take your time with it, and use Approve or Request Changes when you are ready. Happy to talk it through on a call if easier.' },
  { id: 'srt_install_prep', staff_id: null, title: 'Preparing for installation', body: 'Ahead of installation week, please clear the room and leave a clear route from the front door. Our fitters arrive at 8am and will protect floors and doorways on the way in.' },
  { id: 'srt_invoice_reminder', staff_id: 'stf_admin', title: 'Polite invoice reminder', body: 'A gentle reminder that your invoice is now due. Our bank details are on the invoice itself — once payment reaches us we will mark it as paid on your account.' },
  { id: 'srt_lead_time', staff_id: 'stf_designer', title: 'Current lead times', body: 'Current lead time from design sign-off to installation is around 6 to 8 weeks, depending on worktop selection. Stone templating adds roughly a fortnight after the carcasses are in.' },
];

/* -------------------------------------------------------------------------- */
/* notification_preferences — one row per principal                            */
/* -------------------------------------------------------------------------- */

const notificationPreferences: NotificationPreference[] = [
  ...clients.map((client, index) => ({
    id: `npf_${client.id}`,
    owner_id: client.id,
    owner_type: 'Client' as const,
    email_enabled: true,
    sms_enabled: index % 3 === 0,
    in_app_enabled: true,
  })),
  ...staffUsers.map((staff) => ({
    id: `npf_${staff.id}`,
    owner_id: staff.id,
    owner_type: 'Staff' as const,
    email_enabled: true,
    sms_enabled: false,
    in_app_enabled: true,
  })),
];

/* -------------------------------------------------------------------------- */
/* documents — every type, mixed client_visible                                */
/* -------------------------------------------------------------------------- */

const documents: DocumentRecord[] = [
  { id: 'doc_jones_contract', client_id: 'cli_sarah_jones', project_id: 'prj_jones_kitchen', name: 'Stoneygate Kitchen — Contract.pdf', type: 'Contract', size_bytes: 284_119, upload_date: at('2026-05-25'), client_visible: true, storage_url: 'placeholder://documents/cli_sarah_jones/stoneygate-kitchen-contract.pdf' },
  { id: 'doc_jones_plan', client_id: 'cli_sarah_jones', project_id: 'prj_jones_kitchen', name: 'Kitchen Plan — Rev C.pdf', type: 'Plan', size_bytes: 1_482_330, upload_date: at('2026-06-11'), client_visible: true, storage_url: 'placeholder://documents/cli_sarah_jones/kitchen-plan-rev-c.pdf' },
  { id: 'doc_jones_mood', client_id: 'cli_sarah_jones', project_id: 'prj_jones_wardrobe', name: 'Wardrobe Mood Board.pdf', type: 'MoodBoard', size_bytes: 3_920_774, upload_date: at('2026-07-19'), client_visible: true, storage_url: 'placeholder://documents/cli_sarah_jones/wardrobe-mood-board.pdf' },
  { id: 'doc_jones_invoice', client_id: 'cli_sarah_jones', project_id: 'prj_jones_kitchen', name: 'INV-2026-0001.pdf', type: 'Invoice', size_bytes: 96_442, upload_date: at('2026-05-24'), client_visible: true, storage_url: 'placeholder://documents/cli_sarah_jones/inv-2026-0001.pdf' },
  { id: 'doc_okafor_render', client_id: 'cli_david_okafor', project_id: 'prj_okafor_mediawall', name: 'Media Wall Render — Rev B.pdf', type: 'MoodBoard', size_bytes: 5_114_208, upload_date: fromNow(-2), client_visible: true, storage_url: 'placeholder://documents/cli_david_okafor/media-wall-render-rev-b.pdf' },
  { id: 'doc_okafor_survey', client_id: 'cli_david_okafor', project_id: 'prj_okafor_mediawall', name: 'Internal Survey Notes.pdf', type: 'Plan', size_bytes: 214_006, upload_date: at('2026-06-06'), client_visible: false, storage_url: 'placeholder://documents/cli_david_okafor/internal-survey-notes.pdf' },
  { id: 'doc_hart_contract', client_id: 'cli_amelia_hart', project_id: 'prj_hart_kitchen', name: 'Wigston Kitchen — Contract.pdf', type: 'Contract', size_bytes: 279_540, upload_date: at('2026-04-29'), client_visible: true, storage_url: 'placeholder://documents/cli_amelia_hart/wigston-kitchen-contract.pdf' },
  { id: 'doc_hart_handover', client_id: 'cli_amelia_hart', project_id: 'prj_hart_kitchen', name: 'Handover & Care Guide.pdf', type: 'Plan', size_bytes: 861_223, upload_date: at('2026-07-28'), client_visible: true, storage_url: 'placeholder://documents/cli_amelia_hart/handover-care-guide.pdf' },
  { id: 'doc_patel_contract', client_id: 'cli_raj_patel', project_id: 'prj_patel_wardrobe', name: 'Birstall Wardrobe — Contract.pdf', type: 'Contract', size_bytes: 268_781, upload_date: at('2026-06-23'), client_visible: true, storage_url: 'placeholder://documents/cli_raj_patel/birstall-wardrobe-contract.pdf' },
  { id: 'doc_patel_plan', client_id: 'cli_raj_patel', project_id: 'prj_patel_wardrobe', name: 'Wardrobe Elevations.pdf', type: 'Plan', size_bytes: 1_190_455, upload_date: at('2026-07-01'), client_visible: true, storage_url: 'placeholder://documents/cli_raj_patel/wardrobe-elevations.pdf' },
  { id: 'doc_shaw_mood', client_id: 'cli_eleanor_shaw', project_id: 'prj_shaw_bedroom', name: 'Bedroom Mood Board.pdf', type: 'MoodBoard', size_bytes: 4_402_119, upload_date: fromNow(-4), client_visible: true, storage_url: 'placeholder://documents/cli_eleanor_shaw/bedroom-mood-board.pdf' },
  { id: 'doc_bradley_invoice', client_id: 'cli_tom_bradley', project_id: 'prj_bradley_mediawall', name: 'INV-2026-0005.pdf', type: 'Invoice', size_bytes: 94_118, upload_date: at('2026-06-26'), client_visible: true, storage_url: 'placeholder://documents/cli_tom_bradley/inv-2026-0005.pdf' },
];

/* -------------------------------------------------------------------------- */
/* testimonials                                                               */
/* -------------------------------------------------------------------------- */

const testimonials: Testimonial[] = [
  { id: 'tst_hart', client_name: 'Amelia Hart', rating: 5, review_text: 'From the first survey to handover the whole thing was calm and well organised. The shaker doors are beautifully made and the fit around our very un-square walls is faultless.', project_id: 'prj_hart_kitchen', is_published: true, created_at: at('2026-07-30') },
  { id: 'tst_bradley', client_name: 'Tom Bradley', rating: 5, review_text: 'The media wall completely changed the room. They hid every cable and the walnut is stunning in the evening light.', project_id: 'prj_bradley_mediawall', is_published: true, created_at: at('2026-06-29') },
  { id: 'tst_okafor', client_name: 'David O.', rating: 4, review_text: 'Really good design work and genuinely helpful advice about the flue. Communication through the portal made it easy to keep track.', project_id: 'prj_okafor_mediawall', is_published: true, created_at: at('2026-08-04') },
  { id: 'tst_patel', client_name: 'Raj Patel', rating: 5, review_text: 'Hannah listened properly to how we actually use the space. The walk-in is now the best-organised room in the house.', project_id: 'prj_patel_wardrobe', is_published: true, created_at: at('2026-08-16') },
  { id: 'tst_langley', client_name: 'Marie Langley', rating: 5, review_text: 'Second project with Enzo and the standard has not slipped at all. Would not go anywhere else in Leicester.', project_id: null, is_published: true, created_at: at('2026-05-12') },
  { id: 'tst_whitmore', client_name: 'Ian Whitmore', rating: 4, review_text: 'Excellent joinery and a tidy team. Install ran a few days over but they kept us informed the whole way.', project_id: null, is_published: true, created_at: at('2026-07-06') },
  { id: 'tst_pending', client_name: 'Eleanor Shaw', rating: 5, review_text: 'Early days but the care taken over the listed-building constraints has been really reassuring.', project_id: 'prj_shaw_bedroom', is_published: false, created_at: fromNow(-3) },
];

/* -------------------------------------------------------------------------- */
/* portfolio_items                                                            */
/* -------------------------------------------------------------------------- */

const img = (seed: string, count: number): string[] =>
  Array.from({ length: count }, (_, i) => `https://picsum.photos/seed/enzo-${seed}-${i + 1}/1400/1000`);

const portfolioItems: PortfolioItem[] = [
  { id: 'prt_wigston_kitchen', project_id: 'prj_hart_kitchen', title: 'Wigston Shaker Kitchen', category: 'Kitchen', location: 'Wigston, Leicester', year: 2026, duration_weeks: 9, description: 'A hand-painted shaker kitchen in a 1930s semi, opened through to the dining room. Granite worktops and a full-height larder run.', materials_used: 'Hand-painted tulipwood, granite worktop, brushed brass ironmongery', image_urls: img('wigston-kitchen', 4), is_published: true },
  { id: 'prt_syston_mediawall', project_id: 'prj_bradley_mediawall', title: 'Syston Walnut Media Wall', category: 'MediaWall', location: 'Syston, Leicester', year: 2026, duration_weeks: 4, description: 'Book-matched walnut media wall with concealed cable management and a recessed 65" panel.', materials_used: 'American walnut veneer, lacquered MDF, warm-white LED', image_urls: img('syston-mediawall', 3), is_published: true },
  { id: 'prt_birstall_wardrobe', project_id: 'prj_patel_wardrobe', title: 'Birstall Walk-In Wardrobe', category: 'Wardrobe', location: 'Birstall, Leicester', year: 2026, duration_weeks: 5, description: 'A full walk-in conversion of a box room, with mirrored doors, soft-close rails and integrated drawer lighting.', materials_used: 'Fenix NTM fronts, anodised rails, bronzed mirror', image_urls: img('birstall-wardrobe', 4), is_published: true },
  { id: 'prt_stoneygate_kitchen', project_id: 'prj_jones_kitchen', title: 'Stoneygate Island Kitchen', category: 'Kitchen', location: 'Stoneygate, Leicester', year: 2026, duration_weeks: 10, description: 'A large island kitchen in a Victorian villa, with quartz surfaces and three brass pendants over the run.', materials_used: 'Silestone quartz, matt painted shaker fronts, brushed brass', image_urls: img('stoneygate-kitchen', 5), is_published: true },
  { id: 'prt_oadby_bedroom', project_id: null, title: 'Oadby Fitted Bedroom', category: 'Bedroom', location: 'Oadby, Leicester', year: 2025, duration_weeks: 6, description: 'Wall-to-wall fitted bedroom furniture with a floating bedside detail and concealed dressing table.', materials_used: 'Matt lacquer, oak interiors, integrated LED', image_urls: img('oadby-bedroom', 3), is_published: true },
  { id: 'prt_harborough_wardrobe', project_id: null, title: 'Market Harborough Freestanding Suite', category: 'Wardrobe', location: 'Market Harborough', year: 2025, duration_weeks: 7, description: 'A freestanding bedroom suite for a Grade II listed cottage, scribed to the walls with no fixings into the plaster.', materials_used: 'Solid tulipwood, hand-painted finish, antique brass', image_urls: img('harborough-wardrobe', 3), is_published: true },
  { id: 'prt_clarendon_mediawall', project_id: null, title: 'Clarendon Park Media Wall', category: 'MediaWall', location: 'Clarendon Park, Leicester', year: 2025, duration_weeks: 3, description: 'A compact media wall for a terraced sitting room, using a fluted oak detail to disguise the chimney breast.', materials_used: 'Fluted oak, painted carcass, warm-white LED', image_urls: img('clarendon-mediawall', 3), is_published: true },
  { id: 'prt_draft_kitchen', project_id: null, title: 'Loughborough Kitchen (unpublished draft)', category: 'Kitchen', location: 'Loughborough', year: 2026, duration_weeks: null, description: 'Photography booked — not yet released.', materials_used: null, image_urls: img('loughborough-kitchen', 2), is_published: false },
];

/* -------------------------------------------------------------------------- */
/* contact_submissions                                                        */
/* -------------------------------------------------------------------------- */

const contactSubmissions: ContactSubmission[] = ([
  { id: 'sub_natalie_reed', name: 'Natalie Reed', email: 'natalie.reed@example.com', phone: '07700 900411', service_interest: 'Kitchen', message: 'We are extending at the back and will need a kitchen for around March. Do you take bookings that far ahead?', status: 'New', created_at: fromNow(-1, '19:42') },
  { id: 'sub_owen_clarke', name: 'Owen Clarke', email: 'owen.clarke@example.com', phone: '07700 900866', service_interest: 'MediaWall', message: 'Looking for a media wall in a fairly narrow lounge — is 2.6m wide enough to be worth doing?', status: 'New', created_at: fromNow(-3, '12:08') },
  { id: 'sub_priti_shah', name: 'Priti Shah', email: 'priti.shah@example.com', phone: '07700 900209', service_interest: 'Wardrobe', message: 'Interested in fitted wardrobes for two bedrooms. Would like a rough idea of cost before booking.', status: 'Contacted', created_at: at('2026-08-14', '10:22') },
  { id: 'sub_eleanor_shaw', name: 'Eleanor Shaw', email: 'eleanor.shaw@example.com', phone: '07700 900281', service_interest: 'Bedroom', message: 'Grade II listed cottage, need freestanding bedroom furniture. Recommended by Marie Langley.', status: 'Converted', created_at: at('2026-07-08', '16:55') },
  { id: 'sub_spam', name: 'Growth Partners', email: 'no-reply@example.net', phone: null, service_interest: null, message: 'We can get your website to the top of Google in 14 days, guaranteed.', status: 'Archived', created_at: at('2026-08-01', '03:17') },
] as Array<Omit<ContactSubmission, 'kind' | 'details'>>).map((row) => ({ ...row, kind: 'contact' as const, details: null }));

/* -------------------------------------------------------------------------- */
/* business_settings — singleton                                              */
/* -------------------------------------------------------------------------- */

const businessSettings: BusinessSettings[] = [
  {
    id: 'settings_enzo',
    business_name: 'Enzo Interiors',
    vat_rate: VAT,
    logo_url: 'placeholder://logo/enzo-interiors-primary.svg',
    // UI/UX Brief v6 green-900, which is what admin and portal are built on.
    brand_primary_color: '#173C30',
    email_from_address: 'studio@enzointeriors.co.uk',
  },
];

/* -------------------------------------------------------------------------- */
/* activity_logs — a believable trail                                         */
/* -------------------------------------------------------------------------- */

interface LogSpec {
  actor: string;
  action: string;
  table: string;
  target: string;
  daysAgo: number;
  details?: Record<string, unknown>;
}

const logSpecs: LogSpec[] = [
  { actor: 'stf_admin', action: 'client_create', table: 'clients', target: 'cli_eleanor_shaw', daysAgo: 50, details: { name: 'Eleanor Shaw', source: 'contact_submission' } },
  { actor: 'stf_admin', action: 'contact_submission_status_change', table: 'contact_submissions', target: 'sub_eleanor_shaw', daysAgo: 50, details: { from: 'Contacted', to: 'Converted' } },
  { actor: 'stf_designer', action: 'project_stage_change', table: 'projects', target: 'prj_jones_kitchen', daysAgo: 34, details: { from: 'Approval', to: 'Installation' } },
  { actor: 'stf_admin', action: 'invoice_mark_paid', table: 'invoices', target: 'inv_hart_kitchen', daysAgo: 30, details: { number: 'INV-2026-0002', method: 'Bank transfer' } },
  { actor: 'stf_designer_hannah', action: 'project_stage_change', table: 'projects', target: 'prj_hart_kitchen', daysAgo: 29, details: { from: 'Installation', to: 'Completed' } },
  { actor: 'stf_admin', action: 'testimonial_publish', table: 'testimonials', target: 'tst_hart', daysAgo: 28 },
  { actor: 'stf_admin', action: 'portfolio_item_create', table: 'portfolio_items', target: 'prt_wigston_kitchen', daysAgo: 27, details: { title: 'Wigston Shaker Kitchen' } },
  { actor: 'stf_designer', action: 'document_upload', table: 'documents', target: 'doc_okafor_render', daysAgo: 22, details: { name: 'Media Wall Render — Rev B.pdf', client_visible: true } },
  { actor: 'stf_admin', action: 'invoice_create', table: 'invoices', target: 'inv_mensah_deposit', daysAgo: 21, details: { number: 'INV-2026-0007', amount: 960 } },
  { actor: 'stf_designer', action: 'project_stage_change', table: 'projects', target: 'prj_okafor_mediawall', daysAgo: 18, details: { from: 'Design', to: 'Approval' } },
  { actor: 'stf_admin', action: 'client_update', table: 'clients', target: 'cli_tom_bradley', daysAgo: 16, details: { field: 'status', from: 'Active', to: 'Inactive' } },
  { actor: 'stf_designer_hannah', action: 'project_assign_designer', table: 'projects', target: 'prj_shaw_bedroom', daysAgo: 14, details: { assigned_designer_id: 'stf_designer_hannah' } },
  { actor: 'stf_admin', action: 'invoice_status_change', table: 'invoices', target: 'inv_bradley_mediawall', daysAgo: 12, details: { from: 'Outstanding', to: 'Overdue' } },
  { actor: 'stf_designer', action: 'booking_create', table: 'bookings', target: 'bkg_jones_template', daysAgo: 10, details: { service_type: 'Kitchen' } },
  { actor: 'stf_admin', action: 'availability_update', table: 'availability_settings', target: 'avl_4', daysAgo: 8, details: { end_time: { from: '17:30', to: '19:00' }, note: 'Late Thursdays for evening consultations' } },
  { actor: 'stf_designer_hannah', action: 'project_visibility_change', table: 'projects', target: 'prj_patel_kitchen', daysAgo: 5, details: { client_visible: false, reason: 'Awaiting floor plan before sharing' } },
  { actor: 'stf_designer', action: 'document_upload', table: 'documents', target: 'doc_shaw_mood', daysAgo: 4, details: { name: 'Bedroom Mood Board.pdf' } },
  { actor: 'stf_admin', action: 'business_settings_update', table: 'business_settings', target: 'settings_enzo', daysAgo: 2, details: { field: 'brand_primary_color', to: '#173C30' } },
];

const staffName = (id: string): string =>
  staffUsers.find((staff) => staff.id === id)?.name ?? 'Unknown';

const activityLogs: ActivityLog[] = logSpecs.map((spec, index) => ({
  id: `act_${String(index + 1).padStart(3, '0')}`,
  staff_id: spec.actor,
  actor_type: 'Staff',
  actor_name: staffName(spec.actor),
  action: spec.action,
  target_table: spec.table,
  target_id: spec.target,
  details: spec.details ?? null,
  created_at: fromNow(-spec.daysAgo, `${9 + (index % 8)}:${index % 2 ? '41' : '12'}`),
}));

/* -------------------------------------------------------------------------- */
/* Derived: total_spent from actually-paid invoices                            */
/* -------------------------------------------------------------------------- */

for (const client of clients) {
  client.total_spent = sum(
    invoices
      .filter((invoice) => invoice.client_id === client.id && invoice.status === 'Paid')
      .map((invoice) => invoice.amount),
  );
}

/* -------------------------------------------------------------------------- */
/* Integrity check — fail loudly rather than write a broken dataset            */
/* -------------------------------------------------------------------------- */

function verifyReferentialIntegrity(): void {
  const problems: string[] = [];
  const ids = {
    staff: new Set(staffUsers.map((r) => r.id)),
    client: new Set(clients.map((r) => r.id)),
    project: new Set(projects.map((r) => r.id)),
    invoice: new Set(invoices.map((r) => r.id)),
    conversation: new Set(conversations.map((r) => r.id)),
  };

  const check = (ok: boolean, message: string) => {
    if (!ok) problems.push(message);
  };

  for (const client of clients) {
    check(
      client.assigned_staff_id === null || ids.staff.has(client.assigned_staff_id),
      `clients.${client.id}.assigned_staff_id -> ${client.assigned_staff_id}`,
    );
  }
  for (const project of projects) {
    check(ids.client.has(project.client_id), `projects.${project.id}.client_id -> ${project.client_id}`);
    check(
      project.assigned_designer_id === null || ids.staff.has(project.assigned_designer_id),
      `projects.${project.id}.assigned_designer_id -> ${project.assigned_designer_id}`,
    );
    check(project.progress_pct >= 0 && project.progress_pct <= 100, `projects.${project.id}.progress_pct out of range`);
  }
  for (const invoice of invoices) {
    check(ids.client.has(invoice.client_id), `invoices.${invoice.id}.client_id -> ${invoice.client_id}`);
    check(
      invoice.project_id === null || ids.project.has(invoice.project_id),
      `invoices.${invoice.id}.project_id -> ${invoice.project_id}`,
    );
    check(
      (invoice.status === 'Paid') === (invoice.paid_at !== null),
      `invoices.${invoice.id}: paid_at must be set if and only if status is Paid`,
    );
  }
  for (const booking of bookings) {
    check(ids.client.has(booking.client_id), `bookings.${booking.id}.client_id -> ${booking.client_id}`);
  }
  for (const conversation of conversations) {
    check(ids.client.has(conversation.client_id), `conversations.${conversation.id}.client_id`);
  }
  for (const message of messages) {
    check(ids.conversation.has(message.conversation_id), `messages.${message.id}.conversation_id`);
    const senderKnown =
      message.sender_type === 'Client' ? ids.client.has(message.sender_id) : ids.staff.has(message.sender_id);
    check(senderKnown, `messages.${message.id}.sender_id -> ${message.sender_id}`);
  }
  for (const document of documents) {
    check(ids.client.has(document.client_id), `documents.${document.id}.client_id`);
    check(
      document.project_id === null || ids.project.has(document.project_id),
      `documents.${document.id}.project_id`,
    );
  }
  for (const testimonial of testimonials) {
    check(
      testimonial.project_id === null || ids.project.has(testimonial.project_id),
      `testimonials.${testimonial.id}.project_id`,
    );
    check(testimonial.rating >= 1 && testimonial.rating <= 5, `testimonials.${testimonial.id}.rating out of range`);
  }
  for (const item of portfolioItems) {
    check(item.project_id === null || ids.project.has(item.project_id), `portfolio_items.${item.id}.project_id`);
    check(item.image_urls.length > 0, `portfolio_items.${item.id} has no images`);
  }
  for (const log of activityLogs) {
    check(ids.staff.has(log.staff_id), `activity_logs.${log.id}.staff_id -> ${log.staff_id}`);
  }

  if (problems.length > 0) {
    throw new Error(`Seed failed referential integrity:\n  - ${problems.join('\n  - ')}`);
  }
}

/* -------------------------------------------------------------------------- */
/* Run                                                                        */
/* -------------------------------------------------------------------------- */

async function main(): Promise<void> {
  verifyReferentialIntegrity();

  // This wipes every table and replaces it with demo records whose passwords
  // are printed at the end. Running it against production would delete the
  // real data and install publicly known credentials, so it refuses unless
  // someone has very deliberately said otherwise.
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DESTRUCTIVE_SEED !== 'yes') {
    console.error(
      [
        'Refusing to seed demo data with NODE_ENV=production.',
        'This deletes all existing records. If you are certain, set ALLOW_DESTRUCTIVE_SEED=yes.',
      ].join(' '),
    );
    process.exit(1);
  }

  const db = new DatabaseService(new PrismaService());

  // The readable values above are the demo credentials printed at the end;
  // what actually lands in the database is a bcrypt hash of each.
  for (const row of staffUsers) row.password_hash = await hashPassword(row.password_hash);
  for (const row of clients) row.password_hash = await hashPassword(row.password_hash);

  await Promise.all([
    db.staffUsers.replaceAll(staffUsers),
    db.clients.replaceAll(clients),
    db.projects.replaceAll(projects),
    db.invoices.replaceAll(invoices.map((row) => ({ ...row, ...BLANK_LAYOUT }))),
    db.bookings.replaceAll(bookings),
    db.availabilitySettings.replaceAll(availabilitySettings),
    db.conversations.replaceAll(conversations),
    db.messages.replaceAll(messages),
    db.savedReplyTemplates.replaceAll(savedReplyTemplates),
    db.notificationPreferences.replaceAll(notificationPreferences),
    db.documents.replaceAll(documents),
    db.testimonials.replaceAll(testimonials),
    db.portfolioItems.replaceAll(portfolioItems),
    db.contactSubmissions.replaceAll(contactSubmissions),
    db.businessSettings.replaceAll(businessSettings),
    db.activityLogs.replaceAll(activityLogs),
  ]);

  const counts: Array<[string, number]> = [
    ['staff_users', staffUsers.length],
    ['clients', clients.length],
    ['projects', projects.length],
    ['invoices', invoices.length],
    ['bookings', bookings.length],
    ['availability_settings', availabilitySettings.length],
    ['conversations', conversations.length],
    ['messages', messages.length],
    ['saved_reply_templates', savedReplyTemplates.length],
    ['notification_preferences', notificationPreferences.length],
    ['documents', documents.length],
    ['testimonials', testimonials.length],
    ['portfolio_items', portfolioItems.length],
    ['contact_submissions', contactSubmissions.length],
    ['business_settings', businessSettings.length],
    ['activity_logs', activityLogs.length],
  ];

  console.log(`\nSeeded ${db.target}\n`);
  for (const [table, count] of counts) {
    console.log(`  ${table.padEnd(26)} ${String(count).padStart(3)}`);
  }
  console.log('\nDemo accounts');
  console.log('  Admin      admin@enzointeriors.co.uk     / admin123');
  console.log('  Designer   designer@enzointeriors.co.uk  / designer123');
  console.log('  Installer  installer@enzointeriors.co.uk / installer123');
  console.log('  Client     sarah.jones@example.com       / client123');
  console.log('  Client     david.okafor@example.com      / client123');
  console.log('  Client     raj.patel@example.com         / client123');
  console.log('  Client     amelia.hart@example.com       / client123');
  console.log('  Client     eleanor.shaw@example.com      / client123\n');
}

main().catch((error: unknown) => {
  console.error('\nSeed failed:\n', error);
  process.exit(1);
});
