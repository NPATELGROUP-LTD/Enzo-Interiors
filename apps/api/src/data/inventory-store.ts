import { Prisma } from '@prisma/client';

import { BaseRecord } from '../common/types/domain';
import { FieldTypes, PrismaRepository } from './prisma-repository';
import { PrismaService } from './prisma.service';

/* Inventory (modules/inventory). Types live here, not in domain.ts, so the whole feature is these two files. */

export const ITEM_TYPES = ['Sheet', 'Hardware', 'Bought-in'] as const;
export const BOARD_ROLES = ['carcass', 'front', 'worktop', 'back'] as const;

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
  length_mm: number | null;
  width_mm: number | null;
  thickness_mm: number | null;
  grain: boolean;
  board_role: (typeof BOARD_ROLES)[number] | null;
  swatch: string | null;
  image_id: string | null;
  specs: Array<{ label: string; value: string }>;
  show_on_site: boolean;
  public_name: string | null;
  /** Admin only: what the quote maker prices this at; null = avg_cost. */
  quote_cost: number | null;
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
  po_id: string | null;
  created_at: string;
}

export const ORDER_STATUSES = ['Draft', 'Sent', 'Part-received', 'Received', 'Cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface PurchaseOrder extends BaseRecord {
  ref_no: number;
  supplier_id: string;
  status: OrderStatus;
  vat_rate: number;
  expected_at: string | null;
  notes: string | null;
  sent_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderItem extends BaseRecord {
  po_id: string;
  item_id: string;
  quantity: number;
  received: number;
  unit_cost: number;
  position: number;
}

/** What an item should be bought for: open project needs, free stock, what is on order, its reorder level. */
export interface ShortfallRow {
  id: string;
  sku: string;
  name: string;
  unit: string;
  supplier_id: string | null;
  avg_cost: number;
  on_hand: number;
  reorder_level: number | null;
  held: number;
  wanted: number;
  on_order: number;
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
type Move = Pick<
  StockMovement,
  'item_id' | 'kind' | 'quantity' | 'reason' | 'by_id' | 'by_name'
> & {
  unit_cost: string | null;
  project_id: string | null;
  po_id?: string | null;
};

/** Thrown inside a transaction to roll it back with a refusal. */
export class Refused extends Error {
  constructor(readonly refusal: Refusal | 'state') {
    super(refusal);
  }
}

const STAMPS: FieldTypes = { dates: ['created_at', 'updated_at'] };

export class InventoryStore {
  readonly suppliers: PrismaRepository<InventorySupplier>;
  readonly items: PrismaRepository<InventoryItem>;
  readonly movements: PrismaRepository<StockMovement>;
  readonly materials: PrismaRepository<ProjectMaterial>;
  readonly orders: PrismaRepository<PurchaseOrder>;
  readonly orderLines: PrismaRepository<PurchaseOrderItem>;

  constructor(private readonly prisma: PrismaService) {
    this.suppliers = new PrismaRepository(prisma.inventorySupplier, 'inventory_suppliers', STAMPS);
    this.items = new PrismaRepository(prisma.inventoryItem, 'inventory_items', {
      ...STAMPS,
      decimals: ['avg_cost', 'quote_cost'],
    });
    this.movements = new PrismaRepository(prisma.stockMovement, 'stock_movements', {
      dates: ['created_at'],
      decimals: ['unit_cost'],
    });
    this.materials = new PrismaRepository(prisma.projectMaterial, 'project_materials', STAMPS);
    this.orders = new PrismaRepository(prisma.purchaseOrder, 'purchase_orders', {
      dates: ['created_at', 'updated_at', 'expected_at', 'sent_at'],
      decimals: ['vat_rate'],
    });
    this.orderLines = new PrismaRepository(prisma.purchaseOrderItem, 'purchase_order_items', {
      decimals: ['unit_cost'],
    });
  }

  /** Units ordered and not yet in, per item, on orders that have gone to the supplier. */
  async onOrderByItem(): Promise<Map<string, number>> {
    const rows = await this.prisma.$queryRaw<{ item_id: string; n: bigint }[]>`
      SELECT l.item_id, SUM(l.quantity - l.received) AS n FROM purchase_order_items l
      JOIN purchase_orders o ON o.id = l.po_id WHERE o.status IN ('Sent', 'Part-received') GROUP BY l.item_id`;
    return new Map(rows.map((row) => [row.item_id, Number(row.n)]));
  }

  async shortfall(): Promise<ShortfallRow[]> {
    type Raw = Omit<ShortfallRow, 'held' | 'wanted' | 'on_order' | 'avg_cost'> &
      Record<'held' | 'wanted' | 'on_order', bigint> & { avg_cost: Prisma.Decimal };
    const rows = await this.prisma.$queryRaw<Raw[]>`
      SELECT i.id, i.sku, i.name, i.unit, i.supplier_id, i.avg_cost, i.on_hand, i.reorder_level,
        COALESCE(m.held, 0) AS held, COALESCE(m.wanted, 0) AS wanted, COALESCE(o.n, 0) AS on_order
      FROM inventory_items i
      LEFT JOIN (SELECT item_id, SUM(reserved) AS held, SUM(GREATEST(needed - issued - reserved, 0)) AS wanted
                 FROM project_materials GROUP BY item_id) m ON m.item_id = i.id
      LEFT JOIN (SELECT l.item_id, SUM(l.quantity - l.received) AS n FROM purchase_order_items l
                 JOIN purchase_orders p ON p.id = l.po_id WHERE p.status IN ('Sent', 'Part-received') GROUP BY l.item_id) o ON o.item_id = i.id
      WHERE i.active ORDER BY i.name`;
    return rows.map((r) => ({
      ...r,
      avg_cost: Number(r.avg_cost),
      held: Number(r.held),
      wanted: Number(r.wanted),
      on_order: Number(r.on_order),
    }));
  }

  /** Every receipt of an item, newest first, with the supplier of its order when it came on one. */
  async priceHistory(itemId: string) {
    const rows = await this.prisma.stockMovement.findMany({
      where: { item_id: itemId, kind: 'receive' },
      orderBy: { created_at: 'desc' },
      take: 50,
      select: {
        quantity: true,
        unit_cost: true,
        created_at: true,
        order: { select: { ref_no: true, supplier: { select: { name: true } } } },
      },
    });
    return rows.map((r) => ({
      quantity: r.quantity,
      unit_cost: r.unit_cost.toNumber(),
      created_at: r.created_at.toISOString(),
      po_ref: r.order?.ref_no ?? null,
      supplier_name: r.order?.supplier.name ?? null,
    }));
  }

  /** The cost side (cost price x quantity) of a project's accepted quotes: what its work was priced at cost. */
  async quotedCost(projectId: string): Promise<number | null> {
    const [row] = await this.prisma.$queryRaw<{ cost: Prisma.Decimal | null }[]>`
      SELECT SUM(ROUND(i.quantity * i.cost_price, 2)) AS cost FROM project_quote_items i
      JOIN project_quotes q ON q.id = i.quote_id
      WHERE q.project_id = ${projectId} AND q.status = 'Accepted' AND i.cost_price IS NOT NULL`;
    return row?.cost == null ? null : row.cost.toNumber();
  }

  /** A new Draft with its lines, in one go. Answers its id. */
  async createDraft(
    order: Omit<Prisma.PurchaseOrderUncheckedCreateInput, 'id'>,
    lines: Omit<PurchaseOrderItem, 'id' | 'po_id' | 'received'>[],
  ): Promise<string> {
    const id = crypto.randomUUID();
    await this.prisma.purchaseOrder.create({
      data: {
        ...order,
        id,
        items: { create: lines.map((l) => ({ ...l, id: crypto.randomUUID() })) },
      },
    });
    return id;
  }

  /** A Draft's fields and lines replaced in one go. False = not a Draft (any more). */
  replaceDraft(
    id: string,
    patch: Prisma.PurchaseOrderUpdateManyMutationInput,
    lines: Omit<PurchaseOrderItem, 'id' | 'po_id' | 'received'>[],
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.purchaseOrder.updateMany({
        where: { id, status: 'Draft' },
        data: { ...patch, updated_at: new Date() },
      });
      if (!count) return false;
      await tx.purchaseOrderItem.deleteMany({ where: { po_id: id } });
      await tx.purchaseOrderItem.createMany({
        data: lines.map((l) => ({ ...l, id: crypto.randomUUID(), po_id: id })),
      });
      return true;
    });
  }

  /**
   * Book in what arrived against an order's lines, all or nothing: a line's received count never
   * passes what was ordered (conditional UPDATE + CHECK), each is a receipt at the line's cost, and
   * the order becomes Part-received or Received. Answers the items touched.
   */
  receive(
    poId: string,
    lines: { line_id: string; quantity: number }[],
    by: { id: string; name: string },
  ): Promise<string[]> {
    return this.prisma.$transaction(async (tx) => {
      const [order] = await tx.$queryRaw<
        { status: string }[]
      >`SELECT status FROM purchase_orders WHERE id = ${poId} FOR UPDATE`;
      if (!order) throw new Refused('missing');
      if (order.status !== 'Sent' && order.status !== 'Part-received') throw new Refused('state');
      const touched: string[] = [];
      for (const { line_id, quantity } of lines) {
        const [line] = await tx.$queryRaw<{ item_id: string; unit_cost: Prisma.Decimal }[]>`
          UPDATE purchase_order_items SET received = received + ${quantity}::int
          WHERE id = ${line_id} AND po_id = ${poId} AND received + ${quantity}::int <= quantity
          RETURNING item_id, unit_cost`;
        if (!line) throw new Refused('short');
        const booked = await this.bookIn(tx, {
          item_id: line.item_id,
          kind: 'receive',
          quantity,
          unit_cost: line.unit_cost.toFixed(2),
          reason: null,
          by_id: by.id,
          by_name: by.name,
          project_id: null,
          po_id: poId,
        });
        if (typeof booked === 'string') throw new Refused(booked);
        touched.push(line.item_id);
      }
      const sum = await tx.purchaseOrderItem.aggregate({
        where: { po_id: poId },
        _sum: { quantity: true, received: true },
      });
      const done = (sum._sum.quantity ?? 0) === (sum._sum.received ?? 0);
      await tx.purchaseOrder.update({
        where: { id: poId },
        data: { status: done ? 'Received' : 'Part-received', updated_at: new Date() },
      });
      return touched;
    });
  }

  /** Units held for projects, per item. */
  async reservedByItem(): Promise<Map<string, number>> {
    const rows = await this.prisma.projectMaterial.groupBy({
      by: ['item_id'],
      _sum: { reserved: true },
      where: { reserved: { gt: 0 } },
    });
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
    const held = await tx.projectMaterial.aggregate({
      where: { item_id: itemId },
      _sum: { reserved: true },
    });
    return { onHand: row.on_hand, free: row.on_hand - (held._sum.reserved ?? 0) };
  }

  private line(tx: Tx, projectId: string, itemId: string) {
    return tx.projectMaterial.findUnique({
      where: { project_id_item_id: { project_id: projectId, item_id: itemId } },
    });
  }

  /**
   * One ledger row and the item's count in one transaction. Stock reserved for projects is not free:
   * anything leaving without a project must leave it covered. A project issue uses that project's
   * reservation first, then free stock; a return gives back at most what was issued. A receipt
   * re-averages the cost in SQL decimals; anything else books at the average as it stands.
   */
  book(move: Move): Promise<InventoryItem | Refusal> {
    return this.prisma.$transaction((tx) => this.bookIn(tx, move));
  }

  private async bookIn(tx: Tx, move: Move): Promise<InventoryItem | Refusal> {
    {
      const { item_id: id, quantity: q, project_id: projectId } = move;
      const stock = await this.lock(tx, id);
      if (!stock) return 'missing';
      if (projectId) {
        const line = await this.line(tx, projectId, id);
        if (!line) return 'missing';
        if (move.kind === 'issue') {
          const fromReserved = Math.min(-q, line.reserved);
          if (-q - fromReserved > stock.free) return 'short';
          await tx.projectMaterial.update({
            where: { id: line.id },
            data: {
              reserved: { decrement: fromReserved },
              issued: { increment: -q },
              updated_at: new Date(),
            },
          });
        } else {
          if (q > line.issued) return 'short';
          await tx.projectMaterial.update({
            where: { id: line.id },
            data: { issued: { decrement: q }, updated_at: new Date() },
          });
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
      await tx.stockMovement.create({
        data: {
          ...move,
          id: crypto.randomUUID(),
          unit_cost: new Prisma.Decimal(cost ?? row.avg_cost),
        },
      });
      return {
        ...row,
        avg_cost: row.avg_cost.toNumber(),
        created_at: row.created_at.toISOString(),
        updated_at: row.updated_at.toISOString(),
      } as InventoryItem;
    }
  }

  /**
   * Hold (delta > 0) or let go of (delta < 0) units for a project. A hold never exceeds free stock
   * or what the line still needs; with `upTo` it takes as much of delta as it can instead of refusing.
   * Answers how many it moved.
   */
  reserve(
    projectId: string,
    itemId: string,
    delta: number,
    upTo = false,
  ): Promise<number | Refusal> {
    return this.prisma.$transaction(async (tx) => {
      const stock = await this.lock(tx, itemId);
      const line = stock && (await this.line(tx, projectId, itemId));
      if (!line) return 'missing';
      const most =
        delta > 0
          ? Math.min(stock!.free, line.needed - line.issued - line.reserved)
          : line.reserved;
      const n = Math.min(Math.abs(delta), Math.max(most, 0));
      if (n < Math.abs(delta) && !upTo) return 'short';
      if (n)
        await tx.projectMaterial.update({
          where: { id: line.id },
          data: { reserved: { increment: Math.sign(delta) * n }, updated_at: new Date() },
        });
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
    return (
      (
        await this.prisma.projectMaterial.deleteMany({
          where: { project_id: projectId, item_id: itemId, issued: 0 },
        })
      ).count > 0
    );
  }

  async releaseAll(projectId: string): Promise<void> {
    await this.prisma.projectMaterial.updateMany({
      where: { project_id: projectId, reserved: { gt: 0 } },
      data: { reserved: 0, updated_at: new Date() },
    });
  }

  async reserveOnStage(): Promise<string | null> {
    return (
      (await this.prisma.inventorySetting.findUnique({ where: { id: 'inventory' } }))
        ?.reserve_on_stage ?? null
    );
  }

  async setReserveOnStage(stage: string | null): Promise<void> {
    const data = { reserve_on_stage: stage, updated_at: new Date() };
    await this.prisma.inventorySetting.upsert({
      where: { id: 'inventory' },
      create: { id: 'inventory', ...data },
      update: data,
    });
  }
}
