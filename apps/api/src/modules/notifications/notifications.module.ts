import { Body, Controller, Get, HttpCode, Injectable, Module, Post } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsOptional, IsString } from 'class-validator';

import { CurrentUser } from '../../common/decorators';
import { Notification } from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { DatabaseService } from '../../data/database.service';

export class MarkReadDto {
  /** Omit to mark every notification read. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  ids?: string[];
}

type NewNotification = Pick<Notification, 'kind' | 'title'> & Partial<Pick<Notification, 'body' | 'link'>>;

/** The bell in the admin's menu bar: new bookings, review requests, replies. */
@Injectable()
export class NotificationsService {
  constructor(private readonly db: DatabaseService) {}

  async notify(recipientId: string, note: NewNotification): Promise<void> {
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
  async notifyAdmins(note: NewNotification, exceptId?: string): Promise<void> {
    const admins = await this.db.staffUsers.findAll((row) => row.role === 'Admin' && row.id !== exceptId);
    for (const admin of admins) await this.notify(admin.id, note);
  }

  /**
   * The latest 50 and how many are unread.
   *
   * ponytail: findAll + filter in memory like every repository here. Fine for
   * a handful of staff; give it a WHERE recipient_id query and a cleanup job
   * if the table ever reaches the tens of thousands.
   */
  async mine(principal: AuthPrincipal): Promise<{ items: Notification[]; unread: number }> {
    const rows = (await this.db.notifications.findAll((row) => row.recipient_id === principal.id)).sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    );
    return { items: rows.slice(0, 50), unread: rows.filter((row) => !row.read_at).length };
  }

  async markRead(principal: AuthPrincipal, ids?: string[]): Promise<void> {
    const wanted = ids ? new Set(ids) : null;
    const now = new Date().toISOString();
    const rows = await this.db.notifications.findAll(
      (row) => row.recipient_id === principal.id && !row.read_at && (!wanted || wanted.has(row.id)),
    );
    for (const row of rows) await this.db.notifications.update(row.id, { read_at: now });
  }
}

@Controller('notifications')
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
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
