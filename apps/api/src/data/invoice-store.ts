import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { Invoice, InvoiceItem, InvoiceStage } from '../common/types/domain';
import { FieldTypes, PrismaRepository, Where } from './prisma-repository';
import { PrismaService } from './prisma.service';

export const INVOICE_FIELDS: FieldTypes = {
  dates: ['created_at', 'due_date', 'paid_at'],
  decimals: ['amount', 'vat_rate', 'discount'],
};
export const INVOICE_ITEM_FIELDS: FieldTypes = { dates: ['created_at'], decimals: ['quantity', 'unit_price'] };
export const INVOICE_STAGE_FIELDS: FieldTypes = { dates: ['paid_at'], decimals: ['value', 'amount'] };

export interface ItemInput {
  description: string;
  section: string | null;
  detail: string | null;
  quantity: number;
  unit_price: number;
}

export type StageInput = Omit<InvoiceStage, 'id' | 'invoice_id'>;

/** The statuses an invoice can be paid from. */
const PAYABLE = ['Sent', 'Outstanding', 'Overdue'];

/**
 * The invoice writes that must be all-or-nothing: an invoice with its lines and
 * stages, and recording payment. Everything else goes through the plain
 * repositories. Writes that read-then-write across the stages lock the invoice
 * row first, so two Admins paying the last two stages cannot both miss that the
 * other finished it.
 */
export class InvoiceStore {
  constructor(private readonly prisma: PrismaService) {}

  private repos(tx: Pick<PrismaService, 'invoice' | 'invoiceItem' | 'invoiceStage'>) {
    return {
      invoices: new PrismaRepository<Invoice>(tx.invoice, 'invoices', INVOICE_FIELDS),
      items: new PrismaRepository<InvoiceItem>(tx.invoiceItem, 'invoice_items', INVOICE_ITEM_FIELDS),
      stages: new PrismaRepository<InvoiceStage>(tx.invoiceStage, 'invoice_stages', INVOICE_STAGE_FIELDS),
    };
  }

  private rows(invoice_id: string, items: ItemInput[]): Array<Omit<InvoiceItem, 'id'>> {
    const created_at = new Date().toISOString();
    return items.map((item, position) => ({ ...item, invoice_id, position, created_at }));
  }

  private lock(tx: Prisma.TransactionClient, id: string) {
    return tx.$queryRaw`SELECT id FROM invoices WHERE id = ${id} FOR UPDATE`;
  }

  /** Replaces the stages; refused once any is paid (a payment may have been recorded since the caller looked). */
  private async setStages(tx: Prisma.TransactionClient, id: string, stages: StageInput[]): Promise<void> {
    const { stages: repo } = this.repos(tx);
    if ((await repo.countWhere({ invoice_id: id, paid_at: { not: null } })) > 0) {
      throw new ConflictException('A stage was marked paid while you were editing. Reload and try again.');
    }
    await repo.deleteWhere({ invoice_id: id });
    for (const stage of stages) await repo.create({ ...stage, invoice_id: id });
  }

  /** SUM(amount) over `where`, in PostgreSQL and exact (a Decimal, never a float). */
  async sum(where: Where<Invoice>): Promise<Prisma.Decimal> {
    const total = await this.prisma.invoice.aggregate({ where: where as Prisma.InvoiceWhereInput, _sum: { amount: true } });
    return total._sum.amount ?? new Prisma.Decimal(0);
  }

  /** Every project quote added up by status, in one query (the dashboard's "Total quoted"). */
  async quotedByStatus(): Promise<Map<string, Prisma.Decimal>> {
    const rows = await this.prisma.projectQuote.groupBy({ by: ['status'], _sum: { amount: true } });
    return new Map(rows.map((row) => [row.status, row._sum.amount ?? new Prisma.Decimal(0)]));
  }

