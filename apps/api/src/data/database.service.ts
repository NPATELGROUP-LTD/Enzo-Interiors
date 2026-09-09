import { Injectable } from '@nestjs/common';
import * as path from 'node:path';

import {
  ActivityLog,
  AvailabilitySetting,
  Booking,
  BusinessSettings,
  Client,
  ComponentItem,
  ContactSubmission,
  Conversation,
  DocumentRecord,
  Invoice,
  Message,
  NotificationPreference,
  PortfolioItem,
  Project,
  Quote,
  QuoteLineItem,
  SavedReplyTemplate,
  StaffUser,
  Testimonial,
} from '../common/types/domain';
import { JsonRepository } from './json-repository';

/**
 * Where the JSON tables live. Resolved from this file rather than from
 * process.cwd() so that `npm run dev` (cwd = apps/api) and `npm start` from
 * dist/ (cwd could be anywhere) both find the same directory.
 *
 * __dirname is <api>/src/data under tsx and <api>/dist/data after a build, so
 * two levels up is the app root in both cases.
 */
export const DATA_DIR = path.resolve(__dirname, '..', '..', 'data');

/**
 * The prototype stand-in for PrismaService.
 *
 * Every table in Backend Schema v2.0 section 3 gets a repository, named after
 * the documented table. Services depend on this and only this for persistence.
 * Swapping to Prisma means replacing the bodies here with `prisma.client` etc.
 * and deleting JsonRepository; no service signature changes.
 */
@Injectable()
export class DatabaseService {
  private readonly dataDir: string;

  readonly staffUsers: JsonRepository<StaffUser>;
  readonly clients: JsonRepository<Client>;
  readonly projects: JsonRepository<Project>;
  readonly components: JsonRepository<ComponentItem>;
  readonly quotes: JsonRepository<Quote>;
  readonly quoteLineItems: JsonRepository<QuoteLineItem>;
  readonly invoices: JsonRepository<Invoice>;
  readonly bookings: JsonRepository<Booking>;
  readonly availabilitySettings: JsonRepository<AvailabilitySetting>;
  readonly conversations: JsonRepository<Conversation>;
  readonly messages: JsonRepository<Message>;
  readonly savedReplyTemplates: JsonRepository<SavedReplyTemplate>;
  readonly notificationPreferences: JsonRepository<NotificationPreference>;
  readonly documents: JsonRepository<DocumentRecord>;
  readonly testimonials: JsonRepository<Testimonial>;
  readonly portfolioItems: JsonRepository<PortfolioItem>;
  readonly contactSubmissions: JsonRepository<ContactSubmission>;
  readonly businessSettings: JsonRepository<BusinessSettings>;
  readonly activityLogs: JsonRepository<ActivityLog>;

  /**
   * Deliberately parameterless. An optional `dataDir` constructor argument
   * reads to Nest's injector as an unresolvable `String` dependency, default
   * value or not, so the directory is taken from the module constant instead.
   * If a future test needs to point at a scratch directory, add an injection
   * token rather than a bare parameter.
   */
  constructor() {
    const dataDir = DATA_DIR;
    this.dataDir = dataDir;
    this.staffUsers = new JsonRepository(dataDir, 'staff_users');
    this.clients = new JsonRepository(dataDir, 'clients');
    this.projects = new JsonRepository(dataDir, 'projects');
    this.components = new JsonRepository(dataDir, 'components');
    this.quotes = new JsonRepository(dataDir, 'quotes');
    this.quoteLineItems = new JsonRepository(dataDir, 'quote_line_items');
    this.invoices = new JsonRepository(dataDir, 'invoices');
    this.bookings = new JsonRepository(dataDir, 'bookings');
    this.availabilitySettings = new JsonRepository(dataDir, 'availability_settings');
    this.conversations = new JsonRepository(dataDir, 'conversations');
    this.messages = new JsonRepository(dataDir, 'messages');
    this.savedReplyTemplates = new JsonRepository(dataDir, 'saved_reply_templates');
    this.notificationPreferences = new JsonRepository(dataDir, 'notification_preferences');
    this.documents = new JsonRepository(dataDir, 'documents');
    this.testimonials = new JsonRepository(dataDir, 'testimonials');
    this.portfolioItems = new JsonRepository(dataDir, 'portfolio_items');
    this.contactSubmissions = new JsonRepository(dataDir, 'contact_submissions');
    this.businessSettings = new JsonRepository(dataDir, 'business_settings');
    this.activityLogs = new JsonRepository(dataDir, 'activity_logs');
  }

  /** Where this instance reads and writes. Surfaced for the startup log. */
  get directory(): string {
    return this.dataDir;
  }

  /**
   * The single business_settings row (Backend Schema 3.17 is a singleton).
   * Falls back to the documented defaults when the table has not been seeded,
   * so a fresh checkout does not 500 before `npm run seed`.
   */
  async settings(): Promise<BusinessSettings> {
    const [existing] = await this.businessSettings.findAll();
    return (
      existing ?? {
        id: 'settings_enzo',
        business_name: 'Enzo Interiors',
        vat_rate: 20,
        logo_url: null,
        brand_primary_color: '#173C30',
        email_from_address: null,
      }
    );
  }
}
