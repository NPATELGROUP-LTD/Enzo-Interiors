import { Injectable, Logger } from '@nestjs/common';

import { ActivityLog } from '../common/types/domain';
import { AuthPrincipal } from '../common/types/principal';
import { DatabaseService } from '../data/database.service';
import { AlertService } from './alert.service';

/**
 * Actions that also email a security alert, with what to say. Account and
 * access changes, and the deletes that cannot be undone. Names of clients and
 * staff stay out of the sentence: it names only who did it.
 */
const SECURITY_ACTIONS: Record<string, string> = {
  staff_invite: 'A staff account was invited',
  staff_role_change: 'A staff role was changed',
  staff_delete: 'A staff account was removed',
  staff_reset_2fa: 'Two-step sign-in was reset for a staff account',
  staff_removal_requested: 'Removal of an Admin was requested',
  client_delete: 'A client was deleted',
  project_delete: 'A project was deleted',
  invoice_delete: 'An invoice was deleted',
};

export interface RecordActivityInput {
  principal: AuthPrincipal;
  /** Verb-ish, snake_case, stable. e.g. 'client_create', 'invoice_mark_paid'. */
  action: string;
  /** The table the change landed in, matching the schema doc's table name. */
  targetTable: string;
  targetId: string;
  /** Anything a human auditing this later would need. Keep it small. */
  details?: Record<string, unknown> | null;
}

/**
 * Writes the audit trail.
 *
 * Every mutating endpoint appends one of these — it is step 4 of the required
 * write sequence (validate, enforce RBAC, mutate, log, return the resource),
 * and the Settings "security audit log" screen reads it back.
 *
 * A failure to log must never fail the business operation that succeeded: the
 * write has already hit disk, and throwing here would report failure for work
 * that actually happened. Logging failures are surfaced to the server log
 * instead.
 */
@Injectable()
export class ActivityLogService {
  private readonly logger = new Logger(ActivityLogService.name);

  constructor(
    private readonly db: DatabaseService,
    // ponytail: optional so the one-off scripts (make-infra, reset-2fa) can log without mail; Nest still injects it.
    private readonly alerts?: AlertService,
  ) {}

  async record(input: RecordActivityInput): Promise<void> {
    try {
      await this.db.activityLogs.create({
        staff_id: input.principal.id,
        actor_type: input.principal.kind,
        actor_name: input.principal.name,
        action: input.action,
        target_table: input.targetTable,
        target_id: input.targetId,
        details: input.details ?? null,
        created_at: new Date().toISOString(),
      });
      const what = SECURITY_ACTIONS[input.action];
      if (what) this.alerts?.report({ kind: 'security', source: 'api', title: `${what} by ${input.principal.name}. See Settings › Security.` });
    } catch (error) {
      this.logger.error(
        `Failed to write activity log for ${input.action} on ${input.targetTable}/${input.targetId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /** Newest first. */
  async list(limit = 200): Promise<ActivityLog[]> {
    // Ordered and cut in PostgreSQL (created_at is indexed): the table only grows.
    return this.db.activityLogs.findWhere({}, { orderBy: { created_at: 'desc' }, take: limit });
  }

  /** The audit trail for one record, newest first. Powers the detail-view tabs. */
  async listForTarget(targetTable: string, targetId: string): Promise<ActivityLog[]> {
    return this.db.activityLogs.findWhere(
      { target_table: targetTable, target_id: targetId },
      { orderBy: { created_at: 'desc' } },
    );
  }
}
