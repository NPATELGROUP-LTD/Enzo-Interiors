import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { FriendlyThrottlerGuard } from './common/guards/throttle.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { CoreModule } from './core/core.module';
import { RateLimitStore } from './core/rate-limit';
import { AlertsModule } from './modules/alerts/alerts.module';
import { InfraModule } from './modules/infra/infra.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { QuoteDesignsModule } from './modules/quote-maker/designs';
import { QuoteMakerModule } from './modules/quote-maker/quote-maker.module';
import { AuthModule } from './modules/auth/auth.module';
import { BookingModule } from './modules/booking/booking.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { ChangeRequestsModule } from './modules/change-requests/change-requests.module';
import { ClientsModule } from './modules/clients/clients.module';
import { ConversationsModule } from './modules/conversations/conversations.controller';
import { SearchModule } from './modules/search/search.module';
import { QuotesModule } from './modules/quotes/quotes.module';
import { TeamChatModule } from './modules/team-chat/team-chat.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { CmsModule } from './modules/cms/cms.module';
import { EnquiriesModule } from './modules/enquiries/enquiries.module';
import { InvoicesModule } from './modules/invoices/invoices.controller';
import { MailboxModule } from './modules/mailbox/mailbox.module';
import { MediaModule } from './modules/media/media.module';
import { NewsletterModule } from './modules/newsletter/newsletter.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ProjectsModule } from './modules/projects/projects.controller';
import { SettingsModule } from './modules/settings/settings.module';
import { SiteSettingsModule } from './modules/site-settings/site-settings.module';

/**
 * Guard order matters: JwtAuthGuard must run before RolesGuard so it has a
 * principal to inspect. Nest runs APP_GUARDs in registration order.
 *
 * Registering both globally is the whole point of the RBAC design — a new
 * controller is authenticated and role-checked by default, and opening one up
 * requires an explicit, greppable @Public().
 *
 * v1 SCOPE: the public site, the CMS that runs it, consultation booking
 * (BookingModule: the site's booking form and the admin's Bookings screen),
 * the admin's users and notifications, the newsletter, and the CRM's client
 * book (ClientsModule: Admin, and Designers for the clients of their projects;
 * portal invitations) and projects (ProjectsModule: Admin, Designers on their
 * assigned projects, clients on their own shared ones), invoices
 * (InvoicesModule: Admin only; clients read their own, never Drafts) and
 * documents (DocumentsModule: the private bucket, same scope by project;
 * clients their own shared files), the dashboard (DashboardModule: per
 * role), messages (ConversationsModule: one conversation per client, same
 * scope, live over Socket.IO on this server) and the staff's saved replies
 * plus the Admin's audit-log viewer (SettingsModule). Every CRM route names
 * its roles with @Roles.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // 300 requests a minute per IP across the API: flood control, loose enough
    // for an office of editors behind one address. Every public write
    // (sign-in, reset, enquiry, booking, newsletter) tightens this per route
    // with @Throttle. Counters live in Redis when REDIS_URL is set, so limits
    // hold across restarts and replicas; see core/rate-limit.ts. Floods that
    // big belong to the edge (Cloudflare), docs/prelaunch.md → Rate limits.
    ThrottlerModule.forRootAsync({
      inject: [RateLimitStore],
      useFactory: (storage: RateLimitStore) => ({ throttlers: [{ ttl: 60_000, limit: 300 }], storage }),
    }),
    CoreModule,
    AuthModule,
    MediaModule,
    SiteSettingsModule,
    AlertsModule,
    InfraModule,
    CmsModule,
    EnquiriesModule,
    NotificationsModule,
    BookingModule,
    CalendarModule,
    MailboxModule,
    NewsletterModule,
    ClientsModule,
    ProjectsModule,
    ChangeRequestsModule,
    InvoicesModule,
    DocumentsModule,
    DashboardModule,
    ConversationsModule,
    SearchModule,
    TeamChatModule,
    QuotesModule,
    InventoryModule,
    QuoteMakerModule,
    QuoteDesignsModule,
    SettingsModule,
  ],
  providers: [
    // First, so a flood is refused before any token is verified.
    { provide: APP_GUARD, useClass: FriendlyThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
