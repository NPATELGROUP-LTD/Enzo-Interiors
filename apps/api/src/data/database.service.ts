import { Injectable } from '@nestjs/common';

import {
  ActivityLog,
  Appointment,
  AvailabilitySetting,
  Booking,
  BookingSettingsRow,
  BusinessSettings,
  CalendarConnection,
  Client,
  CmsEntry,
  ContactSubmission,
  Conversation,
  DocumentRecord,
  Invoice,
  InvoiceItem,
  MediaAsset,
  Message,
  NewsletterCampaign,
  NewsletterSubscriber,
  Notification,
  NotificationPreference,
  PortfolioItem,
  Project,
  SavedReplyTemplate,
  SiteSettings,
  StaffUser,
  Testimonial,
  TrustedDevice,
} from '../common/types/domain';
import { INVOICE_FIELDS, INVOICE_ITEM_FIELDS, InvoiceStore } from './invoice-store';
import { PrismaRepository } from './prisma-repository';
import { PrismaService } from './prisma.service';

/**
 * The one place the rest of the API gets at persistence.
 *
 * Every table in Backend Schema v2.0 section 3 gets a repository, named after
 * the documented table, plus the two CMS tables added for v1. Services depend
 * on this and only this.
 *
 * This file used to hand out JsonRepository instances backed by files on disk.
 * Swapping to PostgreSQL changed the right-hand side of these assignments and
 * nothing else: PrismaRepository keeps JsonRepository's method surface, so no
 * service signature moved. The per-table `dates` and `decimals` lists below are
 * the only new information — they tell the repository which columns to convert
 * between Postgres types and the ISO strings and plain numbers the domain types
 * declare. A column added to schema.prisma as a timestamptz or a decimal must
 * be added to its list here, or it will reach callers as a Date or a Decimal.
 */
@Injectable()
export class DatabaseService {
  readonly staffUsers: PrismaRepository<StaffUser>;
  readonly clients: PrismaRepository<Client>;
  readonly projects: PrismaRepository<Project>;
  readonly invoices: PrismaRepository<Invoice>;
  readonly invoiceItems: PrismaRepository<InvoiceItem>;
  readonly invoiceStore: InvoiceStore;
  readonly bookings: PrismaRepository<Booking>;
  readonly availabilitySettings: PrismaRepository<AvailabilitySetting>;
  readonly conversations: PrismaRepository<Conversation>;
  readonly messages: PrismaRepository<Message>;
  readonly savedReplyTemplates: PrismaRepository<SavedReplyTemplate>;
  readonly notificationPreferences: PrismaRepository<NotificationPreference>;
  readonly documents: PrismaRepository<DocumentRecord>;
  readonly testimonials: PrismaRepository<Testimonial>;
  readonly portfolioItems: PrismaRepository<PortfolioItem>;
  readonly contactSubmissions: PrismaRepository<ContactSubmission>;
  readonly businessSettings: PrismaRepository<BusinessSettings>;
  readonly activityLogs: PrismaRepository<ActivityLog>;
  readonly cmsEntries: PrismaRepository<CmsEntry>;
  readonly mediaAssets: PrismaRepository<MediaAsset>;
  readonly siteSettings: PrismaRepository<SiteSettings>;
  readonly bookingSettings: PrismaRepository<BookingSettingsRow>;
  readonly appointments: PrismaRepository<Appointment>;
  readonly notifications: PrismaRepository<Notification>;
  readonly newsletterSubscribers: PrismaRepository<NewsletterSubscriber>;
  readonly newsletterCampaigns: PrismaRepository<NewsletterCampaign>;
  readonly trustedDevices: PrismaRepository<TrustedDevice>;
  readonly calendarConnections: PrismaRepository<CalendarConnection>;

