import { Prisma } from '@prisma/client';

import { BaseRecord } from '../common/types/domain';
import { FieldTypes, PrismaRepository } from './prisma-repository';
import { PrismaService } from './prisma.service';

/* Inventory (modules/inventory). Types live here, not in domain.ts, so the whole feature is these two files. */

export const ITEM_TYPES = ['Sheet', 'Hardware', 'Bought-in'] as const;

export interface InventorySupplier extends BaseRecord {
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  lead_days: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryItem extends BaseRecord {
  sku: string;
  name: string;
  type: (typeof ITEM_TYPES)[number];
  category: string | null;
  unit: string;
  size_note: string | null;
  supplier_id: string | null;
  on_hand: number;
  avg_cost: number;
  reorder_level: number | null;
  low_notified: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StockMovement extends BaseRecord {
  item_id: string;
  kind: 'receive' | 'issue' | 'adjust';
  quantity: number;
  unit_cost: number;
  reason: string | null;
  by_id: string | null;
  by_name: string;
  created_at: string;
}

const STAMPS: FieldTypes = { dates: ['created_at', 'updated_at'] };

export class InventoryStore {
  readonly suppliers: PrismaRepository<InventorySupplier>;
  readonly items: PrismaRepository<InventoryItem>;
  readonly movements: PrismaRepository<StockMovement>;

  constructor(private readonly prisma: PrismaService) {
    this.suppliers = new PrismaRepository(prisma.inventorySupplier, 'inventory_suppliers', STAMPS);
    this.items = new PrismaRepository(prisma.inventoryItem, 'inventory_items', { ...STAMPS, decimals: ['avg_cost'] });
    this.movements = new PrismaRepository(prisma.stockMovement, 'stock_movements', { dates: ['created_at'], decimals: ['unit_cost'] });
  }

  /**
   * One ledger row and the item's count in one transaction. Each UPDATE is a single statement that
   * reads the row's current values, so two bookings at once cannot lose a count or take stock below 0.
   * A receipt (quantity > 0 with a cost) re-averages the cost in SQL decimals; anything else books at
   * the average as it stands. Null = no active item with that id, 'short' = not that many in stock.
   */
  async book(
    move: Pick<StockMovement, 'item_id' | 'kind' | 'quantity' | 'reason' | 'by_id' | 'by_name'> & { unit_cost: string | null },
  ): Promise<InventoryItem | 'short' | null> {
    return this.prisma.$transaction(async (tx) => {
      const { item_id: id, quantity: q, unit_cost: cost } = move;
      const changed = cost !== null
        ? await tx.$executeRaw`UPDATE inventory_items SET avg_cost = ROUND((on_hand * avg_cost + ${q}::int * ${cost}::numeric) / (on_hand + ${q}::int), 2),
            on_hand = on_hand + ${q}::int, updated_at = now() WHERE id = ${id} AND active`
        : await tx.$executeRaw`UPDATE inventory_items SET on_hand = on_hand + ${q}::int, updated_at = now()
            WHERE id = ${id} AND active AND on_hand + ${q}::int >= 0`;
      const row = await tx.inventoryItem.findUnique({ where: { id } });
      if (!changed) return row?.active ? 'short' : null;
      await tx.stockMovement.create({
        data: { ...move, id: crypto.randomUUID(), unit_cost: new Prisma.Decimal(cost ?? row!.avg_cost) },
      });
      return { ...row!, avg_cost: row!.avg_cost.toNumber(), created_at: row!.created_at.toISOString(), updated_at: row!.updated_at.toISOString() } as InventoryItem;
    });
  }
}
