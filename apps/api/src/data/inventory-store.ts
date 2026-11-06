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
  kind: 'receive' | 'issue' | 'return' | 'adjust';
  quantity: number;
  unit_cost: number;
  reason: string | null;
  by_id: string | null;
  by_name: string;
  project_id: string | null;
  created_at: string;
}

export interface ProjectMaterial extends BaseRecord {
  project_id: string;
  item_id: string;
  needed: number;
  reserved: number;
  issued: number;
  created_at: string;
  updated_at: string;
}

/** Why a booking was refused: no such (active) item or line, or not that many to take. */
export type Refusal = 'missing' | 'short';

type Tx = Prisma.TransactionClient;
type Move = Pick<StockMovement, 'item_id' | 'kind' | 'quantity' | 'reason' | 'by_id' | 'by_name'> & {
  unit_cost: string | null;
  project_id: string | null;
};

const STAMPS: FieldTypes = { dates: ['created_at', 'updated_at'] };

export class InventoryStore {
  readonly suppliers: PrismaRepository<InventorySupplier>;
  readonly items: PrismaRepository<InventoryItem>;
  readonly movements: PrismaRepository<StockMovement>;
  readonly materials: PrismaRepository<ProjectMaterial>;

  constructor(private readonly prisma: PrismaService) {
    this.suppliers = new PrismaRepository(prisma.inventorySupplier, 'inventory_suppliers', STAMPS);
    this.items = new PrismaRepository(prisma.inventoryItem, 'inventory_items', { ...STAMPS, decimals: ['avg_cost'] });
    this.movements = new PrismaRepository(prisma.stockMovement, 'stock_movements', { dates: ['created_at'], decimals: ['unit_cost'] });
    this.materials = new PrismaRepository(prisma.projectMaterial, 'project_materials', STAMPS);
  }

  /** Units held for projects, per item. */
  async reservedByItem(): Promise<Map<string, number>> {
    const rows = await this.prisma.projectMaterial.groupBy({ by: ['item_id'], _sum: { reserved: true }, where: { reserved: { gt: 0 } } });
    return new Map(rows.map((row) => [row.item_id, row._sum.reserved ?? 0]));
  }

  /** Net cost of what each item's issues (less returns) to this project came to, at the cost booked each time. */
  async projectCost(projectId: string): Promise<Map<string, number>> {
    const rows = await this.prisma.$queryRaw<{ item_id: string; cost: Prisma.Decimal }[]>`
      SELECT item_id, SUM(-quantity * unit_cost) AS cost FROM stock_movements
      WHERE project_id = ${projectId} AND kind IN ('issue', 'return') GROUP BY item_id`;
    return new Map(rows.map((row) => [row.item_id, Number(row.cost)]));
  }

  /**
   * The item row, locked until the transaction ends, with what projects hold of it. Every change to a
   * count or a reservation takes this lock first, so bookings of one item queue rather than race.
   */
  private async lock(tx: Tx, itemId: string) {
    const [row] = await tx.$queryRaw<{ on_hand: number; active: boolean }[]>`
      SELECT on_hand, active FROM inventory_items WHERE id = ${itemId} FOR UPDATE`;
    if (!row?.active) return null;
    const held = await tx.projectMaterial.aggregate({ where: { item_id: itemId }, _sum: { reserved: true } });
    return { onHand: row.on_hand, free: row.on_hand - (held._sum.reserved ?? 0) };
  }

  private line(tx: Tx, projectId: string, itemId: string) {
    return tx.projectMaterial.findUnique({ where: { project_id_item_id: { project_id: projectId, item_id: itemId } } });
  }

