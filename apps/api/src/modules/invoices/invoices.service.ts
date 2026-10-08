import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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
  MinLength,
  ValidateNested,
} from 'class-validator';

import { AccessService } from '../../common/access/access.service';
import { Invoice, InvoiceItem, InvoiceStatus } from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { ActivityLogService } from '../../core/activity-log.service';
import { ItemInput } from '../../data/invoice-store';
import { DatabaseService } from '../../data/database.service';
import { MAX_AMOUNT, splitGross, sumMoney, totalsOf } from './totals';

/* -------------------------------------------------------------------------- */
/* DTOs                                                                       */
/* -------------------------------------------------------------------------- */

export class InvoiceItemDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString() @MinLength(1, { message: 'Describe each line' }) @MaxLength(300) description!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Quantity must have at most 2 decimal places' })
  @Min(0.01, { message: 'Quantity must be more than zero' })
  @Max(100_000)
  quantity!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Price must have at most 2 decimal places' })
  @Min(0, { message: 'Price cannot be negative' })
  @Max(9_999_999.99)
  unit_price!: number;
}

export class CreateInvoiceDto {
  @IsString() client_id!: string;
  @IsOptional() @IsString() project_id?: string | null;

  /** Net (ex-VAT) lines. The invoice's amount is worked out from them, never sent. */
  @IsArray() @ArrayMinSize(1, { message: 'Add at least one line' }) @ArrayMaxSize(50, { message: 'An invoice can have at most 50 lines' }) @ValidateNested({ each: true }) @Type(() => InvoiceItemDto)
  items!: InvoiceItemDto[];

  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) vat_rate?: number;

  @IsDateString({}, { message: 'Enter a valid due date' })
  due_date!: string;

  @IsOptional()
  @IsIn(['Draft', 'Sent'], { message: 'A new invoice can only be Draft or Sent' })
  status?: 'Draft' | 'Sent';
}

export class UpdateInvoiceDto {
  @IsOptional() @IsString() project_id?: string | null;
  @IsOptional()
  @IsArray() @ArrayMinSize(1, { message: 'Add at least one line' }) @ArrayMaxSize(50, { message: 'An invoice can have at most 50 lines' }) @ValidateNested({ each: true }) @Type(() => InvoiceItemDto)
  items?: InvoiceItemDto[];
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) vat_rate?: number;
  @IsOptional() @IsDateString() due_date?: string;

  /** Paid is not accepted here: recording payment is its own audited action (mark-paid). */
  @IsOptional()
  @IsIn(['Draft', 'Sent', 'Overdue'], { message: 'Use the mark-paid action to record payment' })
  status?: 'Draft' | 'Sent' | 'Overdue';
}

/**
 * Where an invoice may go next. Draft -> Sent -> Overdue; a sent invoice can go
 * back to Draft to be edited; Paid is final and only mark-paid gets there.
 * 'Outstanding' is the legacy name for Sent and is only ever left, never set.
 *
 * Lines and VAT can be edited only while the invoice is a Draft, or in the same
 * request that moves it back to Draft. Once it has been sent, the client may
 * have it, so the numbers do not change under them.
 */
const NEXT: Record<InvoiceStatus, InvoiceStatus[]> = {
  Draft: ['Sent'],
  Sent: ['Draft', 'Overdue'],
  Outstanding: ['Draft', 'Sent', 'Overdue'],
  Overdue: ['Draft', 'Sent'],
  Paid: [],
};

/* -------------------------------------------------------------------------- */
/* View model                                                                 */
/* -------------------------------------------------------------------------- */

export interface InvoiceView extends Invoice {
  items: InvoiceItem[];
  client_name: string;
  project_name: string | null;
  /** The ex-VAT subtotal and the VAT on it; `amount` is their sum, the gross payable. */
  net_amount: number;
  vat_amount: number;
  /** True when unpaid and past its due date, regardless of the stored status. */
  is_overdue: boolean;
  days_overdue: number;
}

const NUMBER_ATTEMPTS = 8;