  constructor(private readonly prisma: PrismaService) {
    const stamps = ['created_at', 'updated_at'] as const;

    this.staffUsers = new PrismaRepository(prisma.staffUser, 'staff_users', {
      dates: [...stamps, 'reset_expires_at', 'totp_confirmed_at', 'login_code_expires_at'],
    });
    this.clients = new PrismaRepository(prisma.client, 'clients', {
      dates: [...stamps, 'joined_date'],
      decimals: ['total_spent'],
    });
    this.projects = new PrismaRepository(prisma.project, 'projects', { dates: stamps });
    this.invoices = new PrismaRepository(prisma.invoice, 'invoices', INVOICE_FIELDS);
    this.invoiceItems = new PrismaRepository(prisma.invoiceItem, 'invoice_items', INVOICE_ITEM_FIELDS);
    this.invoiceStore = new InvoiceStore(prisma);
    this.bookings = new PrismaRepository(prisma.booking, 'bookings', {
      dates: ['created_at', 'date_time'],
    });
    this.availabilitySettings = new PrismaRepository(
      prisma.availabilitySetting,
      'availability_settings',
    );
    this.conversations = new PrismaRepository(prisma.conversation, 'conversations', {
      dates: ['created_at'],
    });
    this.messages = new PrismaRepository(prisma.message, 'messages', {
      dates: ['created_at', 'read_at'],
    });
    this.savedReplyTemplates = new PrismaRepository(
      prisma.savedReplyTemplate,
      'saved_reply_templates',
    );
    this.notificationPreferences = new PrismaRepository(
      prisma.notificationPreference,
      'notification_preferences',
    );
    this.documents = new PrismaRepository(prisma.documentRecord, 'documents', {
      dates: ['upload_date'],
    });
    this.testimonials = new PrismaRepository(prisma.testimonial, 'testimonials', {
      dates: ['created_at'],
    });
    this.portfolioItems = new PrismaRepository(prisma.portfolioItem, 'portfolio_items');
    this.contactSubmissions = new PrismaRepository(
      prisma.contactSubmission,
      'contact_submissions',
      { dates: ['created_at'] },
    );
    this.businessSettings = new PrismaRepository(prisma.businessSettings, 'business_settings', {
      decimals: ['vat_rate'],
    });
    this.activityLogs = new PrismaRepository(prisma.activityLog, 'activity_logs', {
      dates: ['created_at'],
    });
    this.cmsEntries = new PrismaRepository(prisma.cmsEntry, 'cms_entries', {
      dates: ['published_at', 'updated_at', 'review_at'],
    });
    this.mediaAssets = new PrismaRepository(prisma.mediaAsset, 'media_assets', {
      dates: stamps,
    });
    this.siteSettings = new PrismaRepository(prisma.siteSettings, 'site_settings', {
      dates: ['launch_at', 'updated_at'],
    });
    this.bookingSettings = new PrismaRepository(prisma.bookingSettings, 'booking_settings', {
      dates: ['updated_at'],
    });
    this.appointments = new PrismaRepository(prisma.appointment, 'appointments', {
      dates: [...stamps, 'starts_at', 'ends_at', 'cancelled_at'],
    });
    this.notifications = new PrismaRepository(prisma.notification, 'notifications', {
      dates: ['created_at', 'read_at'],
    });
    this.newsletterSubscribers = new PrismaRepository(prisma.newsletterSubscriber, 'newsletter_subscribers', {
      dates: ['created_at', 'confirm_sent_at', 'confirmed_at', 'unsubscribed_at'],
    });
    this.newsletterCampaigns = new PrismaRepository(prisma.newsletterCampaign, 'newsletter_campaigns', {
      dates: [...stamps, 'sent_at'],
    });
    this.trustedDevices = new PrismaRepository(prisma.trustedDevice, 'trusted_devices', {
      dates: ['created_at', 'last_used_at', 'expires_at'],
    });
    this.calendarConnections = new PrismaRepository(prisma.calendarConnection, 'calendar_connections', {
      dates: stamps,
    });
  }

  /** Surfaced for the startup log. Credentials are never included. */
  get target(): string {
    const url = process.env.DATABASE_URL ?? '';
    try {
      const parsed = new URL(url);
      return `postgres://${parsed.host}${parsed.pathname}`;
    } catch {
      return 'postgres (DATABASE_URL not parseable)';
    }
  }

  /**
   * The single business_settings row (Backend Schema 3.17 is a singleton).
   * Falls back to the documented defaults when the table has not been seeded,
   * so a fresh database does not 500 before the seed has run.
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
