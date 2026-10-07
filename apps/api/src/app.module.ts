import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { FriendlyThrottlerGuard } from './common/guards/throttle.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { CoreModule } from './core/core.module';
import { RateLimitStore } from './core/rate-limit';
import { AuthModule } from './modules/auth/auth.module';
import { BookingModule } from './modules/booking/booking.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { ClientsModule } from './modules/clients/clients.module';
import { CmsModule } from './modules/cms/cms.module';
import { EnquiriesModule } from './modules/enquiries/enquiries.module';
import { MediaModule } from './modules/media/media.module';
import { NewsletterModule } from './modules/newsletter/newsletter.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
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
 * portal invitations). Nothing else. The other CRM modules (projects,
 * invoices, bookings, conversations, documents, content, settings, dashboard)
 * are still in src/modules and their tables are still in the schema, so
 * existing data is untouched — they are simply not mounted, which means none
 * of their routes exist on a v1 server. To bring them back, import them here
 * again, each with an explicit @Roles on every route:
 *
 *   ProjectsModule, InvoicesModule, BookingsModule, ConversationsModule,
 *   DocumentsModule, ContentModule, SettingsModule, DashboardModule
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
    CmsModule,
    EnquiriesModule,
    NotificationsModule,
    BookingModule,
    CalendarModule,
    NewsletterModule,
    ClientsModule,
  ],
  providers: [
    // First, so a flood is refused before any token is verified.
    { provide: APP_GUARD, useClass: FriendlyThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