  /** Net profit still to come: Sent + Accepted quotes, costed lines only (price - cost) x qty, less each quote's discount. */
  async potentialProfit(): Promise<Prisma.Decimal> {
    const [row] = await this.prisma.$queryRaw<Array<{ profit: Prisma.Decimal | null }>>`
      SELECT COALESCE(SUM(q.lines - q.discount), 0) AS profit FROM (
        SELECT pq.discount,
          COALESCE((SELECT SUM(i.quantity * (i.unit_price - i.cost_price)) FROM project_quote_items i
                    WHERE i.quote_id = pq.id AND i.cost_price IS NOT NULL), 0) AS lines
        FROM project_quotes pq WHERE pq.status IN ('Sent', 'Accepted')) q`;
    return new Prisma.Decimal(row?.profit ?? 0);
  }

  /**
   * Money actually received over `where` (an invoice filter) since `from`: every paid stage, plus
   * Paid invoices that have no stages. A part-paid invoice counts for what has been paid so far.
   */
  async received(where: Where<Invoice> = {}, from?: Date): Promise<Prisma.Decimal> {
    const paid_at = from ? { gte: from } : { not: null };
    const [staged, plain] = await Promise.all([
      this.prisma.invoiceStage.aggregate({
        where: { paid_at, invoice: where as Prisma.InvoiceWhereInput },
        _sum: { amount: true },
      }),
      this.prisma.invoice.aggregate({
        where: { ...(where as Prisma.InvoiceWhereInput), status: 'Paid', stages: { none: {} }, paid_at },
        _sum: { amount: true },
      }),
    ]);
    return new Prisma.Decimal(staged._sum.amount ?? 0).add(plain._sum.amount ?? 0);
  }

  /** The receipts behind `received` since `from`, one per paid stage or stage-less Paid invoice. */
  async receipts(from: Date): Promise<Array<{ paid_at: string; amount: number }>> {
    const [staged, plain] = await Promise.all([
      this.prisma.invoiceStage.findMany({ where: { paid_at: { gte: from } }, select: { paid_at: true, amount: true } }),
      this.prisma.invoice.findMany({
        where: { status: 'Paid', stages: { none: {} }, paid_at: { gte: from } },
        select: { paid_at: true, amount: true },
      }),
    ]);
    return [...staged, ...plain].map((r) => ({ paid_at: r.paid_at!.toISOString(), amount: Number(r.amount) }));
  }

  /** Per client, SUM(amount) of the invoices still to be paid: the client page's Outstanding, in one query. */
  async outstandingByClient(): Promise<Map<string, number>> {
    const rows = await this.prisma.invoice.groupBy({ by: ['client_id'], where: { status: { in: PAYABLE } }, _sum: { amount: true } });
    return new Map(rows.map((row) => [row.client_id, new Prisma.Decimal(row._sum.amount ?? 0).toNumber()]));
  }

  /** What is still owed over `where`: SUM(amount) less the stages already paid, exact. */
  async balance(where: Where<Invoice>): Promise<Prisma.Decimal> {
    const paid = await this.prisma.invoiceStage.aggregate({
      where: { paid_at: { not: null }, invoice: where as Prisma.InvoiceWhereInput },
      _sum: { amount: true },
    });
    return (await this.sum(where)).sub(paid._sum.amount ?? 0);
  }

  /** Throws a Prisma P2002 when the number is taken; the caller picks another. */
  async create(invoice: Omit<Invoice, 'id'>, items: ItemInput[], stages: StageInput[] = []): Promise<Invoice> {
    return this.prisma.$transaction(async (tx) => {
      const repos = this.repos(tx);
      const created = await repos.invoices.create(invoice);
      for (const row of this.rows(created.id, items)) await repos.items.create(row);
      if (stages.length > 0) await this.setStages(tx, created.id, stages);
      return created;
    });
  }

  /**
   * Null when the invoice is gone or already Paid. `items` / `stages` replace the lines / stages when given.
   * `paid` = the caller only touches the job/schedule fields, which a Paid invoice may still change.
   */
  async update(
    id: string,
    patch: Partial<Omit<Invoice, 'id'>>,
    items?: ItemInput[],
    paid = false,
    stages?: StageInput[],
  ): Promise<Invoice | null> {
    return this.prisma.$transaction(async (tx) => {
      const repos = this.repos(tx);
      await this.lock(tx, id);
      if (!(await repos.invoices.updateWhere({ id, status: paid ? 'Paid' : { not: 'Paid' } }, patch))) return null;
      if (items) {
        await repos.items.deleteWhere({ invoice_id: id });
        for (const row of this.rows(id, items)) await repos.items.create(row);
      }
      if (stages) await this.setStages(tx, id, stages);
      return repos.invoices.findById(id);
    });
  }

