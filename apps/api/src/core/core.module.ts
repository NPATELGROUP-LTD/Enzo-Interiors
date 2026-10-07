import { Global, Module } from '@nestjs/common';

import { AccessService } from '../common/access/access.service';
import { DatabaseService } from '../data/database.service';
import { PrismaService } from '../data/prisma.service';
import { ActivityLogService } from './activity-log.service';
import { CacheService } from './cache';
import { HealthController } from './health.controller';
import { MailService } from './mail.service';
import { RateLimitStore } from './rate-limit';
import { RevalidateService } from './revalidate.service';

/**
 * The services every feature module needs: the database connection,
 * persistence, row-level scoping, the audit trail, outgoing email, the
 * public site's cache, the rate-limit counters and a small shared cache.
 *
 * Global because the alternative is importing this module into all eighteen
 * feature modules, which is noise rather than encapsulation — these are
 * infrastructure, not domain collaborators.
 */
@Global()
@Module({
  controllers: [HealthController],
  providers: [PrismaService, DatabaseService, AccessService, ActivityLogService, MailService, RevalidateService, RateLimitStore, CacheService],
  exports: [PrismaService, DatabaseService, AccessService, ActivityLogService, MailService, RevalidateService, RateLimitStore, CacheService],
})
export class CoreModule {}
