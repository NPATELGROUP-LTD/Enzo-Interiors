import { BadRequestException, Body, ConflictException, Controller, Delete, Get, HttpCode, Injectable, Module, NotFoundException, Param, Post, Put, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Prisma } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { AccessService } from '../../common/access/access.service';
import { CurrentUser, Roles } from '../../common/decorators';
import { ProjectQuote, ProjectQuoteItem, QuoteStatus } from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { ActivityLogService } from '../../core/activity-log.service';
import { DatabaseService } from '../../data/database.service';
import { QuoteItemInput } from '../../data/quote-store';
import { confirmPassword, PasswordConfirmDto } from '../auth/reauth';
import { InvoicesModule } from '../invoices/invoices.controller';
import { hasEmail } from '../clients/no-email';
import { InvoiceItemDto, InvoicesService, type Issuer } from '../invoices/invoices.service';
import { DEFAULT_STAGES } from '../invoices/stages';
import { MAX_AMOUNT, pennies, totalsOf } from '../invoices/totals';
import { NotificationsModule, NotificationsService } from '../notifications/notifications.module';

/* -------------------------------------------------------------------------- */
/* DTOs                                                                       */
/* -------------------------------------------------------------------------- */

const OptionalText = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() || null : value));

/** A line as the Admin writes it: with a cost, the price each is cost + margin and is worked out here. */
export class QuoteItemDto extends InvoiceItemDto {
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Cost must have at most 2 decimal places' }) @Min(0) @Max(9_999_999.99)
  cost_price?: number | null;

  /** Percent added on top of the cost. */
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Margin must have at most 2 decimal places' }) @Min(0) @Max(1000)
  margin_pct?: number | null;
}

class QuoteFields {
  @OptionalText() @IsOptional() @IsString() @MaxLength(200) title?: string | null;
  @OptionalText() @IsOptional() @IsString() @MaxLength(4000) notes?: string | null;
  /** The last day the client can accept. */
  @IsOptional() @IsDateString({}, { message: 'Enter a valid date' }) valid_until?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) vat_rate?: number;
  /** A fixed £ amount off the subtotal, before VAT. */
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }, { message: 'The discount must have at most 2 decimal places' }) @Min(0) @Max(9_999_999.99) discount?: number;
}

export class CreateQuoteDto extends QuoteFields {
  @IsString() client_id!: string;
  /** A quote is always for a project of that client. */
  @IsString() project_id!: string;
  @IsArray() @ArrayMinSize(1, { message: 'Add at least one line' }) @ArrayMaxSize(50, { message: 'A quote can have at most 50 lines' }) @ValidateNested({ each: true }) @Type(() => QuoteItemDto)
  items!: QuoteItemDto[];
}

export class UpdateQuoteDto extends QuoteFields {
  @IsOptional()
  @IsArray() @ArrayMinSize(1, { message: 'Add at least one line' }) @ArrayMaxSize(50, { message: 'A quote can have at most 50 lines' }) @ValidateNested({ each: true }) @Type(() => QuoteItemDto)
  items?: QuoteItemDto[];
}

export class RespondDto {
  @IsIn(['accept', 'decline'], { message: 'Accept or decline' }) decision!: 'accept' | 'decline';
  @OptionalText() @IsOptional() @IsString() @MaxLength(1000) comment?: string | null;
}

export class QuoteListQuery {
  @IsOptional() @IsString() project_id?: string;
  @IsOptional() @IsString() client_id?: string;
}

/* -------------------------------------------------------------------------- */
/* Service                                                                    */
/* -------------------------------------------------------------------------- */

export interface QuoteView extends ProjectQuote {
  items: ProjectQuoteItem[];
  client_name: string;
  project_name: string | null;
  /** The lines added up, before the discount. */
  subtotal_amount: number;
  net_amount: number;
  vat_amount: number;
  /** Sent, and past its last day: the client can no longer accept. */
  expired: boolean;
  /** For the letterhead sheet: the company, the client's contact and where the job is. */
  issuer: Issuer;
  client_email: string | null;
  client_phone: string | null;
  job_address: string | null;
}

