import { Global, Module } from '@nestjs/common';

import { AccessService } from '../common/access/access.service';
import { DatabaseService } from '../data/database.service';
import { ActivityLogService } from './activity-log.service';

/**
 * The three services every feature module needs: persistence, row-level
 * scoping, and the audit trail.
 *
 * Global because the alternative is importing this module into all eighteen
 * feature modules, which is noise rather than encapsulation — these are
 * infrastructure, not domain collaborators.
 */
@Global()
@Module({
  providers: [DatabaseService, AccessService, ActivityLogService],
  exports: [DatabaseService, AccessService, ActivityLogService],
})
export class CoreModule {}
