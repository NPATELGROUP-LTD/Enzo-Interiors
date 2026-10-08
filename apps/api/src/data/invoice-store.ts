import { Prisma } from '@prisma/client';

import { Invoice, InvoiceItem } from '../common/types/domain';
import { FieldTypes, PrismaRepository, Where } from './prisma-repository';
import { PrismaService } from './prisma.service';

export const INVOICE_FIELDS: FieldTypes = {
  dates: ['created_at', 'due_date', 'paid_at'],
  decimals: ['amount', 'vat_rate', 'discount'],
};
export const INVOICE_ITEM_FIELDS: FieldTypes = { dates: ['created_at'], decimals: ['quantity', 'unit_price'] };

export interface ItemInput {
  description: string;
  section: string | null;
  detail: string | null;
  quantity: number;
  unit_price: number;
}

/** The statuses an invoice can be paid from. */
const PAYABLE = ['Sent', 'Outstanding', 'Overdue'];

/**
 * The invoice writes that must be all-or-nothing: an invoice with its lines,
 * and recording payment. Everything else goes through the plain repositories.
 */
export class InvoiceStore {
  constructor(private readonly prisma: PrismaService) {}

  private repos(tx: Pick<PrismaService, 'invoice' | 'invoiceItem'>) {
    return {
      invoices: new PrismaRepository<Invoice>(tx.invoice, 'invoices', INVOICE_FIELDS),
      items: new PrismaRepository<InvoiceItem>(tx.invoiceItem, 'invoice_items', INVOICE_ITEM_FIELDS),
    };
  }

  private rows(invoice_id: string, items: ItemInput[]): Array<Omit<InvoiceItem, 'id'>> {
    const created_at = new Date().toISOString();
    return items.map((item, position) => ({ ...item, invoice_id, position, created_at }));
  }

  /** SUM(amount) over `where`, in PostgreSQL and exact (a Decimal, never a float). */
  async sum(where: Where<Invoice>): Promise<Prisma.Decimal> {
    const total = await this.prisma.invoice.aggregate({ where: where as Prisma.InvoiceWhereInput, _sum: { amount: true } });
    return total._sum.amount ?? new Prisma.Decimal(0);
  }

  /** Throws a Prisma P2002 when the number is taken; the caller picks another. */
  async create(invoice: Omit<Invoice, 'id'>, items: ItemInput[]): Promise<Invoice> {
    return this.prisma.$transaction(async (tx) => {
      const repos = this.repos(tx);
      const created = await repos.invoices.create(invoice);
      for (const row of this.rows(created.id, items)) await repos.items.create(row);
      return created;
    });
  }

  /**
   * Null when the invoice is gone or already Paid. `items` replaces the lines when given.
   * `paid` = the caller only touches the job/schedule fields, which a Paid invoice may still change.
   */
  async update(id: string, patch: Partial<Omit<Invoice, 'id'>>, items?: ItemInput[], paid = false): Promise<Invoice | null> {
    return this.prisma.$transaction(async (tx) => {
      const repos = this.repos(tx);
      if (!(await repos.invoices.updateWhere({ id, status: paid ? 'Paid' : { not: 'Paid' } }, patch))) return null;
      if (items) {
        await repos.items.deleteWhere({ invoice_id: id });
        for (const row of this.rows(id, items)) await repos.items.create(row);
      }
      return repos.invoices.findById(id);
    });
  }

  /**
   * Paid + the client's lifetime value, together. Null when the invoice is not
   * in a payable state (missing, Draft, or already Paid), so a double click or
   * two admins cannot record the payment twice.
   */
  async markPaid(id: string, paidAt: string): Promise<Invoice | null> {
    return this.prisma.$transaction(async (tx) => {
      const { invoices } = this.repos(tx);
      if (!(await invoices.updateWhere({ id, status: { in: PAYABLE } }, { status: 'Paid', paid_at: paidAt }))) return null;
      const invoice = (await invoices.findById(id))!;
      const paid = await tx.invoice.aggregate({
        where: { client_id: invoice.client_id, status: 'Paid' },
        _sum: { amount: true },
      });
      await tx.client.update({
        where: { id: invoice.client_id },
        data: { total_spent: paid._sum.amount ?? 0, updated_at: new Date(paidAt) },
      });
      return invoice;
    });
  }
}