/** Draft, or Declined (the Admin revises it and sends it again). */
const EDITABLE: QuoteStatus[] = ['Draft', 'Declined'];
const NUMBER_ATTEMPTS = 8;
const INVOICE_DUE_DAYS = 14;
const today = () => new Date().toISOString().slice(0, 10);

@Injectable()
export class QuotesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly access: AccessService,
    private readonly activity: ActivityLogService,
    private readonly notifications: NotificationsService,
    private readonly invoices: InvoicesService,
  ) {}

  async list(principal: AuthPrincipal, query: QuoteListQuery): Promise<QuoteView[]> {
    const where = this.access.isClient(principal)
      ? { client_id: principal.id, status: { not: 'Draft' } }
      : { ...(query.project_id ? { project_id: query.project_id } : {}), ...(query.client_id ? { client_id: query.client_id } : {}) };
    return this.views(await this.db.projectQuotes.findWhere(where, { orderBy: { created_at: 'desc' } }), this.access.isClient(principal));
  }

  async findOne(principal: AuthPrincipal, id: string): Promise<QuoteView> {
    const quote = await this.db.projectQuotes.findById(id);
    // A client gets the same 404 for someone else's quote and for their own Draft.
    if (!quote || (this.access.isClient(principal) && (quote.client_id !== principal.id || quote.status === 'Draft'))) {
      throw new NotFoundException('Quote not found');
    }
    return (await this.views([quote], this.access.isClient(principal)))[0]!;
  }

  /** design_id is set only by the quote maker, never from a request body. */
  async create(principal: AuthPrincipal, dto: CreateQuoteDto, design_id: string | null = null): Promise<QuoteView> {
    const client = await this.db.clients.findById(dto.client_id);
    if (!client) throw new BadRequestException('Client does not exist');
    const project = await this.db.projects.findById(dto.project_id);
    if (!project) throw new BadRequestException('Project does not exist');
    if (project.client_id !== dto.client_id) throw new BadRequestException('That project belongs to a different client');

    const vat_rate = dto.vat_rate ?? (await this.db.settings()).vat_rate;
    const discount = dto.discount ?? 0;
    const items = this.lines(dto.items);
    const gross = this.gross(items, vat_rate, discount);
    const now = new Date().toISOString();

    // Two quotes made at once can pick the same number; the unique index refuses the second, which looks again.
    for (let attempt = 1; ; attempt++) {
      try {
        const created = await this.db.quoteStore.create(
          {
            number: await this.nextNumber(),
            client_id: dto.client_id,
            project_id: dto.project_id,
            title: dto.title ?? null,
            status: 'Draft',
            amount: gross,
            vat_rate,
            discount,
            valid_until: dto.valid_until ? dto.valid_until.slice(0, 10) : null,
            notes: dto.notes ?? null,
            sent_at: null,
            responded_at: null,
            response_comment: null,
            invoice_id: null,
            design_id,
            created_by: principal.name,
            created_at: now,
            updated_at: now,
          },
          items,
        );
        await this.activity.record({ principal, action: 'quote_create', targetTable: 'project_quotes', targetId: created.id, details: { number: created.number, amount: created.amount, client: client.name } });
        return this.findOne(principal, created.id);
      } catch (error) {
        const taken = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
        if (!taken) throw error;
        if (attempt >= NUMBER_ATTEMPTS) throw new ConflictException('Could not reserve a quote number. Please try again.');
      }
    }
  }

  async update(principal: AuthPrincipal, id: string, dto: UpdateQuoteDto): Promise<QuoteView> {
    const quote = await this.db.projectQuotes.findById(id);
    if (!quote) throw new NotFoundException('Quote not found');
    if (!EDITABLE.includes(quote.status)) throw new BadRequestException(`A ${quote.status} quote cannot be edited. Withdraw it first, or raise a new one.`);

    const existing = await this.db.projectQuoteItems.findWhere({ quote_id: id }, { orderBy: { position: 'asc' } });
    const items = dto.items ? this.lines(dto.items) : existing.map(({ description, section, detail, quantity, unit_price, cost_price, margin_pct }) => ({ description, section, detail, quantity, unit_price, cost_price, margin_pct }));
    const vat_rate = dto.vat_rate ?? quote.vat_rate;
    const discount = dto.discount ?? quote.discount;
    const saved = await this.db.quoteStore.replace(
      id,
      EDITABLE,
      {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.valid_until !== undefined ? { valid_until: dto.valid_until ? dto.valid_until.slice(0, 10) : null } : {}),
        vat_rate,
        discount,
        amount: this.gross(items, vat_rate, discount),
        // Revised after a no: it is a fresh draft again, and the old answer goes.
        status: 'Draft',
        responded_at: null,
        response_comment: null,
        updated_at: new Date().toISOString(),
      },
      items,
    );
    if (!saved) throw new ConflictException('This quote changed while you were editing. Reload and try again.');
    return this.findOne(principal, id);
  }

  /** Draft -> Sent: the client can see it from now on, and is told. */
  async send(principal: AuthPrincipal, id: string): Promise<QuoteView> {
    const quote = await this.db.projectQuotes.findById(id);
    if (!quote) throw new NotFoundException('Quote not found');
    if (quote.valid_until && quote.valid_until.slice(0, 10) < today()) throw new BadRequestException('The valid-until date has passed. Change it before sending.');
    const moved = await this.db.projectQuotes.updateWhere({ id, status: 'Draft' }, { status: 'Sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    if (moved === 0) throw new BadRequestException('Only a draft quote can be sent.');
    const project = await this.db.projects.findById(quote.project_id);
    await this.notifications.notifyClient(quote.client_id, { kind: 'invoice', title: `New quote ${quote.number}`, body: project?.name, link: `/quotes/${id}` });
    await this.activity.record({ principal, action: 'quote_send', targetTable: 'project_quotes', targetId: id, details: { number: quote.number } });
    return this.findOne(principal, id);
  }

  /** Sent -> Draft, so it can be edited. The client's copy disappears. */
  async withdraw(principal: AuthPrincipal, id: string): Promise<QuoteView> {
    const moved = await this.db.projectQuotes.updateWhere({ id, status: 'Sent' }, { status: 'Draft', sent_at: null, updated_at: new Date().toISOString() });
    if (moved === 0) throw new BadRequestException('Only a sent quote can be withdrawn.');
    return this.findOne(principal, id);
  }

  /** The client's answer. One conditional UPDATE, so a double click (or two devices) answers once. */
  async respond(principal: AuthPrincipal, id: string, dto: RespondDto): Promise<QuoteView> {
    const quote = await this.findOne(principal, id); // 404 unless it is theirs and not a Draft
    if (quote.status !== 'Sent') throw new BadRequestException('This quote has already been answered.');
    if (quote.expired) throw new BadRequestException('This quote has expired. Ask the studio for a new one.');
    const status: QuoteStatus = dto.decision === 'accept' ? 'Accepted' : 'Declined';
    const now = new Date().toISOString();
    const moved = await this.db.projectQuotes.updateWhere({ id, status: 'Sent' }, { status, responded_at: now, response_comment: dto.comment ?? null, updated_at: now });
    if (moved === 0) throw new ConflictException('This quote has already been answered.');
    await this.notifications.notifyAdmins({
      kind: 'request',
      title: `${quote.client_name} ${status.toLowerCase()} quote ${quote.number}`,
      body: dto.comment ?? undefined,
      link: `/quotes/${id}`,
    });
    return this.findOne(principal, id);
  }

  /** Accepted -> a Draft invoice with the same lines and the default payment stages. Once. */
  async createInvoice(principal: AuthPrincipal, id: string): Promise<QuoteView> {
    const quote = await this.findOne(principal, id);
    if (quote.status !== 'Accepted') throw new BadRequestException('Only an accepted quote can become an invoice.');
    if (quote.invoice_id) throw new BadRequestException('This quote already has an invoice.');
    const invoice = await this.invoices.create(principal, {
      client_id: quote.client_id,
      project_id: quote.project_id,
      items: quote.items.map(({ description, section, detail, quantity, unit_price }) => Object.assign(new InvoiceItemDto(), { description, section, detail, quantity, unit_price })),
      vat_rate: quote.vat_rate,
      discount: quote.discount,
      due_date: new Date(Date.now() + INVOICE_DUE_DAYS * 86_400_000).toISOString().slice(0, 10),
      status: 'Draft',
      job_name: quote.title ?? quote.project_name,
      job_notes: quote.notes,
      stages: DEFAULT_STAGES,
    });
    const claimed = await this.db.projectQuotes.updateWhere({ id, invoice_id: null }, { invoice_id: invoice.id, updated_at: new Date().toISOString() });
    if (claimed === 0) {
      // Another click got there first: undo ours rather than leave two Draft invoices.
      await this.invoices.remove(principal, invoice.id);
      throw new ConflictException('This quote already has an invoice.');
    }
    await this.activity.record({ principal, action: 'quote_invoice', targetTable: 'project_quotes', targetId: id, details: { number: quote.number, invoice: invoice.number } });
    return this.findOne(principal, id);
  }

  async remove(principal: AuthPrincipal, id: string, password?: string): Promise<{ id: string; deleted: true }> {
    const quote = await this.db.projectQuotes.findById(id);
    if (!quote) throw new NotFoundException('Quote not found');
    // A quote whose client was deleted ("Unknown client") may go in any status, with the Admin's password.
    const orphan = !(await this.db.clients.findById(quote.client_id));
    if (orphan) {
      await confirmPassword(this.db, principal, password);
      await this.db.projectQuotes.deleteWhere({ id });
    } else {
      if (!EDITABLE.includes(quote.status)) throw new BadRequestException(`A ${quote.status} quote cannot be deleted.`);
      await this.db.projectQuotes.deleteWhere({ id, status: { in: EDITABLE } });
    }
    await this.activity.record({ principal, action: 'quote_delete', targetTable: 'project_quotes', targetId: id, details: { number: quote.number, status: quote.status, ...(orphan ? { client_deleted: true } : {}) } });
    return { id, deleted: true };
  }

  /* ------------------------------------------------------------------ */

  private lines(dtos: QuoteItemDto[]): QuoteItemInput[] {
    return dtos.map(({ description, section, detail, quantity, unit_price, cost_price, margin_pct }) => {
      const cost = cost_price ?? null;
      const margin = cost === null ? null : (margin_pct ?? 0);
      // With a cost, the price the client pays is cost + margin, to the penny; the browser's own sum is never trusted.
      const price = cost === null ? unit_price : pennies(new Prisma.Decimal(cost).mul(100 + margin!).div(100)).toNumber();
      return { description, section: section ?? null, detail: detail ?? null, quantity, unit_price: price, cost_price: cost, margin_pct: margin };
    });
  }

  private gross(items: QuoteItemInput[], vatRate: number, discount: number): number {
    const totals = totalsOf(items, vatRate, discount);
    if (totals.net < 0) throw new BadRequestException('The discount cannot be more than the lines add up to.');
    if (totals.gross >= MAX_AMOUNT) throw new BadRequestException('That total is too large for one quote.');
    return totals.gross;
  }

  private async nextNumber(): Promise<string> {
    const prefix = `Q-${new Date().getFullYear()}-`;
    const existing = await this.db.projectQuotes.findWhere({ number: { startsWith: prefix } });
    const highest = existing.reduce((max, { number }) => Math.max(max, Number(number.slice(prefix.length)) || 0), 0);
    return `${prefix}${String(highest + 1).padStart(4, '0')}`;
  }

  /** Quotes with their lines and names, in a handful of queries however many there are. A client gets the lines as priced to them, never their cost or margin. */
  private async views(quotes: ProjectQuote[], forClient = false): Promise<QuoteView[]> {
    if (quotes.length === 0) return [];
    const ids = (pick: (q: ProjectQuote) => string) => [...new Set(quotes.map(pick))];
    const [items, clients, projects, issuer] = await Promise.all([
      this.db.projectQuoteItems.findWhere({ quote_id: { in: ids((q) => q.id) } }, { orderBy: { position: 'asc' } }),
      this.db.clients.findWhere({ id: { in: ids((q) => q.client_id) } }),
      this.db.projects.findWhere({ id: { in: ids((q) => q.project_id) } }),
      this.invoices.issuer(),
    ]);
    const clientOf = new Map(clients.map((c) => [c.id, c]));
    const projectOf = new Map(projects.map((p) => [p.id, p]));
    return quotes.map((quote) => {
      const own = items.filter((item) => item.quote_id === quote.id);
      const split = totalsOf(own, quote.vat_rate, quote.discount);
      const client = clientOf.get(quote.client_id);
      const project = projectOf.get(quote.project_id);
      return {
        ...quote,
        // Allow-list: a client never receives cost_price or margin_pct.
        items: forClient ? own.map(({ id, quote_id, description, section, detail, quantity, unit_price, position }) => ({ id, quote_id, description, section, detail, quantity, unit_price, cost_price: null, margin_pct: null, position })) : own,
        client_name: client?.name ?? 'Unknown client',
        client_missing: !client,
        project_name: project?.name ?? null,
        issuer,
        client_email: client && hasEmail(client.email) ? client.email : null,
        client_phone: client?.phone ?? null,
        job_address: project?.site_address ?? client?.address ?? null,
        subtotal_amount: split.subtotal,
        net_amount: split.net,
        vat_amount: split.vat,
        expired: quote.status === 'Sent' && !!quote.valid_until && quote.valid_until.slice(0, 10) < today(),
      };
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Controller                                                                 */
/* -------------------------------------------------------------------------- */

@Controller('quotes')
export class QuotesController {
  constructor(private readonly quotes: QuotesService) {}

  /** Admin: every quote (`?project_id=` / `?client_id=` narrow it). Client: their own, never a Draft. */
  @Get()
  @Roles('Admin', 'Client')
  list(@CurrentUser() principal: AuthPrincipal, @Query() query: QuoteListQuery) {
    return this.quotes.list(principal, query);
  }

  @Get(':id')
  @Roles('Admin', 'Client')
  findOne(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.quotes.findOne(principal, id);
  }

  @Post()
  @Roles('Admin')
  create(@CurrentUser() principal: AuthPrincipal, @Body() dto: CreateQuoteDto) {
    return this.quotes.create(principal, dto);
  }

  @Put(':id')
  @Roles('Admin')
  update(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string, @Body() dto: UpdateQuoteDto) {
    return this.quotes.update(principal, id, dto);
  }

  @Post(':id/send')
  @Roles('Admin')
  @HttpCode(200)
  send(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.quotes.send(principal, id);
  }

  @Post(':id/withdraw')
  @Roles('Admin')
  @HttpCode(200)
  withdraw(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.quotes.withdraw(principal, id);
  }

  /** The client accepts or declines (with an optional note). */
  @Post(':id/respond')
  @Roles('Client')
  @HttpCode(200)
  respond(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string, @Body() dto: RespondDto) {
    return this.quotes.respond(principal, id, dto);
  }

  @Post(':id/invoice')
  @Roles('Admin')
  @HttpCode(200)
  invoice(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.quotes.createInvoice(principal, id);
  }

  @Delete(':id')
  @Roles('Admin')
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  remove(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string, @Body() dto: PasswordConfirmDto) {
    return this.quotes.remove(principal, id, dto?.password);
  }
}

@Module({
  imports: [NotificationsModule, InvoicesModule],
  controllers: [QuotesController],
  providers: [QuotesService],
  exports: [QuotesService],
})
export class QuotesModule {}