@Injectable()
export class InvoicesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly access: AccessService,
    private readonly activity: ActivityLogService,
  ) {}

  /** Staff reach here only as Admin (controller). A client sees their own, never Drafts. */
  async list(principal: AuthPrincipal): Promise<InvoiceView[]> {
    const where = this.access.isClient(principal) ? { client_id: principal.id, status: { not: 'Draft' } } : {};
    return this.views(await this.db.invoices.findWhere(where, { orderBy: { created_at: 'desc' } }));
  }

  async findOne(principal: AuthPrincipal, id: string): Promise<InvoiceView> {
    const invoice = await this.db.invoices.findById(id);
    // A client gets the same 404 for someone else's invoice and for their own Draft.
    if (!invoice || (this.access.isClient(principal) && (invoice.client_id !== principal.id || invoice.status === 'Draft'))) {
      throw new NotFoundException('Invoice not found');
    }
    return (await this.views([invoice]))[0]!;
  }

  /** Summary tiles for the portal Invoices screen. Drafts never count for a client. */
  async summary(principal: AuthPrincipal) {
    const invoices = await this.list(principal);
    const outstanding = invoices.filter((i) => i.status === 'Outstanding' || i.status === 'Sent' || i.status === 'Overdue');
    const amounts = (rows: InvoiceView[]) => sumMoney(rows.map((i) => i.amount));
    const nextDue = invoices
      .filter((i) => i.status !== 'Paid' && i.status !== 'Draft')
      .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];

    return {
      paid_total: amounts(invoices.filter((i) => i.status === 'Paid')),
      outstanding_total: amounts(outstanding),
      overdue_total: amounts(invoices.filter((i) => i.is_overdue)),
      counts: {
        total: invoices.length,
        paid: invoices.filter((i) => i.status === 'Paid').length,
        outstanding: outstanding.length,
        overdue: invoices.filter((i) => i.is_overdue).length,
        draft: invoices.filter((i) => i.status === 'Draft').length,
      },
      next_due: nextDue ?? null,
    };
  }

  async create(principal: AuthPrincipal, dto: CreateInvoiceDto): Promise<InvoiceView> {
    const client = await this.db.clients.findById(dto.client_id);
    if (!client) throw new BadRequestException('Client does not exist');
    await this.assertProjectOfClient(dto.project_id, dto.client_id);

    const vat_rate = dto.vat_rate ?? (await this.db.settings()).vat_rate;
    const items = this.lines(dto.items);
    const { gross } = this.totals(items, vat_rate);

    // Two invoices created at once can pick the same next number; the unique
    // index refuses the second, which then looks again. Each failed attempt
    // means another invoice was committed, so this is bounded by concurrency.
    for (let attempt = 1; ; attempt++) {
      try {
        const created = await this.db.invoiceStore.create(
          {
            number: await this.nextNumber(),
            client_id: dto.client_id,
            project_id: dto.project_id ?? null,
            amount: gross,
            vat_rate,
            status: dto.status ?? 'Draft',
            due_date: dto.due_date.slice(0, 10),
            paid_at: null,
            created_at: new Date().toISOString(),
          },
          items,
        );
        await this.activity.record({
          principal,
          action: 'invoice_create',
          targetTable: 'invoices',
          targetId: created.id,
          details: { number: created.number, amount: created.amount, client: client.name },
        });
        return this.findOne(principal, created.id);
      } catch (error) {
        const taken = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
        if (!taken) throw error;
        if (attempt >= NUMBER_ATTEMPTS) throw new ConflictException('Could not reserve an invoice number. Please try again.');
      }
    }
  }

  async update(principal: AuthPrincipal, id: string, dto: UpdateInvoiceDto): Promise<InvoiceView> {
    const invoice = await this.db.invoices.findById(id);
    if (!invoice) throw new NotFoundException('Invoice not found');

    if (invoice.status === 'Paid') {
      throw new BadRequestException(
        'This invoice is marked Paid and can no longer be edited. Raise a credit note or a new invoice instead.',
      );
    }
    if (dto.status && dto.status !== invoice.status && !NEXT[invoice.status].includes(dto.status)) {
      throw new BadRequestException(`A ${invoice.status} invoice cannot be changed to ${dto.status}.`);
    }
    const status = dto.status ?? invoice.status;
    const editsMoney = dto.items !== undefined || dto.vat_rate !== undefined;
    if (editsMoney && status !== 'Draft') {
      throw new BadRequestException('Lines and VAT can only be edited on a Draft. Move the invoice back to Draft first.');
    }
    if (dto.project_id !== undefined) await this.assertProjectOfClient(dto.project_id, invoice.client_id);

    const patch: Partial<Invoice> = { status };
    if (dto.project_id !== undefined) patch.project_id = dto.project_id;
    if (dto.due_date !== undefined) patch.due_date = dto.due_date.slice(0, 10);
    if (dto.vat_rate !== undefined) patch.vat_rate = dto.vat_rate;

    const given = dto.items ? this.lines(dto.items) : undefined;
    if (editsMoney) {
      // Re-total from the new lines, or the existing ones when only VAT changed.
      // An invoice with no lines at all (older than lines) keeps its stored amount.
      const lines = given ?? (await this.itemsOf(id));
      if (lines.length > 0) patch.amount = this.totals(lines, patch.vat_rate ?? invoice.vat_rate).gross;
    }

    const updated = await this.db.invoiceStore.update(id, patch, given);
    if (!updated) throw new BadRequestException('This invoice is marked Paid and can no longer be edited.');

    await this.activity.record({
      principal,
      action: 'invoice_update',
      targetTable: 'invoices',
      targetId: id,
      details: { fields: Object.keys(dto), number: updated.number },
    });
    return this.findOne(principal, id);
  }

  /**
   * PUT /invoices/:id/mark-paid — Admin only, manual, and the ONLY way an
   * invoice ever becomes Paid.
   *
   * There is no payment gateway in this platform and there never will be
   * (PRD section 10, TRD section 13, Architecture section 11). The client pays
   * by the business's own external means and the Admin records it here. Nothing
   * else in this codebase may write `status: 'Paid'` or `paid_at`.
   *
   * The status change and the client's lifetime value are one transaction, and
   * the status change only matches a payable row, so a repeat is refused rather
   * than recorded twice.
   */
  async markPaid(principal: AuthPrincipal, id: string): Promise<InvoiceView> {
    const invoice = await this.db.invoices.findById(id);
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === 'Draft') {
      throw new BadRequestException('A draft invoice cannot be marked paid. Send it to the client first.');
    }

    const paid = await this.db.invoiceStore.markPaid(id, new Date().toISOString());
    if (!paid) throw new BadRequestException('This invoice is already marked as paid.');

    await this.activity.record({
      principal,
      action: 'invoice_mark_paid',
      targetTable: 'invoices',
      targetId: id,
      details: { number: invoice.number, amount: invoice.amount, method: 'Manual (external payment)' },
    });
    return this.findOne(principal, id);
  }

  async remove(principal: AuthPrincipal, id: string): Promise<{ id: string; deleted: true }> {
    const invoice = await this.db.invoices.findById(id);
    if (!invoice) throw new NotFoundException('Invoice not found');

    if (invoice.status === 'Paid') {
      throw new BadRequestException('A paid invoice is a financial record and cannot be deleted.');
    }

    await this.db.invoices.delete(id); // its lines go with it (foreign key cascade)

    await this.activity.record({
      principal,
      action: 'invoice_delete',
      targetTable: 'invoices',
      targetId: id,
      details: { number: invoice.number, amount: invoice.amount },
    });
    return { id, deleted: true };
  }

  /* ------------------------------------------------------------------ */

  private lines(dtos: InvoiceItemDto[]): ItemInput[] {
    return dtos.map(({ description, quantity, unit_price }) => ({ description, quantity, unit_price }));
  }

  private totals(items: ItemInput[], vatRate: number) {
    const totals = totalsOf(items, vatRate);
    if (totals.gross >= MAX_AMOUNT) throw new BadRequestException('That total is too large for one invoice.');
    return totals;
  }

  private itemsOf(invoiceId: string): Promise<InvoiceItem[]> {
    return this.db.invoiceItems.findWhere({ invoice_id: invoiceId }, { orderBy: { position: 'asc' } });
  }

  /** A project may only be invoiced to its own client. */
  private async assertProjectOfClient(projectId: string | null | undefined, clientId: string): Promise<void> {
    if (!projectId) return;
    const project = await this.db.projects.findById(projectId);
    if (!project) throw new BadRequestException('Project does not exist');
    if (project.client_id !== clientId) throw new BadRequestException('That project belongs to a different client');
  }

  /** Invoices with their lines and names, in three queries however many there are. */
  private async views(invoices: Invoice[]): Promise<InvoiceView[]> {
    if (invoices.length === 0) return [];
    const ids = (pick: (i: Invoice) => string | null) => [...new Set(invoices.map(pick).filter((v): v is string => !!v))];
    const [items, clients, projects] = await Promise.all([
      this.db.invoiceItems.findWhere({ invoice_id: { in: ids((i) => i.id) } }, { orderBy: { position: 'asc' } }),
      this.db.clients.findWhere({ id: { in: ids((i) => i.client_id) } }),
      this.db.projects.findWhere({ id: { in: ids((i) => i.project_id) } }),
    ]);
    const clientName = new Map(clients.map((c) => [c.id, c.name]));
    const projectName = new Map(projects.map((p) => [p.id, p.name]));
    return invoices.map((invoice) => {
      const own = items.filter((item) => item.invoice_id === invoice.id);
      const split = own.length > 0 ? totalsOf(own, invoice.vat_rate) : splitGross(invoice.amount, invoice.vat_rate);
      const unpaid = invoice.status !== 'Paid' && invoice.status !== 'Draft';
      // due_date is a timestamp at midnight UTC; the invoice is late after the end of that day.
      const late = Date.now() - new Date(`${invoice.due_date.slice(0, 10)}T23:59:59.999Z`).getTime();
      return {
        ...invoice,
        items: own,
        client_name: clientName.get(invoice.client_id) ?? 'Unknown client',
        project_name: invoice.project_id ? (projectName.get(invoice.project_id) ?? null) : null,
        net_amount: split.net,
        vat_amount: split.vat,
        is_overdue: unpaid && late > 0,
        days_overdue: unpaid && late > 0 ? Math.floor(late / 86_400_000) : 0,
      };
    });
  }

  private async nextNumber(): Promise<string> {
    const prefix = `INV-${new Date().getFullYear()}-`;
    const existing = await this.db.invoices.findWhere({ number: { startsWith: prefix } });
    const highest = existing.reduce((max, { number }) => Math.max(max, Number(number.slice(prefix.length)) || 0), 0);
    return `${prefix}${String(highest + 1).padStart(4, '0')}`;
  }
}
