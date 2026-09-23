import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { CoreModule } from './core/core.module';
import { AuthModule } from './modules/auth/auth.module';
import { CmsModule } from './modules/cms/cms.module';
import { EnquiriesModule } from './modules/enquiries/enquiries.module';
import { MediaModule } from './modules/media/media.module';
import { SiteSettingsModule } from './modules/site-settings/site-settings.module';

/**
 * Guard order matters: JwtAuthGuard must run before RolesGuard so it has a
 * principal to inspect. Nest runs APP_GUARDs in registration order.
 *
 * Registering both globally is the whole point of the RBAC design — a new
 * controller is authenticated and role-checked by default, and opening one up
 * requires an explicit, greppable @Public().
 *
 * v1 SCOPE: the public site and the CMS that runs it, nothing else. The CRM
 * modules (clients, projects, quotes, invoices, bookings, conversations,
 * documents, components, content, settings, dashboard) are still in
 * src/modules and their tables are still in the schema, so existing data is
 * untouched — they are simply not mounted, which means none of their routes
 * exist on a v1 server. To bring the CRM back, import them here again:
 *
 *   ClientsModule, ProjectsModule, ComponentsModule, QuotesModule,
 *   InvoicesModule, BookingsModule, ConversationsModule, DocumentsModule,
 *   ContentModule, SettingsModule, DashboardModule
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // 600 requests a minute per IP across the API: flood control, loose enough
    // for an office of editors behind one address. Sign-in, reset and the
    // public enquiry form tighten this per route with @Throttle.
    // ponytail: in-memory, per process. Fine for one API container; give it
    // a Redis store if the API is ever scaled out.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 600 }]),
    CoreModule,
    AuthModule,
    MediaModule,
    SiteSettingsModule,
    CmsModule,
    EnquiriesModule,
  ],
  providers: [
    // First, so a flood is refused before any token is verified.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