  /**
   * One ledger row and the item's count in one transaction. Stock reserved for projects is not free:
   * anything leaving without a project must leave it covered. A project issue uses that project's
   * reservation first, then free stock; a return gives back at most what was issued. A receipt
   * re-averages the cost in SQL decimals; anything else books at the average as it stands.
   */
  book(move: Move): Promise<InventoryItem | Refusal> {
    return this.prisma.$transaction(async (tx) => {
      const { item_id: id, quantity: q, project_id: projectId } = move;
      const stock = await this.lock(tx, id);
      if (!stock) return 'missing';
      if (projectId) {
        const line = await this.line(tx, projectId, id);
        if (!line) return 'missing';
        if (move.kind === 'issue') {
          const fromReserved = Math.min(-q, line.reserved);
          if (-q - fromReserved > stock.free) return 'short';
          await tx.projectMaterial.update({ where: { id: line.id }, data: { reserved: { decrement: fromReserved }, issued: { increment: -q }, updated_at: new Date() } });
        } else {
          if (q > line.issued) return 'short';
          await tx.projectMaterial.update({ where: { id: line.id }, data: { issued: { decrement: q }, updated_at: new Date() } });
        }
      } else if (q < 0 && -q > stock.free) {
        return 'short';
      }
      const cost = move.unit_cost;
      if (cost !== null) {
        await tx.$executeRaw`UPDATE inventory_items SET avg_cost = ROUND((on_hand * avg_cost + ${q}::int * ${cost}::numeric) / (on_hand + ${q}::int), 2),
            on_hand = on_hand + ${q}::int, updated_at = now() WHERE id = ${id}`;
      } else {
        await tx.$executeRaw`UPDATE inventory_items SET on_hand = on_hand + ${q}::int, updated_at = now() WHERE id = ${id}`;
      }
      const row = (await tx.inventoryItem.findUnique({ where: { id } }))!;
      await tx.stockMovement.create({ data: { ...move, id: crypto.randomUUID(), unit_cost: new Prisma.Decimal(cost ?? row.avg_cost) } });
      return { ...row, avg_cost: row.avg_cost.toNumber(), created_at: row.created_at.toISOString(), updated_at: row.updated_at.toISOString() } as InventoryItem;
    });
  }

  /**
   * Hold (delta > 0) or let go of (delta < 0) units for a project. A hold never exceeds free stock
   * or what the line still needs; with `upTo` it takes as much of delta as it can instead of refusing.
   * Answers how many it moved.
   */
  reserve(projectId: string, itemId: string, delta: number, upTo = false): Promise<number | Refusal> {
    return this.prisma.$transaction(async (tx) => {
      const stock = await this.lock(tx, itemId);
      const line = stock && (await this.line(tx, projectId, itemId));
      if (!line) return 'missing';
      const most = delta > 0 ? Math.min(stock!.free, line.needed - line.issued - line.reserved) : line.reserved;
      const n = Math.min(Math.abs(delta), Math.max(most, 0));
      if (n < Math.abs(delta) && !upTo) return 'short';
      if (n) await tx.projectMaterial.update({ where: { id: line.id }, data: { reserved: { increment: Math.sign(delta) * n }, updated_at: new Date() } });
      return n;
    });
  }

  /** Set how many a project needs (adding the line). A hold above what is still needed shrinks to fit. */
  async setNeeded(projectId: string, itemId: string, needed: number): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO project_materials (id, project_id, item_id, needed) VALUES (${crypto.randomUUID()}, ${projectId}, ${itemId}, ${needed})
      ON CONFLICT (project_id, item_id) DO UPDATE SET needed = EXCLUDED.needed, updated_at = now(),
        reserved = LEAST(project_materials.reserved, GREATEST(EXCLUDED.needed - project_materials.issued, 0))`;
  }

  /** A line with nothing issued goes, and its hold with it. False = none, or it has history. */
  async removeLine(projectId: string, itemId: string): Promise<boolean> {
    return (await this.prisma.projectMaterial.deleteMany({ where: { project_id: projectId, item_id: itemId, issued: 0 } })).count > 0;
  }

  async releaseAll(projectId: string): Promise<void> {
    await this.prisma.projectMaterial.updateMany({ where: { project_id: projectId, reserved: { gt: 0 } }, data: { reserved: 0, updated_at: new Date() } });
  }

  async reserveOnStage(): Promise<string | null> {
    return (await this.prisma.inventorySetting.findUnique({ where: { id: 'inventory' } }))?.reserve_on_stage ?? null;
  }

  async setReserveOnStage(stage: string | null): Promise<void> {
    const data = { reserve_on_stage: stage, updated_at: new Date() };
    await this.prisma.inventorySetting.upsert({ where: { id: 'inventory' }, create: { id: 'inventory', ...data }, update: data });
  }
}
