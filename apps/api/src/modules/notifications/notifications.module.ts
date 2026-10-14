import { Body, Controller, Get, HttpCode, Injectable, Module, Post } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsOptional, IsString } from 'class-validator';

import { CurrentUser, Roles } from '../../common/decorators';
import { Notification, STAFF_ROLES } from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { DatabaseService } from '../../data/database.service';
import { PushController, PushService } from './push';

export class MarkReadDto {
  /** Omit to mark every notification read. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  ids?: string[];
}

type NewNotification = Pick<Notification, 'kind' | 'title'> & Partial<Pick<Notification, 'body' | 'link'>>;

/**
 * The bell in the admin's and the portal's menu bars: new bookings, review
 * requests, replies, projects, messages, invoices, files. Each one is also a
 * Web Push to the recipient's devices (push.ts), so every caller gets both.
 *
 * Staff and clients share this table, keyed on recipient_id alone. Their ids
 * cannot collide: both tables take randomUUID() on create (PrismaRepository),
 * and the only fixed ids are seed data in separate namespaces (stf_*, cli_*).
 * Anything that ever writes a fixed id into staff_users or clients must keep
 * them apart, or add a recipient type here.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly push: PushService,
  ) {}

  /** A staff member's bell (and their devices, unless `push` is false: the caller pushes itself). */
  async notify(recipientId: string, note: NewNotification, push = true): Promise<void> {
    await this.store(recipientId, note);
    if (push) this.push.send('staff', recipientId, note);
  }

  /**
   * A portal client's bell, unless they turned in-app notifications off in
   * Settings. Their devices still get the push: that is its own switch, per device.
   */
  async notifyClient(clientId: string, note: NewNotification, push = true): Promise<void> {
    const prefs = await this.db.notificationPreferences.findFirstWhere({ owner_id: clientId, owner_type: 'Client' });
    if (prefs?.in_app_enabled !== false) await this.store(clientId, note);
    if (push) this.push.send('client', clientId, note);
  }

  private async store(recipientId: string, note: NewNotification): Promise<void> {
    await this.db.notifications.create({
      recipient_id: recipientId,
      kind: note.kind,
      title: note.title,
      body: note.body ?? null,
      link: note.link ?? null,
      read_at: null,
      created_at: new Date().toISOString(),
    });
  }

  /** Every Admin, except whoever caused it. */
  async notifyAdmins(note: NewNotification, exceptId?: string, push = true): Promise<void> {
    const admins = await this.db.staffUsers.findAll((row) => row.role === 'Admin' && row.id !== exceptId);
    for (const admin of admins) await this.notify(admin.id, note, push);
  }

  /**
   * The latest 50 and how many are unread. The bell polls this every minute
   * from every open admin and portal, so both are answered by an index
   * (recipient_id, created_at) and (recipient_id, read_at), not a table read.
   */
  async mine(principal: AuthPrincipal): Promise<{ items: Notification[]; unread: number }> {
    const [items, unread] = await Promise.all([
      this.db.notifications.findWhere({ recipient_id: principal.id }, { orderBy: { created_at: 'desc' }, take: 50 }),
      this.db.notifications.countWhere({ recipient_id: principal.id, read_at: null }),
    ]);
    return { items, unread };
  }

  async markRead(principal: AuthPrincipal, ids?: string[]): Promise<void> {
    await this.db.notifications.updateWhere(
      { recipient_id: principal.id, read_at: null, ...(ids ? { id: { in: ids } } : {}) },
      { read_at: new Date().toISOString() },
    );
  }
}

/** Staff and portal clients alike; each only ever reads and marks their own (recipient_id = caller). */
@Controller('notifications')
@Roles(...STAFF_ROLES, 'Client')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  mine(@CurrentUser() principal: AuthPrincipal) {
    return this.notifications.mine(principal);
  }

  @Post('read')
  @HttpCode(204)
  async read(@CurrentUser() principal: AuthPrincipal, @Body() dto: MarkReadDto) {
    await this.notifications.markRead(principal, dto.ids);
  }
}

@Module({
  controllers: [NotificationsController, PushController],
  providers: [NotificationsService, PushService],
  exports: [NotificationsService, PushService],
})
export class NotificationsModule {}
