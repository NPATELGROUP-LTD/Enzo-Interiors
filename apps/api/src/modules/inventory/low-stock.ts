import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../data/database.service';
import { NotificationsService } from '../notifications/notifications.module';

/**
 * When an item's free stock (on hand less what projects hold) is at or under its reorder level,
 * the Admins are told once, until it is back above it. Call after anything that moves either number.
 */
@Injectable()
export class LowStockWatch {
  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationsService,
  ) {}

  async check(itemId: string): Promise<void> {
    const store = this.db.inventory;
    const item = await store.items.findById(itemId);
    if (!item) return;
    const free = item.on_hand - ((await store.reservedByItem()).get(itemId) ?? 0);
    const low = item.reorder_level !== null && free <= item.reorder_level;
    if (low === item.low_notified) return;
    // Claimed by one conditional UPDATE, so two bookings at once ring once.
    if (!(await store.items.updateWhere({ id: itemId, low_notified: !low }, { low_notified: low }))) return;
    if (low) {
      await this.notifications.notifyAdminsByEmail({
        kind: 'stock',
        title: `Low stock: ${item.name}`,
        body: `${free} ${item.unit} free (reorder at ${item.reorder_level}).`,
        link: '/inventory?view=low',
      });
    }
  }
}
