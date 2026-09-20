import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { CoreModule } from './core/core.module';
import { AuthModule } from './modules/auth/auth.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { ClientsModule } from './modules/clients/clients.module';
import { CmsModule } from './modules/cms/cms.module';
import { ComponentsModule } from './modules/components/components.module';
import { ContentModule } from './modules/content/content.module';
import { ConversationsModule } from './modules/conversations/conversations.controller';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { InvoicesModule } from './modules/invoices/invoices.controller';
import { MediaModule } from './modules/media/media.module';
import { ProjectsModule } from './modules/projects/projects.controller';
import { QuotesModule } from './modules/quotes/quotes.controller';
import { SettingsModule } from './modules/settings/settings.module';

/**
 * Guard order matters: JwtAuthGuard must run first so RolesGuard has a
 * principal to inspect. Nest runs APP_GUARDs in registration order.
 *
 * Registering both globally is the whole point of the RBAC design — a new
 * controller is authenticated and role-checked by default, and opening one up
 * requires an explicit, greppable @Public().
 *
 * Module file layout: modules with substantial domain logic (clients, quotes,
 * invoices, projects, conversations) are split across service/controller/dto
 * files; simpler resources keep controller, service and DTOs in one module file
 * where splitting would add navigation cost without adding clarity.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CoreModule,
    AuthModule,
    ClientsModule,
    ProjectsModule,
    ComponentsModule,
    QuotesModule,
    InvoicesModule,
    BookingsModule,
    ConversationsModule,
    DocumentsModule,
    ContentModule,
    MediaModule,
    CmsModule,
    SettingsModule,
    DashboardModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
