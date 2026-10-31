import { ProjectQuote, ProjectQuoteItem } from '../common/types/domain';
import { ItemInput } from './invoice-store';
import { FieldTypes, PrismaRepository } from './prisma-repository';
import { PrismaService } from './prisma.service';

export const QUOTE_FIELDS: FieldTypes = {
  dates: ['valid_until', 'sent_at', 'responded_at', 'created_at', 'updated_at'],
  decimals: ['amount', 'vat_rate', 'discount'],
};
export const QUOTE_ITEM_FIELDS: FieldTypes = { decimals: ['quantity', 'unit_price', 'cost_price', 'margin_pct'] };

export interface QuoteItemInput extends ItemInput {
  cost_price: number | null;
  margin_pct: number | null;
}

/** A quote with its lines: the writes that must be all-or-nothing. Everything else uses the plain repositories. */
export class QuoteStore {
  constructor(private readonly prisma: PrismaService) {}

  private rows(quote_id: string, items: QuoteItemInput[]): Array<Omit<ProjectQuoteItem, 'id'>> {
    return items.map((item, position) => ({ ...item, quote_id, position }));
  }

  /** Throws a Prisma P2002 when the number is taken; the caller picks another. */
  async create(quote: Omit<ProjectQuote, 'id'>, items: QuoteItemInput[]): Promise<ProjectQuote> {
    return this.prisma.$transaction(async (tx) => {
      const created = await new PrismaRepository<ProjectQuote>(tx.projectQuote, 'project_quotes', QUOTE_FIELDS).create(quote);
      const lines = new PrismaRepository<ProjectQuoteItem>(tx.projectQuoteItem, 'project_quote_items', QUOTE_ITEM_FIELDS);
      for (const row of this.rows(created.id, items)) await lines.create(row);
      return created;
    });
  }

  /** Null when the quote is gone or no longer one that can be edited (the caller says which statuses). */
  async replace(id: string, editable: string[], patch: Partial<Omit<ProjectQuote, 'id'>>, items: QuoteItemInput[]): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const quotes = new PrismaRepository<ProjectQuote>(tx.projectQuote, 'project_quotes', QUOTE_FIELDS);
      if ((await quotes.updateWhere({ id, status: { in: editable } }, patch)) === 0) return false;
      const lines = new PrismaRepository<ProjectQuoteItem>(tx.projectQuoteItem, 'project_quote_items', QUOTE_ITEM_FIELDS);
      await lines.deleteWhere({ quote_id: id });
      for (const row of this.rows(id, items)) await lines.create(row);
      return true;
    });
  }
}
