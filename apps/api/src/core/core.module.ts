import { Global, MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { AccessService } from '../common/access/access.service';
import { DatabaseService } from '../data/database.service';
import { PrismaService } from '../data/prisma.service';
import { AccessLogService, SignInNote } from './access-log.service';
import { ActivityLogService } from './activity-log.service';
import { AlertService } from './alert.service';
import { CacheService } from './cache';
import { HealthController } from './health.controller';
import { MailService } from './mail.service';
import { RateLimitStore } from './rate-limit';
import { RevalidateService } from './revalidate.service';
import { PrivateStorage } from './storage';

/**
 * The services every feature module needs: the database connection,
 * persistence, row-level scoping, the audit trail, outgoing email, the
 * public site's cache, the rate-limit counters, a small shared cache and the
 * private document bucket.
 *
 * Global because the alternative is importing this module into all eighteen
 * feature modules, which is noise rather than encapsulation — these are
 * infrastructure, not domain collaborators.
 */
@Global()
@Module({
  controllers: [HealthController],
  providers: [PrismaService, DatabaseService, AccessService, ActivityLogService, AlertService, AccessLogService, { provide: APP_INTERCEPTOR, useClass: SignInNote }, MailService, RevalidateService, RateLimitStore, CacheService, PrivateStorage],
  exports: [PrismaService, DatabaseService, AccessService, ActivityLogService, AlertService, AccessLogService, MailService, RevalidateService, RateLimitStore, CacheService, PrivateStorage],
})
export class CoreModule implements NestModule {
  constructor(private readonly accessLog: AccessLogService) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(this.accessLog.middleware).forRoutes({ path: '{*path}', method: RequestMethod.ALL });
  }
}
