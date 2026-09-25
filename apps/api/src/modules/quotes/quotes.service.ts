import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { AccessService } from '../../common/access/access.service';
import { Invoice, Quote, QuoteLineItem, ServiceType } from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { grossTotal, lineTotal, money, sum } from '../../common/util/money';
import { ActivityLogService } from '../../core/activity-log.service';
import { DatabaseService } from '../../data/database.service';
import {
  ConvertToInvoiceDto,
  CreateQuoteDto,
  EstimateDto,
  EstimateTier,
  QuoteDecisionDto,
  QuoteLineInput,
  UpdateQuoteDto,
} from './dto';

export interface QuoteWithLines extends Quote {
  lines: QuoteLineItem[];
  client_name: string;
}

/**
 * Indicative pricing for the public website calculator.
 *
 * ASSUMPTION, FLAGGED FOR CLIENT SIGN-OFF. PRD section 12 and TRD section 10
 * both record "pricing formula rules for the Component Library (fixed vs £/m²)"
 * as an OPEN question pending the client. Rather than block, this implements the
 * simplest model consistent with the Investment Guide tiers already on the
 * Service Detail page: a per-m² rate per service and tier, applied to a typical
 * room size, returned as a range rather than a point estimate.
 *
 * These numbers are indicative only — the calculator's own copy says results are
 * not binding until consultation and site measurement. Replace this table with
 * the agreed formula once the client signs it off; nothing else needs to change.
 */
const ESTIMATE_RATES: Record<ServiceType, Record<EstimateTier, number>> = {
  Kitchen: { Essential: 1150, Premium: 1750, Luxury: 2600 },
  Bedroom: { Essential: 720, Premium: 1080, Luxury: 1600 },
  MediaWall: { Essential: 850, Premium: 1250, Luxury: 1850 },
  Wardrobe: { Essential: 640, Premium: 950, Luxury: 1400 },
};

/** Typical room size in m² per service, used when the caller gives no size. */
const DEFAULT_SIZE_SQM: Record<ServiceType, number> = {
  Kitchen: 14,
  Bedroom: 12,
  MediaWall: 6,
  Wardrobe: 8,
};

/** The 3D design package, priced separately per PRD 5.2. */
const DESIGN_PACKAGE_FEE: Record<ServiceType, number> = {
  Kitchen: 850,
  Bedroom: 600,
  MediaWall: 650,
  Wardrobe: 600,
};

/** The estimate is returned as a band this wide either side of the midpoint. */
const ESTIMATE_SPREAD = 0.12;

