import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import {
  ActivityLog,
  Appointment,
  AvailabilitySetting,
  Booking,
  BookingSettingsRow,
  BusinessSettings,
  CalendarConnection,
  ChangeRequest,
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
  PushSubscriptionRecord,
  Project,
  ProjectStageConfig,
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
  readonly pushSubscriptions: PrismaRepository<PushSubscriptionRecord>;
  readonly newsletterSubscribers: PrismaRepository<NewsletterSubscriber>;
  readonly newsletterCampaigns: PrismaRepository<NewsletterCampaign>;
  readonly trustedDevices: PrismaRepository<TrustedDevice>;
  readonly calendarConnections: PrismaRepository<CalendarConnection>;
  readonly changeRequests: PrismaRepository<ChangeRequest>;

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
    this.pushSubscriptions = new PrismaRepository(prisma.pushSubscription, 'push_subscriptions', {
      dates: ['created_at'],
    });
    this.changeRequests = new PrismaRepository(prisma.changeRequest, 'change_requests', {
      dates: ['created_at', 'decided_at'],
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

  /**
   * Settings › Project stages, all or nothing. While any project sits at a
   * stage in `removed`, nothing is written and the counts come back. Otherwise
   * projects at a renamed stage take its new name (ids collected first, so a
   * swap of two names works) and the list is saved.
   *
   * ponytail: a stage move landing between this count and the commit can still
   * write a removed name (READ COMMITTED); the board then shows it nowhere and
   * a later save refuses until it is moved. Lock projects if that bites.
   */
  async saveProjectStages(
    stages: ProjectStageConfig[],
    renames: Array<[string, string]>,
    removed: string[],
    updatedBy: string,
  ): Promise<Record<string, number>> {
    return this.prisma.$transaction(async (tx) => {
      if (removed.length) {
        const inUse = await tx.project.groupBy({ by: ['status'], where: { status: { in: removed } }, _count: { _all: true } });
        if (inUse.length) return Object.fromEntries(inUse.map((row) => [row.status, row._count._all]));
      }
      const moves: Array<{ to: string; ids: string[] }> = [];
      for (const [from, to] of renames) {
        const rows = await tx.project.findMany({ where: { status: from }, select: { id: true } });
        moves.push({ to, ids: rows.map((row) => row.id) });
      }
      for (const { to, ids } of moves) {
        if (ids.length) await tx.project.updateMany({ where: { id: { in: ids } }, data: { status: to } });
      }
      await tx.siteSettings.update({
        where: { id: 'site' },
        data: { project_stages: stages as unknown as Prisma.InputJsonValue, updated_at: new Date(), updated_by: updatedBy },
      });
      return {};
    });
  }

  /**
   * Delete a project in one transaction. Its documents and invoices belong to
   * the client, so they stay on the client's record, no longer linked to it.
   */
  async deleteProject(id: string): Promise<{ documents: number; invoices: number }> {
    return this.prisma.$transaction(async (tx) => {
      const documents = await tx.documentRecord.updateMany({ where: { project_id: id }, data: { project_id: null } });
      const invoices = await tx.invoice.updateMany({ where: { project_id: id }, data: { project_id: null } });
      await tx.changeRequest.deleteMany({ where: { project_id: id } });
      await tx.project.delete({ where: { id } });
      return { documents: documents.count, invoices: invoices.count };
    });
  }

  /**
   * Delete a client and everything that is only theirs, in one transaction:
   * projects, invoices (paid too; lines cascade), documents, the conversation,
   * their bell, devices and preferences. Returns the storage keys of their
   * files for the caller to remove once the rows are gone. Activity logs stay.
   */
  async deleteClient(id: string): Promise<{ storageKeys: string[]; projects: number; invoices: number }> {
    return this.prisma.$transaction(async (tx) => {
      const conversations = await tx.conversation.findMany({ where: { client_id: id }, select: { id: true } });
      await tx.message.deleteMany({ where: { conversation_id: { in: conversations.map((row) => row.id) } } });
      await tx.conversation.deleteMany({ where: { client_id: id } });
      const documents = await tx.documentRecord.findMany({ where: { client_id: id }, select: { storage_url: true } });
      await tx.documentRecord.deleteMany({ where: { client_id: id } });
      const invoices = await tx.invoice.deleteMany({ where: { client_id: id } });
      const projects = await tx.project.deleteMany({ where: { client_id: id } });
      await tx.notification.deleteMany({ where: { recipient_id: id } });
      await tx.pushSubscription.deleteMany({ where: { owner_type: 'client', owner_id: id } });
      await tx.notificationPreference.deleteMany({ where: { owner_type: 'Client', owner_id: id } });
      await tx.changeRequest.deleteMany({ where: { client_id: id } });
      await tx.client.delete({ where: { id } });
      return { storageKeys: documents.map((row) => row.storage_url), projects: projects.count, invoices: invoices.count };
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
