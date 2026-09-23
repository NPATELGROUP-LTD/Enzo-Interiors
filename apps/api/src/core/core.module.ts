import { Global, Module } from '@nestjs/common';

import { AccessService } from '../common/access/access.service';
import { DatabaseService } from '../data/database.service';
import { PrismaService } from '../data/prisma.service';
import { ActivityLogService } from './activity-log.service';
import { HealthController } from './health.controller';
import { MailService } from './mail.service';
import { RevalidateService } from './revalidate.service';

/**
 * The services every feature module needs: the database connection,
 * persistence, row-level scoping, the audit trail, outgoing email and the
 * public site's cache.
 *
 * Global because the alternative is importing this module into all eighteen
 * feature modules, which is noise rather than encapsulation — these are
 * infrastructure, not domain collaborators.
 */
@Global()
@Module({
  controllers: [HealthController],
  providers: [PrismaService, DatabaseService, AccessService, ActivityLogService, MailService, RevalidateService],
  exports: [PrismaService, DatabaseService, AccessService, ActivityLogService, MailService, RevalidateService],
})
export class CoreModule {}