@Injectable()
export class QuotesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly access: AccessService,
    private readonly activity: ActivityLogService,
  ) {}

  /* ------------------------------------------------------------------ */
  /* Public calculator                                                   */
  /* ------------------------------------------------------------------ */

  /**
   * POST /quotes/estimate — public, must answer in under 200ms (TRD section 9).
   *
   * Pure arithmetic over the constants above, with no datastore read at all, so
   * the budget is met by construction rather than by optimisation. This
   * deliberately does NOT persist a quote: the endpoint is called on every
   * slider move on the website, and writing a row per keystroke would fill the
   * table with abandoned estimates.
   */
  estimate(dto: EstimateDto) {
    const sizeSqm = dto.size_sqm ?? DEFAULT_SIZE_SQM[dto.service_id];
    const rate = ESTIMATE_RATES[dto.service_id][dto.tier];
    const designFee = dto.include_design_package ? DESIGN_PACKAGE_FEE[dto.service_id] : 0;

    const midpoint = money(rate * sizeSqm + designFee);
    const low = money(midpoint * (1 - ESTIMATE_SPREAD));
    const high = money(midpoint * (1 + ESTIMATE_SPREAD));
    const vatRate = 20;

    return {
      service_id: dto.service_id,
      tier: dto.tier,
      size_sqm: sizeSqm,
      design_fee: designFee,
      currency: 'GBP',
      net: { low, midpoint, high },
      gross: {
        low: grossTotal(low, vatRate),
        midpoint: grossTotal(midpoint, vatRate),
        high: grossTotal(high, vatRate),
      },
      vat_rate: vatRate,
      /** Shown verbatim by the calculator, per the UI/UX brief. */
      disclaimer:
        'This is an indicative range only. Your final price is confirmed after consultation and site measurement.',
    };
  }

  /* ------------------------------------------------------------------ */
  /* Reads                                                               */
  /* ------------------------------------------------------------------ */

  async list(principal: AuthPrincipal): Promise<QuoteWithLines[]> {
    const all = await this.db.quotes.findAll();
    const scoped = await this.access.scopeToVisibleClients(principal, all, (row) => row.client_id);
    const [lines, clients] = await Promise.all([
      this.db.quoteLineItems.findAll(),
      this.db.clients.findAll(),
    ]);
    const nameById = new Map(clients.map((client) => [client.id, client.name]));

    return scoped
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((quote) => ({
        ...quote,
        lines: lines.filter((line) => line.quote_id === quote.id),
        client_name: nameById.get(quote.client_id) ?? 'Unknown client',
      }));
  }

  async findOne(principal: AuthPrincipal, id: string): Promise<QuoteWithLines> {
    const quote = await this.db.quotes.findById(id);
    if (!quote) throw new NotFoundException('Quote not found');
    await this.access.assertClientAccess(principal, quote.client_id);

    const [lines, client] = await Promise.all([
      this.db.quoteLineItems.findAll((line) => line.quote_id === id),
      this.db.clients.findById(quote.client_id),
    ]);
    return { ...quote, lines, client_name: client?.name ?? 'Unknown client' };
  }

  /* ------------------------------------------------------------------ */
  /* Writes                                                              */
  /* ------------------------------------------------------------------ */

  async create(principal: AuthPrincipal, dto: CreateQuoteDto): Promise<QuoteWithLines> {
    await this.access.assertClientAccess(principal, dto.client_id);
    const client = await this.db.clients.findById(dto.client_id);
    if (!client) throw new BadRequestException('Client does not exist');

    const settings = await this.db.settings();
    const vatRate = dto.vat_rate ?? settings.vat_rate;
    const designFee = money(dto.design_fee ?? 0);

    const { lines, netLines } = await this.buildLines(dto.type, dto.lines, dto.subtotal);
    const subtotal = sum([netLines, designFee]);
    const now = new Date().toISOString();

    const quote = await this.db.quotes.create({
      client_id: dto.client_id,
      service_id: dto.service_id,
      type: dto.type,
      design_fee: designFee,
      subtotal,
      vat_rate: vatRate,
      total: grossTotal(subtotal, vatRate),
      status: dto.status ?? 'Draft',
      invoice_id: null,
      created_at: now,
      updated_at: now,
    });

    const persisted = await this.persistLines(quote.id, lines);

    await this.activity.record({
      principal,
      action: 'quote_create',
      targetTable: 'quotes',
      targetId: quote.id,
      details: { type: quote.type, service: quote.service_id, total: quote.total, client: client.name },
    });
    return { ...quote, lines: persisted, client_name: client.name };
  }

  /**
   * Edit a quote.
   *
   * Only Draft quotes are editable. Once a quote has been Sent the client has
   * seen those figures, and once Accepted it is the basis of an invoice —
   * silently rewriting either would be a serious integrity failure, so this
   * refuses rather than versioning (versioning is a real feature, not a
   * prototype shortcut, and belongs in a later phase).
   */
  async update(principal: AuthPrincipal, id: string, dto: UpdateQuoteDto): Promise<QuoteWithLines> {
    const quote = await this.db.quotes.findById(id);
    if (!quote) throw new NotFoundException('Quote not found');
    await this.access.assertClientAccess(principal, quote.client_id);

    const changesFigures =
      dto.lines !== undefined ||
      dto.subtotal !== undefined ||
      dto.design_fee !== undefined ||
      dto.vat_rate !== undefined ||
      dto.type !== undefined;

    if (changesFigures && quote.status !== 'Draft') {
      throw new BadRequestException(
        `This quote is ${quote.status} and its figures can no longer be changed. ` +
          'Create a new quote for the client instead — the original stays on record.',
      );
    }

    const type = dto.type ?? quote.type;
    const designFee = dto.design_fee !== undefined ? money(dto.design_fee) : quote.design_fee;

    const patch: Partial<Quote> = { updated_at: new Date().toISOString() };
    if (dto.service_id !== undefined) patch.service_id = dto.service_id;
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.type !== undefined) patch.type = type;

    let lines = await this.db.quoteLineItems.findAll((line) => line.quote_id === id);

    if (changesFigures) {
      const vatRate = dto.vat_rate ?? quote.vat_rate;
      const built = await this.buildLines(
        type,
        dto.lines ?? (type === 'Detailed' ? lines.map((l) => ({ component_id: l.component_id, quantity: l.quantity })) : undefined),
        dto.subtotal ?? (type === 'Simple' ? quote.subtotal - quote.design_fee : undefined),
      );
      const subtotal = sum([built.netLines, designFee]);

      patch.design_fee = designFee;
      patch.vat_rate = vatRate;
      patch.subtotal = subtotal;
      patch.total = grossTotal(subtotal, vatRate);

      // Line items are replaced wholesale. The cascade is scoped to this
      // quote's own lines and nothing else, per Backend Schema section 6.
      await this.db.quoteLineItems.deleteMany((line) => line.quote_id === id);
      lines = await this.persistLines(id, built.lines);
    }

    const updated = await this.db.quotes.update(id, patch);
    if (!updated) throw new NotFoundException('Quote not found');

    await this.activity.record({
      principal,
      action: 'quote_update',
      targetTable: 'quotes',
      targetId: id,
      details: { fields: Object.keys(dto), total: updated.total },
    });

    const client = await this.db.clients.findById(updated.client_id);
    return { ...updated, lines, client_name: client?.name ?? 'Unknown client' };
  }

  /** Send a Draft quote to the client. */
  async send(principal: AuthPrincipal, id: string): Promise<QuoteWithLines> {
    const quote = await this.db.quotes.findById(id);
    if (!quote) throw new NotFoundException('Quote not found');
    await this.access.assertClientAccess(principal, quote.client_id);

    if (quote.status !== 'Draft') {
      throw new BadRequestException(`Only a Draft quote can be sent. This one is ${quote.status}.`);
    }

    await this.db.quotes.update(id, { status: 'Sent', updated_at: new Date().toISOString() });
    await this.activity.record({
      principal,
      action: 'quote_send',
      targetTable: 'quotes',
      targetId: id,
      details: { total: quote.total },
    });
    // No email is sent — real delivery is permanently out of scope this phase.
    return this.findOne(principal, id);
  }

  /**
   * Client accepts a quote (portal My Quotes).
   *
   * Acceptance does NOT auto-create an invoice. The docs describe conversion as
   * a deliberate one-click Admin action, and an invoice is a financial document
   * the business should choose to raise. Accepting marks the quote Accepted and
   * surfaces it in the admin's convert-to-invoice queue.
   */
  async accept(principal: AuthPrincipal, id: string): Promise<QuoteWithLines> {
    const quote = await this.requireClientOwnedQuote(principal, id);
    if (quote.status !== 'Sent') {
      throw new BadRequestException(
        `Only a quote that has been sent to you can be accepted. This one is ${quote.status}.`,
      );
    }

    await this.db.quotes.update(id, { status: 'Accepted', updated_at: new Date().toISOString() });
    await this.activity.record({
      principal,
      action: 'quote_accept',
      targetTable: 'quotes',
      targetId: id,
      details: { total: quote.total },
    });
    return this.findOne(principal, id);
  }

  /** Client declines a quote. */
  async decline(principal: AuthPrincipal, id: string, dto: QuoteDecisionDto): Promise<QuoteWithLines> {
    const quote = await this.requireClientOwnedQuote(principal, id);
    if (quote.status !== 'Sent') {
      throw new BadRequestException(`This quote is ${quote.status} and cannot be declined.`);
    }

    // Expired is the schema's terminal non-accepted state — there is no
    // 'Declined' in the documented enum, and inventing one would break the
    // contract with both frontends. The reason is preserved in the audit log.
    await this.db.quotes.update(id, { status: 'Expired', updated_at: new Date().toISOString() });
    await this.activity.record({
      principal,
      action: 'quote_decline',
      targetTable: 'quotes',
      targetId: id,
      details: { note: dto.note ?? null },
    });
    return this.findOne(principal, id);
  }

  /**
   * Client asks for a revision. Returns the quote to Draft so the designer can
   * edit the figures again, and records the client's note for them to read.
   */
  async requestRevision(
    principal: AuthPrincipal,
    id: string,
    dto: QuoteDecisionDto,
  ): Promise<QuoteWithLines> {
    const quote = await this.requireClientOwnedQuote(principal, id);
    if (quote.status !== 'Sent') {
      throw new BadRequestException(`This quote is ${quote.status} and cannot be revised.`);
    }

    await this.db.quotes.update(id, { status: 'Draft', updated_at: new Date().toISOString() });
    await this.activity.record({
      principal,
      action: 'quote_request_revision',
      targetTable: 'quotes',
      targetId: id,
      details: { note: dto.note ?? null },
    });
    return this.findOne(principal, id);
  }

  /**
   * POST /quotes/:id/convert-to-invoice.
   *
   * Carries the accepted quote's total across without re-entry, which is the
   * whole point of the handoff in the App Flow doc. The quote's line items are
   * NOT copied or mutated — the invoice references the quote by id, so the
   * breakdown remains readable through that link while the snapshot prices stay
   * exactly where they were written.
   */
  async convertToInvoice(
    principal: AuthPrincipal,
    id: string,
    dto: ConvertToInvoiceDto,
  ): Promise<Invoice> {
    const quote = await this.db.quotes.findById(id);
    if (!quote) throw new NotFoundException('Quote not found');
    await this.access.assertClientAccess(principal, quote.client_id);

    if (quote.status !== 'Accepted') {
      throw new BadRequestException(
        `Only an Accepted quote can be converted to an invoice. This one is ${quote.status}.`,
      );
    }
    if (quote.invoice_id) {
      throw new BadRequestException('This quote has already been converted to an invoice.');
    }

    if (dto.project_id) {
      const project = await this.db.projects.findById(dto.project_id);
      if (!project) throw new BadRequestException('Project does not exist');
      if (project.client_id !== quote.client_id) {
        throw new BadRequestException('That project belongs to a different client');
      }
    }

    const dueInDays = dto.due_in_days ?? 30;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + dueInDays);
    const now = new Date().toISOString();

    const invoice = await this.db.invoices.create({
      number: await this.nextInvoiceNumber(),
      client_id: quote.client_id,
      project_id: dto.project_id ?? null,
      quote_id: quote.id,
      amount: quote.total,
      vat_rate: quote.vat_rate,
      status: 'Draft',
      due_date: dueDate.toISOString().slice(0, 10),
      paid_at: null,
      created_at: now,
    });

    await this.db.quotes.update(quote.id, { invoice_id: invoice.id, updated_at: now });

    await this.activity.record({
      principal,
      action: 'quote_convert_to_invoice',
      targetTable: 'quotes',
      targetId: quote.id,
      details: { invoice_id: invoice.id, number: invoice.number, amount: invoice.amount },
    });
    return invoice;
  }

  /**
   * Delete a quote.
   *
   * Cascades to this quote's own line items ONLY. Never to clients, invoices or
   * components (Backend Schema section 6). A quote already converted to an
   * invoice is refused outright — the invoice would be left pointing at nothing.
   */
  async remove(principal: AuthPrincipal, id: string): Promise<{ id: string; deleted: true }> {
    const quote = await this.db.quotes.findById(id);
    if (!quote) throw new NotFoundException('Quote not found');
    await this.access.assertClientAccess(principal, quote.client_id);

    if (quote.invoice_id) {
      throw new BadRequestException(
        'This quote has been converted to an invoice and cannot be deleted. Delete the invoice first if it was raised in error.',
      );
    }

    const removedLines = await this.db.quoteLineItems.deleteMany((line) => line.quote_id === id);
    await this.db.quotes.delete(id);

    await this.activity.record({
      principal,
      action: 'quote_delete',
      targetTable: 'quotes',
      targetId: id,
      details: { removed_line_items: removedLines, total: quote.total },
    });
    return { id, deleted: true };
  }

  /* ------------------------------------------------------------------ */
  /* Internals                                                           */
  /* ------------------------------------------------------------------ */

  /**
   * Turn line inputs into priced line items, snapshotting each component's
   * CURRENT price. This is the only place a component price is ever copied onto
   * a quote; after this, that number is frozen for the life of the quote.
   */
  private async buildLines(
    type: 'Simple' | 'Detailed',
    inputs: QuoteLineInput[] | undefined,
    simpleSubtotal: number | undefined,
  ): Promise<{ lines: Omit<QuoteLineItem, 'id' | 'quote_id'>[]; netLines: number }> {
    if (type === 'Simple') {
      if (simpleSubtotal === undefined) {
        throw new BadRequestException('A Simple quote needs a subtotal figure');
      }
      return { lines: [], netLines: money(simpleSubtotal) };
    }

    if (!inputs || inputs.length === 0) {
      throw new BadRequestException('A Detailed quote needs at least one line item');
    }

    const lines: Omit<QuoteLineItem, 'id' | 'quote_id'>[] = [];
    for (const input of inputs) {
      const component = await this.db.components.findById(input.component_id);
      if (!component) {
        throw new BadRequestException(`Component ${input.component_id} does not exist`);
      }
      if (!component.is_active) {
        throw new BadRequestException(
          `"${component.name}" is no longer in the current range and cannot be added to a new quote.`,
        );
      }
      lines.push({
        component_id: component.id,
        component_name: component.name,
        quantity: input.quantity,
        unit_price: component.unit_price, // <- the snapshot
        line_total: lineTotal(input.quantity, component.unit_price),
      });
    }

    return { lines, netLines: sum(lines.map((line) => line.line_total)) };
  }

  private async persistLines(
    quoteId: string,
    lines: Omit<QuoteLineItem, 'id' | 'quote_id'>[],
  ): Promise<QuoteLineItem[]> {
    if (lines.length === 0) return [];
    return this.db.quoteLineItems.createMany(
      lines.map((line) => ({ ...line, quote_id: quoteId })),
    );
  }

  /** Sequential invoice numbers in the documented INV-YYYY-NNNN format. */
  private async nextInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;
    const existing = await this.db.invoices.findAll((row) => row.number.startsWith(prefix));
    const highest = existing.reduce((max, invoice) => {
      const suffix = Number(invoice.number.slice(prefix.length));
      return Number.isFinite(suffix) && suffix > max ? suffix : max;
    }, 0);
    return `${prefix}${String(highest + 1).padStart(4, '0')}`;
  }

  /** A quote the calling CLIENT owns, for the portal decision endpoints. */
  private async requireClientOwnedQuote(principal: AuthPrincipal, id: string): Promise<Quote> {
    const quote = await this.db.quotes.findById(id);
    if (!quote) throw new NotFoundException('Quote not found');
    if (principal.kind !== 'Client') {
      throw new ForbiddenException('Only the client can make this decision on their own quote');
    }
    if (quote.client_id !== principal.id) {
      throw new NotFoundException('Quote not found');
    }
    return quote;
  }
}