  /**
   * Delete an invoice (its lines and stages cascade) and recompute the client's
   * lifetime value in the same transaction, so deleting a Paid one takes its money
   * out of total_spent too. False when it was already gone.
   */
  async remove(id: string): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id }, select: { client_id: true } });
      if (!invoice) return false;
      await tx.invoice.delete({ where: { id } });
      const paid = await tx.invoice.aggregate({ where: { client_id: invoice.client_id, status: 'Paid' }, _sum: { amount: true } });
      await tx.client.updateMany({ where: { id: invoice.client_id }, data: { total_spent: paid._sum.amount ?? 0 } });
      return true;
    });
  }

  /**
   * Paid + the client's lifetime value, together. Null when the invoice is not
   * in a payable state (missing, Draft, or already Paid), so a double click or
   * two admins cannot record the payment twice. An invoice with unpaid stages
   * becomes Paid through its last stage (payStage), never here.
   */
  async markPaid(id: string, paidAt: string): Promise<Invoice | null> {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, id);
      if ((await tx.invoiceStage.count({ where: { invoice_id: id, paid_at: null } })) > 0) {
        throw new BadRequestException('This invoice is paid in stages: mark each stage paid.');
      }
      return this.settle(tx, id, paidAt);
    });
  }

  /** Paid and the client's lifetime value, inside the caller's transaction. Null when not payable. */
  private async settle(tx: Prisma.TransactionClient, id: string, paidAt: string): Promise<Invoice | null> {
    const { invoices } = this.repos(tx);
    if (!(await invoices.updateWhere({ id, status: { in: PAYABLE } }, { status: 'Paid', paid_at: paidAt }))) return null;
    const invoice = (await invoices.findById(id))!;
    const paid = await tx.invoice.aggregate({
      where: { client_id: invoice.client_id, status: 'Paid' },
      _sum: { amount: true },
    });
    await tx.client.update({
      where: { id: invoice.client_id },
      data: { total_spent: paid._sum.amount ?? 0, updated_at: new Date() },
    });
    return invoice;
  }

  /**
   * Records one stage as paid on `paidAt`. When it was the last unpaid stage the
   * invoice becomes Paid in the same transaction (status, paid_at, the client's
   * total_spent, once). Null when the invoice cannot take payment or the stage is
   * missing or already paid.
   */
  async payStage(invoiceId: string, stageId: string, paidAt: string, paidBy: string): Promise<Invoice | null> {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, invoiceId);
      if (!(await tx.invoice.count({ where: { id: invoiceId, status: { in: PAYABLE } } }))) return null;
      const marked = await tx.invoiceStage.updateMany({
        where: { id: stageId, invoice_id: invoiceId, paid_at: null },
        data: { paid_at: new Date(paidAt), paid_by: paidBy },
      });
      if (marked.count === 0) return null;
      if ((await tx.invoiceStage.count({ where: { invoice_id: invoiceId, paid_at: null } })) === 0) {
        await this.settle(tx, invoiceId, paidAt);
      }
      return this.repos(tx).invoices.findById(invoiceId);
    });
  }

  /** Undoes a stage payment while the invoice is not fully paid. Null when there was nothing to undo. */
  async unpayStage(invoiceId: string, stageId: string): Promise<Invoice | null> {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, invoiceId);
      if (!(await tx.invoice.count({ where: { id: invoiceId, status: { notIn: ['Paid', 'Draft'] } } }))) return null;
      const cleared = await tx.invoiceStage.updateMany({
        where: { id: stageId, invoice_id: invoiceId, paid_at: { not: null } },
        data: { paid_at: null, paid_by: null },
      });
      return cleared.count === 0 ? null : this.repos(tx).invoices.findById(invoiceId);
    });
  }
}
